import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { AuthorizationError } from '@/lib/errors';
import { fail, handleRoute, ok, readJson } from '@/lib/api';
import { assignLeadSchema } from '@/lib/validation';
import { assignLead } from '@/services/lead.service';

export const dynamic = 'force-dynamic';

/** POST /api/leads/:id/assign */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    if (!can(user.role, 'ASSIGN_LEADS')) throw new AuthorizationError('Only managers can assign leads.');

    const { id } = await params;
    const parsed = assignLeadSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Invalid assignment data.', 400, parsed.error.flatten().fieldErrors);
    }

    const lead = await assignLead(
      { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name },
      id, parsed.data.assignedToId,
    );
    return ok(lead);
  });
}
