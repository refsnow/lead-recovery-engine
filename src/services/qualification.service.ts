import { prisma } from '@/db/client';
import { NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { stringifyJson } from '@/lib/json';
import { getAIProvider } from '@/providers/ai';
import { buildExtractionPrompt, buildReplyPrompt, buildSystemPrompt } from '@/prompts/qualification';
import { recordActivitySafe } from '@/services/activity.service';
import { notifyManagers } from '@/services/notification.service';
import { rescoreLead } from '@/services/lead.service';
import { sendOutboundMessage } from '@/services/conversation.service';
import { DEFAULT_QUALIFICATION_QUESTIONS } from '@/config/defaults';
import type { QualificationResult } from '@/types/domain';

/**
 * AI qualification workflow.
 *
 * Guarantees enforced here, above whichever provider is active:
 *  - the AI only ever sees approved knowledge-base entries;
 *  - extracted values are normalized before they touch the database;
 *  - low confidence or an escalation trigger sets `needsHumanHandoff`, and the
 *    conversation is handed to a person rather than continued automatically.
 */
export async function qualifyLead(leadId: string): Promise<QualificationResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      organization: { select: { id: true, name: true, industry: true } },
      conversations: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
    },
  });
  if (!lead) throw new NotFoundError('Lead');

  const [knowledge, questions] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where: { organizationId: lead.organizationId, isApproved: true },
      select: { question: true, answer: true },
      take: 40,
    }),
    prisma.qualificationQuestion.findMany({
      where: { organizationId: lead.organizationId, isActive: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  const transcript = buildTranscript(lead.conversations.flatMap((c) => c.messages));
  const systemPrompt = buildSystemPrompt({
    organizationName: lead.organization.name,
    industry: lead.organization.industry,
    knowledge,
    questions: questions.length ? questions : DEFAULT_QUALIFICATION_QUESTIONS,
  });

  const provider = getAIProvider();
  let result: QualificationResult;

  try {
    result = await provider.extractQualification(systemPrompt, buildExtractionPrompt(transcript));
  } catch (error) {
    await logger.error('AI', 'Qualification failed', {
      leadId, provider: provider.name, error: (error as Error).message,
    }, lead.organizationId);

    // Degrade to a human handoff rather than leaving the lead in limbo.
    result = {
      intent: null, location: null, propertyType: null, offeringType: null, budgetMin: null, budgetMax: null,
      purchaseTimeline: null, decisionTimeline: null, summary: 'Automatic qualification is temporarily unavailable.',
      confidence: 0, needsHumanHandoff: true,
      handoffReason: 'The qualification service was unavailable. Please qualify this lead manually.',
      answers: {},
    };
  }

  // Never overwrite a value a person already confirmed with a null from the model.
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      intent: result.intent ?? lead.intent,
      location: result.location ?? lead.location,
      propertyType: result.propertyType ?? lead.propertyType,
      offeringType: result.offeringType ?? result.propertyType ?? lead.offeringType,
      budgetMin: result.budgetMin ?? lead.budgetMin,
      budgetMax: result.budgetMax ?? lead.budgetMax,
      purchaseTimeline: result.purchaseTimeline ?? lead.purchaseTimeline,
      decisionTimeline: result.decisionTimeline ?? result.purchaseTimeline ?? lead.decisionTimeline,
      aiSummary: result.summary,
      aiConfidence: result.confidence,
      qualificationData: stringifyJson(result.answers),
      needsHumanHandoff: result.needsHumanHandoff,
      handoffReason: result.handoffReason,
      status: lead.status === 'NEW' || lead.status === 'CONTACTED'
        ? (result.confidence >= 0.6 ? 'QUALIFIED' : lead.status)
        : lead.status,
      lastActivityAt: new Date(),
    },
  });

  await recordActivitySafe({
    leadId, type: 'AI_QUALIFICATION_COMPLETED', actorType: 'AI',
    summary: `AI qualification completed (${Math.round(result.confidence * 100)}% confidence).`,
    metadata: { confidence: result.confidence, provider: provider.name },
  });

  await rescoreLead(leadId);

  if (result.needsHumanHandoff) {
    await handOffToHuman(leadId, result.handoffReason ?? 'Escalated by the qualification assistant.');
  }

  return result;
}

