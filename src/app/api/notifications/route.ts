import { requireUser } from '@/lib/auth';
import { handleRoute, ok } from '@/lib/api';
import { listNotifications, markAllRead } from '@/services/notification.service';

export const dynamic = 'force-dynamic';

/** GET /api/notifications */
export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const notifications = await listNotifications(user.id, user.organizationId);
    return ok(notifications);
  });
}

/** POST /api/notifications — mark everything read. */
export async function POST() {
  return handleRoute(async () => {
    const user = await requireUser();
    await markAllRead(user.id, user.organizationId);
    return ok({ read: true });
  });
}
