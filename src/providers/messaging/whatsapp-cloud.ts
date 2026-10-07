import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env';
import { IntegrationError } from '@/lib/errors';
import { whatsappWebhookSchema } from '@/lib/validation';
import type {
  InboundMessage, MessageSendResult, MessagingProvider, OutboundMessage,
} from '@/providers/types';

const GRAPH_VERSION = 'v21.0';

/**
 * Official WhatsApp Business Platform (Cloud API) provider.
 *
 * NOT YET VERIFIED AGAINST A LIVE ACCOUNT — it is written to the documented
 * Cloud API contract but has only been exercised against the mock. Treat it as
 * unverified until tested with real credentials (see README, Known Limitations).
 * Only official business messaging is used; no unofficial automation.
 */
export class WhatsAppCloudProvider implements MessagingProvider {
  readonly name = 'whatsapp_cloud';
  readonly isMock = false;

  private get endpoint(): string {
    return `https://graph.facebook.com/${GRAPH_VERSION}/${env.messaging.phoneNumberId}/messages`;
  }

  private async post(payload: Record<string, unknown>): Promise<MessageSendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.messaging.accessToken}`,
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => ({}))) as {
        messages?: { id: string }[];
        error?: { message?: string };
      };

      if (!response.ok) {
        const reason = json.error?.message ?? `HTTP ${response.status}`;
        return { externalId: '', status: 'FAILED', failureReason: reason };
      }
      return { externalId: json.messages?.[0]?.id ?? '', status: 'SENT' };
    } catch (error) {
      throw new IntegrationError('whatsapp_cloud', (error as Error).message, true);
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendMessage(message: OutboundMessage): Promise<MessageSendResult> {
    return this.post({
      to: message.to,
      type: 'text',
      text: { preview_url: false, body: message.body },
    });
  }

  async sendTemplate(message: { to: string; templateName: string; templateParams?: string[] }): Promise<MessageSendResult> {
    return this.post({
      to: message.to,
      type: 'template',
      template: {
        name: message.templateName,
        language: { code: 'en' },
        components: message.templateParams?.length
          ? [{ type: 'body', parameters: message.templateParams.map((text) => ({ type: 'text', text })) }]
          : undefined,
      },
    });
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader || !env.messaging.appSecret) return false;
    const expected = `sha256=${createHmac('sha256', env.messaging.appSecret).update(rawBody, 'utf8').digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(payload: unknown): InboundMessage[] {
    const parsed = whatsappWebhookSchema.safeParse(payload);
    if (!parsed.success) return [];

    const inbound: InboundMessage[] = [];
    for (const entry of parsed.data.entry) {
      for (const change of entry.changes) {
        const contactName = change.value.contacts?.[0]?.profile?.name;
        for (const message of change.value.messages ?? []) {
          if (message.type !== 'text' || !message.text?.body) continue;
          inbound.push({
            from: message.from,
            externalId: message.id,
            body: message.text.body,
            receivedAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
            senderName: contactName,
          });
        }
      }
    }
    return inbound;
  }
}