/** Puts the conversation in a HANDED_OFF state and alerts the owning team. */
export async function handOffToHuman(leadId: string, reason: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, organizationId: true, assignedToId: true, score: true },
  });
  if (!lead) return;

  await prisma.conversation.updateMany({
    where: { leadId, status: { in: ['ACTIVE', 'AWAITING_REPLY'] } },
    data: { status: 'HANDED_OFF' },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { needsHumanHandoff: true, handoffReason: reason },
  });
  // Automated messaging must stop the moment a human is required.
  await prisma.followUp.updateMany({
    where: { leadId, status: 'PENDING', automated: true },
    data: { status: 'CANCELLED', notes: 'Cancelled: handed off to a human salesperson.' },
  });

  await recordActivitySafe({
    leadId, type: 'HANDED_OFF_TO_HUMAN', actorType: 'AI',
    summary: `Handed off to a human: ${reason}`,
  });

  await notifyManagers({
    organizationId: lead.organizationId, type: 'HIGH_INTENT_INACTIVE', severity: 'WARNING',
    title: `Human handoff needed: ${lead.name}`, body: reason, leadId: lead.id,
  });
}

/**
 * Generates the next qualification message. Returns null when the lead has been
 * handed off — the AI must not keep messaging after escalation.
 */
export async function generateQualificationReply(leadId: string): Promise<string | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      organization: { select: { name: true, industry: true } },
      conversations: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
    },
  });
  if (!lead || lead.needsHumanHandoff) return null;

  const [knowledge, questions] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where: { organizationId: lead.organizationId, isApproved: true },
      select: { question: true, answer: true }, take: 40,
    }),
    prisma.qualificationQuestion.findMany({
      where: { organizationId: lead.organizationId, isActive: true }, orderBy: { order: 'asc' },
    }),
  ]);

  const missingKeys = [
    !lead.intent && 'intent',
    !lead.location && 'location',
    !lead.propertyType && !lead.offeringType && 'offeringType',
    !lead.budgetMax && 'budget',
    !lead.purchaseTimeline && !lead.decisionTimeline && 'timeline',
  ].filter(Boolean) as string[];

  const provider = getAIProvider();
  try {
    return await provider.complete([
      {
        role: 'system',
        content: buildSystemPrompt({
          organizationName: lead.organization.name,
          industry: lead.organization.industry,
          knowledge,
          questions: questions.length ? questions : DEFAULT_QUALIFICATION_QUESTIONS,
        }),
      },
      {
        role: 'user',
        content: buildReplyPrompt({
          leadName: lead.name,
          transcript: buildTranscript(lead.conversations.flatMap((c) => c.messages)),
          missingKeys,
        }),
      },
    ]);
  } catch (error) {
    await logger.error('AI', 'Reply generation failed', {
      leadId, error: (error as Error).message,
    }, lead.organizationId);
    return null;
  }
}

/** Qualifies, then sends the AI's next message if a handoff was not triggered. */
export async function runQualificationTurn(leadId: string): Promise<void> {
  const result = await qualifyLead(leadId);
  if (result.needsHumanHandoff) return;

  const reply = await generateQualificationReply(leadId);
  if (!reply) return;

  await sendOutboundMessage({
    leadId, body: reply, sender: 'AI', senderName: 'Qualification Assistant', aiGenerated: true,
  });
}

function buildTranscript(messages: { sender: string; body: string; messageType: string }[]): string {
  return messages
    .filter((message) => message.messageType !== 'NOTE') // internal notes are not AI context
    .map((message) => `${message.sender === 'LEAD' ? 'Lead' : 'Assistant'}: ${message.body}`)
    .join('\n');
}
