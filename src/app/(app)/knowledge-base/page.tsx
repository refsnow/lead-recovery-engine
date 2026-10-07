import { redirect } from 'next/navigation';
import { BookOpen, ShieldCheck } from 'lucide-react';
import { prisma } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { ActionForm, InlineActionForm } from '@/components/ui/action-form';
import { deleteKnowledgeEntryAction, saveKnowledgeEntryAction } from '@/app/actions/admin-actions';

export const metadata = { title: 'Knowledge Base' };
export const dynamic = 'force-dynamic';

/**
 * The approved-answer store. The AI assistant may only state facts that appear
 * here — everything else is escalated to a person.
 */
export default async function KnowledgeBasePage() {
  const user = await requireUser();
  if (!can(user.role, 'MANAGE_KNOWLEDGE_BASE')) redirect('/dashboard');

  const entries = await prisma.knowledgeEntry.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
  });

  const grouped = entries.reduce<Record<string, typeof entries>>((groups, entry) => {
    (groups[entry.category] ??= []).push(entry);
    return groups;
  }, {});

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="The only facts the AI assistant is allowed to state. Anything not written here is escalated to a person."
      />

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
        <div className="text-xs text-sky-900">
          <p className="font-medium">How this constrains the assistant</p>
          <p className="mt-0.5 text-sky-800">
            Approved entries are the assistant&apos;s entire factual world. It cannot invent prices, availability or
            amenities, cannot promise discounts, and hands any question outside these answers to a salesperson.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`Approved answers — ${entries.length}`} />
          {entries.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title="No approved answers yet"
              description="Until you add entries, the assistant will escalate every factual question to a salesperson."
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="px-4 py-3 sm:px-5">
                  <p className="label mb-2">{category}</p>
                  <ul className="space-y-3">
                    {items.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-ink-200/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-ink-900">{entry.question}</p>
                          {entry.isApproved
                            ? <Badge tone="success">Approved</Badge>
                            : <Badge tone="warning">Not approved</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-ink-600">{entry.answer}</p>
                        <div className="mt-2">
                          <InlineActionForm
                            action={deleteKnowledgeEntryAction}
                            label="Remove"
                            variant="ghost"
                            hidden={{ id: entry.id }}
                            confirmMessage={`Remove "${entry.question}" from the knowledge base?`}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Add an answer" description="Only add what you are willing to have stated verbatim." />
          <div className="p-4 sm:p-5">
            <ActionForm action={saveKnowledgeEntryAction} submitLabel="Add entry" resetOnSuccess>
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Question</span>
                  <input name="question" required maxLength={400} className="input mt-1" placeholder="Is parking available?" />
                </label>
                <label className="block">
                  <span className="label">Approved answer</span>
                  <textarea name="answer" required rows={4} maxLength={4000} className="input mt-1"
                    placeholder="Yes, two parking spaces are available with selected units." />
                </label>
                <label className="block">
                  <span className="label">Category</span>
                  <input name="category" maxLength={60} defaultValue="GENERAL" className="input mt-1" />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" name="isApproved" defaultChecked className="rounded border-ink-300" />
                  Approved for the assistant to use
                </label>
              </div>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
