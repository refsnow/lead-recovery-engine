import { Bot, User, Headset, Settings2, AlertTriangle } from 'lucide-react';
import { formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/components/ui';

interface ThreadMessage {
  id: string;
  sender: string;
  senderName: string | null;
  body: string;
  messageType: string;
  aiGenerated: boolean;
  deliveryStatus: string;
  failureReason: string | null;
  createdAt: Date;
}

const SENDER_META: Record<string, { label: string; icon: typeof Bot }> = {
  LEAD: { label: 'Lead', icon: User },
  AI: { label: 'AI assistant', icon: Bot },
  SALESPERSON: { label: 'Salesperson', icon: Headset },
  SYSTEM: { label: 'System', icon: Settings2 },
};

export function ConversationThread({ messages }: { messages: ThreadMessage[] }) {
  if (!messages.length) {
    return (
      <EmptyState
        title="No messages yet"
        description="Send the first message to start the conversation and the qualification sequence."
      />
    );
  }

  return (
    <ul className="max-h-[32rem] space-y-3 overflow-y-auto scroll-thin p-4 sm:p-5">
      {messages.map((message) => {
        const meta = SENDER_META[message.sender] ?? SENDER_META.SYSTEM!;
        const Icon = meta.icon;
        const fromLead = message.sender === 'LEAD';
        const isNote = message.messageType === 'NOTE';

        return (
          <li key={message.id} className={cn('flex gap-2.5', !fromLead && 'flex-row-reverse')}>
            <span className={cn(
              'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              fromLead ? 'bg-ink-200 text-ink-600'
                : message.aiGenerated ? 'bg-violet-100 text-violet-700' : 'bg-brand-100 text-brand-700',
            )}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>

            <div className={cn('max-w-[80%] min-w-0', !fromLead && 'text-right')}>
              <div className={cn(
                'inline-block rounded-2xl px-3 py-2 text-left text-sm',
                isNote ? 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200'
                  : fromLead ? 'bg-ink-100 text-ink-900'
                    : 'bg-brand-600 text-white',
              )}>
                {isNote ? (
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Internal note — not sent to the lead
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              </div>

              <p className={cn('mt-1 flex items-center gap-1.5 text-[11px] text-ink-400', !fromLead && 'justify-end')}>
                <span>{message.senderName ?? meta.label}</span>
                <span aria-hidden>·</span>
                <span>{formatDateTime(message.createdAt)}</span>
                {message.deliveryStatus === 'FAILED' ? (
                  <span className="inline-flex items-center gap-1 font-medium text-rose-600">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    Failed{message.failureReason ? `: ${message.failureReason}` : ''}
                  </span>
                ) : !fromLead && !isNote ? (
                  <span className="text-ink-400">{message.deliveryStatus.toLowerCase()}</span>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
