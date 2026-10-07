import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listAssignableUsers } from '@/services/team.service';
import { INTENTS, PURCHASE_TIMELINES } from '@/types/domain';
import { titleCase } from '@/lib/format';
import { Card, CardHeader, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/ui/action-form';
import { SourceSelect } from '@/components/leads/source-select';
import { createLeadAction } from '@/app/actions/lead-actions';

export const metadata = { title: 'Add lead' };
export const dynamic = 'force-dynamic';

export default async function NewLeadPage() {
  const user = await requireUser();

  const [salespeople, campaigns] = await Promise.all([
    listAssignableUsers(user.organizationId),
    prisma.campaign.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <>
      <Link href="/leads" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Back to leads
      </Link>

      <PageHeader
        title="Add a lead"
        description="Manually captured enquiries — walk-ins, referrals and calls — enter the same pipeline as advertising leads."
      />

      <Card className="max-w-2xl">
        <CardHeader title="Lead details" description="Only a name and phone number are required." />
        <div className="p-4 sm:p-5">
          <ActionForm action={createLeadAction} submitLabel="Create lead">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Name *</span>
                <input name="name" required minLength={2} maxLength={120} className="input mt-1" placeholder="Rahul Sharma" />
              </label>
              <label className="block">
                <span className="label">Phone *</span>
                <input name="phone" required className="input mt-1" placeholder="+91 98100 00000" inputMode="tel" />
              </label>
              <label className="block">
                <span className="label">Email</span>
                <input type="email" name="email" className="input mt-1" placeholder="rahul@example.com" />
              </label>
              <SourceSelect defaultValue="WALK_IN" />
              <label className="block">
                <span className="label">Campaign</span>
                <select name="campaignId" className="input mt-1" defaultValue="">
                  <option value="">No campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </label>
              {can(user.role, 'ASSIGN_LEADS') ? (
                <label className="block">
                  <span className="label">Assign to</span>
                  <select name="assignedToId" className="input mt-1" defaultValue="">
                    <option value="">Leave for automation to assign</option>
                    {salespeople.map((person) => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <fieldset className="mt-4 rounded-lg border border-ink-200 p-3">
              <legend className="label px-1">Requirement & qualification (optional — improves initial score)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Location / City</span>
                  <input name="location" maxLength={120} className="input mt-1" placeholder="Mumbai / Delhi NCR / Remote" />
                </label>
                <label className="block">
                  <span className="label">Offering / Requirement</span>
                  <input name="propertyType" maxLength={60} className="input mt-1" placeholder="e.g. PMS, AIF, 3BHK, Enterprise" />
                </label>
                <label className="block">
                  <span className="label">Budget / Investable surplus (₹)</span>
                  <input type="number" name="budgetMax" min="0" step="1" className="input mt-1" placeholder="20000000" />
                </label>
                <label className="block">
                  <span className="label">Decision timeline</span>
                  <select name="purchaseTimeline" className="input mt-1" defaultValue="">
                    <option value="">Not known</option>
                    {PURCHASE_TIMELINES.map((timeline) => (
                      <option key={timeline} value={timeline}>{titleCase(timeline)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Intent</span>
                  <select name="intent" className="input mt-1" defaultValue="">
                    <option value="">Not known</option>
                    {INTENTS.map((intent) => (
                      <option key={intent} value={intent}>{titleCase(intent)}</option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
