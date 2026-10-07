import { prisma } from '@/db/client';
import { endOfDay, hoursAgo, startOfDay } from '@/lib/dates';
import { rate } from '@/lib/format';
import { leadVisibilityFilter } from '@/lib/permissions';
import { RECOVERY_THRESHOLDS } from '@/config/defaults';
import type { ActorContext } from '@/services/lead.service';

export interface TodayMetrics {
  newLeads: number;
  hotLeads: number;
  uncontactedLeads: number;
  followUpsDue: number;
  overdueFollowUps: number;
  appointments: number;
  conversions: number;
  revenueToday: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** Conversion rate from the previous stage. */
  stepRate: number;
  /** Conversion rate from the top of the funnel. */
  overallRate: number;
}

/**
 * The first screen answers: what came in today, what is hot, and what is
 * being lost right now.
 */
export async function getTodayMetrics(actor: ActorContext): Promise<TodayMetrics> {
  const scope = { organizationId: actor.organizationId, ...leadVisibilityFilter(actor) };
  const from = startOfDay();
  const to = endOfDay();
  const now = new Date();

  const [
    newLeads, hotLeads, uncontactedLeads, followUpsDue, overdueFollowUps, appointments, conversions,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...scope, createdAt: { gte: from, lte: to } } }),
    prisma.lead.count({ where: { ...scope, temperature: 'HOT', status: { notIn: ['WON', 'LOST'] } } }),
    prisma.lead.count({
      where: {
        ...scope, firstContactedAt: null, status: { notIn: ['WON', 'LOST'] },
        createdAt: { lte: new Date(now.getTime() - RECOVERY_THRESHOLDS.uncontactedMinutes * 60_000) },
      },
    }),
    prisma.followUp.count({
      where: {
        status: 'PENDING', scheduledFor: { gte: from, lte: to },
        lead: scope, ...(actor.role === 'SALESPERSON' ? { assignedToId: actor.id } : {}),
      },
    }),
    prisma.followUp.count({
      where: {
        status: 'PENDING', scheduledFor: { lt: now },
        lead: { ...scope, status: { notIn: ['WON', 'LOST'] } },
        ...(actor.role === 'SALESPERSON' ? { assignedToId: actor.id } : {}),
      },
    }),
    prisma.appointment.count({
      where: {
        scheduledFor: { gte: from, lte: to }, status: 'SCHEDULED', lead: scope,
        ...(actor.role === 'SALESPERSON' ? { salespersonId: actor.id } : {}),
      },
    }),
    prisma.conversion.findMany({
      where: { convertedAt: { gte: from, lte: to }, lead: scope },
      select: { revenue: true },
    }),
  ]);

  return {
    newLeads, hotLeads, uncontactedLeads, followUpsDue, overdueFollowUps, appointments,
    conversions: conversions.length,
    revenueToday: conversions.reduce((total, row) => total + row.revenue, 0),
  };
}

/**
 * The lead funnel. Stages are cumulative — a WON lead also counts as contacted,
 * qualified and having reached appointment — so the rates read as a true funnel
 * rather than as a snapshot of current statuses.
 */
export async function getFunnel(actor: ActorContext, since?: Date): Promise<FunnelStage[]> {
  const scope = {
    organizationId: actor.organizationId,
    ...leadVisibilityFilter(actor),
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  // Each stage is cumulative: reaching a later stage implies every earlier one.
  // A lead that converted is counted as contacted even if the first outbound
  // message is not what established contact (for example the lead wrote first).
  const REACHED_CONTACT = [
    { firstContactedAt: { not: null } },
    { status: { in: ['CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'APPOINTMENT', 'WON'] } },
    { appointments: { some: {} } },
    { conversations: { some: { messages: { some: {} } } } },
  ];
  const REACHED_QUALIFIED = [
    { status: { in: ['QUALIFIED', 'APPOINTMENT', 'WON'] } },
    { aiConfidence: { gte: 0.6 } },
    { appointments: { some: {} } },
  ];

  const [total, contacted, qualified, appointment, won] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, OR: REACHED_CONTACT } }),
    prisma.lead.count({ where: { ...scope, OR: REACHED_QUALIFIED } }),
    prisma.lead.count({ where: { ...scope, appointments: { some: {} } } }),
    prisma.lead.count({ where: { ...scope, status: 'WON' } }),
  ]);

  const stages = [
    { key: 'leads', label: 'Leads', count: total },
    { key: 'contacted', label: 'Contacted', count: contacted },
    { key: 'qualified', label: 'Qualified', count: qualified },
    { key: 'appointment', label: 'Appointment', count: appointment },
    { key: 'won', label: 'Won', count: won },
  ];

  return stages.map((stage, index) => ({
    ...stage,
    stepRate: index === 0 ? 1 : rate(stage.count, stages[index - 1]!.count),
    overallRate: rate(stage.count, total),
  }));
}

/** Median time from lead creation to first contact, in minutes. */
export async function getMedianResponseMinutes(organizationId: string, since?: Date): Promise<number | null> {
  const leads = await prisma.lead.findMany({
    where: {
      organizationId, firstContactedAt: { not: null },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: { createdAt: true, firstContactedAt: true },
    take: 1000,
  });
  if (!leads.length) return null;

  const durations = leads
    .map((lead) => (lead.firstContactedAt!.getTime() - lead.createdAt.getTime()) / 60_000)
    .filter((minutes) => minutes >= 0)
    .sort((a, b) => a - b);
  if (!durations.length) return null;

  const mid = Math.floor(durations.length / 2);
  return durations.length % 2 === 0
    ? (durations[mid - 1]! + durations[mid]!) / 2
    : durations[mid]!;
}

/** Daily lead volume for the trend chart. */
export async function getLeadTrend(actor: ActorContext, days = 14) {
  const since = hoursAgo(days * 24);
  const leads = await prisma.lead.findMany({
    where: {
      organizationId: actor.organizationId, ...leadVisibilityFilter(actor),
      createdAt: { gte: since },
    },
    select: { createdAt: true, temperature: true },
  });

  const buckets = new Map<string, { date: string; total: number; hot: number }>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = startOfDay(new Date(Date.now() - index * 86_400_000));
    buckets.set(date.toISOString().slice(0, 10), {
      date: date.toISOString().slice(0, 10), total: 0, hot: 0,
    });
  }

  for (const lead of leads) {
    const key = startOfDay(lead.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (lead.temperature === 'HOT') bucket.hot += 1;
  }

  return [...buckets.values()];
}

export async function getUpcomingWork(actor: ActorContext) {
  const isSalesperson = actor.role === 'SALESPERSON';
  const [followUps, appointments] = await Promise.all([
    prisma.followUp.findMany({
      where: {
        status: 'PENDING',
        lead: { organizationId: actor.organizationId, status: { notIn: ['WON', 'LOST'] } },
        ...(isSalesperson ? { assignedToId: actor.id } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, score: true, temperature: true, phone: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 8,
    }),
    prisma.appointment.findMany({
      where: {
        status: 'SCHEDULED', scheduledFor: { gte: new Date() },
        lead: { organizationId: actor.organizationId },
        ...(isSalesperson ? { salespersonId: actor.id } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, score: true } },
        salesperson: { select: { name: true } },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 5,
    }),
  ]);

  return { followUps, appointments };
}
