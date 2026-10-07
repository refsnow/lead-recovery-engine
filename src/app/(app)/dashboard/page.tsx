import { Suspense } from 'react';
import Link from 'next/link';
import {
  Flame, PhoneOff, CalendarCheck, TrendingUp, Clock, AlertCircle, IndianRupee, UserPlus,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatDuration, formatINR } from '@/lib/format';
import { formatTime, relativeTime } from '@/lib/dates';
import {
  getFunnel, getLeadTrend, getMedianResponseMinutes, getTodayMetrics, getUpcomingWork,
} from '@/services/dashboard.service';
import { getOverdueBySalesperson, getRecoveryAlerts } from '@/services/recovery.service';
import { Card, CardHeader, EmptyState, PageHeader, ScorePill, Skeleton, TemperatureBadge } from '@/components/ui';
import { StatCard } from '@/components/dashboard/stat-card';
import { Funnel } from '@/components/dashboard/funnel';
import { RecoveryAlerts } from '@/components/dashboard/recovery-alerts';
import { TrendChart } from '@/components/charts/bar-chart';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const actor = { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name };

  const [metrics, funnel, alerts, trend, responseMinutes, work, overdueByPerson] = await Promise.all([
    getTodayMetrics(actor),
    getFunnel(actor),
    getRecoveryAlerts(actor),
    getLeadTrend(actor),
    getMedianResponseMinutes(user.organizationId),
    getUpcomingWork(actor),
    can(user.role, 'VIEW_TEAM') ? getOverdueBySalesperson(user.organizationId) : Promise.resolve([]),
  ]);

  const firstName = user.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${firstName}`}
        description={
          user.role === 'SALESPERSON'
            ? 'Your leads, your follow-ups, and anything at risk of being lost.'
            : 'What came in today, what is hot, and what is being lost right now.'
        }
      />

      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
          Today
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <StatCard label="New leads" value={metrics.newLeads} href="/leads?sort=createdAt" icon={<UserPlus className="h-3.5 w-3.5" />} />
          <StatCard label="Hot leads" value={metrics.hotLeads} tone={metrics.hotLeads ? 'danger' : 'neutral'} href="/leads?temperature=HOT" icon={<Flame className="h-3.5 w-3.5" />} />
          <StatCard label="Uncontacted" value={metrics.uncontactedLeads} tone={metrics.uncontactedLeads ? 'danger' : 'success'} href="/leads?risk=UNCONTACTED" icon={<PhoneOff className="h-3.5 w-3.5" />} hint={metrics.uncontactedLeads ? "Contact now" : "All contacted"} />
          <StatCard label="Follow-ups due" value={metrics.followUpsDue} href="/follow-ups" icon={<Clock className="h-3.5 w-3.5" />} />
          <StatCard label="Overdue" value={metrics.overdueFollowUps} tone={metrics.overdueFollowUps ? 'warning' : 'success'} href="/follow-ups?filter=OVERDUE" icon={<AlertCircle className="h-3.5 w-3.5" />} />
          <StatCard label="Appointments" value={metrics.appointments} href="/appointments" icon={<CalendarCheck className="h-3.5 w-3.5" />} />
          <StatCard
            label="Conversions"
            value={metrics.conversions}
            tone={metrics.conversions ? 'success' : 'neutral'}
            hint={can(user.role, 'VIEW_REVENUE') && metrics.revenueToday ? formatINR(metrics.revenueToday) : undefined}
            href="/leads?status=WON"
            icon={<IndianRupee className="h-3.5 w-3.5" />}
          />
        </div>
      </section>

      <section aria-labelledby="recovery-heading" className="mt-6">
        <Card>
          <CardHeader
            title={<span id="recovery-heading">Lead recovery alerts</span>}
            description="Leads that are being lost right now, ranked by how urgently they need action."
          />
          <Suspense fallback={<Skeleton className="m-5 h-40" />}>
            <RecoveryAlerts alerts={alerts} />
          </Suspense>
        </Card>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Lead funnel"
            description="Where leads stop moving, from enquiry to closed business."
            action={
              <span className="text-xs text-ink-500">
                Median response time:{' '}
                <span className="font-medium text-ink-800">{formatDuration(responseMinutes)}</span>
              </span>
            }
          />
          <Funnel stages={funnel} />
        </Card>

        <Card>
          <CardHeader title="Lead volume" description="Last 14 days" />
          <TrendChart data={trend} />
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Next actions"
            description="The follow-ups closest to due, oldest first."
            action={<Link href="/follow-ups" className="text-xs font-medium text-brand-700 hover:underline">View all</Link>}
          />
          {work.followUps.length === 0 ? (
            <EmptyState
              title="No pending follow-ups"
              description="Nothing is scheduled. Create follow-ups from a lead's detail page so commitments never get lost."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {work.followUps.map((followUp) => {
                const overdue = followUp.scheduledFor < new Date();
                return (
                  <li key={followUp.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${followUp.lead.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-700">
                        {followUp.lead.name}
                      </Link>
                      <p className="truncate text-xs text-ink-500">
                        {followUp.type} · {followUp.notes ?? 'No note'}
                      </p>
                    </div>
                    <ScorePill score={followUp.lead.score} className="hidden sm:flex" />
                    <TemperatureBadge temperature={followUp.lead.temperature} />
                    <span className={overdue ? 'text-xs font-medium text-rose-600' : 'text-xs text-ink-500'}>
                      {relativeTime(followUp.scheduledFor)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Upcoming appointments" />
            {work.appointments.length === 0 ? (
              <EmptyState title="No appointments scheduled" description="Booked site visits appear here." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {work.appointments.map((appointment) => (
                  <li key={appointment.id} className="px-4 py-2.5 sm:px-5">
                    <Link href={`/leads/${appointment.lead.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-700">
                      {appointment.lead.name}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {relativeTime(appointment.scheduledFor)} at {formatTime(appointment.scheduledFor)}
                      {appointment.salesperson ? ` · ${appointment.salesperson.name}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {can(user.role, 'VIEW_TEAM') && overdueByPerson.length ? (
            <Card>
              <CardHeader
                title="Overdue by salesperson"
                description="Who has work piling up."
                action={<Link href="/team" className="text-xs font-medium text-brand-700 hover:underline">Team</Link>}
              />
              <ul className="divide-y divide-ink-100">
                {overdueByPerson.map((row) => (
                  <li key={row.userId} className="flex items-center justify-between px-4 py-2.5 sm:px-5">
                    <span className="text-sm text-ink-800">{row.name}</span>
                    <span className="text-sm font-semibold tabular-nums text-rose-600">
                      {row.count} overdue
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-400">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        Never let a valuable lead disappear without someone knowing.
      </p>
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
