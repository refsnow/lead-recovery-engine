'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

/**
 * Error boundary inside the application shell. Navigation stays usable, so one
 * failing screen (a reporting query, an unavailable integration) does not take
 * the whole dashboard down.
 */
export default function AppError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ui] page error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
      <AlertTriangle className="mx-auto h-7 w-7 text-amber-600" aria-hidden />
      <h1 className="mt-3 text-base font-semibold text-amber-900">This screen could not be loaded</h1>
      <p className="mt-2 text-sm text-amber-800">
        The error has been logged. Other parts of the application are still available.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-amber-700">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button" onClick={reset}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          Retry
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
