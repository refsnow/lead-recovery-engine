import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getScoringConfig } from '@/services/scoring.service';
import { Card, CardHeader, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/ui/action-form';
import { saveScoringConfigAction } from '@/app/actions/admin-actions';

export const metadata = { title: 'Lead scoring' };
export const dynamic = 'force-dynamic';

const OPERATORS = [
  { value: 'NOT_EMPTY', label: 'has any value' },
  { value: 'IS_TRUE', label: 'is true' },
  { value: 'EQUALS', label: 'equals' },
  { value: 'IN', label: 'is one of (comma separated)' },
  { value: 'GTE', label: 'is at least' },
  { value: 'LTE', label: 'is at most' },
];

/**
 * Scoring is configuration, not code. Rules are stored per organization and
 * consumed only by LeadScoringService — no UI component computes a score.
 */
export default async function ScoringSettingsPage() {
  const user = await requireUser();
  if (!can(user.role, 'MANAGE_AUTOMATION')) redirect('/dashboard');

  const config = await getScoringConfig(user.organizationId);

  return (
    <>
      <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Back to settings
      </Link>

      <PageHeader
        title="Lead scoring"
        description="What earns a lead points, and where hot, warm and cold begin. Every lead can explain its own score."
      />

      <Card className="max-w-4xl">
        <CardHeader
          title="Scoring rules"
          description="Scores are capped at 100. Available fields: budgetMax, location, propertyType, purchaseTimeline, intent, signals.replied, signals.askedPricing, signals.requestedAppointment."
        />
        <div className="p-4 sm:p-5">
          <ActionForm action={saveScoringConfigAction} submitLabel="Save scoring configuration">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Hot threshold</span>
                <input type="number" name="hotThreshold" min="1" max="100" required
                  defaultValue={config.hotThreshold} className="input mt-1" />
                <span className="mt-1 block text-[11px] text-ink-400">Scores at or above this are HOT.</span>
              </label>
              <label className="block">
                <span className="label">Warm threshold</span>
                <input type="number" name="warmThreshold" min="0" max="99" required
                  defaultValue={config.warmThreshold} className="input mt-1" />
                <span className="mt-1 block text-[11px] text-ink-400">Below this is COLD. Must be under the hot threshold.</span>
              </label>
            </div>

            <div className="mt-4 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[46rem] border-collapse">
                <thead>
                  <tr className="border-b border-ink-200">
                    <th scope="col" className="table-head">Label</th>
                    <th scope="col" className="table-head">Field</th>
                    <th scope="col" className="table-head">Condition</th>
                    <th scope="col" className="table-head">Value</th>
                    <th scope="col" className="table-head w-20">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {config.rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-2 py-1.5">
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <input name="ruleLabel" defaultValue={rule.label} required maxLength={120}
                          className="input text-xs" aria-label={`Label for ${rule.id}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input name="ruleField" defaultValue={rule.field} required maxLength={60}
                          className="input font-mono text-xs" aria-label={`Field for ${rule.id}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select name="ruleOperator" defaultValue={rule.operator}
                          className="input text-xs" aria-label={`Operator for ${rule.id}`}>
                          {OPERATORS.map((operator) => (
                            <option key={operator.value} value={operator.value}>{operator.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input name="ruleValue"
                          defaultValue={Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value ?? '')}
                          className="input text-xs" aria-label={`Value for ${rule.id}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" name="rulePoints" defaultValue={rule.points} min="-100" max="100" required
                          className="input text-xs tabular-nums" aria-label={`Points for ${rule.id}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-ink-500">
              Changes apply to leads as they are rescored — when qualification data changes, when a lead replies, or
              when you use &ldquo;Recalculate score&rdquo; on a lead.
            </p>
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
