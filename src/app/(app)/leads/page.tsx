import { Suspense } from 'react';
import { prisma } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { leadFilterSchema } from '@/lib/validation';
import { listLeads } from '@/services/lead.service';
import { listAssignableUsers } from '@/services/team.service';
import { Card, ErrorState, LinkButton, PageHeader, Skeleton } from '@/components/ui';
import { Pagination } from '@/components/ui/pagination';
import { LeadFilters } from '@/components/leads/lead-filters';
import { LeadTable } from '@/components/leads/lead-table';

export const metadata = { title: 'Leads' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const raw = await searchParams;

  // Invalid query strings degrade to defaults rather than erroring the page.
  const parsed = leadFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : leadFilterSchema.parse({});

  const actor = { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name };

  const [result, salespeople, campaigns] = await Promise.all([
    listLeads(actor, filters),
    listAssignableUsers(user.organizationId),
    prisma.campaign.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const baseParams = Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => key !== 'page')
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );

  return (
    <>
      <PageHeader
        title="Leads"
        description={
          can(user.role, 'VIEW_ALL_LEADS')
            ? 'Every lead in your organization, with the signals that show which are being lost.'
            : 'Leads assigned to you.'
        }
        actions={<LinkButton href="/leads/new" size="sm">Add lead</LinkButton>}
      />

      {!parsed.success ? (
        <div className="mb-4">
          <ErrorState
            title="Some filters were not understood"
            description="The unrecognised filters were ignored and the default view is shown."
          />
        </div>
      ) : null}

      <Suspense fallback={<Skeleton className="h-10" />}>
        <LeadFilters
          salespeople={salespeople}
          campaigns={campaigns}
          canFilterOwner={can(user.role, 'VIEW_ALL_LEADS')}
        />
      </Suspense>

      <Card>
        <LeadTable leads={result.items} />
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={result.pageSize}
          baseParams={baseParams}
        />
      </Card>
    </>
  );
}
