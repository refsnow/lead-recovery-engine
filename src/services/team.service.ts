import { prisma } from '@/db/client';
import { rate } from '@/lib/format';

export interface SalespersonStats {
  id: string;
  name: string;
  email: string;
  role: string;
  leadsAssigned: number;
  leadsContacted: number;
  hotLeads: number;
  followUpsDue: number;
  overdueFollowUps: number;
  appointments: number;
  won: number;
  lost: number;
  revenue: number;
  /** Median minutes from lead assignment to first contact. */
  medianResponseMinutes: number | null;
  followUpCompletionRate: number;
  contactRate: number;
}

/**
 * Operational visibility per salesperson — who has work piling up, not a
 * leaderboard. The UI presents these as workload and follow-through, and
 * deliberately avoids a single ranked score.
 */
export async function getTeamStats(organizationId: string): Promise<SalespersonStats[]> {
  const users = await prisma.user.findMany({
    where: { organizationId, isActive: true, role: { in: ['SALESPERSON', 'SALES_MANAGER'] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
  if (!users.length) return [];

  const userIds = users.map((user) => user.id);
  const now = new Date();

  const [leads, followUps, appointments] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId, assignedToId: { in: userIds } },
      select: {
        assignedToId: true, status: true, temperature: true,
        createdAt: true, firstContactedAt: true,
        conversions: { select: { revenue: true } },
      },
    }),
    prisma.followUp.findMany({
      where: { assignedToId: { in: userIds }, lead: { organizationId } },
      select: { assignedToId: true, status: true, scheduledFor: true },
    }),
    prisma.appointment.findMany({
      where: { salespersonId: { in: userIds }, lead: { organizationId } },
      select: { salespersonId: true, status: true },
    }),
  ]);

  return users.map((user) => {
    const own = leads.filter((lead) => lead.assignedToId === user.id);
    const ownFollowUps = followUps.filter((followUp) => followUp.assignedToId === user.id);
    const closedFollowUps = ownFollowUps.filter((f) => ['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(f.status));

    const responseTimes = own
      .filter((lead) => lead.firstContactedAt)
      .map((lead) => (lead.firstContactedAt!.getTime() - lead.createdAt.getTime()) / 60_000)
      .filter((minutes) => minutes >= 0)
      .sort((a, b) => a - b);

    const contacted = own.filter((lead) => lead.firstContactedAt !== null).length;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      leadsAssigned: own.length,
      leadsContacted: contacted,
      hotLeads: own.filter((lead) => lead.temperature === 'HOT' && !['WON', 'LOST'].includes(lead.status)).length,
      followUpsDue: ownFollowUps.filter((f) => f.status === 'PENDING' && f.scheduledFor >= now).length,
      overdueFollowUps: ownFollowUps.filter((f) => f.status === 'PENDING' && f.scheduledFor < now).length,
      appointments: appointments.filter((a) => a.salespersonId === user.id && a.status !== 'CANCELLED').length,
      won: own.filter((lead) => lead.status === 'WON').length,
      lost: own.filter((lead) => lead.status === 'LOST').length,
      revenue: own.reduce((total, lead) => total + lead.conversions.reduce((sum, c) => sum + c.revenue, 0), 0),
      medianResponseMinutes: median(responseTimes),
      followUpCompletionRate: rate(
        closedFollowUps.filter((f) => f.status === 'COMPLETED').length,
        closedFollowUps.length,
      ),
      contactRate: rate(contacted, own.length),
    };
  });
}

function median(sorted: number[]): number | null {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export async function listOrganizationUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    select: {
      id: true, name: true, email: true, role: true, isActive: true, phone: true, createdAt: true,
      _count: { select: { assignedLeads: true } },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function listAssignableUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId, isActive: true, role: { in: ['SALESPERSON', 'SALES_MANAGER', 'ADMIN', 'OWNER'] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });
}
