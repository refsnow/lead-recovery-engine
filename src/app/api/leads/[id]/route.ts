import { requireUser } from '@/lib/auth';
import { fail, handleRoute, ok, readJson } from '@/lib/api';
import { updateLeadSchema } from '@/lib/validation';
import { getLeadDetail, updateLead } from '@/services/lead.service';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/leads/:id */
export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await params;
    const lead = await getLeadDetail(
      { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name },
      id,
    );
    return ok(lead);
  });
}

/** PATCH /api/leads/:id */
export async function PATCH(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await params;

    const parsed = updateLeadSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Invalid lead data.', 400, parsed.error.flatten().fieldErrors);
    }

    const lead = await updateLead(
      { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name },
      id, parsed.data,
    );
    return ok(lead);
  });
}
