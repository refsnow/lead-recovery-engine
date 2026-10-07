import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ScoreComponent } from '@/types/domain';

/**
 * Answers "why did this lead get this score?" — every rule, matched or not,
 * with its contribution. An unexplained score is not a usable score.
 */
export function ScoreBreakdown({ score, temperature, components }: {
  score: number; temperature: string; components: ScoreComponent[];
}) {
  const matched = components.filter((component) => component.matched);
  const unmatched = components.filter((component) => !component.matched);
  const rawTotal = matched.reduce((total, component) => total + component.points, 0);

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink-900">{score}</span>
        <span className="text-sm text-ink-400">/ 100</span>
        <span className={cn(
          'ml-auto rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
          temperature === 'HOT' ? 'bg-rose-50 text-rose-700 ring-rose-200'
            : temperature === 'WARM' ? 'bg-amber-50 text-amber-800 ring-amber-200'
              : 'bg-sky-50 text-sky-700 ring-sky-200',
        )}>
          {temperature}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn('h-full rounded-full', score >= 70 ? 'bg-rose-500' : score >= 40 ? 'bg-amber-500' : 'bg-sky-500')}
          style={{ width: `${score}%` }}
        />
      </div>

      {components.length === 0 ? (
        <p className="mt-4 text-xs text-ink-500">
          This lead has not been scored yet. Scoring runs automatically once qualification data arrives.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-1.5">
            {matched.map((component) => (
              <li key={component.ruleId} className="flex items-center gap-2 text-xs">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                <span className="flex-1 text-ink-700">{component.label}</span>
                <span className="font-mono font-medium tabular-nums text-emerald-700">
                  +{component.points}
                </span>
              </li>
            ))}
          </ul>

          {rawTotal > 100 ? (
            <p className="mt-2 text-[11px] text-ink-400">
              Raw total {rawTotal}, capped at 100.
            </p>
          ) : null}

          {unmatched.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] font-medium text-ink-500 hover:text-ink-700">
                {unmatched.length} signal{unmatched.length === 1 ? '' : 's'} not present
              </summary>
              <ul className="mt-1.5 space-y-1">
                {unmatched.map((component) => (
                  <li key={component.ruleId} className="flex items-center gap-2 text-xs text-ink-400">
                    <Minus className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="flex-1">{component.label}</span>
                    <span className="font-mono tabular-nums">+{component.points}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
