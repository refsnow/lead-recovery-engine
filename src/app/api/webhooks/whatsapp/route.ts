import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { clientIp, toErrorResponse } from '@/lib/api';
import { getMessagingProvider } from '@/providers/messaging';
import { ingestInboundMessage } from '@/services/ingestion.service';

export const dynamic = 'force-dynamic';

/** WhatsApp Cloud API verification handshake. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token && env.messaging.verifyToken && token === env.messaging.verifyToken) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }

  await logger.warn('WEBHOOK', 'WhatsApp webhook verification rejected', { mode, ip: clientIp(request) });
  return new NextResponse('Verification failed', { status: 403 });
}

/**
 * Inbound messages. Each message is matched to a lead by phone number; an
 * unknown number becomes a new WhatsApp-sourced lead rather than being dropped.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(`webhook:whatsapp:${clientIp(request)}`, 600, 60_000);

    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const provider = getMessagingProvider();

    if (!provider.verifyWebhookSignature(rawBody, signature)) {
      await logger.warn('WEBHOOK', 'WhatsApp webhook signature rejected', { ip: clientIp(request) });
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const messages = provider.parseWebhook(payload);
    if (!messages.length) {
      // Delivery-status callbacks and non-text messages land here; acknowledge.
      return NextResponse.json({ received: true, processed: 0 }, { status: 200 });
    }

    const organization = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!organization) {
      await logger.error('WEBHOOK', 'No organization configured to receive WhatsApp messages');
      return NextResponse.json({ received: true, processed: 0 }, { status: 200 });
    }

    let processed = 0;
    for (const message of messages) {
      try {
        await ingestInboundMessage(organization.id, {
          from: message.from, body: message.body, externalId: message.externalId,
          senderName: message.senderName, receivedAt: message.receivedAt,
        });
        processed += 1;
      } catch (error) {
        await logger.error('WEBHOOK', 'Failed to process an inbound WhatsApp message', {
          from: message.from, error: (error as Error).message,
        }, organization.id);
      }
    }

    return NextResponse.json({ received: true, processed }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
