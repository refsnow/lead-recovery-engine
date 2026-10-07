import { prisma } from '@/db/client';
import { stringifyJson } from '@/lib/json';
import type { ActivityType } from '@/types/domain';

interface RecordActivityInput {
  leadId: string;
  type: ActivityType;
  summary: string;
  actorId?: string | null;
  actorType?: 'USER' | 'AI' | 'SYSTEM' | 'LEAD';
  metadata?: Record<string, unknown>;
}

/**
 * Appends to a lead's timeline. Activity recording is never allowed to fail a
 * business operation, so errors are logged and swallowed by callers that use
 * `recordActivitySafe`.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  await prisma.activity.create({
    data: {
      leadId: input.leadId,
      type: input.type,
      summary: input.summary,
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? 'SYSTEM',
      metadata: input.metadata ? stringifyJson(input.metadata) : null,
    },
  });
}

export async function recordActivitySafe(input: RecordActivityInput): Promise<void> {
  try {
    await recordActivity(input);
  } catch (error) {
    console.error(`[activity] failed to record ${input.type}: ${(error as Error).message}`);
  }
}

export async function writeAuditLog(input: {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? stringifyJson(input.metadata) : null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error(`[audit] failed to record ${input.action}: ${(error as Error).message}`);
  }
}
