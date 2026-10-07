import { ArrowDown, Check } from 'lucide-react';
import { SourceBadge } from '@/components/leads/source-badge';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { AttributionSummary } from '@/services/attribution.service';
import type { JourneyStep } from '@/types/domain';

/**
 * Where this lead came from. First-touch values are the durable record of
 * acquisition; the last-touch line appears only when a later interaction came
 * through a different channel, so it does not add noise to the common case.
 */
export function LeadAttributionPanel({ attribution }: { attribution: AttributionSummary }) {
  const hasUtm = Boolean(
    attribution.utmSource || attribution.utmMedium || attribution.utmCampaign
    || attribution.utmContent || attribution.utmTerm,
  );

  const movedChannel = attribution.lastTouchSource !== null
    && attribution.lastTouchSource !== attribution.source;

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SourceBadge source={attribution.source} sourceDetail={attribution.sourceLabel} />
        <span className="text-xs text-ink-400">
          First captured {formatDateTime(attribution.firstTouchAt)}
        </span>
      </div>

      {/* Stacked rather than a two-column grid: this card lives in the narrow
          sidebar column, where a viewport-breakpoint grid would clip long
          campaign names and landing-page URLs. */}
      <dl className="space-y-2.5">
        {[
          ['Source', attribution.sourceLabel],
          ['Campaign', attribution.campaignName],
          ['Ad set', attribution.adSetName],
          ['Ad', attribution.adName],
          ['Lead form', attribution.formName],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt className="label">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-ink-900">{value ?? '—'}</dd>
          </div>
        ))}

        {attribution.landingPage ? (
          <div>
            <dt className="label">Landing page</dt>
            <dd className="mt-0.5 break-all font-mono text-[11px] text-ink-700">
              {attribution.landingPage}
            </dd>
          </div>
        ) : null}
      </dl>

      {hasUtm ? (
        <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2.5">
          <p className="label mb-2">Tracking parameters</p>
          <dl className="space-y-1.5">
            {[
              ['utm_source', attribution.utmSource],
              ['utm_medium', attribution.utmMedium],
              ['utm_campaign', attribution.utmCampaign],
              ['utm_content', attribution.utmContent],
              ['utm_term', attribution.utmTerm],
              ['referrer', attribution.referrer],
            ].filter(([, value]) => value).map(([key, value]) => (
              <div key={key} className="text-[11px]">
                <dt className="font-mono text-ink-500">{key}</dt>
                <dd className="break-words font-mono text-ink-800">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {movedChannel ? (
        <p className="mt-3 text-xs text-ink-500">
          Most recent contact was on{' '}
          <span className="font-medium text-ink-700">{attribution.lastTouchSource}</span>
          {attribution.lastTouchAt ? ` ${relativeTime(attribution.lastTouchAt)}` : ''} — the acquisition
          source above is unchanged.
        </p>
      ) : null}
    </div>
  );
}

/** The lead's path from the ad that produced it through to the outcome. */
export function LeadJourney({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="px-4 py-4 sm:px-5">
      {steps.map((step, index) => (
        <li key={step.key}>
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                step.reached
                  ? 'bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-200'
                  : 'bg-ink-100 text-ink-400 ring-1 ring-inset ring-ink-200',
              )}
            >
              {step.reached ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <p className={cn('text-sm', step.reached ? 'font-medium text-ink-900' : 'text-ink-400')}>
                {step.label}
              </p>
              {step.detail ? (
                <p className="truncate text-[11px] text-ink-500" title={step.detail}>{step.detail}</p>
              ) : null}
              {step.at ? (
                <p className="text-[11px] text-ink-400">{formatDateTime(step.at)}</p>
              ) : (
                <p className="text-[11px] text-ink-300">Not yet reached</p>
              )}
            </div>
          </div>

          {index < steps.length - 1 ? (
            <div className="flex h-4 w-5 items-center justify-center" aria-hidden>
              <ArrowDown className={cn('h-3 w-3', step.reached ? 'text-brand-300' : 'text-ink-200')} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
