import { redirect } from 'next/navigation';
import { Workflow, Clock } from 'lucide-react';
import { prisma } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { parseJson } from '@/lib/json';
import { relativeTime } from '@/lib/dates';
import { titleCase, formatDuration } from '@/lib/format';
import { DEFAULT_FOLLOW_UP_SEQUENCE } from '@/config/defaults';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { ActionForm, InlineActionForm } from '@/components/ui/action-form';
import { saveAutomationRuleAction, toggleAutomationRuleAction } from '@/app/actions/admin-actions';
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, type RuleActionSpec, type RuleCondition } from '@/types/domain';

export const metadata = { title: 'Automations' };
export const dynamic = 'force-dynamic';

const OPERATOR_LABELS: Record<string, string> = {
  EQUALS: 'is', GT: 'is greater than', GTE: 'is at least', LT: 'is less than',
  LTE: 'is at most', IN: 'is one of', IS_EMPTY: 'is empty', NOT_EMPTY: 'is not empty',
};

/**
 * Rule-based automation, presented as readable WHEN / IF / THEN sentences.
 * Intentionally not a drag-and-drop builder: this covers the assignment,
 * notification and sequencing decisions that prevent lost leads.
 */
export default async function AutomationsPage() {
  const user = await requireUser();
  if (!can(user.role, 'MANAGE_AUTOMATION')) redirect('/dashboard');

  const [rules, steps] = await Promise.all([
    prisma.automationRule.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.followUpStep.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { order: 'asc' },
    }),
  ]);

  const sequence = steps.length ? steps : DEFAULT_FOLLOW_UP_SEQUENCE.map((step, index) => ({
    ...step, id: `default-${index}`, isActive: true, stopOnReply: true, stopOnAppointment: true,
  }));

  return (
    <>
      <PageHeader
        title="Automations"
        description="Rules that act on leads without waiting for a person, and the follow-up cadence they start."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={`Rules — ${rules.length}`} description="Evaluated in order whenever their trigger fires." />
            {rules.length === 0 ? (
              <EmptyState
                icon={<Workflow className="h-8 w-8" />}
                title="No automation rules"
                description="Without rules, every lead waits for a person to notice it."
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {rules.map((rule) => {
                  const conditions = parseJson<RuleCondition[]>(rule.conditions, []);
                  const actions = parseJson<RuleActionSpec[]>(rule.actions, []);

                  return (
                    <li key={rule.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-ink-900">{rule.name}</p>
                          {rule.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Paused</Badge>}
                        </div>
                        <InlineActionForm
                          action={toggleAutomationRuleAction}
                          label={rule.isActive ? 'Pause' : 'Activate'}
                          variant="secondary"
                          hidden={{ id: rule.id }}
                        />
                      </div>

                      <dl className="mt-3 space-y-1.5 text-xs">
                        <Clause label="WHEN" tone="bg-brand-50 text-brand-800">
                          {titleCase(rule.trigger)}
                        </Clause>
                        {conditions.length ? (
                          <Clause label="IF" tone="bg-amber-50 text-amber-800">
                            {conditions.map((condition, index) => (
                              <span key={index}>
                                {index > 0 ? ' and ' : ''}
                                <span className="font-medium">{condition.field}</span>{' '}
                                {OPERATOR_LABELS[condition.operator] ?? condition.operator}{' '}
                                <span className="font-medium">{String(condition.value ?? '')}</span>
                              </span>
                            ))}
                          </Clause>
                        ) : null}
                        <Clause label="THEN" tone="bg-emerald-50 text-emerald-800">
                          {actions.map((action) => titleCase(action.type)).join(', ')}
                        </Clause>
                      </dl>

                      <p className="mt-2 text-[11px] text-ink-400">
                        Run {rule.runCount} time{rule.runCount === 1 ? '' : 's'}
                        {rule.lastRunAt ? ` · last ${relativeTime(rule.lastRunAt)}` : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Follow-up sequence"
              description="What the system sends when a sequence starts. Stops as soon as the lead replies or books a visit."
            />
            <ol className="divide-y divide-ink-100">
              {sequence.map((step, index) => (
                <li key={step.id} className="flex gap-3 px-4 py-3 sm:px-5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                      {step.name}
                      <Badge tone="neutral">
                        <Clock className="h-3 w-3" aria-hidden />
                        {step.delayMinutes === 0 ? 'Immediately' : `+${formatDuration(step.delayMinutes)}`}
                      </Badge>
                      <Badge tone="info">{step.channel}</Badge>
                    </p>
                    <p className="mt-1 text-xs italic text-ink-500">&ldquo;{step.messageTemplate}&rdquo;</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="border-t border-ink-100 px-4 py-2.5 text-[11px] text-ink-400 sm:px-5">
              Stop conditions: the lead replies · an appointment is booked · the lead is handed off to a human ·
              the lead is marked won or lost.
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader title="Add a rule" />
          <div className="p-4 sm:p-5">
            <ActionForm action={saveAutomationRuleAction} submitLabel="Create rule" resetOnSuccess>
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Name</span>
                  <input name="name" required maxLength={160} className="input mt-1" placeholder="Hot leads go to a senior salesperson" />
                </label>

                <label className="block">
                  <span className="label">WHEN (trigger)</span>
                  <select name="trigger" className="input mt-1">
                    {AUTOMATION_TRIGGERS.map((trigger) => (
                      <option key={trigger} value={trigger}>{titleCase(trigger)}</option>
                    ))}
                  </select>
                </label>

                <fieldset className="rounded-lg border border-ink-200 p-3">
                  <legend className="label px-1">IF (optional condition)</legend>
                  <div className="space-y-2">
                    <select name="conditionField" className="input" defaultValue="">
                      <option value="">No condition — always run</option>
                      <option value="score">score</option>
                      <option value="temperature">temperature</option>
                      <option value="status">status</option>
                      <option value="source">source</option>
                      <option value="assignedToId">assignedToId</option>
                      <option value="budgetMax">budgetMax</option>
                    </select>
                    <select name="conditionOperator" className="input">
                      {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <input name="conditionValue" className="input" placeholder="e.g. 70" />
                  </div>
                </fieldset>

                <fieldset className="rounded-lg border border-ink-200 p-3">
                  <legend className="label px-1">THEN (actions)</legend>
                  <div className="space-y-1.5">
                    {AUTOMATION_ACTIONS.map((action) => (
                      <label key={action} className="flex items-center gap-2 text-xs text-ink-700">
                        <input type="checkbox" name="actionType" value={action} className="rounded border-ink-300" />
                        {titleCase(action)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}

function Clause({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className={`h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${tone}`}>{label}</dt>
      <dd className="text-ink-700">{children}</dd>
    </div>
  );
}
