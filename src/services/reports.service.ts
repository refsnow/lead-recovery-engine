import { prisma } from '@/db/client';
import { rate } from '@/lib/format';
import { daysAgo, hoursAgo } from '@/lib/dates';
import { RECOVERY_THRESHOLDS } from '@/config/defaults';
import { sourceLabel } from '@/services/attribution.service';

/**
 * Reporting. Four questions, each answered from the same lead lifecycle data:
 * where did leads come from, how well were they worked, what was lost, and
 * what did it earn.
 */

export interface SourceReportRow {
  key: string;
  label: string;
  leads: number;
  contacted: number;
  qualified: number;
  appointments: number;
  hot: number;
  won: number;
  revenue: number;
  spend: number;
  costPerLead: number | null;
  costPerQualified: number | null;
  revenuePerLead: number;
  contactRate: number;
  qualificationRate: number;
  conversionRate: number;
  averageScore: number;
}

interface LeadRow {
  source: string;
  sourceDetail: string | null;
  campaignId: string | null;
  campaignName: string | null;
  status: string;
  score: number;
  temperature: string;
  firstContactedAt: Date | null;
  aiConfidence: number | null;
  appointmentCount: number;
  revenue: number;
}

async function loadLeadRows(organizationId: string, since?: Date): Promise<LeadRow[]> {
  const leads = await prisma.lead.findMany({
    where: { organizationId, ...(since ? { createdAt: { gte: since } } : {}) },
    select: {
      source: true, sourceDetail: true, campaignId: true, status: true, score: true,
      temperature: true, firstContactedAt: true, aiConfidence: true,
      campaign: { select: { name: true } },
      _count: { select: { appointments: true } },
      conversions: { select: { revenue: true } },
    },
  });

  return leads.map((lead) => ({
    source: lead.source,
    sourceDetail: lead.sourceDetail,
    campaignId: lead.campaignId,
    campaignName: lead.campaign?.name ?? null,
    status: lead.status,
    score: lead.score,
    temperature: lead.temperature,
    firstContactedAt: lead.firstContactedAt,
    aiConfidence: lead.aiConfidence,
    appointmentCount: lead._count.appointments,
    revenue: lead.conversions.reduce((total, row) => total + row.revenue, 0),
  }));
}

function aggregate(rows: LeadRow[], key: string, label: string, spend: number): SourceReportRow {
  const leads = rows.length;
  const contacted = rows.filter((row) => row.firstContactedAt !== null).length;
  const qualified = rows.filter(
    (row) => ['QUALIFIED', 'APPOINTMENT', 'WON'].includes(row.status) || (row.aiConfidence ?? 0) >= 0.6,
  ).length;
  const appointments = rows.filter((row) => row.appointmentCount > 0).length;
  const won = rows.filter((row) => row.status === 'WON').length;
  const hot = rows.filter((row) => row.temperature === 'HOT').length;
  const revenue = rows.reduce((total, row) => total + row.revenue, 0);

  return {
    key, label, leads, contacted, qualified, appointments, hot, won, revenue, spend,
    costPerLead: leads ? spend / leads : null,
    costPerQualified: qualified ? spend / qualified : null,
    revenuePerLead: leads ? revenue / leads : 0,
    contactRate: rate(contacted, leads),
    qualificationRate: rate(qualified, leads),
    conversionRate: rate(won, leads),
    averageScore: leads ? Math.round(rows.reduce((total, row) => total + row.score, 0) / leads) : 0,
  };
}

export async function getSourceReport(organizationId: string, since?: Date): Promise<SourceReportRow[]> {
  const rows = await loadLeadRows(organizationId, since);
  // Campaign spend is attributed to its source for source-level cost metrics.
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId }, select: { source: true, spend: true },
  });

  const spendBySource = new Map<string, number>();
  for (const campaign of campaigns) {
    spendBySource.set(campaign.source, (spendBySource.get(campaign.source) ?? 0) + campaign.spend);
  }

  const grouped = new Map<string, LeadRow[]>();
  for (const row of rows) {
    grouped.set(row.source, [...(grouped.get(row.source) ?? []), row]);
  }

  return [...grouped.entries()]
    .map(([source, sourceRows]) =>
      aggregate(
        sourceRows,
        source,
        sourceLabel(source, sourceRows[0]?.sourceDetail),
        spendBySource.get(source) ?? 0,
      ))
    .sort((a, b) => b.leads - a.leads);
}

export async function getCampaignReport(organizationId: string, since?: Date): Promise<SourceReportRow[]> {
  const [rows, campaigns] = await Promise.all([
    loadLeadRows(organizationId, since),
    prisma.campaign.findMany({ where: { organizationId } }),
  ]);

  const spendById = new Map(campaigns.map((campaign) => [campaign.id, campaign.spend]));
  const nameById = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));

  const grouped = new Map<string, LeadRow[]>();
  for (const row of rows) {
    const key = row.campaignId ?? 'none';
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  // Campaigns with spend but no leads yet still belong in the report.
  for (const campaign of campaigns) {
    if (!grouped.has(campaign.id)) grouped.set(campaign.id, []);
  }

  return [...grouped.entries()]
    .map(([campaignId, campaignRows]) => aggregate(
      campaignRows,
      campaignId,
      campaignId === 'none' ? 'No campaign' : nameById.get(campaignId) ?? 'Unknown campaign',
      spendById.get(campaignId) ?? 0,
    ))
    .sort((a, b) => b.leads - a.leads);
}

