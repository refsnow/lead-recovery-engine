import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { hoursAgo } from '@/lib/dates';
import { RECOVERY_THRESHOLDS } from '@/config/defaults';
import { notify, notifyManagers } from '@/services/notification.service';
import { leadVisibilityFilter } from '@/lib/permissions';
import type { ActorContext } from '@/services/lead.service';
import type { RiskType } from '@/types/domain';

/**
 * THE LEAD RECOVERY ENGINE.
 *
 * Detects leads that are being lost — not as a report you have to go looking
 * for, but as ranked, actionable alerts on the first screen. Each rule answers
 * one question: which leads is nobody acting on right now?
 */

export interface RecoveryAlert {
  type: RiskType;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  count: number;
  /** Deep-link into the leads table pre-filtered to exactly these leads. */
  href: string;
  recommendedAction: string;
  samples: {
    id: string; name: string; phone: string; score: number;
    temperature: string; lastActivityAt: Date; assignedTo: string | null;
    /** Where the lead came from — shown on the alert so the origin is visible
     *  without opening the lead. */
    source: string; sourceDetail: string | null; campaignName: string | null;
  }[];
}

interface RuleContext {
  organizationId: string;
  scope: { assignedToId?: string };
}

const NOT_CLOSED: Prisma.StringFilter<'Lead'> = { notIn: ['WON', 'LOST'] };

async function queryRisk(ctx: RuleContext, where: Record<string, unknown>) {
  const filter = {
    organizationId: ctx.organizationId,
    ...ctx.scope,
    status: NOT_CLOSED,
    ...where,
  };

  const [count, samples] = await Promise.all([
    prisma.lead.count({ where: filter }),
    prisma.lead.findMany({
      where: filter,
      orderBy: [{ score: 'desc' }, { lastActivityAt: 'asc' }],
      take: 5,
      select: {
        id: true, name: true, phone: true, score: true, temperature: true,
        lastActivityAt: true, source: true, sourceDetail: true,
        assignedTo: { select: { name: true } },
        campaign: { select: { name: true } },
        attribution: { select: { campaignName: true } },
      },
    }),
  ]);

  return {
    count,
    samples: samples.map((lead) => ({
      id: lead.id, name: lead.name, phone: lead.phone, score: lead.score,
      temperature: lead.temperature, lastActivityAt: lead.lastActivityAt,
      assignedTo: lead.assignedTo?.name ?? null,
      source: lead.source,
      sourceDetail: lead.sourceDetail,
      // Prefer the attribution snapshot: it is immune to a campaign rename.
      campaignName: lead.attribution?.campaignName ?? lead.campaign?.name ?? null,
    })),
  };
}

/**
 * Evaluates every recovery rule for the actor's visible leads.
 * Returns only rules that actually matched, most severe first.
 */
export async function getRecoveryAlerts(actor: ActorContext): Promise<RecoveryAlert[]> {
  const ctx: RuleContext = {
    organizationId: actor.organizationId,
    scope: leadVisibilityFilter(actor),
  };
  const now = new Date();
  const alerts: RecoveryAlert[] = [];

  // 1. UNCONTACTED — the lead arrived and nobody has reached out.
  const uncontacted = await queryRisk(ctx, {
    firstContactedAt: null,
    createdAt: { lte: new Date(now.getTime() - RECOVERY_THRESHOLDS.uncontactedMinutes * 60_000) },
  });
  if (uncontacted.count > 0) {
    alerts.push({
      type: 'UNCONTACTED',
      severity: 'CRITICAL',
      title: `${uncontacted.count} lead${uncontacted.count === 1 ? ' has' : 's have'} not been contacted`,
      description: `No first contact more than ${RECOVERY_THRESHOLDS.uncontactedMinutes} minutes after the enquiry arrived.`,
      count: uncontacted.count,
      href: '/leads?risk=UNCONTACTED',
      recommendedAction: 'Call or message these leads now — response time is the single largest driver of contact rate.',
      samples: uncontacted.samples,
    });
  }

  // 2. HIGH-INTENT INACTIVE — the most valuable leads going quiet.
  const highIntent = await queryRisk(ctx, {
    score: { gte: RECOVERY_THRESHOLDS.highIntentScore },
    lastActivityAt: { lt: hoursAgo(RECOVERY_THRESHOLDS.highIntentInactiveHours, now) },
  });
  if (highIntent.count > 0) {
    alerts.push({
      type: 'HIGH_INTENT_INACTIVE',
      severity: 'CRITICAL',
      title: `${highIntent.count} high-intent lead${highIntent.count === 1 ? '' : 's'} inactive for ${RECOVERY_THRESHOLDS.highIntentInactiveHours} hours`,
      description: `Scoring ${RECOVERY_THRESHOLDS.highIntentScore}+ with no interaction in ${RECOVERY_THRESHOLDS.highIntentInactiveHours} hours.`,
      count: highIntent.count,
      href: '/leads?risk=HIGH_INTENT_INACTIVE',
      recommendedAction: 'Call immediately. These leads showed strong buying signals and are going cold.',
      samples: highIntent.samples,
    });
  }

  // 3. OVERDUE — a salesperson missed a committed follow-up.
  const overdue = await queryRisk(ctx, {
    followUps: { some: { status: 'PENDING', scheduledFor: { lt: now } } },
  });
  if (overdue.count > 0) {
    alerts.push({
      type: 'OVERDUE',
      severity: 'WARNING',
      title: `${overdue.count} lead${overdue.count === 1 ? ' has' : 's have'} overdue follow-ups`,
      description: 'A scheduled follow-up passed its due time without being completed.',
      count: overdue.count,
      href: '/leads?risk=OVERDUE',
      recommendedAction: 'Complete or reschedule these follow-ups today.',
      samples: overdue.samples,
    });
  }

  // 4. UNASSIGNED — nobody owns the lead, so nobody is accountable.
  const unassigned = await queryRisk(ctx, {
    assignedToId: null,
    createdAt: { lte: new Date(now.getTime() - RECOVERY_THRESHOLDS.unassignedMinutes * 60_000) },
  });
  if (unassigned.count > 0) {
    alerts.push({
      type: 'UNASSIGNED',
      severity: 'WARNING',
      title: `${unassigned.count} lead${unassigned.count === 1 ? ' has' : 's have'} no owner`,
      description: 'An unowned lead has nobody accountable for contacting it.',
      count: unassigned.count,
      href: '/leads?risk=UNASSIGNED',
      recommendedAction: 'Assign these leads to a salesperson, or enable round-robin assignment in Automations.',
      samples: unassigned.samples,
    });
  }

  // 5. DORMANT — still open, but nothing has happened for days.
  const dormant = await queryRisk(ctx, {
    lastActivityAt: { lt: hoursAgo(RECOVERY_THRESHOLDS.dormantHours, now) },
    score: { lt: RECOVERY_THRESHOLDS.highIntentScore },
  });
  if (dormant.count > 0) {
    alerts.push({
      type: 'DORMANT',
      severity: 'INFO',
      title: `${dormant.count} lead${dormant.count === 1 ? ' is' : 's are'} going dormant`,
      description: `No interaction in the last ${RECOVERY_THRESHOLDS.dormantHours} hours.`,
      count: dormant.count,
      href: '/leads?risk=DORMANT',
      recommendedAction: 'Run a re-engagement message, or mark them lost so the pipeline reflects reality.',
      samples: dormant.samples,
    });
  }

  const order = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
}

