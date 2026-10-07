import { afterEach, describe, expect, it } from 'vitest';
import { actorFor, cleanupTestData, createTestOrg, prisma } from './helpers';
import {
  createLead, assignLead, updateLead, rescoreLead, markContacted,
  normalizePhone, pickNextSalesperson, buildLeadWhere,
} from '@/services/lead.service';
import { createFollowUp, completeFollowUp, startFollowUpSequence, shouldStopSequence, runDueAutomatedFollowUps, findOverdueFollowUps, renderTemplate } from '@/services/followup.service';
import { recordInboundMessage, sendOutboundMessage, addNote } from '@/services/conversation.service';
import { leadFilterSchema } from '@/lib/validation';

afterEach(async () => {
  await cleanupTestData();
});

describe('Lead creation', () => {
  it('scores a lead at intake and records the opening activity', async () => {
    const { organization, owner } = await createTestOrg();

    const lead = await createLead({
      organizationId: organization.id, name: 'Rahul Sharma', phone: '9810011111',
      location: 'Gurgaon', propertyType: '3BHK', budgetMax: 20_000_000,
      purchaseTimeline: 'IMMEDIATE',
    }, actorFor(owner, 'OWNER'));

    expect(lead.status).toBe('NEW');
    expect(lead.score).toBeGreaterThan(0);
    expect(lead.temperature).toBe('HOT');
    expect(lead.phone).toBe('+919810011111'); // normalized

    const activities = await prisma.activity.findMany({ where: { leadId: lead.id } });
    expect(activities.map((a) => a.type)).toContain('LEAD_CREATED');
  });

  it('deduplicates on externalId so a redelivered webhook cannot double-create', async () => {
    const { organization } = await createTestOrg();
    const payload = {
      organizationId: organization.id, name: 'Duplicate Lead',
      phone: '+919810022222', externalId: 'meta_lead_9001',
    };

    const first = await createLead(payload);
    const second = await createLead(payload);

    expect(second.id).toBe(first.id);
    expect(await prisma.lead.count({ where: { organizationId: organization.id } })).toBe(1);
  });

  it('creates a campaign on demand when a lead names one', async () => {
    const { organization } = await createTestOrg();

    await createLead({
      organizationId: organization.id, name: 'Campaign Lead', phone: '+919810033333',
      campaignName: 'Luxury Gurgaon 3BHK', source: 'META_LEAD_ADS',
    });

    const campaign = await prisma.campaign.findFirst({
      where: { organizationId: organization.id, name: 'Luxury Gurgaon 3BHK' },
    });
    expect(campaign).not.toBeNull();
  });

  it('notifies managers when a hot lead arrives', async () => {
    const { organization } = await createTestOrg();

    const lead = await createLead({
      organizationId: organization.id, name: 'Hot Lead', phone: '+919810044444',
      location: 'Gurgaon', propertyType: '4BHK', budgetMax: 30_000_000,
      purchaseTimeline: 'IMMEDIATE', intent: 'INVESTMENT',
    });
    expect(lead.temperature).toBe('HOT');

    const notifications = await prisma.notification.findMany({
      where: { leadId: lead.id, type: 'NEW_HOT_LEAD' },
    });
    expect(notifications.length).toBeGreaterThan(0);
  });
});

describe('Phone normalization', () => {
  it('normalizes Indian numbers to E.164', () => {
    expect(normalizePhone('9810011111')).toBe('+919810011111');
    expect(normalizePhone('919810011111')).toBe('+919810011111');
    expect(normalizePhone('+91 98100 11111')).toBe('+919810011111');
    expect(normalizePhone('(981) 001-1111')).toBe('+919810011111');
    expect(normalizePhone('+14155550123')).toBe('+14155550123'); // non-Indian preserved
  });
});

describe('Assignment', () => {
  it('assigns a lead and notifies the new owner', async () => {
    const { organization, owner, salesperson } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Assign Me', phone: '+919810055555',
    });

    const updated = await assignLead(actorFor(owner, 'OWNER'), lead.id, salesperson.id);
    expect(updated.assignedToId).toBe(salesperson.id);

    const notification = await prisma.notification.findFirst({
      where: { leadId: lead.id, userId: salesperson.id },
    });
    expect(notification).not.toBeNull();

    const activity = await prisma.activity.findFirst({
      where: { leadId: lead.id, type: 'LEAD_ASSIGNED' },
    });
    expect(activity?.summary).toContain(salesperson.name);
  });

  it('unassigns a lead when given null', async () => {
    const { organization, owner, salesperson } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Unassign Me',
      phone: '+919810066666', assignedToId: salesperson.id,
    });

    const updated = await assignLead(actorFor(owner, 'OWNER'), lead.id, null);
    expect(updated.assignedToId).toBeNull();
  });

  it('round-robins to the salesperson with the fewest open leads', async () => {
    const { organization, salesperson, secondSalesperson } = await createTestOrg();

    // Give the first salesperson two open leads.
    await createLead({ organizationId: organization.id, name: 'A', phone: '+919810077771', assignedToId: salesperson.id });
    await createLead({ organizationId: organization.id, name: 'B', phone: '+919810077772', assignedToId: salesperson.id });

    expect(await pickNextSalesperson(organization.id)).toBe(secondSalesperson.id);
  });
});

