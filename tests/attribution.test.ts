import { afterEach, describe, expect, it } from 'vitest';
import { actorFor, cleanupTestData, createTestOrg, prisma } from './helpers';
import { createLead, updateLead, assignLead } from '@/services/lead.service';
import { ingestLead, ingestInboundMessage } from '@/services/ingestion.service';
import { recordInboundMessage } from '@/services/conversation.service';
import { bookAppointment } from '@/services/appointment.service';
import { recordConversion } from '@/services/conversion.service';
import {
  recordFirstTouch, recordLastTouch, sourceTypeFor, sourceLabel,
  parseUtmFromUrl, sourceFromUtm, summariseAttribution, buildJourney,
} from '@/services/attribution.service';
import { MockMetaLeadProvider } from '@/providers/lead-source/mock';
import { createLeadSchema } from '@/lib/validation';

afterEach(async () => {
  await cleanupTestData();
});

describe('Attribution capture', () => {
  it('records a first-touch row for every new lead', async () => {
    const { organization } = await createTestOrg();

    const lead = await createLead({
      organizationId: organization.id, name: 'Attributed Lead',
      phone: '+919810070001', source: 'GOOGLE_ADS', campaignName: 'New Launch Search',
      attribution: {
        adSetName: 'Exact match | Gurgaon',
        utmSource: 'google', utmMedium: 'cpc', utmTerm: '3bhk in gurgaon',
        landingPage: 'https://lp.example.com/gurgaon',
      },
    });

    const attribution = await prisma.leadAttribution.findUnique({ where: { leadId: lead.id } });

    expect(attribution).not.toBeNull();
    expect(attribution!.sourceType).toBe('PAID_SEARCH');
    expect(attribution!.campaignName).toBe('New Launch Search');
    expect(attribution!.adSetName).toBe('Exact match | Gurgaon');
    expect(attribution!.utmTerm).toBe('3bhk in gurgaon');
    expect(attribution!.landingPage).toBe('https://lp.example.com/gurgaon');
  });

  it('captures the full ad hierarchy from an ingested Meta lead', async () => {
    const { organization } = await createTestOrg();
    const external = await new MockMetaLeadProvider().fetchLead('meta_attr_1');

    const lead = await ingestLead(organization.id, external, 'META_LEAD_ADS');
    const attribution = await prisma.leadAttribution.findUnique({ where: { leadId: lead.id } });

    expect(attribution!.sourceType).toBe('PAID_SOCIAL');
    expect(attribution!.campaignName).toBeTruthy();
    expect(attribution!.adSetName).toBeTruthy();
    expect(attribution!.adId).toBeTruthy();
    expect(attribution!.formName).toBeTruthy();
    expect(attribution!.utmSource).toBe('facebook');
    expect(attribution!.utmMedium).toBe('paid_social');
  });

  it('records attribution for a lead created from an inbound WhatsApp message', async () => {
    const { organization } = await createTestOrg();

    const lead = await ingestInboundMessage(organization.id, {
      from: '919810070002', body: 'Hi, interested in a 3BHK.', senderName: 'Priya',
    });

    const attribution = await prisma.leadAttribution.findUnique({ where: { leadId: lead.id } });
    expect(lead.source).toBe('WHATSAPP');
    expect(attribution!.sourceType).toBe('MESSAGING');
  });

  it('derives the channel category from the source', () => {
    expect(sourceTypeFor('META_LEAD_ADS')).toBe('PAID_SOCIAL');
    expect(sourceTypeFor('GOOGLE_ADS')).toBe('PAID_SEARCH');
    expect(sourceTypeFor('ORGANIC')).toBe('ORGANIC');
    expect(sourceTypeFor('REFERRAL')).toBe('REFERRAL');
    expect(sourceTypeFor('WALK_IN')).toBe('OFFLINE');
    expect(sourceTypeFor('NONSENSE')).toBe('UNKNOWN');
  });
});

/**
 * The guarantee the whole feature rests on: a lead's origin survives everything
 * that happens to it afterwards.
 */
