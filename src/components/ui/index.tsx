import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card animate-fade-up', className)}>{children}</div>;
}

export function CardHeader({
  title, description, action, className,
}: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-ink-200/70 px-4 py-3 sm:px-5', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const BADGE_TONES = {
  neutral: 'bg-ink-200/50 text-ink-700 ring-ink-300',
  brand: 'bg-brand-700/30 text-brand-400 ring-brand-500/40',
  success: 'bg-emerald-950/70 text-emerald-300 ring-emerald-700/50',
  warning: 'bg-amber-950/70 text-amber-300 ring-amber-700/50',
  danger: 'bg-rose-950/70 text-rose-300 ring-rose-700/50',
  info: 'bg-sky-950/70 text-sky-300 ring-sky-700/50',
  purple: 'bg-violet-950/70 text-violet-300 ring-violet-700/50',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = 'neutral', children, className,
}: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      BADGE_TONES[tone], className,
    )}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  NEW: 'info', CONTACTED: 'brand', QUALIFIED: 'purple', FOLLOW_UP: 'warning',
  APPOINTMENT: 'brand', WON: 'success', LOST: 'neutral', DORMANT: 'danger',
  PENDING: 'warning', COMPLETED: 'success', CANCELLED: 'neutral', SKIPPED: 'neutral',
  SCHEDULED: 'brand', NO_SHOW: 'danger', ACTIVE: 'success', AWAITING_REPLY: 'warning',
  HANDED_OFF: 'danger', CLOSED: 'neutral', FAILED: 'danger', DELIVERED: 'success',
  SENT: 'info', READ: 'success', QUEUED: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}

export function TemperatureBadge({ temperature }: { temperature: string }) {
  const tone: BadgeTone = temperature === 'HOT' ? 'danger' : temperature === 'WARM' ? 'warning' : 'info';
  const icon = temperature === 'HOT' ? '🔥' : temperature === 'WARM' ? '🌤' : '❄️';
  return <Badge tone={tone}><span aria-hidden>{icon}</span>{temperature}</Badge>;
}

/** Score pill, colour-keyed to the same thresholds the scoring engine uses. */
export function ScorePill({ score, className }: { score: number; className?: string }) {
  const tone = score >= 70
    ? 'from-rose-500 to-orange-400'
    : score >= 40
      ? 'from-amber-500 to-yellow-400'
      : 'from-sky-500 to-cyan-400';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-ink-200">
        <span
          className={cn('animate-grow-width absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', tone)}
          style={{ ['--target' as string]: `${score}%` }}
        />
      </span>
      <span className="font-mono text-xs font-semibold tabular-nums text-ink-800">{score}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-500/30 hover:bg-brand-700 hover:shadow-brand-500/40 disabled:bg-brand-900',
  secondary: 'bg-ink-100 text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-200 hover:text-white',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-white',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
} as const;

const BUTTON_SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;
type ButtonSize = keyof typeof BUTTON_SIZES;

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'press inline-flex items-center justify-center gap-1.5 rounded-lg font-medium',
    'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
    BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className,
  );
}

export function Button({
  variant = 'primary', size = 'md', className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href, variant = 'primary', size = 'md', className, children,
}: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode }) {
  return <Link href={href} className={buttonClass(variant, size, className)}>{children}</Link>;
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-ink-300">{icon}</div> : null}
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900">{title}</p>
      {description ? <p className="mt-0.5 text-xs text-amber-800">{description}</p> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-ink-200/50', className)}>
      <span aria-hidden className="shimmer absolute inset-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function DataList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="label">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-ink-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return (
    <span className={cn(
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
      'bg-gradient-to-br from-brand-700 to-brand-900 text-brand-200 ring-1 ring-inset ring-brand-500/40',
      className,
    )}>
      {letters || '?'}
    </span>
  );
}
