import { requireUser } from '@/lib/auth';
import { fail, handleRoute, ok, readJson } from '@/lib/api';
import { createFollowUpSchema } from '@/lib/validation';
import { createFollowUp } from '@/services/followup.service';

export const dynamic = 'force-dynamic';

/** POST /api/leads/:id/followup */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await params;

    const parsed = createFollowUpSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Invalid follow-up data.', 400, parsed.error.flatten().fieldErrors);
    }

    const followUp = await createFollowUp(
      { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name },
      id, parsed.data,
    );
    return ok(followUp, undefined, 201);
  });
}
