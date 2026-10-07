import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CountUp } from '@/components/ui/count-up';
import { cn } from '@/lib/cn';

/**
 * A single number on the "today" row. Every tile is clickable: a number the
 * user cannot act on is not worth showing.
 *
 * Tiles that represent risk (danger/warning) carry a coloured top edge and a
 * tinted ground, so a problem reads at a glance before any label is read.
 */
export function StatCard({
  label, value, hint, href, tone = 'neutral', icon,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
  icon?: ReactNode;
}) {
  const styles = {
    neutral: {
      value: 'text-ink-900', edge: 'from-ink-300 to-ink-200',
      ground: 'bg-white', iconWrap: 'bg-ink-50 text-ink-400',
    },
    danger: {
      value: 'text-rose-600', edge: 'from-rose-500 to-rose-300',
      ground: 'bg-gradient-to-b from-rose-50/70 to-white', iconWrap: 'bg-rose-50 text-rose-500',
    },
    warning: {
      value: 'text-amber-600', edge: 'from-amber-500 to-amber-300',
      ground: 'bg-gradient-to-b from-amber-50/70 to-white', iconWrap: 'bg-amber-50 text-amber-600',
    },
    success: {
      value: 'text-emerald-600', edge: 'from-emerald-500 to-emerald-300',
      ground: 'bg-gradient-to-b from-emerald-50/60 to-white', iconWrap: 'bg-emerald-50 text-emerald-600',
    },
  }[tone];

  const body = (
    <>
      {/* Coloured top edge — the fastest signal that a tile needs attention. */}
      <span
        aria-hidden
        className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r', styles.edge)}
      />

      <div className="flex items-center justify-between gap-1.5">
        <p className="truncate text-[11px] font-medium text-ink-500">{label}</p>
        {icon ? (
          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded transition-transform duration-200 group-hover:scale-110', styles.iconWrap)}>
            {icon}
          </span>
        ) : null}
      </div>

      <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums tracking-tight', styles.value)}>
        <CountUp value={value} />
      </p>

      <div className="mt-0.5 flex items-center justify-between gap-2">
        {hint ? <p className="truncate text-[11px] text-ink-400">{hint}</p> : <span />}
        {href ? (
          <ArrowUpRight
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-ink-300 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
          />
        ) : null}
      </div>
    </>
  );

  const shell = cn(
    'group relative overflow-hidden rounded-xl border border-ink-200/70 shadow-card card-pad',
    styles.ground,
  );

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link href={href} className={cn(shell, 'lift hover:border-ink-300 hover:shadow-pop')}>
      {body}
    </Link>
  );
}
