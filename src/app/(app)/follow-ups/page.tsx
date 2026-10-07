import Link from 'next/link';
import { prisma } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { titleCase } from '@/lib/format';
import {
  Card, CardHeader, EmptyState, PageHeader, ScorePill, StatusBadge, TemperatureBadge,
} from '@/components/ui';
import { CompleteFollowUpButton } from '@/components/leads/complete-follow-up';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Follow-ups' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ filter?: string }>;

/**
 * The salesperson's working queue. Overdue work is listed first because that is
 * what is actively costing the business leads.
 */
export default async function FollowUpsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const now = new Date();

  // Salespeople see only their own queue; managers see the whole team's.
  const ownerScope = can(user.role, 'VIEW_ALL_LEADS') ? {} : { assignedToId: user.id };

  const followUps = await prisma.followUp.findMany({
    where: {
      status: 'PENDING',
      lead: { organizationId: user.organizationId, status: { notIn: ['WON', 'LOST'] } },
      ...ownerScope,
      ...(filter === 'OVERDUE' ? { scheduledFor: { lt: now } } : {}),
    },
    include: {
      lead: { select: { id: true, name: true, phone: true, score: true, temperature: true, status: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { scheduledFor: 'asc' },
    take: 200,
  });

  const overdue = followUps.filter((followUp) => followUp.scheduledFor < now);
  const upcoming = followUps.filter((followUp) => followUp.scheduledFor >= now);

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Every commitment made to a lead, and whether it was kept."
        actions={
          <div className="flex gap-1.5">
            <Link
              href="/follow-ups"
              className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium',
                !filter ? 'bg-brand-600 text-white' : 'bg-white text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50')}
            >
              All pending ({followUps.length})
            </Link>
            <Link
              href="/follow-ups?filter=OVERDUE"
              className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium',
                filter === 'OVERDUE' ? 'bg-rose-600 text-white' : 'bg-white text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50')}
            >
              Overdue ({overdue.length})
            </Link>
          </div>
        }
      />

      <div className="space-y-5">
        {overdue.length ? (
          <Card>
            <CardHeader
              title={<span className="text-rose-700">Overdue — {overdue.length}</span>}
              description="These follow-ups passed their due time. Complete or reschedule them today."
            />
            <FollowUpList items={overdue} now={now} showOwner={can(user.role, 'VIEW_TEAM')} />
          </Card>
        ) : null}

        {filter !== 'OVERDUE' ? (
          <Card>
            <CardHeader title={`Upcoming — ${upcoming.length}`} description="Scheduled and not yet due." />
            {upcoming.length ? (
              <FollowUpList items={upcoming} now={now} showOwner={can(user.role, 'VIEW_TEAM')} />
            ) : (
              <EmptyState
                title="Nothing scheduled"
                description="Create follow-ups from a lead's detail page so no commitment is forgotten."
              />
            )}
          </Card>
        ) : null}

        {!followUps.length ? (
          <Card>
            <EmptyState
              title="No pending follow-ups"
              description={filter === 'OVERDUE'
                ? 'Nothing is overdue. Every committed follow-up has been kept.'
                : 'Your follow-up queue is clear.'}
            />
          </Card>
        ) : null}
      </div>
    </>
  );
}

interface FollowUpItem {
  id: string;
  type: string;
  scheduledFor: Date;
  notes: string | null;
  automated: boolean;
  lead: { id: string; name: string; phone: string; score: number; temperature: string; status: string };
  assignedTo: { id: string; name: string } | null;
}

function FollowUpList({ items, now, showOwner }: { items: FollowUpItem[]; now: Date; showOwner: boolean }) {
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((item) => {
        const isOverdue = item.scheduledFor < now;
        return (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
            <div className="min-w-[10rem] flex-1">
              <Link href={`/leads/${item.lead.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-700">
                {item.lead.name}
              </Link>
              <p className="truncate text-xs text-ink-500">
                {titleCase(item.type)}{item.automated ? ' (automated)' : ''} · {item.notes ?? 'No note'}
              </p>
            </div>

            <ScorePill score={item.lead.score} className="hidden sm:flex" />
            <TemperatureBadge temperature={item.lead.temperature} />
            <StatusBadge status={item.lead.status} />

            {showOwner ? (
              <span className="min-w-[6rem] text-xs text-ink-500">
                {item.assignedTo?.name ?? 'Unassigned'}
              </span>
            ) : null}

            <span
              className={cn('min-w-[9rem] text-xs', isOverdue ? 'font-medium text-rose-600' : 'text-ink-500')}
              title={formatDateTime(item.scheduledFor)}
            >
              {isOverdue ? 'Overdue · ' : 'Due '}{relativeTime(item.scheduledFor)}
            </span>

            <CompleteFollowUpButton followUpId={item.id} leadId={item.lead.id} />
          </li>
        );
      })}
    </ul>
  );
}
