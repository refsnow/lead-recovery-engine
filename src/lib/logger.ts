import { prisma } from '@/db/client';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type LogScope = 'API' | 'WEBHOOK' | 'AI' | 'MESSAGING' | 'DB' | 'WORKFLOW' | 'AUTH';

interface LogInput {
  level: LogLevel;
  scope: LogScope;
  message: string;
  organizationId?: string | null;
  context?: Record<string, unknown>;
}

/**
 * Structured logging. Writes to stdout (for host log drains) and persists
 * WARN/ERROR to the database so the in-app system log view can surface them.
 * Logging must never take down the caller, so persistence failures are swallowed
 * after being printed.
 */
export async function log({ level, scope, message, organizationId, context }: LogInput): Promise<void> {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    organizationId: organizationId ?? undefined,
    ...context,
  });

  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);

  if (level === 'INFO') return;

  try {
    await prisma.systemLog.create({
      data: {
        level,
        scope,
        message,
        organizationId: organizationId ?? null,
        context: context ? JSON.stringify(context) : null,
      },
    });
  } catch (error) {
    console.error(`[logger] failed to persist log: ${(error as Error).message}`);
  }
}

export const logger = {
  info: (scope: LogScope, message: string, context?: Record<string, unknown>, organizationId?: string) =>
    log({ level: 'INFO', scope, message, context, organizationId }),
  warn: (scope: LogScope, message: string, context?: Record<string, unknown>, organizationId?: string) =>
    log({ level: 'WARN', scope, message, context, organizationId }),
  error: (scope: LogScope, message: string, context?: Record<string, unknown>, organizationId?: string) =>
    log({ level: 'ERROR', scope, message, context, organizationId }),
};
