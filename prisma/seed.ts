/**
 * Demo seed: builds "Demo Realty" — a complete, realistic organization that
 * demonstrates every part of the product with no external services.
 *
 * Randomness is seeded, so repeated runs produce the same demo.
 * Run with: npm run db:seed   (or `npm run db:reset` for a clean rebuild)
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { scoreLead, deriveSignals, DEFAULT_SCORING_CONFIG } from '../src/services/scoring.service';
import {
  DEFAULT_FOLLOW_UP_SEQUENCE, DEFAULT_QUALIFICATION_QUESTIONS,
  DEFAULT_SCORING_RULES, DEFAULT_HOT_THRESHOLD, DEFAULT_WARM_THRESHOLD,
} from '../src/config/defaults';
import {
  CONVERSATION_SCRIPTS, DEMO_AUTOMATION_RULES, DEMO_CAMPAIGNS, DEMO_KNOWLEDGE, DEMO_ORG,
  DEMO_SOURCE_MIX, DEMO_USERS, FIRST_NAMES, GOOGLE_KEYWORDS, LANDING_PAGES, LAST_NAMES,
  LOCATIONS, META_AD_SETS, META_CREATIVES, META_FORMS, PROPERTY_TYPES, REFERRAL_SOURCES,
  type ScriptName,
} from './seed-data';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo123';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Deterministic PRNG (mulberry32) so the demo is reproducible.
let seed = 20260917;
function random(): number {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
const int = (min: number, max: number): number => Math.floor(min + random() * (max - min + 1));
const chance = (probability: number): boolean => random() < probability;

/**
 * Lead archetypes. Each produces a coherent set of attributes, conversation,
 * follow-ups and outcome, so the dashboard tells a believable story.
 */
interface Archetype {
  weight: number;
  status: string;
  script: ScriptName;
  contacted: boolean;
  /** Hours since the lead arrived. */
  ageHours: [number, number];
  /** Hours since the last interaction; large values create dormant/at-risk leads. */
  inactiveHours: [number, number];
  assigned: boolean;
  qualified: boolean;
  overdueFollowUp?: boolean;
  pendingFollowUp?: boolean;
  appointment?: boolean;
  converted?: boolean;
  handoff?: boolean;
}

const ARCHETYPES: Archetype[] = [
  // Freshly arrived, nobody has touched them yet -> UNCONTACTED alerts.
  { weight: 7, status: 'NEW', script: 'neverContacted', contacted: false, ageHours: [1, 10], inactiveHours: [1, 10], assigned: true, qualified: false },
  // Arrived with no owner at all -> UNASSIGNED alerts.
  { weight: 4, status: 'NEW', script: 'neverContacted', contacted: false, ageHours: [2, 26], inactiveHours: [2, 26], assigned: false, qualified: false },
  // Engaged hot buyers currently being worked.
  { weight: 6, status: 'QUALIFIED', script: 'hotBuyer', contacted: true, ageHours: [4, 60], inactiveHours: [1, 12], assigned: true, qualified: true, pendingFollowUp: true },
  // Hot, qualified, but nobody has followed up -> OVERDUE.
  { weight: 5, status: 'FOLLOW_UP', script: 'hotBuyer', contacted: true, ageHours: [30, 140], inactiveHours: [20, 70], assigned: true, qualified: true, overdueFollowUp: true },
  // High score, gone quiet -> HIGH_INTENT_INACTIVE.
  { weight: 4, status: 'FOLLOW_UP', script: 'hotBuyer', contacted: true, ageHours: [80, 220], inactiveHours: [50, 120], assigned: true, qualified: true, overdueFollowUp: true },
  // Investors in mid-funnel.
  { weight: 6, status: 'CONTACTED', script: 'investor', contacted: true, ageHours: [10, 90], inactiveHours: [3, 30], assigned: true, qualified: true, pendingFollowUp: true },
  // Price shoppers -> AI handoff to a human.
  { weight: 4, status: 'CONTACTED', script: 'priceShopper', contacted: true, ageHours: [5, 70], inactiveHours: [2, 24], assigned: true, qualified: false, handoff: true, pendingFollowUp: true },
  // Casual browsers, low intent.
  { weight: 6, status: 'CONTACTED', script: 'browser', contacted: true, ageHours: [20, 200], inactiveHours: [10, 60], assigned: true, qualified: true, pendingFollowUp: true },
  // Never replied to the automated sequence -> going dormant.
  { weight: 6, status: 'DORMANT', script: 'silent', contacted: true, ageHours: [120, 400], inactiveHours: [80, 300], assigned: true, qualified: false },
  // Site visits booked.
  { weight: 5, status: 'APPOINTMENT', script: 'hotBuyer', contacted: true, ageHours: [24, 180], inactiveHours: [1, 20], assigned: true, qualified: true, appointment: true },
  // Closed business.
  { weight: 5, status: 'WON', script: 'hotBuyer', contacted: true, ageHours: [200, 800], inactiveHours: [10, 120], assigned: true, qualified: true, appointment: true, converted: true },
  // Lost.
  { weight: 4, status: 'LOST', script: 'browser', contacted: true, ageHours: [200, 900], inactiveHours: [100, 500], assigned: true, qualified: true },
];

