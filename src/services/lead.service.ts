import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { parseJson, stringifyJson } from '@/lib/json';
import { hoursAgo, minutesFromNow } from '@/lib/dates';
import { RECOVERY_THRESHOLDS } from '@/config/defaults';
import { recordActivitySafe } from '@/services/activity.service';
import { notify, notifyManagers } from '@/services/notification.service';
import { deriveSignals, getScoringConfig, scoreLead } from '@/services/scoring.service';
import { recordFirstTouch, sourceLabel } from '@/services/attribution.service';
import type { LeadFilterInput } from '@/lib/validation';
import type { LeadAttributionInput, LeadStatus, ScoreComponent, UserRole } from '@/types/domain';
import { leadVisibilityFilter } from '@/lib/permissions';

export interface ActorContext {
  id: string;
  role: UserRole;
  organizationId: string;
  name: string;
}

export const LEAD_LIST_INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export interface CreateLeadInput {
  organizationId: string;
  name: string;
  phone: string;
  email?: string | null;
  source?: string;
  campaignId?: string | null;
  campaignName?: string;
  adName?: string | null;
  externalId?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  location?: string | null;
  propertyType?: string | null;
  offeringType?: string | null;
  purchaseTimeline?: string | null;
  decisionTimeline?: string | null;
  intent?: string | null;
  assignedToId?: string | null;
  createdAt?: Date;
  /** Free-text channel label, used when source is OTHER. */
  sourceDetail?: string | null;
  /** Detailed first-touch acquisition record. Written once, never rewritten. */
  attribution?: LeadAttributionInput;
}

/**
 * Creates a lead, scores it from whatever is known at intake, and records the
 * opening timeline entry. Deduplicates on (organizationId, externalId) so a
 * redelivered webhook cannot create a duplicate lead.
 */
export async function createLead(input: CreateLeadInput, actor?: ActorContext) {
  if (input.externalId) {
    const existing = await prisma.lead.findFirst({
      where: { organizationId: input.organizationId, externalId: input.externalId },
    });
    if (existing) return existing;
  }

  let campaignId = input.campaignId ?? null;
  if (!campaignId && input.campaignName) {
    campaignId = (await upsertCampaignByName(input.organizationId, input.campaignName, input.source)).id;
  }

  const effectiveOffering = input.offeringType ?? input.propertyType ?? null;
  const effectiveTimeline = input.decisionTimeline ?? input.purchaseTimeline ?? null;

  const config = await getScoringConfig(input.organizationId);
  const scored = scoreLead(
    {
      budgetMin: input.budgetMin, budgetMax: input.budgetMax, location: input.location,
      propertyType: effectiveOffering, offeringType: effectiveOffering,
      purchaseTimeline: effectiveTimeline, decisionTimeline: effectiveTimeline,
      intent: input.intent,
      signals: { replied: false, askedPricing: false, requestedAppointment: false },
    },
    config,
  );

  const lead = await prisma.lead.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      phone: normalizePhone(input.phone),
      email: input.email ?? null,
      source: input.source ?? 'MANUAL',
      sourceDetail: input.sourceDetail ?? null,
      campaignId,
      adName: input.adName ?? null,
      externalId: input.externalId ?? null,
      status: 'NEW',
      score: scored.score,
      temperature: scored.temperature,
      scoreBreakdown: stringifyJson(scored.components),
      assignedToId: input.assignedToId ?? null,
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
      location: input.location ?? null,
      propertyType: input.propertyType ?? effectiveOffering,
      offeringType: effectiveOffering,
      purchaseTimeline: input.purchaseTimeline ?? effectiveTimeline,
      decisionTimeline: effectiveTimeline,
      intent: input.intent ?? null,
      createdAt: input.createdAt ?? new Date(),
      lastActivityAt: input.createdAt ?? new Date(),
    },
  });

  // First-touch attribution is captured at birth, so the origin is recorded
  // before any later interaction could obscure it.
  await recordFirstTouch(lead.id, lead.source, {
    ...input.attribution,
    campaignName: input.attribution?.campaignName ?? input.campaignName ?? null,
    adName: input.attribution?.adName ?? input.adName ?? null,
    firstTouchAt: input.attribution?.firstTouchAt ?? lead.createdAt,
  });

  await recordActivitySafe({
    leadId: lead.id,
    type: 'LEAD_CREATED',
    summary: `Lead created from ${formatSource(lead.source)}${input.campaignName ? ` — ${input.campaignName}` : ''}.`,
    actorId: actor?.id ?? null,
    actorType: actor ? 'USER' : 'SYSTEM',
    metadata: { source: lead.source, campaign: input.campaignName ?? null, score: lead.score },
  });

  if (lead.temperature === 'HOT') {
    await notifyManagers({
      organizationId: lead.organizationId,
      type: 'NEW_HOT_LEAD',
      title: `Hot lead: ${lead.name}`,
      body: `Scored ${lead.score}/100 from ${formatSource(lead.source)}. Contact immediately.`,
      severity: 'CRITICAL',
      leadId: lead.id,
    });
  }

  return lead;
}

