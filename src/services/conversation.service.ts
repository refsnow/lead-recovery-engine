import { prisma } from '@/db/client';
import { NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getMessagingProvider } from '@/providers/messaging';
import { recordActivitySafe } from '@/services/activity.service';
import { markContacted, rescoreLead } from '@/services/lead.service';
import type { Channel, MessageSender } from '@/types/domain';

/** Returns the lead's open conversation on a channel, creating it if needed. */
export async function getOrCreateConversation(leadId: string, channel: Channel = 'WHATSAPP') {
  const existing = await prisma.conversation.findFirst({
    where: { leadId, channel, status: { not: 'CLOSED' } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;
  return prisma.conversation.create({ data: { leadId, channel } });
}

interface SendMessageInput {
  leadId: string;
  body: string;
  channel?: Channel;
  sender: MessageSender;
  senderName?: string;
  senderId?: string | null;
  aiGenerated?: boolean;
  templateName?: string;
}

/**
 * Sends an outbound message through the active messaging provider and records
 * it. A provider failure is persisted as a FAILED message rather than thrown,
 * so a messaging outage degrades the feature instead of breaking the page.
 */
export async function sendOutboundMessage(input: SendMessageInput) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new NotFoundError('Lead');

  const channel = input.channel ?? 'WHATSAPP';
  const conversation = await getOrCreateConversation(lead.id, channel);
  const provider = getMessagingProvider();

  let externalId: string | null = null;
  let deliveryStatus = 'SENT';
  let failureReason: string | null = null;

  try {
    const result = input.templateName
      ? await provider.sendTemplate({ to: lead.phone, templateName: input.templateName, templateParams: [lead.name] })
      : await provider.sendMessage({ to: lead.phone, body: input.body });
    externalId = result.externalId || null;
    deliveryStatus = result.status;
    failureReason = result.failureReason ?? null;
  } catch (error) {
    deliveryStatus = 'FAILED';
    failureReason = (error as Error).message;
    await logger.error('MESSAGING', 'Outbound message failed', {
      leadId: lead.id, provider: provider.name, error: failureReason,
    }, lead.organizationId);
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      sender: input.sender,
      senderName: input.senderName ?? null,
      body: input.body,
      messageType: input.templateName ? 'TEMPLATE' : 'TEXT',
      aiGenerated: input.aiGenerated ?? false,
      deliveryStatus,
      failureReason,
      externalId,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: 'AWAITING_REPLY', updatedAt: new Date() },
  });

  if (deliveryStatus !== 'FAILED') {
    await markContacted(lead.id);
    await recordActivitySafe({
      leadId: lead.id,
      type: 'MESSAGE_SENT',
      summary: `${input.aiGenerated ? 'AI' : input.senderName ?? 'System'} sent a ${channel.toLowerCase()} message.`,
      actorId: input.senderId ?? null,
      actorType: input.aiGenerated ? 'AI' : input.senderId ? 'USER' : 'SYSTEM',
    });
  }

  return { message, delivered: deliveryStatus !== 'FAILED', failureReason };
}

/** Records an internal note. Notes are never sent to the lead. */
export async function addNote(leadId: string, body: string, author: { id: string; name: string }) {
  const conversation = await getOrCreateConversation(leadId, 'IN_APP');
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id, sender: 'SALESPERSON', senderName: author.name,
      body, messageType: 'NOTE', deliveryStatus: 'DELIVERED',
    },
  });

  await prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });
  await recordActivitySafe({
    leadId, type: 'NOTE_ADDED', actorId: author.id, actorType: 'USER',
    summary: `${author.name} added a note.`,
  });

  return message;
}

/**
 * Records an inbound message from a lead: stops automated follow-ups, updates
 * engagement signals, rescores, and re-runs qualification.
 */
export async function recordInboundMessage(input: {
  leadId: string; body: string; channel?: Channel; externalId?: string; receivedAt?: Date;
}) {
  const conversation = await getOrCreateConversation(input.leadId, input.channel ?? 'WHATSAPP');

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id, sender: 'LEAD', body: input.body,
      deliveryStatus: 'DELIVERED', externalId: input.externalId ?? null,
      createdAt: input.receivedAt ?? new Date(),
    },
  });

  await prisma.conversation.update({ where: { id: conversation.id }, data: { status: 'ACTIVE' } });
  await prisma.lead.update({
    where: { id: input.leadId },
    data: { lastActivityAt: input.receivedAt ?? new Date() },
  });

  await recordActivitySafe({
    leadId: input.leadId, type: 'LEAD_REPLIED', actorType: 'LEAD',
    summary: 'Lead replied.',
  });

  // A reply cancels the automated sequence — a human conversation is underway.
  await prisma.followUp.updateMany({
    where: { leadId: input.leadId, status: 'PENDING', automated: true },
    data: { status: 'CANCELLED', notes: 'Cancelled automatically: the lead replied.' },
  });

  await rescoreLead(input.leadId);
  return message;
}

export async function getConversationThreads(organizationId: string, options: {
  assignedToId?: string; limit?: number;
} = {}) {
  return prisma.conversation.findMany({
    where: {
      lead: { organizationId, ...(options.assignedToId ? { assignedToId: options.assignedToId } : {}) },
    },
    include: {
      lead: { select: { id: true, name: true, phone: true, score: true, temperature: true, status: true, assignedTo: { select: { name: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: options.limit ?? 50,
  });
}
