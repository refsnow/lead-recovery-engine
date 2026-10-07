import { requireUser } from '@/lib/auth';
import { handleRoute, ok } from '@/lib/api';
import { rescoreLead } from '@/services/lead.service';

export const dynamic = 'force-dynamic';

/** POST /api/leads/:id/score — recompute the score and return the explanation. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await params;

    // Tenancy: rescoring is only permitted for a lead the caller can already see.
    const { getLeadDetail } = await import('@/services/lead.service');
    const actor = { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name };
    await getLeadDetail(actor, id);

    const { scored } = await rescoreLead(id, actor);
    return ok(scored);
  });
}