export interface SalesReport {
  totalLeads: number;
  contacted: number;
  qualified: number;
  appointments: number;
  won: number;
  lost: number;
  contactRate: number;
  qualificationRate: number;
  appointmentRate: number;
  conversionRate: number;
  revenue: number;
  revenuePerLead: number;
}

export async function getSalesReport(organizationId: string, since?: Date): Promise<SalesReport> {
  const rows = await loadLeadRows(organizationId, since);
  const summary = aggregate(rows, 'all', 'All leads', 0);
  const lost = rows.filter((row) => row.status === 'LOST').length;

  return {
    totalLeads: summary.leads,
    contacted: summary.contacted,
    qualified: summary.qualified,
    appointments: summary.appointments,
    won: summary.won,
    lost,
    contactRate: summary.contactRate,
    qualificationRate: summary.qualificationRate,
    appointmentRate: rate(summary.appointments, summary.leads),
    conversionRate: summary.conversionRate,
    revenue: summary.revenue,
    revenuePerLead: summary.revenuePerLead,
  };
}

export interface RecoveryReport {
  uncontacted: number;
  overdueFollowUps: number;
  dormant: number;
  highIntentInactive: number;
  unassigned: number;
  recovered: number;
  /** Open leads currently flagged by at least one recovery rule. */
  atRiskTotal: number;
}

export async function getRecoveryReport(organizationId: string): Promise<RecoveryReport> {
  const now = new Date();
  const open = { organizationId, status: { notIn: ['WON', 'LOST'] } };

  const [uncontacted, overdueFollowUps, dormant, highIntentInactive, unassigned, recovered, atRiskTotal] =
    await Promise.all([
      prisma.lead.count({
        where: {
          ...open, firstContactedAt: null,
          createdAt: { lte: new Date(now.getTime() - RECOVERY_THRESHOLDS.uncontactedMinutes * 60_000) },
        },
      }),
      prisma.followUp.count({
        where: { status: 'PENDING', scheduledFor: { lt: now }, lead: open },
      }),
      prisma.lead.count({ where: { organizationId, status: 'DORMANT' } }),
      prisma.lead.count({
        where: {
          ...open, score: { gte: RECOVERY_THRESHOLDS.highIntentScore },
          lastActivityAt: { lt: hoursAgo(RECOVERY_THRESHOLDS.highIntentInactiveHours, now) },
        },
      }),
      prisma.lead.count({ where: { ...open, assignedToId: null } }),
      prisma.activity.count({
        where: { type: 'LEAD_RECOVERED', lead: { organizationId }, createdAt: { gte: daysAgo(30) } },
      }),
      prisma.lead.count({
        where: {
          ...open,
          OR: [
            { firstContactedAt: null, createdAt: { lte: new Date(now.getTime() - RECOVERY_THRESHOLDS.uncontactedMinutes * 60_000) } },
            { followUps: { some: { status: 'PENDING', scheduledFor: { lt: now } } } },
            { lastActivityAt: { lt: hoursAgo(RECOVERY_THRESHOLDS.dormantHours, now) } },
            { assignedToId: null },
          ],
        },
      }),
    ]);

  return { uncontacted, overdueFollowUps, dormant, highIntentInactive, unassigned, recovered, atRiskTotal };
}

export interface RevenueRow { key: string; label: string; revenue: number; deals: number; revenuePerLead: number }

export async function getRevenueReport(organizationId: string, since?: Date) {
  const conversions = await prisma.conversion.findMany({
    where: {
      lead: { organizationId },
      ...(since ? { convertedAt: { gte: since } } : {}),
    },
    include: {
      lead: {
        select: {
          source: true, sourceDetail: true, campaignId: true, assignedToId: true,
          campaign: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      },
    },
  });

  const leadCounts = await prisma.lead.groupBy({
    by: ['source'],
    where: { organizationId, ...(since ? { createdAt: { gte: since } } : {}) },
    _count: { _all: true },
  });
  const leadsBySource = new Map(leadCounts.map((row) => [row.source, row._count._all]));

  const bucket = (rows: typeof conversions, keyFn: (row: (typeof conversions)[number]) => [string, string]) => {
    const map = new Map<string, RevenueRow>();
    for (const row of rows) {
      const [key, label] = keyFn(row);
      const current = map.get(key) ?? { key, label, revenue: 0, deals: 0, revenuePerLead: 0 };
      current.revenue += row.revenue;
      current.deals += 1;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  };

  const bySource = bucket(conversions, (row) => [row.lead.source, sourceLabel(row.lead.source, row.lead.sourceDetail)])
    .map((row) => ({
      ...row,
      revenuePerLead: leadsBySource.get(row.key) ? row.revenue / leadsBySource.get(row.key)! : 0,
    }));

  return {
    total: conversions.reduce((sum, row) => sum + row.revenue, 0),
    deals: conversions.length,
    bySource,
    byCampaign: bucket(conversions, (row) => [row.lead.campaignId ?? 'none', row.lead.campaign?.name ?? 'No campaign']),
    bySalesperson: bucket(conversions, (row) => [row.lead.assignedToId ?? 'none', row.lead.assignedTo?.name ?? 'Unassigned']),
  };
}
