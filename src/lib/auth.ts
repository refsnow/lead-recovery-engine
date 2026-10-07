import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/db/client';
import { env } from '@/config/env';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import type { UserRole } from '@/types/domain';

export const SESSION_COOKIE = 'lre_session';
const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  isDemo: boolean;
}

/**
 * Session tokens are random 256-bit values. Only their SHA-256 hash is stored,
 * so a database leak cannot be replayed as a live session.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(`${token}${env.sessionSecret}`).digest('hex');
}

export async function createSession(userId: string, userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 250) },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Returns the signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { organization: true } } },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as UserRole,
    organizationId: session.user.organizationId,
    organizationName: session.user.organization.name,
    isDemo: session.user.organization.isDemo,
  };
}

/** Returns the signed-in user or throws AuthenticationError. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthorizationError(`This action requires one of: ${roles.join(', ')}.`);
  }
  return user;
}

/** Housekeeping: drop expired sessions. Called by the scheduler endpoint. */
export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}
