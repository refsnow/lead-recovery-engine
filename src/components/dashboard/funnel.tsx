import Link from 'next/link';
import { formatPercent } from '@/lib/format';
import type { FunnelStage } from '@/services/dashboard.service';

const STAGE_LINKS: Record<string, string> = {
  leads: '/leads',
  contacted: '/leads?status=CONTACTED',
  qualified: '/leads?status=QUALIFIED',
  appointment: '/leads?status=APPOINTMENT',
  won: '/leads?status=WON',
};

/** Each stage gets a deeper shade, so the funnel narrows visually as well as numerically. */
const STAGE_FILLS = [
  'from-brand-400 to-brand-500',
  'from-brand-500 to-brand-600',
  'from-brand-600 to-brand-700',
  'from-brand-700 to-brand-950',
  'from-emerald-500 to-emerald-600',
];

/**
 * The lead funnel, drawn as proportional bars. Each stage shows both the
 * step-over-step rate (where leads are dropping) and the overall rate.
 */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.count ?? 0;

  if (!top) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-500">
        No leads yet. Once leads arrive, the funnel shows exactly where they stop moving.
      </p>
    );
  }

  return (
    <div className="space-y-3 p-4 sm:p-5">
      {stages.map((stage, index) => {
        const width = Math.max(4, (stage.count / top) * 100);
        const dropped = index > 0 ? (stages[index - 1]?.count ?? 0) - stage.count : 0;

        return (
          <Link key={stage.key} href={STAGE_LINKS[stage.key] ?? '/leads'} className="group block">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink-700 transition-colors group-hover:text-brand-700">
                {stage.label}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-semibold tabular-nums text-ink-900">{stage.count}</span>
                <span className="text-xs tabular-nums text-ink-400">
                  {formatPercent(stage.overallRate)} of all leads
                </span>
              </span>
            </div>

            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink-100">
              <div
                className={`animate-grow-width h-full rounded-full bg-gradient-to-r ${STAGE_FILLS[index] ?? STAGE_FILLS[0]} transition-[filter] group-hover:brightness-110`}
                style={{
                  ['--target' as string]: `${width}%`,
                  animationDelay: `${index * 90}ms`,
                }}
              />
            </div>

            {index > 0 ? (
              <p className="mt-1 text-[11px] text-ink-400">
                {formatPercent(stage.stepRate)} converted from {stages[index - 1]?.label.toLowerCase()}
                {dropped > 0 ? (
                  <span className="text-ink-400"> · <span className="font-medium text-rose-500">{dropped}</span> did not progress</span>
                ) : ''}
              </p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
