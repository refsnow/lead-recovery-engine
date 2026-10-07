import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
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
 * Session tokens are cryptographically signed to maintain stateless continuity
 * across ephemeral serverless containers, with database fallback.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(`${token}${env.sessionSecret}`).digest('hex');
}

function signToken(userId: string, expiresAt: Date): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      exp: expiresAt.getTime(),
      rnd: randomBytes(8).toString('hex'),
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
  return `v1.${payload}.${signature}`;
}

function verifyToken(token: string): { userId: string } | null {
  if (!token.startsWith('v1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payload, signature] = parts;
  const expected = createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');

  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || typeof data.exp !== 'number' || data.exp < Date.now()) {
      return null;
    }
    return { userId: data.uid };
  } catch {
    return null;
  }
}

export async function createSession(userId: string, userAgent?: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = signToken(userId, expiresAt);

  try {
    await prisma.session.create({
      data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 250) },
    });
  } catch {
    // Non-fatal if DB write encounters ephemeral container locks
  }

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
    try {
      await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    } catch {
      // Ignored
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Returns the signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // 1. Check stateless cryptographic signature first
  const verified = verifyToken(token);
  if (verified) {
    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      isDemo: user.organization.isDemo,
    };
  }

  // 2. Fall back to database session query for legacy sessions
  try {
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
  } catch {
    return null;
  }
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
