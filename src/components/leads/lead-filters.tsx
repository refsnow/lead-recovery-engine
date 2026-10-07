'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_TEMPERATURES } from '@/types/domain';
import { buttonClass } from '@/components/ui';
import { titleCase } from '@/lib/format';

const RISK_OPTIONS = [
  { value: 'UNCONTACTED', label: 'Uncontacted' },
  { value: 'OVERDUE', label: 'Follow-up overdue' },
  { value: 'DORMANT', label: 'Dormant' },
  { value: 'HIGH_INTENT_INACTIVE', label: 'High-intent inactive' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
];

/**
 * Filters write to the URL, so any filtered view is shareable and the recovery
 * alerts on the dashboard can deep-link straight into it.
 */
export function LeadFilters({
  salespeople, campaigns, canFilterOwner,
}: {
  salespeople: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  canFilterOwner: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get('q') ?? '');

  const update = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page'); // any filter change returns to the first page
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }, [params, pathname, router]);

  const activeCount = ['status', 'temperature', 'source', 'campaignId', 'assignedToId', 'risk', 'q']
    .filter((key) => params.get(key)).length;

  return (
    <div className="mb-4 space-y-3">
      <form
        onSubmit={(event) => { event.preventDefault(); update('q', query.trim()); }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, phone or email…"
            aria-label="Search leads"
            className="input pl-9"
          />
        </div>
        <button type="submit" className={buttonClass('secondary')}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Search'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select label="Status" value={params.get('status') ?? ''} onChange={(v) => update('status', v)}
          options={LEAD_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
        <Select label="Temperature" value={params.get('temperature') ?? ''} onChange={(v) => update('temperature', v)}
          options={LEAD_TEMPERATURES.map((t) => ({ value: t, label: titleCase(t) }))} />
        <Select label="Source" value={params.get('source') ?? ''} onChange={(v) => update('source', v)}
          options={LEAD_SOURCES.map((s) => ({ value: s, label: titleCase(s) }))} />
        <Select label="Campaign" value={params.get('campaignId') ?? ''} onChange={(v) => update('campaignId', v)}
          options={campaigns.map((c) => ({ value: c.id, label: c.name }))} />
        {canFilterOwner ? (
          <Select label="Salesperson" value={params.get('assignedToId') ?? ''} onChange={(v) => update('assignedToId', v)}
            options={[{ value: 'UNASSIGNED', label: 'Unassigned' }, ...salespeople.map((s) => ({ value: s.id, label: s.name }))]} />
        ) : null}
        <Select label="At risk" value={params.get('risk') ?? ''} onChange={(v) => update('risk', v)}
          options={RISK_OPTIONS} />
        <Select label="Min score" value={params.get('minScore') ?? ''} onChange={(v) => update('minScore', v)}
          options={[{ value: '70', label: '70+ (hot)' }, { value: '40', label: '40+ (warm)' }, { value: '1', label: 'Any score' }]} />

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => startTransition(() => router.push(pathname))}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Select({
  label, value, options, onChange,
}: {
  label: string; value: string; onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        <option value="">{label}: All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