async function upsertCampaignByName(organizationId: string, name: string, source?: string) {
  const existing = await prisma.campaign.findFirst({ where: { organizationId, name } });
  if (existing) return existing;
  return prisma.campaign.create({
    data: { organizationId, name, source: source ?? 'META_LEAD_ADS' },
  });
}

/** Strips formatting; assumes Indian numbers when no country code is present. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Builds the Prisma `where` clause for the leads table.
 * `organizationId` is always applied, and salespeople are additionally limited
 * to leads assigned to them — tenancy and row-level access in one place.
 */
export function buildLeadWhere(actor: ActorContext, filters: Partial<LeadFilterInput>): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    organizationId: actor.organizationId,
    ...leadVisibilityFilter(actor),
  };

  if (filters.status) where.status = filters.status;
  if (filters.temperature) where.temperature = filters.temperature;
  if (filters.source) where.source = filters.source;
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId === 'UNASSIGNED' ? null : filters.assignedToId;
  }
  if (filters.minScore !== undefined || filters.maxScore !== undefined) {
    where.score = { gte: filters.minScore ?? 0, lte: filters.maxScore ?? 100 };
  }
  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = { gte: filters.createdFrom, lte: filters.createdTo };
  }
  if (filters.q) {
    // SQLite has no case-insensitive `mode`; phone/email are stored normalized
    // and names are matched with `contains`, which is sufficient for the MVP.
    where.OR = [
      { name: { contains: filters.q } },
      { phone: { contains: filters.q.replace(/[^\d+]/g, '') || filters.q } },
      { email: { contains: filters.q.toLowerCase() } },
    ];
  }
  if (filters.risk) Object.assign(where, riskFilter(filters.risk));

  return where;
}

/** Translates a recovery risk type into a query constraint. */
export function riskFilter(risk: string): Prisma.LeadWhereInput {
  const now = new Date();
  switch (risk) {
    case 'UNCONTACTED':
      return {
        firstContactedAt: null,
        status: { notIn: ['WON', 'LOST'] },
        createdAt: { lte: new Date(now.getTime() - RECOVERY_THRESHOLDS.uncontactedMinutes * 60_000) },
      };
    case 'OVERDUE':
      return {
        status: { notIn: ['WON', 'LOST'] },
        followUps: { some: { status: 'PENDING', scheduledFor: { lt: now } } },
      };
    case 'DORMANT':
      return {
        status: { notIn: ['WON', 'LOST'] },
        lastActivityAt: { lt: hoursAgo(RECOVERY_THRESHOLDS.dormantHours, now) },
      };
    case 'HIGH_INTENT_INACTIVE':
      return {
        status: { notIn: ['WON', 'LOST'] },
        score: { gte: RECOVERY_THRESHOLDS.highIntentScore },
        lastActivityAt: { lt: hoursAgo(RECOVERY_THRESHOLDS.highIntentInactiveHours, now) },
      };
    case 'UNASSIGNED':
      return { assignedToId: null, status: { notIn: ['WON', 'LOST'] } };
    default:
      return {};
  }
}

export async function listLeads(actor: ActorContext, filters: LeadFilterInput) {
  const where = buildLeadWhere(actor, filters);
  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: LEAD_LIST_INCLUDE,
      orderBy: { [filters.sort]: filters.dir },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: filters.pageSize, pageCount: Math.max(1, Math.ceil(total / filters.pageSize)) };
}