const LOST_REASONS = [
  'Budget did not match available inventory.',
  'Chose a competing project.',
  'Postponed the purchase decision.',
  'Looking in a location we do not operate in.',
  'Could not be reached after repeated attempts.',
];

function weightedArchetype(): Archetype {
  const total = ARCHETYPES.reduce((sum, a) => sum + a.weight, 0);
  let roll = random() * total;
  for (const archetype of ARCHETYPES) {
    roll -= archetype.weight;
    if (roll <= 0) return archetype;
  }
  return ARCHETYPES[0]!;
}

async function main() {
  console.log('Seeding demo organization...');

  // Idempotent: wipe and rebuild the demo org only. Other orgs are untouched.
  const existing = await prisma.organization.findUnique({ where: { slug: DEMO_ORG.slug } });
  if (existing) {
    await prisma.organization.delete({ where: { id: existing.id } });
    console.log('  Removed the previous demo organization.');
  }

  const organization = await prisma.organization.create({
    data: { ...DEMO_ORG, isDemo: true },
  });

  // --- Users ---------------------------------------------------------------
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = await Promise.all(DEMO_USERS.map((user) =>
    prisma.user.create({
      data: { ...user, organizationId: organization.id, passwordHash },
    }),
  ));
  const salespeople = users.filter((user) => user.role === 'SALESPERSON');
  console.log(`  Created ${users.length} users.`);

  // --- Configuration -------------------------------------------------------
  await prisma.scoringConfig.create({
    data: {
      organizationId: organization.id,
      rules: JSON.stringify(DEFAULT_SCORING_RULES),
      hotThreshold: DEFAULT_HOT_THRESHOLD,
      warmThreshold: DEFAULT_WARM_THRESHOLD,
    },
  });

  await prisma.qualificationQuestion.createMany({
    data: DEFAULT_QUALIFICATION_QUESTIONS.map((question) => ({
      ...question, organizationId: organization.id,
    })),
  });

  await prisma.followUpStep.createMany({
    data: DEFAULT_FOLLOW_UP_SEQUENCE.map((step) => ({ ...step, organizationId: organization.id })),
  });

  await prisma.knowledgeEntry.createMany({
    data: DEMO_KNOWLEDGE.map((entry) => ({ ...entry, organizationId: organization.id })),
  });

  await prisma.automationRule.createMany({
    data: DEMO_AUTOMATION_RULES.map((rule) => ({
      organizationId: organization.id,
      name: rule.name,
      trigger: rule.trigger,
      conditions: JSON.stringify(rule.conditions),
      actions: JSON.stringify(rule.actions),
      runCount: int(3, 40),
      lastRunAt: new Date(Date.now() - int(1, 48) * HOUR),
    })),
  });

  await prisma.integrationSetting.createMany({
    data: [
      { organizationId: organization.id, provider: 'META_LEAD_ADS', isEnabled: false, secretRef: 'META_PAGE_ACCESS_TOKEN', config: JSON.stringify({ mode: 'mock' }) },
      { organizationId: organization.id, provider: 'WHATSAPP', isEnabled: false, secretRef: 'WHATSAPP_ACCESS_TOKEN', config: JSON.stringify({ mode: 'mock' }) },
      { organizationId: organization.id, provider: 'OPENAI', isEnabled: false, secretRef: 'OPENAI_API_KEY', config: JSON.stringify({ mode: 'mock' }) },
    ],
  });

  const campaigns = await Promise.all(DEMO_CAMPAIGNS.map((campaign) =>
    prisma.campaign.create({ data: { ...campaign, organizationId: organization.id } }),
  ));
  console.log(`  Created ${campaigns.length} campaigns and organization configuration.`);

  // --- Leads ---------------------------------------------------------------
  const LEAD_COUNT = 64;
  let created = 0;

  for (let index = 0; index < LEAD_COUNT; index += 1) {
    const archetype = weightedArchetype();
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const createdAt = new Date(Date.now() - int(...archetype.ageHours) * HOUR);
    const lastActivityAt = new Date(Math.min(
      Date.now() - int(...archetype.inactiveHours) * HOUR,
      Date.now(),
    ));
    const acquisition = pickSource();
    // Pick the campaign name ONCE — calling pick() inside find() would re-roll
    // on every comparison and match only by coincidence.
    const campaignName = acquisition.campaigns.length ? pick(acquisition.campaigns) : null;
    const campaign = campaignName
      ? campaigns.find((row) => row.name === campaignName) ?? null
      : null;
    const owner = archetype.assigned ? pick(salespeople) : null;

    const isHotProfile = archetype.script === 'hotBuyer';
    const isInvestor = archetype.script === 'investor';

    const attributes = archetype.qualified
      ? {
          location: isHotProfile ? pick(LOCATIONS.slice(0, 6)) : pick(LOCATIONS),
          propertyType: isHotProfile ? pick(['3BHK', '4BHK', 'VILLA']) : pick(PROPERTY_TYPES),
          budgetMin: null as number | null,
          budgetMax: isHotProfile ? int(15, 40) * 5_000_000 : int(60, 180) * 100_000,
          purchaseTimeline: isHotProfile
            ? pick(['IMMEDIATE', '1_3_MONTHS'])
            : pick(['1_3_MONTHS', '3_6_MONTHS', '6_12_MONTHS', 'EXPLORING']),
          intent: isInvestor ? 'INVESTMENT' : pick(['END_USE', 'INVESTMENT', 'UNKNOWN']),
        }
      : {
          location: null, propertyType: null, budgetMin: null, budgetMax: null,
          purchaseTimeline: null, intent: null,
        };

    const firstContactedAt = archetype.contacted
      ? new Date(createdAt.getTime() + int(3, 400) * MINUTE)
      : null;

    const lead = await prisma.lead.create({
      data: {
        organizationId: organization.id,
        name,
        phone: `+9198${String(int(10_000_000, 99_999_999))}`,
        email: chance(0.8) ? `${name.toLowerCase().replace(/\s+/g, '.')}@example.com` : null,
        source: acquisition.source,
        sourceDetail: null,
        campaignId: campaign?.id ?? null,
        adName: acquisition.source === 'META_LEAD_ADS' ? pick(META_CREATIVES) : null,
        externalId: `demo_${index}_${int(100000, 999999)}`,
        status: archetype.status,
        assignedToId: owner?.id ?? null,
        createdAt,
        lastActivityAt,
        firstContactedAt,
        lastContactedAt: firstContactedAt ? lastActivityAt : null,
        needsHumanHandoff: archetype.handoff ?? false,
        handoffReason: archetype.handoff
          ? 'Lead raised a commercial or escalation topic that must be handled by a person.'
          : null,
        lostReason: archetype.status === 'LOST' ? pick(LOST_REASONS) : null,
        aiSummary: archetype.qualified ? buildSummary(name, attributes) : null,
        aiConfidence: archetype.qualified ? Number((0.62 + random() * 0.33).toFixed(2)) : (archetype.contacted ? 0.35 : null),
        ...attributes,
      },
    });

    await prisma.leadAttribution.create({
      data: { leadId: lead.id, ...buildAttribution(acquisition.source, campaign?.name ?? null, createdAt) },
    });

    // --- Conversation ------------------------------------------------------
    const script = CONVERSATION_SCRIPTS[archetype.script];
    let messages: { sender: string; body: string }[] = [];

    if (script.length) {
      const conversation = await prisma.conversation.create({
        data: {
          leadId: lead.id,
          channel: 'WHATSAPP',
          status: archetype.handoff ? 'HANDED_OFF' : archetype.script === 'silent' ? 'AWAITING_REPLY' : 'ACTIVE',
          createdAt,
        },
      });

      const step = Math.max(6 * MINUTE, (lastActivityAt.getTime() - createdAt.getTime()) / (script.length + 1));
      messages = script.map((message) => ({
        sender: message.sender,
        body: message.body
          .replace(/\{\{name\}\}/g, name.split(' ')[0]!)
          .replace(/\{\{owner\}\}/g, owner?.name ?? 'our consultant'),
      }));

      await prisma.message.createMany({
        data: messages.map((message, messageIndex) => ({
          conversationId: conversation.id,
          sender: message.sender,
          senderName: message.sender === 'SALESPERSON' ? owner?.name ?? null : message.sender === 'AI' ? 'Qualification Assistant' : null,
          body: message.body,
          aiGenerated: message.sender === 'AI',
          deliveryStatus: message.sender === 'LEAD' ? 'DELIVERED' : 'DELIVERED',
          createdAt: new Date(createdAt.getTime() + (messageIndex + 1) * step),
        })),
      });
    }

    // --- Score from the same engine the app uses ---------------------------
    const scored = scoreLead(
      { ...attributes, signals: deriveSignals(messages) },
      DEFAULT_SCORING_CONFIG,
    );
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        score: scored.score,
        temperature: scored.temperature,
        scoreBreakdown: JSON.stringify(scored.components),
      },
    });

    // --- Follow-ups --------------------------------------------------------
    const followUps: {
      type: string; scheduledFor: Date; status: string; completedAt: Date | null;
      notes: string | null; automated: boolean; sequenceStep: number | null; channel: string;
    }[] = [];

    if (archetype.contacted) {
      const completedCount = int(1, 3);
      for (let step = 0; step < completedCount; step += 1) {
        const at = new Date(createdAt.getTime() + (step + 1) * int(2, 20) * HOUR);
        if (at.getTime() > Date.now()) break;
        followUps.push({
          type: 'AUTOMATED', channel: 'WHATSAPP', scheduledFor: at, status: 'COMPLETED',
          completedAt: at, notes: DEFAULT_FOLLOW_UP_SEQUENCE[step]?.name ?? 'Automated follow-up',
          automated: true, sequenceStep: step,
        });
      }
    }

    if (archetype.overdueFollowUp) {
      followUps.push({
        type: pick(['CALL', 'WHATSAPP']), channel: 'MANUAL',
        scheduledFor: new Date(Date.now() - int(3, 96) * HOUR),
        status: 'PENDING', completedAt: null,
        notes: 'Call back to confirm requirement and schedule a site visit.',
        automated: false, sequenceStep: null,
      });
    }

    if (archetype.pendingFollowUp) {
      followUps.push({
        type: pick(['CALL', 'WHATSAPP', 'VISIT']), channel: 'MANUAL',
        scheduledFor: new Date(Date.now() + int(1, 40) * HOUR),
        status: 'PENDING', completedAt: null,
        notes: 'Share shortlisted options and confirm visit timing.',
        automated: false, sequenceStep: null,
      });
    }

    if (followUps.length) {
      await prisma.followUp.createMany({
        data: followUps.map((followUp) => ({
          ...followUp, leadId: lead.id, assignedToId: owner?.id ?? null,
        })),
      });
      const nextPending = followUps
        .filter((f) => f.status === 'PENDING')
        .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0];
      if (nextPending) {
        await prisma.lead.update({
          where: { id: lead.id }, data: { nextFollowUpAt: nextPending.scheduledFor },
        });
      }
    }

    // --- Appointments & conversions ---------------------------------------
    if (archetype.appointment) {
      const isPast = archetype.converted || chance(0.4);
      const scheduledFor = isPast
        ? new Date(Date.now() - int(2, 200) * HOUR)
        : new Date(Date.now() + int(2, 120) * HOUR);
      await prisma.appointment.create({
        data: {
          leadId: lead.id,
          salespersonId: owner?.id ?? null,
          scheduledFor,
          status: archetype.converted ? 'COMPLETED' : isPast ? pick(['COMPLETED', 'NO_SHOW']) : 'SCHEDULED',
          location: 'Site office, Sector 65, Gurugram',
          notes: 'Site visit with the family. Show the 3BHK sample flat.',
        },
      });
    }

    if (archetype.converted) {
      const revenue = (attributes.budgetMax ?? 15_000_000) * (0.92 + random() * 0.12);
      await prisma.conversion.create({
        data: {
          leadId: lead.id,
          revenue: Math.round(revenue / 100_000) * 100_000,
          convertedAt: new Date(Date.now() - int(1, 90) * DAY),
          product: `${attributes.propertyType ?? '3BHK'} — ${attributes.location ?? 'Golf Course Road'}`,
          notes: 'Booking amount received; agreement executed.',
        },
      });
    }

    // --- Activity timeline -------------------------------------------------
    const activities: { type: string; summary: string; createdAt: Date; actorType: string; actorId: string | null }[] = [
      {
        type: 'LEAD_CREATED',
        summary: `Lead created from ${acquisition.source.replace(/_/g, ' ').toLowerCase()}${campaign ? ` — ${campaign.name}` : ''}.`,
        createdAt, actorType: 'SYSTEM', actorId: null,
      },
    ];

    if (messages.length) {
      activities.push({ type: 'MESSAGE_SENT', summary: 'AI sent a whatsapp message.', createdAt: new Date(createdAt.getTime() + 2 * MINUTE), actorType: 'AI', actorId: null });
      if (messages.some((m) => m.sender === 'LEAD')) {
        activities.push({ type: 'LEAD_REPLIED', summary: 'Lead replied.', createdAt: new Date(createdAt.getTime() + 9 * MINUTE), actorType: 'LEAD', actorId: null });
      }
    }
    if (archetype.qualified) {
      activities.push({ type: 'AI_QUALIFICATION_COMPLETED', summary: `AI qualification completed (${int(62, 95)}% confidence).`, createdAt: new Date(createdAt.getTime() + 12 * MINUTE), actorType: 'AI', actorId: null });
      activities.push({ type: 'SCORE_CHANGED', summary: `Score changed from 0 to ${scored.score} (${scored.temperature}).`, createdAt: new Date(createdAt.getTime() + 13 * MINUTE), actorType: 'SYSTEM', actorId: null });
    }
    if (owner) {
      activities.push({ type: 'LEAD_ASSIGNED', summary: `Assigned to ${owner.name}.`, createdAt: new Date(createdAt.getTime() + 14 * MINUTE), actorType: 'SYSTEM', actorId: null });
    }
    if (archetype.handoff) {
      activities.push({ type: 'HANDED_OFF_TO_HUMAN', summary: 'Handed off to a human: Lead raised a commercial or escalation topic that must be handled by a person.', createdAt: new Date(createdAt.getTime() + 20 * MINUTE), actorType: 'AI', actorId: null });
    }
    if (archetype.appointment) {
      activities.push({ type: 'APPOINTMENT_BOOKED', summary: 'Site visit booked.', createdAt: new Date(lastActivityAt.getTime() - HOUR), actorType: 'USER', actorId: owner?.id ?? null });
    }
    if (archetype.converted) {
      activities.push({ type: 'CONVERSION_RECORDED', summary: 'Conversion recorded.', createdAt: lastActivityAt, actorType: 'USER', actorId: owner?.id ?? null });
    }
    if (archetype.status === 'LOST') {
      activities.push({ type: 'LEAD_LOST', summary: `Status changed from FOLLOW_UP to LOST — ${LOST_REASONS[0]}`, createdAt: lastActivityAt, actorType: 'USER', actorId: owner?.id ?? null });
    }

    await prisma.activity.createMany({
      data: activities.map((activity) => ({ ...activity, leadId: lead.id })),
    });

    created += 1;
  }

  console.log(`  Created ${created} leads with conversations, follow-ups, appointments and conversions.`);

  // --- Notifications -------------------------------------------------------
  const atRisk = await prisma.lead.findMany({
    where: {
      organizationId: organization.id, status: { notIn: ['WON', 'LOST'] },
      OR: [{ firstContactedAt: null }, { score: { gte: 70 } }],
    },
    take: 12,
    orderBy: { score: 'desc' },
  });

  await prisma.notification.createMany({
    data: atRisk.map((lead, index) => ({
      organizationId: organization.id,
      userId: lead.assignedToId,
      leadId: lead.id,
      type: lead.firstContactedAt ? 'HIGH_INTENT_INACTIVE' : 'UNCONTACTED_LEAD',
      severity: lead.score >= 70 ? 'CRITICAL' : 'WARNING',
      title: lead.firstContactedAt ? `High-intent lead at risk: ${lead.name}` : `Uncontacted lead: ${lead.name}`,
      body: lead.firstContactedAt
        ? `Score ${lead.score}/100 with no recent activity. Call immediately.`
        : `Scoring ${lead.score}/100 and still not contacted. Reach out now.`,
      createdAt: new Date(Date.now() - index * 37 * MINUTE),
    })),
  });

  // A couple of representative system log entries for the diagnostics view.
  await prisma.systemLog.createMany({
    data: [
      { organizationId: organization.id, level: 'WARN', scope: 'MESSAGING', message: 'Outbound message failed', context: JSON.stringify({ provider: 'mock-whatsapp', reason: 'Simulated delivery failure (recipient unreachable).' }), createdAt: new Date(Date.now() - 5 * HOUR) },
      { organizationId: organization.id, level: 'ERROR', scope: 'WEBHOOK', message: 'Lead source temporarily unavailable', context: JSON.stringify({ provider: 'mock-meta', status: 503 }), createdAt: new Date(Date.now() - 27 * HOUR) },
    ],
  });

  const counts = await prisma.lead.groupBy({
    by: ['status'], where: { organizationId: organization.id }, _count: { _all: true },
  });

  console.log('\nDemo organization ready: Demo Realty');
  console.log('  Leads by status:', counts.map((row) => `${row.status}=${row._count._all}`).join(' '));
  console.log('\n  DEVELOPMENT / DEMO CREDENTIALS (never use in production):');
  console.log('    Owner:        owner@demorealty.test    / demo123');
  console.log('    Admin:        admin@demorealty.test    / demo123');
  console.log('    Sales manager manager@demorealty.test  / demo123');
  console.log('    Salesperson:  sales@demorealty.test    / demo123');
}

