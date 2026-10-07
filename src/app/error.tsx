'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertOctagon } from 'lucide-react';

/** Root error boundary: a failure in one page never leaves a blank screen. */
export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ui] unhandled error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white p-6 text-center shadow-card">
        <AlertOctagon className="mx-auto h-8 w-8 text-rose-500" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold text-ink-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-600">
          This screen could not be loaded. The error has been logged and the rest of the application is unaffected.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-ink-400">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button" onClick={reset}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
