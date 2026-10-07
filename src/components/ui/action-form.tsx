'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { buttonClass } from '@/components/ui';
import type { ActionState } from '@/app/actions/lead-actions';

/**
 * Shared wrapper for server-action forms: handles pending state, error display
 * and success messaging so every admin form behaves identically.
 */
export function ActionForm({
  action, submitLabel, children, className, variant = 'primary', resetOnSuccess = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess && state.ok ? state.message : undefined}
    >
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Submit label={submitLabel} variant={variant} />
        {state.error ? <p role="alert" className="text-xs text-rose-600">{state.error}</p> : null}
        {state.ok ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </div>
    </form>
  );
}

function Submit({ label, variant }: { label: string; variant: 'primary' | 'secondary' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, 'sm')}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

/** A form that is a single button (toggle, delete, run-now). */
export function InlineActionForm({
  action, label, hidden, variant = 'secondary', confirmMessage,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  hidden: Record<string, string>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  confirmMessage?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form
      action={formAction}
      className="inline-flex items-center gap-2"
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <InlineSubmit label={label} variant={variant} />
      {state.error ? <span role="alert" className="text-xs text-rose-600">{state.error}</span> : null}
    </form>
  );
}

function InlineSubmit({ label, variant }: { label: string; variant: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, 'sm')}>
      {pending ? '…' : label}
    </button>
  );
}
