import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-ink-200 bg-ink-100 p-6 text-center shadow-card">
        <SearchX className="mx-auto h-8 w-8 text-ink-400" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold text-ink-900">Not found</h1>
        <p className="mt-2 text-sm text-ink-600">
          This page does not exist, or the record belongs to another organization.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
