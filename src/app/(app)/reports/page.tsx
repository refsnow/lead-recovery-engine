import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { daysAgo } from '@/lib/dates';
import { formatINR, formatPercent, rate } from '@/lib/format';
import { SourceBadge } from '@/components/leads/source-badge';
import {
  getCampaignReport, getRecoveryReport, getRevenueReport, getSalesReport, getSourceReport,
  type SourceReportRow,
} from '@/services/reports.service';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { HorizontalBars } from '@/components/charts/bar-chart';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

const RANGES = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
] as const;

type SearchParams = Promise<{ range?: string }>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(user.role, 'VIEW_ANALYTICS')) redirect('/dashboard');

  const { range } = await searchParams;
  const selected = RANGES.find((option) => option.key === range) ?? RANGES[0];
  const since = selected.days ? daysAgo(selected.days) : undefined;
  const canSeeRevenue = can(user.role, 'VIEW_REVENUE');

  const [sources, campaigns, sales, recovery, revenue] = await Promise.all([
    getSourceReport(user.organizationId, since),
    getCampaignReport(user.organizationId, since),
    getSalesReport(user.organizationId, since),
    getRecoveryReport(user.organizationId),
    getRevenueReport(user.organizationId, since),
  ]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Where leads came from, how well they were worked, what was lost, and what it earned."
        actions={
          <div className="flex gap-1.5">
            {RANGES.map((option) => (
              <Link
                key={option.key}
                href={`/reports?range=${option.key}`}
                className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium',
                  option.key === selected.key
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50')}
              >
                {option.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* SALES PERFORMANCE */}
      <Card>
        <CardHeader title="Sales performance" description="The lead-to-revenue conversion chain." />
        <div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Leads" value={String(sales.totalLeads)} />
          <Metric label="Contact rate" value={formatPercent(sales.contactRate)} hint={`${sales.contacted} contacted`} />
          <Metric label="Qualification rate" value={formatPercent(sales.qualificationRate)} hint={`${sales.qualified} qualified`} />
          <Metric label="Appointment rate" value={formatPercent(sales.appointmentRate)} hint={`${sales.appointments} visits`} />
          <Metric label="Conversion rate" value={formatPercent(sales.conversionRate, 1)} hint={`${sales.won} won · ${sales.lost} lost`} />
          {canSeeRevenue ? (
            <Metric label="Revenue per lead" value={formatINR(Math.round(sales.revenuePerLead))} hint={formatINR(sales.revenue)} />
          ) : (
            <Metric label="Lost" value={String(sales.lost)} />
          )}
        </div>
      </Card>

      {/* RECOVERY */}
      <Card className="mt-5">
        <CardHeader
          title="Lead recovery"
          description="Leads currently at risk of being lost, and how many were brought back."
        />
        <div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="At risk now" value={String(recovery.atRiskTotal)} href="/leads?risk=UNCONTACTED" tone={recovery.atRiskTotal ? 'danger' : 'neutral'} />
          <Metric label="Uncontacted" value={String(recovery.uncontacted)} href="/leads?risk=UNCONTACTED" tone={recovery.uncontacted ? 'danger' : 'neutral'} />
          <Metric label="Overdue follow-ups" value={String(recovery.overdueFollowUps)} href="/follow-ups?filter=OVERDUE" tone={recovery.overdueFollowUps ? 'warning' : 'neutral'} />
          <Metric label="High-intent inactive" value={String(recovery.highIntentInactive)} href="/leads?risk=HIGH_INTENT_INACTIVE" tone={recovery.highIntentInactive ? 'danger' : 'neutral'} />
          <Metric label="Dormant" value={String(recovery.dormant)} href="/leads?risk=DORMANT" />
          <Metric label="Recovered (30d)" value={String(recovery.recovered)} tone="success" />
        </div>
      </Card>

      {/* LEAD SOURCE PERFORMANCE */}
      <Card className="mt-5">
        <CardHeader
          title="Lead source performance"
          description="Every acquisition channel from volume through to closed revenue."
        />
        <SourcePerformanceTable rows={sources} canSeeRevenue={canSeeRevenue} />
      </Card>

      {/* CAMPAIGNS */}
      <Card className="mt-5">
        <CardHeader title="Leads by campaign" description="Which campaigns generate leads worth working." />
        <SourceTable rows={campaigns} canSeeRevenue={canSeeRevenue} />
      </Card>

      {/* REVENUE */}
      {canSeeRevenue ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card className="card-pad">
            <p className="label">Revenue by source</p>
            <div className="mt-3">
              {revenue.bySource.length ? (
                <HorizontalBars
                  rows={revenue.bySource.map((row) => ({
                    label: row.label, value: row.revenue,
                    secondary: `${row.deals} deal${row.deals === 1 ? '' : 's'} · ${formatINR(Math.round(row.revenuePerLead))} per lead`,
                  }))}
                  formatValue={formatINR}
                />
              ) : <EmptyState title="No revenue recorded yet" />}
            </div>
          </Card>

          <Card className="card-pad">
            <p className="label">Revenue by campaign</p>
            <div className="mt-3">
              {revenue.byCampaign.length ? (
                <HorizontalBars
                  rows={revenue.byCampaign.map((row) => ({
                    label: row.label, value: row.revenue, secondary: `${row.deals} deal${row.deals === 1 ? '' : 's'}`,
                  }))}
                  formatValue={formatINR}
                />
              ) : <EmptyState title="No revenue recorded yet" />}
            </div>
          </Card>

          <Card className="card-pad">
            <p className="label">Revenue by salesperson</p>
            <div className="mt-3">
              {revenue.bySalesperson.length ? (
                <HorizontalBars
                  rows={revenue.bySalesperson.map((row) => ({
                    label: row.label, value: row.revenue, secondary: `${row.deals} deal${row.deals === 1 ? '' : 's'}`,
                  }))}
                  formatValue={formatINR}
                />
              ) : <EmptyState title="No revenue recorded yet" />}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function Metric({
  label, value, hint, href, tone = 'neutral',
}: {
  label: string; value: string; hint?: string; href?: string;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
}) {
  const tones = {
    neutral: 'text-ink-900', danger: 'text-rose-600',
    warning: 'text-amber-600', success: 'text-emerald-600',
  } as const;

  const body = (
    <>
      <p className="text-[11px] font-medium text-ink-500">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', tones[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p> : null}
    </>
  );

  return href
    ? <Link href={href} className="bg-white px-4 py-3 hover:bg-brand-50/40">{body}</Link>
    : <div className="bg-white px-4 py-3">{body}</div>;
}

/**
 * The headline marketing view: which channels produce leads worth working, and
 * what they actually earn. Deliberately ends on revenue — the column every
 * other number in the row is building towards.
 */
function SourcePerformanceTable({
  rows, canSeeRevenue,
}: { rows: SourceReportRow[]; canSeeRevenue: boolean }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No leads in this period"
        description="Once leads arrive, each channel's volume, quality and revenue appear here."
      />
    );
  }

  const totals = rows.reduce(
    (sum, row) => ({
      leads: sum.leads + row.leads,
      hot: sum.hot + row.hot,
      appointments: sum.appointments + row.appointments,
      won: sum.won + row.won,
      revenue: sum.revenue + row.revenue,
      spend: sum.spend + row.spend,
    }),
    { leads: 0, hot: 0, appointments: 0, won: 0, revenue: 0, spend: 0 },
  );

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[54rem] border-collapse">
        <thead className="border-b border-ink-200 bg-ink-50/60">
          <tr>
            <th scope="col" className="table-head">Source</th>
            <th scope="col" className="table-head text-right">Leads</th>
            <th scope="col" className="table-head text-right">Hot</th>
            <th scope="col" className="table-head text-right">Appointments</th>
            <th scope="col" className="table-head text-right">Conversions</th>
            <th scope="col" className="table-head text-right">Conv. rate</th>
            <th scope="col" className="table-head text-right">Spend</th>
            <th scope="col" className="table-head text-right">Cost / lead</th>
            {canSeeRevenue ? <th scope="col" className="table-head text-right">Revenue</th> : null}
          </tr>
        </thead>

        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-brand-50/30">
              <td className="table-cell">
                <Link
                  href={`/leads?source=${encodeURIComponent(row.key)}`}
                  className="inline-flex items-center gap-1.5 font-medium text-ink-900 hover:text-brand-700"
                >
                  <SourceBadge source={row.key} showLabel={false} decorative />
                  {row.label}
                </Link>
              </td>
              <td className="table-cell text-right tabular-nums">{row.leads}</td>
              <td className={cn('table-cell text-right tabular-nums', row.hot > 0 && 'font-medium text-rose-600')}>
                {row.hot}
              </td>
              <td className="table-cell text-right tabular-nums">{row.appointments}</td>
              <td className="table-cell text-right tabular-nums text-emerald-700">{row.won}</td>
              <td className="table-cell text-right tabular-nums">
                {row.leads ? formatPercent(row.conversionRate, 1) : '—'}
              </td>
              <td className="table-cell text-right tabular-nums">
                {row.spend ? formatINR(row.spend) : '—'}
              </td>
              <td className="table-cell text-right tabular-nums">
                {row.costPerLead !== null && row.spend ? formatINR(Math.round(row.costPerLead)) : '—'}
              </td>
              {canSeeRevenue ? (
                <td className="table-cell text-right font-medium tabular-nums">
                  {row.revenue ? formatINR(row.revenue) : '—'}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>

        <tfoot className="border-t border-ink-200 bg-ink-50/60">
          <tr>
            <th scope="row" className="table-cell text-left font-semibold text-ink-800">All sources</th>
            <td className="table-cell text-right font-semibold tabular-nums">{totals.leads}</td>
            <td className="table-cell text-right font-semibold tabular-nums">{totals.hot}</td>
            <td className="table-cell text-right font-semibold tabular-nums">{totals.appointments}</td>
            <td className="table-cell text-right font-semibold tabular-nums">{totals.won}</td>
            <td className="table-cell text-right font-semibold tabular-nums">
              {totals.leads ? formatPercent(rate(totals.won, totals.leads), 1) : '—'}
            </td>
            <td className="table-cell text-right font-semibold tabular-nums">
              {totals.spend ? formatINR(totals.spend) : '—'}
            </td>
            <td className="table-cell text-right font-semibold tabular-nums">
              {totals.spend && totals.leads ? formatINR(Math.round(totals.spend / totals.leads)) : '—'}
            </td>
            {canSeeRevenue ? (
              <td className="table-cell text-right font-semibold tabular-nums">
                {totals.revenue ? formatINR(totals.revenue) : '—'}
              </td>
            ) : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SourceTable({ rows, canSeeRevenue }: { rows: SourceReportRow[]; canSeeRevenue: boolean }) {
  if (!rows.length) {
    return <EmptyState title="No data in this period" description="Try widening the date range." />;
  }

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[40rem] border-collapse">
        <thead className="border-b border-ink-200 bg-ink-50/60">
          <tr>
            <th scope="col" className="table-head">Name</th>
            <th scope="col" className="table-head text-right">Leads</th>
            <th scope="col" className="table-head text-right">Avg score</th>
            <th scope="col" className="table-head text-right">Hot</th>
            <th scope="col" className="table-head text-right">Qualified</th>
            <th scope="col" className="table-head text-right">Won</th>
            <th scope="col" className="table-head text-right">Spend</th>
            <th scope="col" className="table-head text-right">Cost / lead</th>
            {canSeeRevenue ? <th scope="col" className="table-head text-right">Revenue</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-brand-50/30">
              <td className="table-cell max-w-[14rem] truncate font-medium text-ink-800">{row.label}</td>
              <td className="table-cell text-right tabular-nums">{row.leads}</td>
              <td className={cn('table-cell text-right tabular-nums',
                row.averageScore >= 70 ? 'font-medium text-rose-600' : row.averageScore >= 40 ? 'text-amber-700' : '')}>
                {row.leads ? row.averageScore : '—'}
              </td>
              <td className="table-cell text-right tabular-nums text-rose-600">{row.hot}</td>
              <td className="table-cell text-right tabular-nums">
                {row.qualified}
                <span className="ml-1 text-[11px] text-ink-400">{row.leads ? formatPercent(row.qualificationRate) : ''}</span>
              </td>
              <td className="table-cell text-right tabular-nums text-emerald-700">{row.won}</td>
              <td className="table-cell text-right tabular-nums">{row.spend ? formatINR(row.spend) : '—'}</td>
              <td className="table-cell text-right tabular-nums">
                {row.costPerLead !== null && row.spend ? formatINR(Math.round(row.costPerLead)) : '—'}
              </td>
              {canSeeRevenue ? (
                <td className="table-cell text-right font-medium tabular-nums">
                  {row.revenue ? formatINR(row.revenue) : '—'}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
