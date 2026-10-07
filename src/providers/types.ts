import type { LeadAttributionInput, QualificationResult } from '@/types/domain';

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  readonly name: string;
  readonly isMock: boolean;
  /** Free-form completion used for reply generation. */
  complete(messages: AIMessage[], options?: { maxTokens?: number }): Promise<string>;
  /** Structured extraction used for qualification. */
  extractQualification(systemPrompt: string, extractionPrompt: string): Promise<QualificationResult>;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export interface OutboundMessage {
  to: string;
  body: string;
  /** Business-initiated messages outside the 24h window require a template. */
  templateName?: string;
  templateParams?: string[];
}

export interface MessageSendResult {
  externalId: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  failureReason?: string;
}

export interface InboundMessage {
  from: string;
  externalId: string;
  body: string;
  receivedAt: Date;
  senderName?: string;
}

export interface MessagingProvider {
  readonly name: string;
  readonly isMock: boolean;
  sendMessage(message: OutboundMessage): Promise<MessageSendResult>;
  sendTemplate(message: Required<Pick<OutboundMessage, 'to' | 'templateName'>> & { templateParams?: string[] }): Promise<MessageSendResult>;
  /** Verifies a webhook signature. Returns false for unsigned/invalid payloads. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  /** Normalizes a provider webhook payload into inbound messages. */
  parseWebhook(payload: unknown): InboundMessage[];
}

// ---------------------------------------------------------------------------
// Lead sources
// ---------------------------------------------------------------------------

export interface ExternalLead {
  externalId: string;
  name: string;
  phone: string;
  email?: string;
  campaignName?: string;
  adName?: string;
  createdAt: Date;
  offeringType?: string;
  propertyType?: string;
  raw?: Record<string, unknown>;
  /**
   * Detailed acquisition metadata from the source platform. Carried through
   * ingestion into the lead's durable first-touch record.
   */
  attribution?: LeadAttributionInput;
}

export interface LeadSourceProvider {
  readonly name: string;
  readonly isMock: boolean;
  /** Fetch a single lead by its platform id (webhook delivers only the id). */
  fetchLead(leadgenId: string): Promise<ExternalLead>;
  /** Poll recent leads — used by the scheduler as a webhook-loss safety net. */
  fetchRecentLeads(since: Date): Promise<ExternalLead[]>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
}
