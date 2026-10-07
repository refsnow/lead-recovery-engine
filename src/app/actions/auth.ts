'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/db/client';
import { loginSchema } from '@/lib/validation';
import { verifyPassword } from '@/lib/password';
import { createSession, destroySession } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { writeAuditLog } from '@/services/activity.service';
import { RateLimitError } from '@/lib/errors';

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Sign-in. Failures return a single generic message so the form cannot be used
 * to discover which email addresses exist.
 */
export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: 'Enter a valid email address and password.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  try {
    enforceRateLimit(`login:${ip}`, 10, 60_000);
    enforceRateLimit(`login:${parsed.data.email}`, 5, 60_000);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: 'Too many sign-in attempts. Please wait a minute and try again.' };
    }
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user?.isActive ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

  if (!user || !valid) {
    await logger.warn('AUTH', 'Failed sign-in attempt', { email: parsed.data.email, ip });
    return { error: 'That email and password combination is not correct.' };
  }

  await createSession(user.id, headerList.get('user-agent') ?? undefined);
  await writeAuditLog({
    organizationId: user.organizationId, userId: user.id,
    action: 'USER_SIGNED_IN', entityType: 'User', entityId: user.id, ipAddress: ip,
  });

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
