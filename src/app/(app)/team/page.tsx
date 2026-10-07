import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getTeamStats } from '@/services/team.service';
import { formatDuration, formatINR, formatPercent, titleCase } from '@/lib/format';
import { Avatar, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Sales Team' };
export const dynamic = 'force-dynamic';

/**
 * Operational visibility, not a leaderboard. The columns are workload and
 * follow-through so a manager can see who needs help — deliberately no single
 * ranked "performance score".
 */
export default async function TeamPage() {
  const user = await requireUser();
  if (!can(user.role, 'VIEW_TEAM')) redirect('/dashboard');

  const team = await getTeamStats(user.organizationId);
  const canSeeRevenue = can(user.role, 'VIEW_REVENUE');

  return (
    <>
      <PageHeader
        title="Sales team"
        description="Workload and follow-through for each salesperson. Overdue work is highlighted so it can be redistributed."
      />

      {team.length === 0 ? (
        <Card>
          <EmptyState
            title="No salespeople yet"
            description="Add team members in Settings to start assigning leads."
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Team overview" />
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[62rem] border-collapse">
                <thead className="border-b border-ink-200 bg-ink-50/60">
                  <tr>
                    <th scope="col" className="table-head">Salesperson</th>
                    <th scope="col" className="table-head text-right">Assigned</th>
                    <th scope="col" className="table-head text-right">Contacted</th>
                    <th scope="col" className="table-head text-right">Contact rate</th>
                    <th scope="col" className="table-head text-right">Hot</th>
                    <th scope="col" className="table-head text-right">Due</th>
                    <th scope="col" className="table-head text-right">Overdue</th>
                    <th scope="col" className="table-head text-right">Follow-through</th>
                    <th scope="col" className="table-head text-right">Median response</th>
                    <th scope="col" className="table-head text-right">Visits</th>
                    <th scope="col" className="table-head text-right">Won</th>
                    <th scope="col" className="table-head text-right">Lost</th>
                    {canSeeRevenue ? <th scope="col" className="table-head text-right">Revenue</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {team.map((person) => (
                    <tr key={person.id} className="hover:bg-brand-50/30">
                      <td className="table-cell">
                        <span className="flex items-center gap-2">
                          <Avatar name={person.name} />
                          <span>
                            <Link href={`/leads?assignedToId=${person.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                              {person.name}
                            </Link>
                            <span className="block text-[11px] text-ink-400">{titleCase(person.role)}</span>
                          </span>
                        </span>
                      </td>
                      <td className="table-cell text-right tabular-nums">{person.leadsAssigned}</td>
                      <td className="table-cell text-right tabular-nums">{person.leadsContacted}</td>
                      <td className={cn('table-cell text-right tabular-nums',
                        person.contactRate < 0.7 && person.leadsAssigned > 0 && 'font-medium text-amber-700')}>
                        {person.leadsAssigned ? formatPercent(person.contactRate) : '—'}
                      </td>
                      <td className="table-cell text-right tabular-nums">{person.hotLeads}</td>
                      <td className="table-cell text-right tabular-nums">{person.followUpsDue}</td>
                      <td className={cn('table-cell text-right tabular-nums',
                        person.overdueFollowUps > 0 && 'font-semibold text-rose-600')}>
                        {person.overdueFollowUps}
                      </td>
                      <td className="table-cell text-right tabular-nums">
                        {formatPercent(person.followUpCompletionRate)}
                      </td>
                      <td className="table-cell text-right tabular-nums">
                        {formatDuration(person.medianResponseMinutes)}
                      </td>
                      <td className="table-cell text-right tabular-nums">{person.appointments}</td>
                      <td className="table-cell text-right tabular-nums text-emerald-700">{person.won}</td>
                      <td className="table-cell text-right tabular-nums text-ink-400">{person.lost}</td>
                      {canSeeRevenue ? (
                        <td className="table-cell text-right font-medium tabular-nums">{formatINR(person.revenue)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((person) => (
              <Card key={person.id} className="card-pad">
                <div className="flex items-center gap-2">
                  <Avatar name={person.name} className="h-8 w-8 text-xs" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{person.name}</p>
                    <p className="truncate text-xs text-ink-400">{person.email}</p>
                  </div>
                </div>

                {person.overdueFollowUps > 0 ? (
                  <Link
                    href={`/leads?assignedToId=${person.id}&risk=OVERDUE`}
                    className="mt-3 block rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-inset ring-rose-200 hover:bg-rose-100"
                  >
                    <span className="font-semibold">{person.overdueFollowUps} overdue follow-up{person.overdueFollowUps === 1 ? '' : 's'}</span>
                    {' — '}review and redistribute.
                  </Link>
                ) : (
                  <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    No overdue follow-ups.
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Open leads" value={String(person.leadsAssigned - person.won - person.lost)} />
                  <Metric label="Hot" value={String(person.hotLeads)} />
                  <Metric label="Visits" value={String(person.appointments)} />
                </dl>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-50 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}
