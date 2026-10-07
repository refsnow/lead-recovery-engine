import { prisma } from '@/db/client';
import { logger } from '@/lib/logger';
import { getLeadSourceProvider } from '@/providers/lead-source';
import { createLead, normalizePhone } from '@/services/lead.service';
import { recordLastTouch, sourceTypeFor } from '@/services/attribution.service';
import { runAutomations, buildAutomationContext } from '@/services/automation.service';
import { recordInboundMessage } from '@/services/conversation.service';
import { runQualificationTurn } from '@/services/qualification.service';
import type { ExternalLead } from '@/providers/types';

/**
 * Lead ingestion: the entry point of the whole product.
 * Every path (webhook, poll, manual, API) funnels through `ingestLead` so
 * scoring, automation and the follow-up sequence always run.
 */
export async function ingestLead(organizationId: string, external: ExternalLead, source = 'META_LEAD_ADS') {
  const lead = await createLead({
    organizationId,
    name: external.name,
    phone: external.phone,
    email: external.email ?? null,
    source,
    campaignName: external.campaignName,
    adName: external.adName ?? null,
    externalId: external.externalId,
    createdAt: external.createdAt,
    offeringType: external.offeringType ?? external.propertyType ?? null,
    propertyType: external.propertyType ?? external.offeringType ?? null,
    attribution: {
      sourceType: sourceTypeFor(source),
      ...external.attribution,
      firstTouchAt: external.attribution?.firstTouchAt ?? external.createdAt,
    },
  });

  const ctx = await buildAutomationContext(lead.id);
  if (ctx) {
    const executed = await runAutomations('LEAD_CREATED', ctx);
    await logger.info('WORKFLOW', 'Lead ingested', {
      leadId: lead.id, source, campaign: external.campaignName ?? null, rulesExecuted: executed,
    }, organizationId);
  }

  return lead;
}

/** Retrieves a lead from the source platform by id, then ingests it. */
export async function ingestFromWebhook(organizationId: string, leadgenId: string, meta: {
  campaignName?: string; adName?: string;
} = {}) {
  const provider = getLeadSourceProvider();
  try {
    const external = await provider.fetchLead(leadgenId);
    return await ingestLead(organizationId, {
      ...external,
      campaignName: external.campaignName ?? meta.campaignName,
      adName: external.adName ?? meta.adName,
    });
  } catch (error) {
    await logger.error('WEBHOOK', 'Lead retrieval failed', {
      leadgenId, provider: provider.name, error: (error as Error).message,
    }, organizationId);
    throw error;
  }
}

/**
 * Routes an inbound WhatsApp message to the matching lead. An unknown number
 * becomes a new WhatsApp-sourced lead rather than being dropped.
 */
export async function ingestInboundMessage(organizationId: string, input: {
  from: string; body: string; externalId?: string; senderName?: string; receivedAt?: Date;
}) {
  const phone = normalizePhone(input.from);
  let lead = await prisma.lead.findFirst({
    where: { organizationId, phone },
    orderBy: { createdAt: 'desc' },
  });

  if (!lead) {
    lead = await createLead({
      organizationId,
      name: input.senderName ?? `WhatsApp ${phone.slice(-4)}`,
      phone,
      source: 'WHATSAPP',
      attribution: { sourceType: 'MESSAGING', firstTouchAt: input.receivedAt ?? new Date() },
    });
  } else {
    // The lead already exists — this conversation is a later touch. Recording it
    // here must NOT disturb the original acquisition source.
    await recordLastTouch(lead.id, 'WHATSAPP', null, input.receivedAt ?? new Date());
  }

  await recordInboundMessage({
    leadId: lead.id, body: input.body, channel: 'WHATSAPP',
    externalId: input.externalId, receivedAt: input.receivedAt,
  });

  const ctx = await buildAutomationContext(lead.id);
  if (ctx) await runAutomations('LEAD_REPLIED', ctx);

  // Qualification is best-effort: a provider outage must not fail the webhook.
  try {
    await runQualificationTurn(lead.id);
  } catch (error) {
    await logger.error('AI', 'Qualification turn failed after inbound message', {
      leadId: lead.id, error: (error as Error).message,
    }, organizationId);
  }

  return lead;
}

/** Safety net for missed webhooks: polls the source for recent leads. */
export async function pollLeadSource(organizationId: string, since: Date) {
  const provider = getLeadSourceProvider();
  try {
    const leads = await provider.fetchRecentLeads(since);
    let ingested = 0;
    for (const external of leads) {
      const existing = await prisma.lead.findFirst({
        where: { organizationId, externalId: external.externalId },
      });
      if (existing) continue;
      await ingestLead(organizationId, external);
      ingested += 1;
    }
    return { ingested, fetched: leads.length, available: true as const };
  } catch (error) {
    await logger.error('WEBHOOK', 'Lead source poll failed', {
      provider: provider.name, error: (error as Error).message,
    }, organizationId);
    // Degrade gracefully — the dashboard shows "temporarily unavailable".
    return { ingested: 0, fetched: 0, available: false as const, error: (error as Error).message };
  }
}
