import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { clientIp, fail, handleRoute, ok, readJson } from '@/lib/api';
import { enforceRateLimit } from '@/lib/rate-limit';
import { createLeadSchema, leadFilterSchema } from '@/lib/validation';
import { createLead, listLeads } from '@/services/lead.service';
import { buildAutomationContext, runAutomations } from '@/services/automation.service';
import { writeAuditLog } from '@/services/activity.service';

export const dynamic = 'force-dynamic';

/** GET /api/leads — organization-scoped, filtered, paginated. */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const parsed = leadFilterSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Invalid filter parameters.', 400, parsed.error.flatten().fieldErrors);
    }

    const result = await listLeads(
      { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name },
      parsed.data,
    );

    return ok(result.items, {
      total: result.total, page: result.page, pageSize: result.pageSize, pageCount: result.pageCount,
    });
  });
}

/** POST /api/leads — create a lead and run LEAD_CREATED automations. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleRoute(async () => {
    const user = await requireUser();
    enforceRateLimit(`api:leads:create:${user.organizationId}`, 120, 60_000);

    const body = await readJson(request);
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Invalid lead data.', 400, parsed.error.flatten().fieldErrors);
    }

    const actor = { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name };
    const lead = await createLead({ ...parsed.data, organizationId: user.organizationId }, actor);

    const ctx = await buildAutomationContext(lead.id);
    if (ctx) await runAutomations('LEAD_CREATED', ctx);

    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id, action: 'LEAD_CREATED',
      entityType: 'Lead', entityId: lead.id, ipAddress: clientIp(request),
    });

    return ok(lead, undefined, 201);
  });
}
