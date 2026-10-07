import { requireUser } from '@/lib/auth';
import { handleRoute, ok } from '@/lib/api';
import { getFunnel, getMedianResponseMinutes, getTodayMetrics } from '@/services/dashboard.service';
import { getRecoveryAlerts } from '@/services/recovery.service';

export const dynamic = 'force-dynamic';

/** GET /api/dashboard — the same figures the dashboard screen renders. */
export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const actor = { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name };

    const [today, funnel, alerts, medianResponseMinutes] = await Promise.all([
      getTodayMetrics(actor),
      getFunnel(actor),
      getRecoveryAlerts(actor),
      getMedianResponseMinutes(user.organizationId),
    ]);

    return ok({ today, funnel, alerts, medianResponseMinutes });
  });
}
