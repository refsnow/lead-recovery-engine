import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { env } from '@/config/env';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm shadow-brand-500/30">
            LL
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">Leadloop</span>
        </Link>

        <div className="card card-pad">
          <h1 className="text-lg font-semibold text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">Access your lead recovery dashboard.</p>
          <LoginForm demoMode={env.demoMode} />
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">
          <Link href="/" className="hover:text-ink-600">← Back to the overview</Link>
        </p>
      </div>
    </main>
  );
}