describe('Rescoring', () => {
  it('raises the score when qualification data is added and records the change', async () => {
    const { organization, owner } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Rescore Me', phone: '+919810088888',
    });
    expect(lead.score).toBe(0);

    await updateLead(actorFor(owner, 'OWNER'), lead.id, {
      location: 'Gurgaon', propertyType: '3BHK', budgetMax: 20_000_000, purchaseTimeline: 'IMMEDIATE',
    });

    const rescored = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(rescored!.score).toBeGreaterThan(0);
    expect(rescored!.temperature).toBe('HOT');

    const change = await prisma.activity.findFirst({
      where: { leadId: lead.id, type: 'SCORE_CHANGED' },
    });
    expect(change).not.toBeNull();
  });

  it('counts engagement signals from the lead\'s replies', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Engaged Lead', phone: '+919810099999',
      location: 'Gurgaon',
    });
    const before = lead.score;

    await recordInboundMessage({
      leadId: lead.id,
      body: 'What is the price? I would like to book a site visit.',
    });

    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after!.score).toBeGreaterThan(before);
  });
});

describe('Status transitions', () => {
  it('records a recovery when a dormant lead starts moving again', async () => {
    const { organization, owner } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Recovered Lead', phone: '+919810010101',
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'DORMANT' } });

    await updateLead(actorFor(owner, 'OWNER'), lead.id, { status: 'QUALIFIED' });

    const recovery = await prisma.activity.findFirst({
      where: { leadId: lead.id, type: 'LEAD_RECOVERED' },
    });
    expect(recovery).not.toBeNull();
  });

  it('sets first contact only once, so response time stays accurate', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Contact Me', phone: '+919810011011',
    });

    const first = await markContacted(lead.id, new Date('2026-09-01T10:00:00Z'));
    expect(first.status).toBe('CONTACTED');

    const second = await markContacted(lead.id, new Date('2026-09-02T10:00:00Z'));
    expect(second.firstContactedAt?.toISOString()).toBe(first.firstContactedAt?.toISOString());
    expect(second.lastContactedAt?.toISOString()).not.toBe(first.lastContactedAt?.toISOString());
  });
});

describe('Filter construction', () => {
  it('always scopes queries to the actor\'s organization', () => {
    const where = buildLeadWhere(
      { id: 'u1', role: 'OWNER', organizationId: 'org-1', name: 'Owner' },
      leadFilterSchema.parse({ status: 'NEW' }),
    );
    expect(where.organizationId).toBe('org-1');
    expect(where.status).toBe('NEW');
    expect(where.assignedToId).toBeUndefined();
  });

  it('restricts a salesperson to their own leads', () => {
    const where = buildLeadWhere(
      { id: 'u2', role: 'SALESPERSON', organizationId: 'org-1', name: 'Sales' },
      leadFilterSchema.parse({}),
    );
    expect(where.assignedToId).toBe('u2');
  });

  it('translates the UNASSIGNED filter into a null owner', () => {
    const where = buildLeadWhere(
      { id: 'u1', role: 'OWNER', organizationId: 'org-1', name: 'Owner' },
      leadFilterSchema.parse({ assignedToId: 'UNASSIGNED' }),
    );
    expect(where.assignedToId).toBeNull();
  });
});

describe('Notes and messages', () => {
  it('keeps internal notes out of the outbound channel', async () => {
    const { organization, owner } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Note Lead', phone: '+919810012121',
    });

    await addNote(lead.id, 'Customer prefers an evening call.', { id: owner.id, name: owner.name });

    const message = await prisma.message.findFirst({ where: { conversation: { leadId: lead.id } } });
    expect(message?.messageType).toBe('NOTE');

    // A note must not count as contacting the lead.
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.firstContactedAt).toBeNull();
  });

  it('marks the lead contacted when a message is delivered', async () => {
    const { organization, owner } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Message Lead', phone: '+919810013131',
    });

    const result = await sendOutboundMessage({
      leadId: lead.id, body: 'Hello, following up on your enquiry.',
      sender: 'SALESPERSON', senderName: owner.name, senderId: owner.id,
    });

    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    if (result.delivered) {
      expect(after?.firstContactedAt).not.toBeNull();
      expect(after?.status).toBe('CONTACTED');
    } else {
      // A simulated delivery failure must be recorded, not silently swallowed.
      expect(result.failureReason).toBeTruthy();
      const message = await prisma.message.findFirst({ where: { conversation: { leadId: lead.id } } });
      expect(message?.deliveryStatus).toBe('FAILED');
    }
  });
});

