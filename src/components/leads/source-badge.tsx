import { Facebook, Search, Globe, MessageCircle, Users, Store, Sparkles, Building2, PenLine, CircleDot } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

/**
 * Compact source marker used in the leads table and recovery alerts.
 * Colour and icon encode the channel, so a source is recognisable at a glance
 * in a dense table without reading the label.
 */
const SOURCE_STYLES: Record<string, { icon: LucideIcon; tone: string }> = {
  META_LEAD_ADS: { icon: Facebook, tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  GOOGLE_ADS: { icon: Search, tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  WEBSITE: { icon: Globe, tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  WHATSAPP: { icon: MessageCircle, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REFERRAL: { icon: Users, tone: 'bg-pink-50 text-pink-700 ring-pink-200' },
  WALK_IN: { icon: Store, tone: 'bg-orange-50 text-orange-800 ring-orange-200' },
  ORGANIC: { icon: Sparkles, tone: 'bg-teal-50 text-teal-700 ring-teal-200' },
  PORTAL: { icon: Building2, tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  MANUAL: { icon: PenLine, tone: 'bg-ink-100 text-ink-700 ring-ink-200' },
  OTHER: { icon: CircleDot, tone: 'bg-ink-100 text-ink-700 ring-ink-200' },
};

const LABELS: Record<string, string> = {
  META_LEAD_ADS: 'Meta Ads', GOOGLE_ADS: 'Google Ads', WEBSITE: 'Website',
  WHATSAPP: 'WhatsApp', REFERRAL: 'Referral', WALK_IN: 'Walk-in',
  ORGANIC: 'Organic', PORTAL: 'Portal', MANUAL: 'Manual', OTHER: 'Other',
};

export function SourceBadge({
  source, sourceDetail, className, showLabel = true, decorative = false,
}: {
  source: string;
  sourceDetail?: string | null;
  className?: string;
  showLabel?: boolean;
  /** True when the caller already renders the source name beside the badge, so
   *  the badge must not announce it a second time. */
  decorative?: boolean;
}) {
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.OTHER!;
  const Icon = style.icon;
  const label = source === 'OTHER' && sourceDetail ? sourceDetail : LABELS[source] ?? source;

  return (
    <span
      title={label}
      aria-hidden={decorative || undefined}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        style.tone, className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {showLabel ? <span className="truncate">{label}</span>
        : decorative ? null
        : <span className="sr-only">{label}</span>}
    </span>
  );
}
