'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, X } from 'lucide-react';
import { completeFollowUpAction, type ActionState } from '@/app/actions/lead-actions';
import { buttonClass } from '@/components/ui';

/** Inline complete / skip controls so a queue can be cleared without navigating. */
export function CompleteFollowUpButton({ followUpId, leadId }: { followUpId: string; leadId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(completeFollowUpAction, {});

  if (state.ok) {
    return <span className="text-xs font-medium text-emerald-700">Done</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="followUpId" value={followUpId} />
      <input type="hidden" name="leadId" value={leadId} />
      <StatusButtons />
      {state.error ? <span role="alert" className="text-xs text-rose-600">{state.error}</span> : null}
    </form>
  );
}

function StatusButtons() {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit" name="status" value="COMPLETED" disabled={pending}
        className={buttonClass('success', 'sm')} title="Mark this follow-up completed"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />{pending ? '…' : 'Complete'}
      </button>
      <button
        type="submit" name="status" value="CANCELLED" disabled={pending}
        className={buttonClass('ghost', 'sm')} title="Cancel this follow-up"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Cancel follow-up</span>
      </button>
    </>
  );
}
