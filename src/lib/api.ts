import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { requireUser, type SessionUser } from '@/lib/auth';
import type { ActorContext } from '@/services/lead.service';

export interface ApiSuccess<T> { data: T; meta?: Record<string, unknown> }
export interface ApiFailure { error: { code: string; message: string; details?: unknown } }

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data, ...(meta ? { meta } : {}) }, { status });
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json<ApiFailure>({ error: { code, message, details } }, { status });
}

/**
 * Wraps a route handler: authenticates, provides an organization-scoped actor,
 * and converts any thrown error into a typed JSON response. No handler needs
 * its own try/catch, and no internal error message reaches the client.
 */
export function withAuth<T>(
  handler: (actor: ActorContext, user: SessionUser) => Promise<NextResponse<ApiSuccess<T> | ApiFailure>>,
) {
  return async (): Promise<NextResponse> => {
    try {
      const user = await requireUser();
      return await handler(
        { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name },
        user,
      );
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function handleRoute(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return toErrorResponse(error);
  }
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return fail('VALIDATION_ERROR', 'The submitted data is invalid.', 400, error.flatten().fieldErrors);
  }
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.status, error.details);
  }

  // Unexpected: log the detail, return a generic message.
  void logger.error('API', 'Unhandled API error', { error: (error as Error).message });
  return fail('INTERNAL_ERROR', 'Something went wrong. The error has been logged.', 500);
}

/** Parses a request body as JSON without throwing on malformed input. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}
