import { prisma } from '@/db/client';
import type { NotificationType } from '@/types/domain';

interface CreateNotificationInput {
  organizationId: string;
  type: NotificationType;
  title: string;
  body: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  userId?: string | null;
  leadId?: string | null;
}

/**
 * In-app notifications. The delivery channel is deliberately abstracted behind
 * this service so email/WhatsApp delivery can be added without touching callers.
 */
export async function notify(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        leadId: input.leadId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        severity: input.severity ?? 'INFO',
      },
    });
  } catch (error) {
    console.error(`[notify] failed to create ${input.type}: ${(error as Error).message}`);
  }
}

/** Notifies every manager/owner/admin in an organization. */
export async function notifyManagers(input: Omit<CreateNotificationInput, 'userId'>): Promise<void> {
  const managers = await prisma.user.findMany({
    where: {
      organizationId: input.organizationId,
      isActive: true,
      role: { in: ['OWNER', 'ADMIN', 'SALES_MANAGER'] },
    },
    select: { id: true },
  });

  await Promise.all(managers.map((manager) => notify({ ...input, userId: manager.id })));
}

export async function listNotifications(userId: string, organizationId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { organizationId, OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { lead: { select: { id: true, name: true } } },
  });
}

export async function countUnread(userId: string, organizationId: string): Promise<number> {
  return prisma.notification.count({
    where: { organizationId, readAt: null, OR: [{ userId }, { userId: null }] },
  });
}

export async function markAllRead(userId: string, organizationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { organizationId, readAt: null, OR: [{ userId }, { userId: null }] },
    data: { readAt: new Date() },
  });
}
