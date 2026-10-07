import { formatTime, formatDate } from '@/lib/dates';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';

interface TimelineItem {
  id: string;
  type: string;
  summary: string;
  actorType: string;
  createdAt: Date;
  actor: { id: string; name: string } | null;
}

const TYPE_TONES: Record<string, string> = {
  LEAD_CREATED: 'bg-sky-500',
  MESSAGE_SENT: 'bg-brand-400',
  LEAD_REPLIED: 'bg-emerald-500',
  AI_QUALIFICATION_COMPLETED: 'bg-violet-500',
  SCORE_CHANGED: 'bg-amber-500',
  LEAD_ASSIGNED: 'bg-brand-500',
  FOLLOW_UP_CREATED: 'bg-ink-300',
  FOLLOW_UP_COMPLETED: 'bg-emerald-500',
  APPOINTMENT_BOOKED: 'bg-brand-600',
  CONVERSION_RECORDED: 'bg-emerald-600',
  LEAD_LOST: 'bg-ink-400',
  HANDED_OFF_TO_HUMAN: 'bg-rose-500',
  LEAD_RECOVERED: 'bg-emerald-500',
};

/** The full lead history — who did what, when, and what the system did on its own. */
export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return <EmptyState title="No activity recorded" description="Everything that happens to this lead appears here." />;
  }

  let lastDate = '';

  return (
    <ol className="max-h-[28rem] overflow-y-auto scroll-thin px-4 py-3 sm:px-5">
      {items.map((item) => {
        const date = formatDate(item.createdAt);
        const showDate = date !== lastDate;
        lastDate = date;

        return (
          <li key={item.id}>
            {showDate ? (
              <p className="sticky top-0 -mx-1 bg-white/95 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 backdrop-blur">
                {date}
              </p>
            ) : null}
            <div className="flex gap-3 pb-3">
              <div className="flex flex-col items-center">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TYPE_TONES[item.type] ?? 'bg-ink-300')} />
                <span className="mt-1 w-px flex-1 bg-ink-100" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-sm text-ink-800">{item.summary}</p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {formatTime(item.createdAt)} · {item.actor?.name ?? actorLabel(item.actorType)}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function actorLabel(actorType: string): string {
  switch (actorType) {
    case 'AI': return 'AI assistant';
    case 'LEAD': return 'Lead';
    case 'USER': return 'Team member';
    default: return 'System';
  }
}
