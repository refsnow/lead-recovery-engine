import { env } from '@/config/env';
import type { MessagingProvider } from '@/providers/types';
import { MockWhatsAppProvider } from '@/providers/messaging/mock';
import { WhatsAppCloudProvider } from '@/providers/messaging/whatsapp-cloud';

let cached: MessagingProvider | null = null;

export function getMessagingProvider(): MessagingProvider {
  if (cached) return cached;
  const configured = env.messaging.provider === 'whatsapp_cloud'
    && env.messaging.accessToken
    && env.messaging.phoneNumberId;
  cached = configured ? new WhatsAppCloudProvider() : new MockWhatsAppProvider();
  return cached;
}

export function resetMessagingProvider(): void {
  cached = null;
}