describe('Follow-up engine', () => {
  it('creates a follow-up and syncs the lead\'s next follow-up time', async () => {
    const { organization, owner, salesperson } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Follow Up Lead',
      phone: '+919810014141', assignedToId: salesperson.id,
    });

    const scheduledFor = new Date(Date.now() + 3_600_000);
    const followUp = await createFollowUp(actorFor(owner, 'OWNER'), lead.id, {
      type: 'CALL', scheduledFor, notes: 'Confirm budget.',
    });

    expect(followUp.assignedToId).toBe(salesperson.id); // inherits the lead owner

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated?.nextFollowUpAt?.toISOString()).toBe(scheduledFor.toISOString());
  });

  it('completes a follow-up, marks the lead contacted and clears the next time', async () => {
    const { organization, owner } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Complete Me', phone: '+919810015151',
    });
    const followUp = await createFollowUp(actorFor(owner, 'OWNER'), lead.id, {
      type: 'CALL', scheduledFor: new Date(Date.now() + 3_600_000),
    });

    const completed = await completeFollowUp(actorFor(owner, 'OWNER'), followUp.id, {
      status: 'COMPLETED', notes: 'Spoke to the customer.',
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).not.toBeNull();

    const lead2 = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(lead2?.nextFollowUpAt).toBeNull();
    expect(lead2?.status).toBe('CONTACTED');
  });

  it('prevents a salesperson from closing a colleague\'s follow-up', async () => {
    const { organization, owner, salesperson, secondSalesperson } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Not Yours',
      phone: '+919810016161', assignedToId: salesperson.id,
    });
    const followUp = await createFollowUp(actorFor(owner, 'OWNER'), lead.id, {
      type: 'CALL', scheduledFor: new Date(Date.now() + 3_600_000),
    });

    await expect(completeFollowUp(actorFor(secondSalesperson, 'SALESPERSON'), followUp.id, {
      status: 'COMPLETED',
    })).rejects.toThrow(/another salesperson/i);
  });

  it('detects overdue follow-ups', async () => {
    const { organization, owner, salesperson } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Overdue Lead',
      phone: '+919810017171', assignedToId: salesperson.id,
    });
    await createFollowUp(actorFor(owner, 'OWNER'), lead.id, {
      type: 'CALL', scheduledFor: new Date(Date.now() - 7_200_000),
    });

    const overdue = await findOverdueFollowUps(organization.id);
    expect(overdue).toHaveLength(1);
    expect(overdue[0]!.lead.id).toBe(lead.id);
  });

  it('starts the configured sequence once and not twice', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Sequence Lead', phone: '+919810018181',
    });

    const created = await startFollowUpSequence(lead.id);
    expect(created).toBeGreaterThan(0);

    const again = await startFollowUpSequence(lead.id);
    expect(again).toBe(0); // already running
  });

  it('stops the sequence when the lead replies', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Replying Lead', phone: '+919810019191',
    });
    await startFollowUpSequence(lead.id);

    expect((await shouldStopSequence(lead.id)).stop).toBe(false);

    await recordInboundMessage({ leadId: lead.id, body: 'Yes, I am interested.' });

    const stop = await shouldStopSequence(lead.id);
    expect(stop.stop).toBe(true);
    expect(stop.reason).toMatch(/replied/i);

    // Pending automated steps must be cancelled immediately.
    const pending = await prisma.followUp.count({
      where: { leadId: lead.id, automated: true, status: 'PENDING' },
    });
    expect(pending).toBe(0);
  });

  it('executes due automated steps and skips leads that should stop', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Due Lead', phone: '+919810020202',
    });
    await startFollowUpSequence(lead.id);

    const result = await runDueAutomatedFollowUps(10);
    // The T+0 step is due immediately.
    expect(result.sent + result.failed).toBeGreaterThan(0);
  });

  it('renders message templates with lead values', () => {
    expect(renderTemplate('Hi {{name}}, this is {{organization}}.', {
      name: 'Rahul', organization: 'Demo Realty',
    })).toBe('Hi Rahul, this is Demo Realty.');

    // An unknown placeholder becomes empty rather than leaking the token.
    expect(renderTemplate('Hi {{unknown}}.', {})).toBe('Hi .');
  });
});

describe('Sequence start guards', () => {
  it('does not start a cadence for a lead that already replied', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Already Replied', phone: '+919810021212',
    });

    await recordInboundMessage({ leadId: lead.id, body: 'I am interested, please call.' });

    // A NO_RESPONSE rule firing later must not re-message a lead who engaged.
    expect(await startFollowUpSequence(lead.id)).toBe(0);
    expect(await prisma.followUp.count({ where: { leadId: lead.id, automated: true } })).toBe(0);
  });

  it('does not start a cadence for a won lead', async () => {
    const { organization } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Closed Won', phone: '+919810021213',
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'WON' } });

    expect(await startFollowUpSequence(lead.id)).toBe(0);
  });
});
