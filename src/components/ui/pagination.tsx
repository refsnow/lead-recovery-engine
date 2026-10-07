import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Pagination({
  page, pageCount, total, pageSize, baseParams,
}: {
  page: number; pageCount: number; total: number; pageSize: number;
  baseParams: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) {
    return (
      <p className="border-t border-ink-200/70 px-4 py-2.5 text-xs text-ink-500 sm:px-5">
        {total} lead{total === 1 ? '' : 's'}
      </p>
    );
  }

  const href = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(baseParams)) {
      if (value) params.set(key, value);
    }
    params.set('page', String(targetPage));
    return `?${params.toString()}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-200/70 px-4 py-2.5 sm:px-5">
      <p className="text-xs text-ink-500">
        Showing <span className="font-medium text-ink-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-ink-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous page">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </PageLink>
        <span className="px-2 text-xs tabular-nums text-ink-600">Page {page} of {pageCount}</span>
        <PageLink href={href(page + 1)} disabled={page >= pageCount} label="Next page">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href, disabled, label, children,
}: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const className = cn(
    'inline-flex items-center justify-center rounded-md p-1.5',
    disabled ? 'cursor-not-allowed text-ink-300' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  );
  if (disabled) return <span className={className} aria-disabled>{children}</span>;
  return <Link href={href} className={className} aria-label={label}>{children}</Link>;
}
