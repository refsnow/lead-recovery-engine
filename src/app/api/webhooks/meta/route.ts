import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { clientIp, toErrorResponse } from '@/lib/api';
import { metaWebhookSchema } from '@/lib/validation';
import { getLeadSourceProvider } from '@/providers/lead-source';
import { ingestFromWebhook } from '@/services/ingestion.service';

export const dynamic = 'force-dynamic';

/**
 * Meta Lead Ads webhook verification handshake.
 * GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token && env.leadSource.verifyToken && token === env.leadSource.verifyToken) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }

  await logger.warn('WEBHOOK', 'Meta webhook verification rejected', { mode, ip: clientIp(request) });
  return new NextResponse('Verification failed', { status: 403 });
}

/**
 * Lead delivery. Meta sends only a leadgen_id; the lead itself is retrieved
 * from the Graph API. A 200 is returned even for individual lead failures so
 * Meta does not retry the whole batch — failures are logged and recoverable via
 * the polling safety net.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(`webhook:meta:${clientIp(request)}`, 300, 60_000);

    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const provider = getLeadSourceProvider();

    if (!provider.verifyWebhookSignature(rawBody, signature)) {
      await logger.warn('WEBHOOK', 'Meta webhook signature rejected', { ip: clientIp(request) });
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    const parsed = metaWebhookSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      await logger.warn('WEBHOOK', 'Meta webhook payload rejected', { issues: parsed.error.flatten() });
      return NextResponse.json({ error: 'Unrecognised payload.' }, { status: 400 });
    }

    // Single-tenant webhook endpoint: the target organization is resolved by
    // page id in a multi-tenant deployment. For the MVP the first non-demo
    // organization owns inbound leads, falling back to the demo organization.
    const organization = await resolveOrganization();
    if (!organization) {
      await logger.error('WEBHOOK', 'No organization configured to receive Meta leads');
      return NextResponse.json({ received: true, ingested: 0 }, { status: 200 });
    }

    let ingested = 0;
    let failed = 0;

    for (const entry of parsed.data.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'leadgen') continue;
        try {
          await ingestFromWebhook(organization.id, change.value.leadgen_id, {
            campaignName: change.value.campaign_name,
            adName: change.value.ad_name,
          });
          ingested += 1;
        } catch (error) {
          failed += 1;
          await logger.error('WEBHOOK', 'Failed to ingest a Meta lead', {
            leadgenId: change.value.leadgen_id, error: (error as Error).message,
          }, organization.id);
        }
      }
    }

    return NextResponse.json({ received: true, ingested, failed }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function resolveOrganization() {
  return (await prisma.organization.findFirst({ where: { isDemo: false }, orderBy: { createdAt: 'asc' } }))
    ?? (await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } }));
}