describe('First-touch attribution is never overwritten', () => {
  it('keeps the Meta origin after the lead converses on WhatsApp', async () => {
    const { organization } = await createTestOrg();

    const lead = await ingestLead(organization.id, {
      externalId: 'meta_durable_1', name: 'Rahul Sharma', phone: '+919810071001',
      campaignName: 'Gurgaon 3BHK September', createdAt: new Date(),
      attribution: {
        sourceType: 'PAID_SOCIAL', campaignName: 'Gurgaon 3BHK September',
        adName: '3BHK Family Creative', adSetName: 'HNI | Gurgaon | 35-55',
      },
    }, 'META_LEAD_ADS');

    // The lead now arrives on WhatsApp — the same person, a later touch.
    await ingestInboundMessage(organization.id, {
      from: '+919810071001', body: 'Yes, still interested.',
    });

    const after = await prisma.lead.findUnique({
      where: { id: lead.id }, include: { attribution: true },
    });

    expect(after!.source).toBe('META_LEAD_ADS');
    expect(after!.attribution!.campaignName).toBe('Gurgaon 3BHK September');
    expect(after!.attribution!.adName).toBe('3BHK Family Creative');
    expect(after!.attribution!.adSetName).toBe('HNI | Gurgaon | 35-55');

    // ...but the last touch reflects the new channel.
    expect(after!.attribution!.lastTouchSource).toBe('WHATSAPP');

    // And no duplicate lead was created for the same phone number.
    expect(await prisma.lead.count({ where: { organizationId: organization.id } })).toBe(1);
  });

  it('survives the entire funnel to conversion', async () => {
    const { organization, owner, salesperson } = await createTestOrg();
    const actor = actorFor(owner, 'OWNER');

    const lead = await ingestLead(organization.id, {
      externalId: 'meta_durable_2', name: 'Funnel Lead', phone: '+919810071002',
      campaignName: 'Golf Course Road', createdAt: new Date(),
      attribution: { campaignName: 'Golf Course Road', adName: 'Golf View Carousel' },
    }, 'META_LEAD_ADS');

    await recordInboundMessage({ leadId: lead.id, body: 'Looking for a 3BHK, 2 cr, immediately.' });
    await assignLead(actor, lead.id, salesperson.id);
    await updateLead(actor, lead.id, { status: 'QUALIFIED', location: 'Gurgaon' });
    await bookAppointment(actor, lead.id, { scheduledFor: new Date(Date.now() + 86_400_000) });
    await recordConversion(actor, lead.id, { revenue: 19_500_000 });

    const after = await prisma.lead.findUnique({
      where: { id: lead.id }, include: { attribution: true },
    });

    expect(after!.status).toBe('WON');
    expect(after!.source).toBe('META_LEAD_ADS');
    expect(after!.attribution!.campaignName).toBe('Golf Course Road');
    expect(after!.attribution!.adName).toBe('Golf View Carousel');
  });

  it('refuses to rewrite an existing first-touch record', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Origin Lead', phone: '+919810071003',
      source: 'META_LEAD_ADS', attribution: { campaignName: 'Original Campaign' },
    });

    // A second call — a retried ingestion, or a redelivered webhook.
    await recordFirstTouch(lead.id, 'GOOGLE_ADS', { campaignName: 'Wrong Campaign' });

    const attribution = await prisma.leadAttribution.findUnique({ where: { leadId: lead.id } });
    expect(attribution!.campaignName).toBe('Original Campaign');
    expect(attribution!.sourceType).toBe('PAID_SOCIAL');
  });

  it('moves only the last-touch fields when a later touch is recorded', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Touch Lead', phone: '+919810071004',
      source: 'GOOGLE_ADS', attribution: { campaignName: 'Search Campaign', utmTerm: 'gurgaon flats' },
    });

    await recordLastTouch(lead.id, 'REFERRAL', 'Channel Partner Referrals');

    const attribution = await prisma.leadAttribution.findUnique({ where: { leadId: lead.id } });
    expect(attribution!.campaignName).toBe('Search Campaign');
    expect(attribution!.utmTerm).toBe('gurgaon flats');
    expect(attribution!.lastTouchSource).toBe('REFERRAL');
    expect(attribution!.lastTouchCampaign).toBe('Channel Partner Referrals');
  });

  it('does not change the source when a deduplicated lead is re-ingested', async () => {
    const { organization } = await createTestOrg();
    const payload = {
      externalId: 'meta_dedupe_1', name: 'Dup Lead', phone: '+919810071005',
      campaignName: 'First Campaign', createdAt: new Date(),
    };

    const first = await ingestLead(organization.id, payload, 'META_LEAD_ADS');
    const second = await ingestLead(organization.id, { ...payload, campaignName: 'Second Campaign' }, 'GOOGLE_ADS');

    expect(second.id).toBe(first.id);
    const attribution = await prisma.leadAttribution.findUnique({ where: { leadId: first.id } });
    expect(attribution!.campaignName).toBe('First Campaign');

    const lead = await prisma.lead.findUnique({ where: { id: first.id } });
    expect(lead!.source).toBe('META_LEAD_ADS');
  });
});

