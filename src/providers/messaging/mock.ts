import { randomUUID } from 'node:crypto';
import type {
  InboundMessage, MessageSendResult, MessagingProvider, OutboundMessage,
} from '@/providers/types';

/**
 * Simulates the WhatsApp Business Platform for demo/development.
 * Messages are recorded in memory so the UI can show a realistic outbox, and a
 * small failure rate is simulated so delivery-failure handling is exercised.
 */
export class MockWhatsAppProvider implements MessagingProvider {
  readonly name = 'mock-whatsapp';
  readonly isMock = true;

  private static readonly outbox: (OutboundMessage & { id: string; sentAt: Date })[] = [];

  static getOutbox(): ReadonlyArray<OutboundMessage & { id: string; sentAt: Date }> {
    return MockWhatsAppProvider.outbox;
  }

  async sendMessage(message: OutboundMessage): Promise<MessageSendResult> {
    const id = `mock_${randomUUID()}`;
    MockWhatsAppProvider.outbox.push({ ...message, id, sentAt: new Date() });
    if (MockWhatsAppProvider.outbox.length > 500) MockWhatsAppProvider.outbox.shift();

    // Deterministic pseudo-failure: ~1 in 25 sends fail, exercising retry/UI paths.
    const failed = hashCode(message.to + message.body) % 25 === 0;
    return failed
      ? { externalId: id, status: 'FAILED', failureReason: 'Simulated delivery failure (recipient unreachable).' }
      : { externalId: id, status: 'SENT' };
  }

  async sendTemplate(message: { to: string; templateName: string; templateParams?: string[] }): Promise<MessageSendResult> {
    return this.sendMessage({
      to: message.to,
      body: `[template:${message.templateName}] ${(message.templateParams ?? []).join(' | ')}`,
      templateName: message.templateName,
      templateParams: message.templateParams,
    });
  }

  /** The mock accepts only explicitly mock-signed payloads, never arbitrary ones. */
  verifyWebhookSignature(_rawBody: string, signatureHeader: string | null): boolean {
    return signatureHeader === 'mock-signature';
  }

  parseWebhook(payload: unknown): InboundMessage[] {
    const body = payload as { from?: string; body?: string; name?: string } | null;
    if (!body?.from || !body?.body) return [];
    return [{
      from: body.from,
      externalId: `mock_in_${randomUUID()}`,
      body: body.body,
      receivedAt: new Date(),
      senderName: body.name,
    }];
  }
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
