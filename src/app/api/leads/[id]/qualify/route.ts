import { requireUser } from '@/lib/auth';
import { handleRoute, ok } from '@/lib/api';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getLeadDetail } from '@/services/lead.service';
import { qualifyLead } from '@/services/qualification.service';

export const dynamic = 'force-dynamic';

/** POST /api/leads/:id/qualify — run AI qualification for this lead. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await params;

    // AI calls cost money and time; cap per organization.
    enforceRateLimit(`api:qualify:${user.organizationId}`, 60, 60_000);

    await getLeadDetail(
      { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name },
      id,
    );

    const result = await qualifyLead(id);
    return ok(result);
  });
}
