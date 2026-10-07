import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { env } from '@/config/env';
import { getAIProvider } from '@/providers/ai';
import { getMessagingProvider } from '@/providers/messaging';
import { getLeadSourceProvider } from '@/providers/lead-source';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — liveness and dependency check for the host platform.
 * Returns 503 when the database is unreachable so a load balancer can react.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: 'ok' | 'unavailable' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'unavailable';
  }

  const body = {
    status: database === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    checks: {
      database,
      ai: { provider: getAIProvider().name, mock: getAIProvider().isMock },
      messaging: { provider: getMessagingProvider().name, mock: getMessagingProvider().isMock },
      leadSource: { provider: getLeadSourceProvider().name, mock: getLeadSourceProvider().isMock },
    },
    demoMode: env.demoMode,
  };

  return NextResponse.json(body, { status: database === 'ok' ? 200 : 503 });
}
