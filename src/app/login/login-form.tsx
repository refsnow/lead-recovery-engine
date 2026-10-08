'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type AuthFormState } from '@/app/actions/auth';
import { buttonClass } from '@/components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Owner', email: 'owner@demorealty.test' },
  { label: 'Sales manager', email: 'manager@demorealty.test' },
  { label: 'Salesperson', email: 'sales@demorealty.test' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('primary', 'md', 'w-full')}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(loginAction, {});

  return (
    <>
      <form action={formAction} className="mt-5 space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            defaultValue={demoMode ? 'owner@demorealty.test' : ''}
            className="input mt-1" placeholder="you@company.com"
          />
          {state.fieldErrors?.email ? (
            <p className="mt-1 text-xs text-rose-600">{state.fieldErrors.email[0]}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password" name="password" type="password" required autoComplete="current-password"
            defaultValue={demoMode ? 'demo123' : ''}
            className="input mt-1" placeholder="••••••••"
          />
          {state.fieldErrors?.password ? (
            <p className="mt-1 text-xs text-rose-600">{state.fieldErrors.password[0]}</p>
          ) : null}
        </div>

        {state.error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-200">
            {state.error}
          </p>
        ) : null}

        <SubmitButton />
      </form>

      {demoMode ? (
        <div className="mt-6 rounded-lg border border-amber-900/60 bg-amber-950/40 p-3">
          <p className="text-xs font-semibold text-amber-300">Demo credentials — development only</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-400/80">
            These accounts exist only in demo mode and must never be enabled in production.
            Password for all: <code className="font-mono font-semibold text-amber-300">demo123</code>
          </p>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email} className="flex items-center justify-between gap-2 text-[11px] text-amber-300">
                <span className="font-medium text-amber-200">{account.label}</span>
                <code className="font-mono text-amber-400">{account.email}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
