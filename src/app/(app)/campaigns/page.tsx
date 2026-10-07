import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getCampaignReport } from '@/services/reports.service';
import { prisma } from '@/db/client';
import { formatINR, formatPercent } from '@/lib/format';
import { LEAD_SOURCES } from '@/types/domain';
import { titleCase } from '@/lib/format';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/ui/action-form';
import { saveCampaignAction } from '@/app/actions/admin-actions';

export const metadata = { title: 'Campaigns' };
export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const user = await requireUser();
  if (!can(user.role, 'MANAGE_CAMPAIGNS')) redirect('/dashboard');

  const [report, campaigns] = await Promise.all([
    getCampaignReport(user.organizationId),
    prisma.campaign.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
    }),
  ]);

  const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const canSeeRevenue = can(user.role, 'VIEW_REVENUE');

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Spend against lead quality — which campaigns produce leads worth working, not just leads."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Campaign performance" />
          {report.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-8 w-8" />}
              title="No campaigns yet"
              description="Add a campaign to track spend against the leads it produces."
            />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[52rem] border-collapse">
                <thead className="border-b border-ink-200 bg-ink-50/60">
                  <tr>
                    <th scope="col" className="table-head">Campaign</th>
                    <th scope="col" className="table-head text-right">Leads</th>
                    <th scope="col" className="table-head text-right">Avg score</th>
                    <th scope="col" className="table-head text-right">Contact rate</th>
                    <th scope="col" className="table-head text-right">Qualified</th>
                    <th scope="col" className="table-head text-right">Won</th>
                    <th scope="col" className="table-head text-right">Spend</th>
                    <th scope="col" className="table-head text-right">Cost / lead</th>
                    <th scope="col" className="table-head text-right">Cost / qualified</th>
                    {canSeeRevenue ? <th scope="col" className="table-head text-right">Revenue</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {report.map((row) => {
                    const campaign = byId.get(row.key);
                    return (
                      <tr key={row.key} className="hover:bg-brand-50/30">
                        <td className="table-cell max-w-[14rem]">
                          {row.key === 'none' ? (
                            <span className="text-ink-500">{row.label}</span>
                          ) : (
                            <Link href={`/leads?campaignId=${row.key}`} className="font-medium text-ink-900 hover:text-brand-700">
                              {row.label}
                            </Link>
                          )}
                          {campaign && !campaign.isActive ? (
                            <Badge tone="neutral" className="ml-1.5">Paused</Badge>
                          ) : null}
                        </td>
                        <td className="table-cell text-right tabular-nums">{row.leads}</td>
                        <td className="table-cell text-right tabular-nums">{row.leads ? row.averageScore : '—'}</td>
                        <td className="table-cell text-right tabular-nums">{row.leads ? formatPercent(row.contactRate) : '—'}</td>
                        <td className="table-cell text-right tabular-nums">{row.qualified}</td>
                        <td className="table-cell text-right tabular-nums text-emerald-700">{row.won}</td>
                        <td className="table-cell text-right tabular-nums">{row.spend ? formatINR(row.spend) : '—'}</td>
                        <td className="table-cell text-right tabular-nums">
                          {row.costPerLead !== null && row.spend ? formatINR(Math.round(row.costPerLead)) : '—'}
                        </td>
                        <td className="table-cell text-right tabular-nums">
                          {row.costPerQualified !== null && row.spend ? formatINR(Math.round(row.costPerQualified)) : '—'}
                        </td>
                        {canSeeRevenue ? (
                          <td className="table-cell text-right font-medium tabular-nums">
                            {row.revenue ? formatINR(row.revenue) : '—'}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Add a campaign" description="Record spend so cost per qualified lead is accurate." />
          <div className="p-4 sm:p-5">
            <ActionForm action={saveCampaignAction} submitLabel="Create campaign" resetOnSuccess>
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Name</span>
                  <input name="name" required maxLength={160} className="input mt-1" placeholder="Luxury Gurgaon 3BHK" />
                </label>
                <label className="block">
                  <span className="label">Source</span>
                  <select name="source" className="input mt-1" defaultValue="META_LEAD_ADS">
                    {LEAD_SOURCES.map((source) => (
                      <option key={source} value={source}>{titleCase(source)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Spend to date (₹)</span>
                  <input type="number" name="spend" min="0" step="1" defaultValue="0" className="input mt-1" />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" name="isActive" defaultChecked className="rounded border-ink-300" />
                  Currently running
                </label>
              </div>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