describe('Manual lead source selection', () => {
  it('accepts each supported manual source', async () => {
    const { organization } = await createTestOrg();

    for (const [index, source] of ['WALK_IN', 'REFERRAL', 'ORGANIC', 'WEBSITE'].entries()) {
      const lead = await createLead({
        organizationId: organization.id, name: `Manual ${source}`,
        phone: `+91981007200${index}`, source,
      });
      const attribution = await prisma.leadAttribution.findUnique({ where: { leadId: lead.id } });
      expect(lead.source).toBe(source);
      expect(attribution!.sourceType).toBe(sourceTypeFor(source));
    }
  });

  it('stores a custom label when the source is OTHER', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Hoarding Lead',
      phone: '+919810072010', source: 'OTHER', sourceDetail: 'Hoarding at Sector 54',
    });

    expect(lead.sourceDetail).toBe('Hoarding at Sector 54');
    expect(sourceLabel(lead.source, lead.sourceDetail)).toBe('Hoarding at Sector 54');
  });

  it('requires a custom label when OTHER is chosen', () => {
    const base = { name: 'Some Lead', phone: '+919810072011' };
    expect(createLeadSchema.safeParse({ ...base, source: 'OTHER' }).success).toBe(false);
    expect(createLeadSchema.safeParse({ ...base, source: 'OTHER', sourceDetail: 'Hoarding' }).success).toBe(true);
    // Other sources need no label.
    expect(createLeadSchema.safeParse({ ...base, source: 'WALK_IN' }).success).toBe(true);
  });

  it('does not require campaign or ad fields for manual sources', () => {
    const result = createLeadSchema.safeParse({
      name: 'Walk In Lead', phone: '+919810072012', source: 'WALK_IN',
    });
    expect(result.success).toBe(true);
  });
});

describe('UTM handling', () => {
  it('parses tracking parameters out of a landing-page URL', () => {
    const parsed = parseUtmFromUrl(
      'https://lp.example.com/gurgaon-3bhk?utm_source=google&utm_medium=cpc&utm_campaign=sep&utm_term=3bhk',
    );
    expect(parsed.landingPage).toBe('https://lp.example.com/gurgaon-3bhk');
    expect(parsed.utmSource).toBe('google');
    expect(parsed.utmMedium).toBe('cpc');
    expect(parsed.utmCampaign).toBe('sep');
    expect(parsed.utmTerm).toBe('3bhk');
  });

  it('returns nothing for a malformed URL rather than throwing', () => {
    expect(parseUtmFromUrl('not a url')).toEqual({});
  });

  it('infers a source from UTM parameters', () => {
    expect(sourceFromUtm('facebook', 'paid_social')).toBe('META_LEAD_ADS');
    expect(sourceFromUtm('google', 'cpc')).toBe('GOOGLE_ADS');
    expect(sourceFromUtm('google', 'organic')).toBe('ORGANIC');
    expect(sourceFromUtm(null, 'referral')).toBe('REFERRAL');
    expect(sourceFromUtm('mystery', null)).toBeNull();
  });
});

describe('Attribution presentation', () => {
  it('falls back to the lead record when no attribution row exists', () => {
    const summary = summariseAttribution({
      source: 'WEBSITE', sourceDetail: null, adName: 'Legacy ad',
      createdAt: new Date('2026-09-01T10:00:00Z'),
      campaign: { name: 'Legacy Campaign' }, attribution: null,
    });

    expect(summary.sourceLabel).toBe('Website');
    expect(summary.campaignName).toBe('Legacy Campaign');
    expect(summary.adName).toBe('Legacy ad');
    expect(summary.firstTouchAt.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });

  it('builds a journey that marks reached and unreached steps', () => {
    const steps = buildJourney({
      source: 'META_LEAD_ADS', sourceDetail: null,
      createdAt: new Date('2026-09-01T10:00:00Z'),
      firstContactedAt: new Date('2026-09-01T10:05:00Z'),
      aiConfidence: 0.9, assignedToId: 'user-1', status: 'CONTACTED',
      attribution: { formName: 'Gurgaon 3BHK Form', campaignName: 'Sep Campaign', firstTouchAt: new Date('2026-09-01T10:00:00Z') },
      conversations: [{ channel: 'WHATSAPP', messages: [{ sender: 'AI', createdAt: new Date('2026-09-01T10:01:00Z') }] }],
      appointments: [], conversions: [], activities: [],
    });

    const byKey = Object.fromEntries(steps.map((step) => [step.key, step]));
    expect(byKey.source!.label).toBe('Meta Ads');
    expect(byKey.source!.detail).toBe('Sep Campaign');
    expect(byKey.qualification!.reached).toBe(true);
    expect(byKey.salesperson!.reached).toBe(true);
    expect(byKey.appointment!.reached).toBe(false);
    expect(byKey.conversion!.reached).toBe(false);
  });
});
