import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { AuthorizationError } from '@/lib/errors';
import { handleRoute, ok } from '@/lib/api';
import { daysAgo } from '@/lib/dates';
import {
  getCampaignReport, getRecoveryReport, getRevenueReport, getSalesReport, getSourceReport,
} from '@/services/reports.service';

export const dynamic = 'force-dynamic';

/** GET /api/reports?days=30 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    if (!can(user.role, 'VIEW_ANALYTICS')) throw new AuthorizationError();

    const daysParam = new URL(request.url).searchParams.get('days');
    const days = daysParam === 'all' ? null : Math.min(365, Math.max(1, Number(daysParam) || 30));
    const since = days ? daysAgo(days) : undefined;

    const [sources, campaigns, sales, recovery, revenue] = await Promise.all([
      getSourceReport(user.organizationId, since),
      getCampaignReport(user.organizationId, since),
      getSalesReport(user.organizationId, since),
      getRecoveryReport(user.organizationId),
      can(user.role, 'VIEW_REVENUE') ? getRevenueReport(user.organizationId, since) : Promise.resolve(null),
    ]);

    return ok({ sources, campaigns, sales, recovery, revenue }, { days: days ?? 'all' });
  });
}