/** Loads a lead with everything the detail page needs, enforcing tenancy. */
export async function getLeadDetail(actor: ActorContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, ...leadVisibilityFilter(actor) },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      campaign: { select: { id: true, name: true, source: true } },
      attribution: true,
      conversations: { include: { messages: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'asc' } },
      followUps: { include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { scheduledFor: 'asc' } },
      appointments: { include: { salesperson: { select: { id: true, name: true } } }, orderBy: { scheduledFor: 'desc' } },
      conversions: { orderBy: { convertedAt: 'desc' } },
      activities: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 },
    },
  });

  if (!lead) throw new NotFoundError('Lead');
  return lead;
}

export function readScoreBreakdown(lead: { scoreBreakdown: string | null }): ScoreComponent[] {
  return parseJson<ScoreComponent[]>(lead.scoreBreakdown, []);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Verifies the lead belongs to the actor's organization and is visible to them. */
async function requireLead(actor: ActorContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, ...leadVisibilityFilter(actor) },
  });
  if (!lead) throw new NotFoundError('Lead');
  return lead;
}

export async function updateLead(actor: ActorContext, leadId: string, data: Record<string, unknown>) {
  const lead = await requireLead(actor, leadId);
  const previousStatus = lead.status as LeadStatus;

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { ...data, lastActivityAt: new Date() },
  });

  if (data.status && data.status !== previousStatus) {
    await recordActivitySafe({
      leadId: lead.id,
      type: data.status === 'LOST' ? 'LEAD_LOST' : 'STATUS_CHANGED',
      summary: `Status changed from ${previousStatus} to ${data.status}${data.lostReason ? ` — ${data.lostReason}` : ''}.`,
      actorId: actor.id,
      actorType: 'USER',
      metadata: { from: previousStatus, to: data.status },
    });

    // A recovered lead is one that was dormant or uncontacted and is now moving again.
    if ((previousStatus === 'DORMANT' || previousStatus === 'NEW') &&
        ['QUALIFIED', 'APPOINTMENT', 'WON'].includes(String(data.status))) {
      await recordActivitySafe({
        leadId: lead.id, type: 'LEAD_RECOVERED', actorId: actor.id, actorType: 'USER',
        summary: `Lead recovered from ${previousStatus} to ${data.status}.`,
      });
      await notifyManagers({
        organizationId: actor.organizationId, type: 'LEAD_RECOVERED',
        title: `Lead recovered: ${lead.name}`,
        body: `${actor.name} moved this lead from ${previousStatus} to ${data.status}.`,
        leadId: lead.id,
      });
    }
  }

  // Qualification attributes changed -> the score is stale.
  const scoringFields = ['budgetMin', 'budgetMax', 'location', 'propertyType', 'offeringType', 'purchaseTimeline', 'decisionTimeline', 'intent'];
  if (scoringFields.some((field) => field in data)) {
    await rescoreLead(lead.id, actor);
  }

  return updated;
}

export async function assignLead(actor: ActorContext, leadId: string, assigneeId: string | null) {
  const lead = await requireLead(actor, leadId);

  if (assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, organizationId: actor.organizationId, isActive: true },
    });
    if (!assignee) throw new ValidationError('The selected salesperson is not part of this organization.');

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { assignedToId: assigneeId, lastActivityAt: new Date() },
    });

    await recordActivitySafe({
      leadId: lead.id, type: 'LEAD_ASSIGNED', actorId: actor.id, actorType: 'USER',
      summary: `Assigned to ${assignee.name}.`, metadata: { assigneeId },
    });

    await notify({
      organizationId: actor.organizationId, userId: assigneeId, leadId: lead.id,
      type: lead.temperature === 'HOT' ? 'NEW_HOT_LEAD' : 'UNASSIGNED_LEAD',
      severity: lead.temperature === 'HOT' ? 'CRITICAL' : 'INFO',
      title: `New lead assigned: ${lead.name}`,
      body: `${lead.temperature} lead scoring ${lead.score}/100 from ${formatSource(lead.source)}.`,
    });

    return updated;
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { assignedToId: null, lastActivityAt: new Date() },
  });
  await recordActivitySafe({
    leadId: lead.id, type: 'LEAD_ASSIGNED', actorId: actor.id, actorType: 'USER',
    summary: 'Lead unassigned.',
  });
  return updated;
}

