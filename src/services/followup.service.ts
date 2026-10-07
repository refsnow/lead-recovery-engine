import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { DEFAULT_FOLLOW_UP_SEQUENCE } from '@/config/defaults';
import { recordActivitySafe } from '@/services/activity.service';
import { notify, notifyManagers } from '@/services/notification.service';
import { sendOutboundMessage } from '@/services/conversation.service';
import type { ActorContext } from '@/services/lead.service';
import type { Channel, FollowUpStatus, FollowUpType } from '@/types/domain';

// ---------------------------------------------------------------------------
// Manual follow-ups
// ---------------------------------------------------------------------------

export async function createFollowUp(actor: ActorContext, leadId: string, input: {
  type: FollowUpType; scheduledFor: Date; assignedToId?: string | null; notes?: string;
  automated?: boolean; sequenceStep?: number; channel?: Channel;
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
  });
  if (!lead) throw new NotFoundError('Lead');

  const assignedToId = input.assignedToId ?? lead.assignedToId ?? null;
  if (assignedToId) {
    const exists = await prisma.user.count({
      where: { id: assignedToId, organizationId: actor.organizationId },
    });
    if (!exists) throw new ValidationError('The selected owner is not part of this organization.');
  }

  const followUp = await prisma.followUp.create({
    data: {
      leadId, assignedToId, type: input.type, scheduledFor: input.scheduledFor,
      notes: input.notes ?? null, automated: input.automated ?? false,
      sequenceStep: input.sequenceStep ?? null, channel: input.channel ?? 'MANUAL',
    },
  });

  await syncNextFollowUp(leadId);
  await recordActivitySafe({
    leadId, type: 'FOLLOW_UP_CREATED', actorId: actor.id, actorType: input.automated ? 'SYSTEM' : 'USER',
    summary: `${input.type} follow-up scheduled for ${input.scheduledFor.toLocaleString('en-IN')}.`,
  });

  return followUp;
}

export async function completeFollowUp(actor: ActorContext, followUpId: string, input: {
  status: FollowUpStatus; notes?: string;
}) {
  const followUp = await prisma.followUp.findFirst({
    where: { id: followUpId, lead: { organizationId: actor.organizationId } },
    include: { lead: { select: { id: true, name: true, status: true } } },
  });
  if (!followUp) throw new NotFoundError('Follow-up');

  // A salesperson may only close their own follow-ups.
  if (actor.role === 'SALESPERSON' && followUp.assignedToId && followUp.assignedToId !== actor.id) {
    throw new ValidationError('This follow-up is assigned to another salesperson.');
  }

  const updated = await prisma.followUp.update({
    where: { id: followUpId },
    data: {
      status: input.status,
      completedAt: input.status === 'COMPLETED' ? new Date() : null,
      notes: input.notes ?? followUp.notes,
    },
  });

  if (input.status === 'COMPLETED') {
    await prisma.lead.update({
      where: { id: followUp.leadId },
      data: {
        lastContactedAt: new Date(),
        lastActivityAt: new Date(),
        status: followUp.lead.status === 'NEW' ? 'CONTACTED' : followUp.lead.status,
      },
    });
  }

  await syncNextFollowUp(followUp.leadId);
  await recordActivitySafe({
    leadId: followUp.leadId, type: 'FOLLOW_UP_COMPLETED', actorId: actor.id, actorType: 'USER',
    summary: `${followUp.type} follow-up marked ${input.status.toLowerCase()}${input.notes ? ` — ${input.notes}` : ''}.`,
  });

  return updated;
}

/** Keeps `lead.nextFollowUpAt` consistent with the earliest pending follow-up. */
export async function syncNextFollowUp(leadId: string): Promise<void> {
  const next = await prisma.followUp.findFirst({
    where: { leadId, status: 'PENDING' },
    orderBy: { scheduledFor: 'asc' },
    select: { scheduledFor: true },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { nextFollowUpAt: next?.scheduledFor ?? null },
  });
}

// ---------------------------------------------------------------------------
// Automated sequence
// ---------------------------------------------------------------------------

/**
 * Schedules the configured follow-up sequence for a lead.
 * Steps are created as PENDING automated follow-ups; the scheduler executes
 * each one when due, subject to its stop conditions.
 */
export async function startFollowUpSequence(leadId: string): Promise<number> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new NotFoundError('Lead');

  const existing = await prisma.followUp.count({
    where: { leadId, automated: true, status: 'PENDING' },
  });
  if (existing > 0) return 0; // sequence already running

  // Never start a cadence for a lead that already meets a stop condition — a
  // lead who replied, booked a visit or was handed off must not be re-messaged.
  // The scheduler also checks this at send time; checking here avoids creating
  // (and immediately cancelling) steps that could never legitimately send.
  const { stop } = await shouldStopSequence(leadId);
  if (stop) return 0;

  const steps = await prisma.followUpStep.findMany({
    where: { organizationId: lead.organizationId, isActive: true },
    orderBy: { order: 'asc' },
  });
  const sequence = steps.length ? steps : DEFAULT_FOLLOW_UP_SEQUENCE.map((step, index) => ({
    ...step, id: `default-${index}`, organizationId: lead.organizationId,
    isActive: true, stopOnReply: true, stopOnAppointment: true,
  }));

  const now = Date.now();
  await prisma.followUp.createMany({
    data: sequence.map((step) => ({
      leadId,
      assignedToId: lead.assignedToId,
      type: 'AUTOMATED' as const,
      channel: step.channel,
      scheduledFor: new Date(now + step.delayMinutes * 60_000),
      automated: true,
      sequenceStep: step.order,
      notes: step.name,
    })),
  });

  await syncNextFollowUp(leadId);
  await recordActivitySafe({
    leadId, type: 'FOLLOW_UP_CREATED', actorType: 'SYSTEM',
    summary: `Automated follow-up sequence started (${sequence.length} steps).`,
  });

  return sequence.length;
}

