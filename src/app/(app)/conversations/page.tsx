import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getConversationThreads } from '@/services/conversation.service';
import { relativeTime } from '@/lib/dates';
import {
  Badge, Card, EmptyState, PageHeader, ScorePill, StatusBadge, TemperatureBadge,
} from '@/components/ui';

export const metadata = { title: 'Conversations' };
export const dynamic = 'force-dynamic';

export default async function ConversationsPage() {
  const user = await requireUser();

  const threads = await getConversationThreads(user.organizationId, {
    assignedToId: can(user.role, 'VIEW_ALL_LEADS') ? undefined : user.id,
    limit: 80,
  });

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Every messaging thread, newest activity first. Threads marked handed off need a person."
      />

      <Card>
        {threads.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="h-8 w-8" />}
            title="No conversations yet"
            description="Conversations appear as soon as a lead is messaged or replies."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {threads.map((thread) => {
              const last = thread.messages[0];
              return (
                <li key={thread.id}>
                  <Link
                    href={`/leads/${thread.lead.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-brand-50/30 sm:px-5"
                  >
                    <div className="min-w-[12rem] flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-900">{thread.lead.name}</span>
                        <Badge tone="neutral">{thread.channel}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {last
                          ? `${last.sender === 'LEAD' ? thread.lead.name.split(' ')[0] : last.senderName ?? 'Team'}: ${last.body}`
                          : 'No messages yet'}
                      </p>
                    </div>

                    <ScorePill score={thread.lead.score} className="hidden sm:flex" />
                    <TemperatureBadge temperature={thread.lead.temperature} />
                    <StatusBadge status={thread.status} />
                    <span className="min-w-[6rem] text-right text-xs text-ink-400">
                      {relativeTime(thread.updatedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
