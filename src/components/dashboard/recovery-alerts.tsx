import Link from 'next/link';
import { Flame, AlertTriangle, Info, ArrowRight, Phone, MessageCircle } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui';
import { SourceBadge } from '@/components/leads/source-badge';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { RecoveryAlert } from '@/services/recovery.service';

const SEVERITY = {
  CRITICAL: { icon: Flame, ring: 'ring-rose-800/80', bg: 'bg-gradient-to-r from-rose-950/40 to-transparent', bar: 'bg-rose-500', text: 'text-rose-400', tone: 'danger' },
  WARNING: { icon: AlertTriangle, ring: 'ring-amber-800/80', bg: 'bg-gradient-to-r from-amber-950/40 to-transparent', bar: 'bg-amber-500', text: 'text-amber-400', tone: 'warning' },
  INFO: { icon: Info, ring: 'ring-sky-800/80', bg: 'bg-gradient-to-r from-sky-950/40 to-transparent', bar: 'bg-sky-400', text: 'text-sky-400', tone: 'info' },
} as const;

/**
 * The product's core promise made visible: which leads are being lost right
 * now, why, and what to do about it — with the actions one click away.
 */
export function RecoveryAlerts({ alerts }: { alerts: RecoveryAlert[] }) {
  if (!alerts.length) {
    return (
      <EmptyState
        title="No leads are at risk"
        description="Every lead has been contacted, owned and followed up on time. This panel fills up the moment that stops being true."
      />
    );
  }

  return (
    <ul className="stagger divide-y divide-ink-200/60">
      {alerts.map((alert) => {
        const severity = SEVERITY[alert.severity];
        const Icon = severity.icon;

        return (
          <li key={alert.type} className={cn('px-4 py-4 sm:px-5', severity.bg)}>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 ring-1',
                  severity.ring,
                  // Critical risk gets a slow pulse; warnings and info stay still.
                  alert.severity === 'CRITICAL' && 'animate-pulse-ring',
                )}
              >
                <Icon className={cn('h-4 w-4', severity.text)} aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={alert.href} className="text-sm font-semibold text-ink-900 hover:text-brand-700">
                    {alert.title}
                  </Link>
                  <Badge tone={severity.tone}>{alert.type.replace(/_/g, ' ')}</Badge>
                </div>

                <p className="mt-0.5 text-xs text-ink-600">{alert.description}</p>
                <p className={cn('mt-1.5 text-xs font-medium', severity.text)}>
                  → {alert.recommendedAction}
                </p>

                {alert.samples.length ? (
                  <ul className="stagger mt-3 space-y-1.5">
                    {alert.samples.map((lead) => (
                      <li
                        key={lead.id}
                        className="lift flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-ink-100 px-2.5 py-1.5 ring-1 ring-ink-200 hover:shadow-card hover:ring-brand-500/40"
                      >
                        <span className="min-w-0 flex-1">
                          <Link href={`/leads/${lead.id}`} className="text-xs font-medium text-ink-900 hover:text-brand-400">
                            {lead.name}
                          </Link>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono text-[11px] text-ink-500">Score {lead.score}</span>
                            <SourceBadge source={lead.source} sourceDetail={lead.sourceDetail} />
                            {lead.campaignName ? (
                              <span className="max-w-[12rem] truncate text-[11px] text-ink-500" title={lead.campaignName}>
                                {lead.campaignName}
                              </span>
                            ) : null}
                            <span className="text-[11px] text-ink-400">
                              Last activity {relativeTime(lead.lastActivityAt)}
                            </span>
                            <span className="text-[11px] text-ink-400">
                              {lead.assignedTo ? `Owner: ${lead.assignedTo}` : 'No owner'}
                            </span>
                          </span>
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          <a
                            href={`tel:${lead.phone}`}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-ink-100"
                            title={`Call ${lead.name}`}
                          >
                            <Phone className="h-3 w-3" aria-hidden />Call
                          </a>
                          <a
                            href={`https://wa.me/${lead.phone.replace(/[^\d]/g, '')}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-ink-100"
                            title={`WhatsApp ${lead.name}`}
                          >
                            <MessageCircle className="h-3 w-3" aria-hidden />WhatsApp
                          </a>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-50"
                          >
                            Open<ArrowRight className="h-3 w-3" aria-hidden />
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {alert.count > alert.samples.length ? (
                  <Link href={alert.href} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                    View all {alert.count} leads<ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