/**
 * Recomputes a lead's score from current attributes plus conversation signals,
 * and records a timeline entry when the score moves.
 */
export async function rescoreLead(leadId: string, actor?: ActorContext) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { conversations: { include: { messages: { select: { sender: true, body: true } } } } },
  });
  if (!lead) throw new NotFoundError('Lead');

  const messages = lead.conversations.flatMap((conversation) => conversation.messages);
  const config = await getScoringConfig(lead.organizationId);
  const effectiveOffering = lead.offeringType ?? lead.propertyType;
  const effectiveTimeline = lead.decisionTimeline ?? lead.purchaseTimeline;
  const scored = scoreLead(
    {
      budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, location: lead.location,
      propertyType: effectiveOffering, offeringType: effectiveOffering,
      purchaseTimeline: effectiveTimeline, decisionTimeline: effectiveTimeline,
      intent: lead.intent,
      signals: deriveSignals(messages),
    },
    config,
  );

  const previousScore = lead.score;
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      score: scored.score,
      temperature: scored.temperature,
      scoreBreakdown: stringifyJson(scored.components),
    },
  });

  if (scored.score !== previousScore) {
    await recordActivitySafe({
      leadId: lead.id,
      type: 'SCORE_CHANGED',
      summary: `Score changed from ${previousScore} to ${scored.score} (${scored.temperature}).`,
      actorId: actor?.id ?? null,
      actorType: actor ? 'USER' : 'SYSTEM',
      metadata: { from: previousScore, to: scored.score },
    });

    if (scored.temperature === 'HOT' && lead.temperature !== 'HOT') {
      await notifyManagers({
        organizationId: lead.organizationId, type: 'NEW_HOT_LEAD', severity: 'CRITICAL',
        title: `Lead turned hot: ${lead.name}`,
        body: `Score rose to ${scored.score}/100. ${lead.assignedToId ? '' : 'This lead is unassigned.'}`,
        leadId: lead.id,
      });
    }
  }

  return { lead: updated, scored };
}

/** Marks a lead contacted; sets first-contact time only once, for response-time reporting. */
export async function markContacted(leadId: string, when: Date = new Date()) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new NotFoundError('Lead');

  return prisma.lead.update({
    where: { id: leadId },
    data: {
      lastContactedAt: when,
      firstContactedAt: lead.firstContactedAt ?? when,
      lastActivityAt: when,
      status: lead.status === 'NEW' ? 'CONTACTED' : lead.status,
    },
  });
}

/** Round-robin assignment across active salespeople, balanced by open lead count. */
export async function pickNextSalesperson(organizationId: string): Promise<string | null> {
  const salespeople = await prisma.user.findMany({
    where: { organizationId, isActive: true, role: 'SALESPERSON' },
    select: {
      id: true,
      _count: { select: { assignedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } } } },
    },
  });
  if (!salespeople.length) return null;

  return salespeople.reduce((least, current) =>
    current._count.assignedLeads < least._count.assignedLeads ? current : least,
  ).id;
}

/** Highest-performing salesperson by won leads — used by ASSIGN_TO_SENIOR. */
export async function pickSeniorSalesperson(organizationId: string): Promise<string | null> {
  const candidates = await prisma.user.findMany({
    where: { organizationId, isActive: true, role: { in: ['SALESPERSON', 'SALES_MANAGER'] } },
    select: { id: true, _count: { select: { assignedLeads: { where: { status: 'WON' } } } } },
  });
  if (!candidates.length) return null;

  return candidates.reduce((best, current) =>
    current._count.assignedLeads > best._count.assignedLeads ? current : best,
  ).id;
}

/**
 * Display label for a lead source. Delegates to the attribution service so a
 * label is defined in exactly one place.
 */
export function formatSource(source: string, sourceDetail?: string | null): string {
  return sourceLabel(source, sourceDetail);
}

/** Schedules the next follow-up timestamp on the lead record. */
export async function setNextFollowUp(leadId: string, minutesFromNowValue: number): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { nextFollowUpAt: minutesFromNow(minutesFromNowValue) },
  });
}