/** Weighted pick across the demo acquisition mix. */
function pickSource(): (typeof DEMO_SOURCE_MIX)[number] {
  const total = DEMO_SOURCE_MIX.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of DEMO_SOURCE_MIX) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return DEMO_SOURCE_MIX[0]!;
}

/**
 * Builds a first-touch record appropriate to the channel: paid social carries
 * the full ad hierarchy, paid search carries keywords, a walk-in carries almost
 * nothing. Realistic gaps matter — attribution is never uniformly complete.
 */
function buildAttribution(source: string, campaignName: string | null, at: Date) {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const base = {
    campaignName,
    firstTouchAt: at,
    lastTouchSource: source,
    lastTouchCampaign: campaignName,
    lastTouchAt: at,
  };

  switch (source) {
    case 'META_LEAD_ADS': {
      const creative = pick(META_CREATIVES);
      return {
        ...base, sourceType: 'PAID_SOCIAL',
        campaignExternalId: `camp_${int(100000, 999999)}`,
        adSetId: `adset_${int(100000, 999999)}`, adSetName: pick(META_AD_SETS),
        adId: `ad_${int(100000, 999999)}`, adName: creative,
        formId: `form_${int(10000, 99999)}`, formName: pick(META_FORMS),
        utmSource: 'facebook', utmMedium: 'paid_social',
        utmCampaign: campaignName ? slug(campaignName) : null,
        utmContent: slug(creative),
      };
    }
    case 'GOOGLE_ADS': {
      const landing = pick(LANDING_PAGES);
      return {
        ...base, sourceType: 'PAID_SEARCH',
        campaignExternalId: `gads_${int(100000, 999999)}`,
        adSetId: `ag_${int(10000, 99999)}`, adSetName: 'Exact match | Gurgaon',
        adName: 'Responsive search ad',
        landingPage: `https://lp.demorealty.example${landing}`,
        formName: 'Landing page enquiry form',
        utmSource: 'google', utmMedium: 'cpc',
        utmCampaign: campaignName ? slug(campaignName) : null,
        utmTerm: pick(GOOGLE_KEYWORDS),
      };
    }
    case 'WEBSITE':
      return {
        ...base, sourceType: 'DIRECT',
        landingPage: `https://www.demorealty.example${pick(LANDING_PAGES)}`,
        formName: 'Website enquiry form',
        referrer: 'https://www.google.com/',
      };
    case 'ORGANIC':
      return {
        ...base, sourceType: 'ORGANIC',
        landingPage: `https://www.demorealty.example${pick(LANDING_PAGES)}`,
        utmSource: 'google', utmMedium: 'organic',
        referrer: 'https://www.google.com/',
      };
    case 'REFERRAL':
      return { ...base, sourceType: 'REFERRAL', referrer: pick(REFERRAL_SOURCES) };
    case 'WHATSAPP':
      return { ...base, sourceType: 'MESSAGING' };
    case 'WALK_IN':
      return { ...base, sourceType: 'OFFLINE', formName: 'Site office walk-in register' };
    default:
      return { ...base, sourceType: 'UNKNOWN' };
  }
}

function buildSummary(name: string, attributes: {
  location: string | null; propertyType: string | null; budgetMax: number | null;
  purchaseTimeline: string | null; intent: string | null;
}): string {
  const budget = attributes.budgetMax
    ? attributes.budgetMax >= 10_000_000
      ? `₹${(attributes.budgetMax / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`
      : `₹${Math.round(attributes.budgetMax / 100_000)} L`
    : 'an unstated budget';

  const timeline: Record<string, string> = {
    IMMEDIATE: 'planning to purchase immediately',
    '1_3_MONTHS': 'planning to purchase within 1-3 months',
    '3_6_MONTHS': 'planning to purchase within 3-6 months',
    '6_12_MONTHS': 'planning to purchase within 6-12 months',
    EXPLORING: 'still exploring options',
  };

  const intentLabel = attributes.intent === 'INVESTMENT' ? 'Investment buyer' : attributes.intent === 'END_USE' ? 'End-use buyer' : 'Buyer';
  return `${intentLabel} looking for a ${attributes.propertyType ?? 'property'} in ${attributes.location ?? 'the NCR region'} with a budget of ${budget}, ${timeline[attributes.purchaseTimeline ?? ''] ?? 'timeline not confirmed'}.`;
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
