import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/db/client';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { purgeExpiredSessions } from '@/lib/auth';
import { clientIp, toErrorResponse } from '@/lib/api';
import { runDueAutomatedFollowUps, alertOverdueFollowUps } from '@/services/followup.service';
import { runRecoverySweep } from '@/services/recovery.service';
import { buildAutomationContext, runAutomations } from '@/services/automation.service';
import { hoursAgo } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/cron/run — the scheduler entry point.
 *
 * Runs the automated follow-up sequence, the recovery sweep and overdue alerts
 * for every organization. Drive it from Vercel Cron, n8n or any scheduler:
 *
 *   curl -X POST https://your-app/api/cron/run \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Each stage is isolated: one failing organization does not stop the others.
 */
export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      await logger.warn('WORKFLOW', 'Unauthorized scheduler call', { ip: clientIp(request) });
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const startedAt = Date.now();
    const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });

    const followUps = await runDueAutomatedFollowUps(100);
    const results: Record<string, unknown>[] = [];

    for (const organization of organizations) {
      try {
        const [sweep, overdue, noResponse] = await Promise.all([
          runRecoverySweep(organization.id),
          alertOverdueFollowUps(organization.id),
          triggerNoResponseAutomations(organization.id),
        ]);

        results.push({
          organization: organization.name,
          markedDormant: sweep.markedDormant,
          alertsRaised: sweep.alertsRaised,
          overdueFollowUps: overdue,
          noResponseRulesRun: noResponse,
        });
      } catch (error) {
        await logger.error('WORKFLOW', 'Scheduler run failed for an organization', {
          organizationId: organization.id, error: (error as Error).message,
        }, organization.id);
        results.push({ organization: organization.name, error: 'Run failed; see system logs.' });
      }
    }

    const purgedSessions = await purgeExpiredSessions();

    await logger.info('WORKFLOW', 'Scheduler run complete', {
      durationMs: Date.now() - startedAt, followUps, organizations: organizations.length,
    });

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      automatedFollowUps: followUps,
      purgedSessions,
      organizations: results,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** GET is accepted for schedulers that only issue GET requests. */
export async function GET(request: Request) {
  return POST(request);
}

function isAuthorized(request: Request): boolean {
  // Without a configured secret the endpoint is available only in development.
  if (!env.cronSecret) return !env.isProduction;

  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.cronSecret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fires NO_RESPONSE_24H rules for leads that went quiet after being contacted. */
async function triggerNoResponseAutomations(organizationId: string): Promise<number> {
  const stale = await prisma.lead.findMany({
    where: {
      organizationId,
      status: { notIn: ['WON', 'LOST', 'APPOINTMENT'] },
      firstContactedAt: { not: null },
      lastActivityAt: { lt: hoursAgo(24) },
      needsHumanHandoff: false,
    },
    select: { id: true },
    take: 100,
  });

  let count = 0;
  for (const lead of stale) {
    const ctx = await buildAutomationContext(lead.id);
    if (!ctx) continue;
    const executed = await runAutomations('NO_RESPONSE_24H', ctx);
    if (executed.length) count += 1;
  }
  return count;
}