/** Stop conditions: a reply, a booked appointment, or a closed lead halt the sequence. */
export async function shouldStopSequence(leadId: string): Promise<{ stop: boolean; reason?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      conversations: { include: { messages: { where: { sender: 'LEAD' }, take: 1 } } },
      appointments: { where: { status: { in: ['SCHEDULED', 'COMPLETED'] } }, take: 1 },
    },
  });
  if (!lead) return { stop: true, reason: 'Lead no longer exists.' };

  if (['WON', 'LOST'].includes(lead.status)) return { stop: true, reason: `Lead is ${lead.status}.` };
  if (lead.needsHumanHandoff) return { stop: true, reason: 'Lead was handed off to a human.' };
  if (lead.appointments.length) return { stop: true, reason: 'An appointment is booked.' };
  if (lead.conversations.some((c) => c.messages.length)) return { stop: true, reason: 'The lead replied.' };

  return { stop: false };
}

/**
 * Executes every automated follow-up that is now due.
 * Called by the scheduler endpoint (`POST /api/cron/run`), which n8n, Vercel
 * Cron, or any external scheduler can drive.
 */
export async function runDueAutomatedFollowUps(limit = 50): Promise<{ sent: number; skipped: number; failed: number }> {
  const due = await prisma.followUp.findMany({
    where: { status: 'PENDING', automated: true, scheduledFor: { lte: new Date() } },
    include: { lead: { include: { organization: { select: { name: true } } } } },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
  });

  let sent = 0; let skipped = 0; let failed = 0;

  for (const followUp of due) {
    const { stop, reason } = await shouldStopSequence(followUp.leadId);
    if (stop) {
      await prisma.followUp.updateMany({
        where: { leadId: followUp.leadId, status: 'PENDING', automated: true },
        data: { status: 'CANCELLED', notes: `Stopped: ${reason}` },
      });
      skipped += 1;
      continue;
    }

    const step = await resolveStepTemplate(followUp.lead.organizationId, followUp.sequenceStep ?? 0);
    const body = renderTemplate(step.messageTemplate, {
      name: followUp.lead.name.split(' ')[0] ?? followUp.lead.name,
      organization: followUp.lead.organization.name,
    });

    const result = await sendOutboundMessage({
      leadId: followUp.leadId, body, channel: step.channel as Channel,
      sender: 'AI', senderName: 'Follow-up Engine', aiGenerated: true,
    });

    await prisma.followUp.update({
      where: { id: followUp.id },
      data: {
        status: result.delivered ? 'COMPLETED' : 'SKIPPED',
        completedAt: result.delivered ? new Date() : null,
        notes: result.delivered ? step.name : `Delivery failed: ${result.failureReason ?? 'unknown error'}`,
      },
    });

    if (result.delivered) sent += 1; else failed += 1;
    await syncNextFollowUp(followUp.leadId);
  }

  return { sent, skipped, failed };
}

async function resolveStepTemplate(organizationId: string, order: number) {
  const step = await prisma.followUpStep.findFirst({
    where: { organizationId, order, isActive: true },
  });
  if (step) return step;
  const fallback = DEFAULT_FOLLOW_UP_SEQUENCE[Math.min(order, DEFAULT_FOLLOW_UP_SEQUENCE.length - 1)]!;
  return fallback;
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '');
}

// ---------------------------------------------------------------------------
// Overdue detection
// ---------------------------------------------------------------------------

export async function findOverdueFollowUps(organizationId: string, assignedToId?: string) {
  return prisma.followUp.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lt: new Date() },
      lead: { organizationId, status: { notIn: ['WON', 'LOST'] } },
      ...(assignedToId ? { assignedToId } : {}),
    },
    include: {
      lead: { select: { id: true, name: true, score: true, temperature: true, phone: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { scheduledFor: 'asc' },
  });
}

/** Raises one notification per newly overdue follow-up owner. */
export async function alertOverdueFollowUps(organizationId: string): Promise<number> {
  const overdue = await findOverdueFollowUps(organizationId);
  const byOwner = new Map<string, typeof overdue>();

  for (const item of overdue) {
    if (!item.assignedToId) continue;
    const bucket = byOwner.get(item.assignedToId) ?? [];
    bucket.push(item);
    byOwner.set(item.assignedToId, bucket);
  }

  for (const [ownerId, items] of byOwner) {
    await notify({
      organizationId, userId: ownerId, type: 'OVERDUE_FOLLOW_UP', severity: 'WARNING',
      title: `${items.length} overdue follow-up${items.length === 1 ? '' : 's'}`,
      body: `Oldest: ${items[0]!.lead.name}, due ${items[0]!.scheduledFor.toLocaleString('en-IN')}.`,
      leadId: items[0]!.lead.id,
    });
  }

  if (byOwner.size) {
    await notifyManagers({
      organizationId, type: 'OVERDUE_FOLLOW_UP', severity: 'WARNING',
      title: `${overdue.length} follow-ups are overdue`,
      body: `Across ${byOwner.size} salesperson${byOwner.size === 1 ? '' : 's'}.`,
    });
  }

  return overdue.length;
}
