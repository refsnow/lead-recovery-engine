import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Sparkles } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { NotFoundError } from '@/lib/errors';
import { getLeadDetail, readScoreBreakdown } from '@/services/lead.service';
import { listAssignableUsers } from '@/services/team.service';
import { formatBudgetRange, formatINR, titleCase } from '@/lib/format';
import { formatDateTime, relativeTime } from '@/lib/dates';
import {
  Badge, Card, CardHeader, DataList, EmptyState, StatusBadge, TemperatureBadge,
} from '@/components/ui';
import { summariseAttribution, buildJourney } from '@/services/attribution.service';
import { LeadAttributionPanel, LeadJourney } from '@/components/leads/lead-attribution';
import { SourceBadge } from '@/components/leads/source-badge';
import { ScoreBreakdown } from '@/components/leads/score-breakdown';
import { ConversationThread } from '@/components/leads/conversation-thread';
import { ActivityTimeline } from '@/components/leads/activity-timeline';
import { LeadActions } from '@/components/leads/lead-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const lead = await getLeadDetail(
      { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name },
      id,
    );
    return { title: lead.name };
  } catch {
    return { title: 'Lead' };
  }
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const actor = { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name };

  let lead;
  try {
    lead = await getLeadDetail(actor, id);
  } catch (error) {
    // A lead in another organization is indistinguishable from one that does
    // not exist — tenancy leaks nothing, not even existence.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const salespeople = await listAssignableUsers(user.organizationId);
  const components = readScoreBreakdown(lead);
  const messages = lead.conversations.flatMap((conversation) => conversation.messages);
  const now = new Date();

  const pendingFollowUps = lead.followUps.filter((followUp) => followUp.status === 'PENDING');
  const overdueFollowUps = pendingFollowUps.filter((followUp) => followUp.scheduledFor < now);
  const completedFollowUps = lead.followUps.filter((followUp) => followUp.status !== 'PENDING');
  const totalRevenue = lead.conversions.reduce((total, conversion) => total + conversion.revenue, 0);
  const attribution = summariseAttribution(lead);
  const journey = buildJourney(lead);

  return (
    <>
      <Link href="/leads" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Back to leads
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">{lead.name}</h1>
            <StatusBadge status={lead.status} />
            <TemperatureBadge temperature={lead.temperature} />
            <SourceBadge source={lead.source} sourceDetail={lead.sourceDetail} />
            {lead.needsHumanHandoff ? <Badge tone="danger">Handoff to human</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            <a href={`tel:${lead.phone}`} className="font-mono hover:text-brand-700">{lead.phone}</a>
            {lead.email ? <> · <a href={`mailto:${lead.email}`} className="hover:text-brand-700">{lead.email}</a></> : null}
            {' · '}Created {relativeTime(lead.createdAt)}
          </p>
        </div>

        <div className="text-right text-xs text-ink-500">
          <p>{lead.assignedTo ? <>Owner: <span className="font-medium text-ink-800">{lead.assignedTo.name}</span></> : <span className="font-medium text-amber-700">Unassigned</span>}</p>
          {lead.lastContactedAt
            ? <p>Last contacted {relativeTime(lead.lastContactedAt)}</p>
            : <p className="font-medium text-rose-600">Never contacted</p>}
        </div>
      </div>

      {/* Alerts that need the salesperson's attention before anything else. */}
      {overdueFollowUps.length ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
          <div>
            <p className="text-sm font-medium text-rose-900">
              {overdueFollowUps.length} follow-up{overdueFollowUps.length === 1 ? ' is' : 's are'} overdue
            </p>
            <p className="text-xs text-rose-700">
              Oldest was due {relativeTime(overdueFollowUps[0]!.scheduledFor)}. Complete or reschedule it below.
            </p>
          </div>
        </div>
      ) : null}

      {lead.needsHumanHandoff && lead.handoffReason ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="text-sm font-medium text-amber-900">The AI assistant handed this lead to a person</p>
            <p className="text-xs text-amber-800">{lead.handoffReason}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Actions" description="Everything you can do with this lead." />
            <LeadActions
              leadId={lead.id}
              leadPhone={lead.phone}
              leadStatus={lead.status}
              salespeople={salespeople}
              assignedToId={lead.assignedToId}
              canAssign={can(user.role, 'ASSIGN_LEADS')}
              canRecordRevenue={can(user.role, 'RECORD_CONVERSION')}
            />
          </Card>

          <Card>
            <CardHeader
              title="Conversation"
              description={`${messages.length} message${messages.length === 1 ? '' : 's'} across ${lead.conversations.length} thread${lead.conversations.length === 1 ? '' : 's'}.`}
            />
            <ConversationThread messages={messages} />
          </Card>

          <Card>
            <CardHeader
              title="Follow-ups"
              description={`${pendingFollowUps.length} pending · ${overdueFollowUps.length} overdue · ${completedFollowUps.length} closed.`}
            />
            {lead.followUps.length === 0 ? (
              <EmptyState title="No follow-ups yet" description="Schedule one above so this lead cannot be forgotten." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {lead.followUps.map((followUp) => {
                  const overdue = followUp.status === 'PENDING' && followUp.scheduledFor < now;
                  return (
                    <li key={followUp.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
                      <StatusBadge status={overdue ? 'PENDING' : followUp.status} />
                      <span className="text-sm text-ink-800">{titleCase(followUp.type)}</span>
                      <span className="text-xs text-ink-500">{followUp.notes ?? 'No note'}</span>
                      <span className={overdue ? 'ml-auto text-xs font-medium text-rose-600' : 'ml-auto text-xs text-ink-500'}>
                        {overdue ? 'Overdue · ' : ''}{formatDateTime(followUp.scheduledFor)}
                      </span>
                      {followUp.assignedTo ? (
                        <span className="text-xs text-ink-400">{followUp.assignedTo.name}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Lead score" description="Every signal that contributed." />
            <ScoreBreakdown score={lead.score} temperature={lead.temperature} components={components} />
          </Card>

          {lead.aiSummary ? (
            <Card>
              <CardHeader
                title="AI summary"
                description={lead.aiConfidence !== null ? `${Math.round(lead.aiConfidence * 100)}% confidence` : undefined}
              />
              <p className="px-4 py-3 text-sm leading-relaxed text-ink-700 sm:px-5">{lead.aiSummary}</p>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Lead attribution"
              description="Where this lead came from. The acquisition source never changes as the lead progresses."
            />
            <LeadAttributionPanel attribution={attribution} />
          </Card>

          <Card>
            <CardHeader title="Lead journey" description="Acquisition through to outcome." />
            <LeadJourney steps={journey} />
          </Card>

          <Card>
            <CardHeader title="Lead information" />
            <div className="px-4 py-4 sm:px-5">
              <DataList items={[
                { label: 'Budget / Surplus', value: formatBudgetRange(lead.budgetMin, lead.budgetMax) },
                { label: 'Location / Region', value: lead.location ?? '—' },
                { label: 'Offering / Requirement', value: lead.offeringType ?? lead.propertyType ?? '—' },
                { label: 'Timeline', value: lead.decisionTimeline ? titleCase(lead.decisionTimeline) : lead.purchaseTimeline ? titleCase(lead.purchaseTimeline) : '—' },
                { label: 'Intent', value: lead.intent ? titleCase(lead.intent) : '—' },
              ]} />
              {lead.lostReason ? (
                <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  <span className="font-medium">Lost reason:</span> {lead.lostReason}
                </p>
              ) : null}
            </div>
          </Card>

          {lead.appointments.length ? (
            <Card>
              <CardHeader title="Appointments" />
              <ul className="divide-y divide-ink-100">
                {lead.appointments.map((appointment) => (
                  <li key={appointment.id} className="px-4 py-2.5 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink-800">{formatDateTime(appointment.scheduledFor)}</span>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <p className="text-xs text-ink-500">
                      {appointment.location ?? 'Location not set'}
                      {appointment.salesperson ? ` · ${appointment.salesperson.name}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {lead.conversions.length && can(user.role, 'VIEW_REVENUE') ? (
            <Card>
              <CardHeader title="Revenue" description={`${formatINR(totalRevenue)} total`} />
              <ul className="divide-y divide-ink-100">
                {lead.conversions.map((conversion) => (
                  <li key={conversion.id} className="px-4 py-2.5 sm:px-5">
                    <p className="text-sm font-medium text-emerald-700">{formatINR(conversion.revenue)}</p>
                    <p className="text-xs text-ink-500">
                      {conversion.product ?? 'Unspecified product'} · {formatDateTime(conversion.convertedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Activity timeline" description="Everything that happened, newest first." />
            <ActivityTimeline items={lead.activities} />
          </Card>
        </div>
      </div>
    </>
  );
}