/**
 * Per-salesperson overdue workload — "Salesperson Amit has 6 overdue follow-ups."
 */
export async function getOverdueBySalesperson(organizationId: string) {
  const overdue = await prisma.followUp.groupBy({
    by: ['assignedToId'],
    where: {
      status: 'PENDING',
      scheduledFor: { lt: new Date() },
      lead: { organizationId, status: NOT_CLOSED },
      assignedToId: { not: null },
    },
    _count: { _all: true },
  });
  if (!overdue.length) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: overdue.map((row) => row.assignedToId!) } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((user) => [user.id, user.name]));

  return overdue
    .map((row) => ({
      userId: row.assignedToId!,
      name: names.get(row.assignedToId!) ?? 'Unknown',
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Sweeps the organization: marks stale leads DORMANT and raises alerts.
 * Driven by the scheduler so risk is detected without anyone opening the app.
 */
export async function runRecoverySweep(organizationId: string): Promise<{
  markedDormant: number; alertsRaised: number;
}> {
  const now = new Date();

  const { count: markedDormant } = await prisma.lead.updateMany({
    where: {
      organizationId,
      status: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP'] },
      lastActivityAt: { lt: hoursAgo(RECOVERY_THRESHOLDS.dormantHours, now) },
    },
    data: { status: 'DORMANT' },
  });

  let alertsRaised = 0;

  const uncontacted = await prisma.lead.findMany({
    where: {
      organizationId, firstContactedAt: null, status: NOT_CLOSED,
      createdAt: { lte: new Date(now.getTime() - RECOVERY_THRESHOLDS.uncontactedMinutes * 60_000) },
    },
    select: { id: true, name: true, score: true, assignedToId: true },
    take: 50,
  });

  for (const lead of uncontacted) {
    await notify({
      organizationId, userId: lead.assignedToId, leadId: lead.id,
      type: 'UNCONTACTED_LEAD', severity: 'CRITICAL',
      title: `Uncontacted lead: ${lead.name}`,
      body: `Scoring ${lead.score}/100 and still not contacted. Reach out now.`,
    });
    alertsRaised += 1;
  }

  const highIntentInactive = await prisma.lead.findMany({
    where: {
      organizationId, status: NOT_CLOSED,
      score: { gte: RECOVERY_THRESHOLDS.highIntentScore },
      lastActivityAt: { lt: hoursAgo(RECOVERY_THRESHOLDS.highIntentInactiveHours, now) },
    },
    select: { id: true, name: true, score: true, assignedToId: true },
    take: 50,
  });

  for (const lead of highIntentInactive) {
    await notify({
      organizationId, userId: lead.assignedToId, leadId: lead.id,
      type: 'HIGH_INTENT_INACTIVE', severity: 'CRITICAL',
      title: `High-intent lead at risk: ${lead.name}`,
      body: `Score ${lead.score}/100 with no activity for ${RECOVERY_THRESHOLDS.highIntentInactiveHours}+ hours. Call immediately.`,
    });
    alertsRaised += 1;
  }

  if (markedDormant > 0) {
    await notifyManagers({
      organizationId, type: 'HIGH_INTENT_INACTIVE', severity: 'WARNING',
      title: `${markedDormant} leads moved to dormant`,
      body: `No interaction for over ${RECOVERY_THRESHOLDS.dormantHours} hours.`,
    });
  }

  return { markedDormant, alertsRaised };
}
