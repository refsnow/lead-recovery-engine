import { prisma } from '@/db/client';
import { parseJson } from '@/lib/json';
import { logger } from '@/lib/logger';
import { notify, notifyManagers } from '@/services/notification.service';
import { startFollowUpSequence } from '@/services/followup.service';
import { pickNextSalesperson, pickSeniorSalesperson } from '@/services/lead.service';
import { recordActivitySafe } from '@/services/activity.service';
import type { AutomationTrigger, RuleActionSpec, RuleCondition } from '@/types/domain';

/**
 * Rule-based automation: WHEN <trigger> IF <conditions> THEN <actions>.
 *
 * Deliberately not a drag-and-drop builder — this covers the assignment,
 * notification and sequencing decisions that actually prevent lost leads, and
 * stays simple enough to reason about and test.
 */

export interface AutomationContext {
  leadId: string;
  organizationId: string;
  /** Flattened lead snapshot that conditions are evaluated against. */
  lead: Record<string, unknown>;
}

export async function runAutomations(trigger: AutomationTrigger, ctx: AutomationContext): Promise<string[]> {
  const rules = await prisma.automationRule.findMany({
    where: { organizationId: ctx.organizationId, trigger, isActive: true },
  });

  const executed: string[] = [];

  for (const rule of rules) {
    const conditions = parseJson<RuleCondition[]>(rule.conditions, []);
    if (!conditions.every((condition) => evaluateCondition(ctx.lead, condition))) continue;

    const actions = parseJson<RuleActionSpec[]>(rule.actions, []);
    for (const action of actions) {
      try {
        await executeAction(action, ctx);
      } catch (error) {
        // One failing action must not abort the remaining rules.
        await logger.error('WORKFLOW', `Automation action ${action.type} failed`, {
          ruleId: rule.id, leadId: ctx.leadId, error: (error as Error).message,
        }, ctx.organizationId);
      }
    }

    await prisma.automationRule.update({
      where: { id: rule.id },
      data: { lastRunAt: new Date(), runCount: { increment: 1 } },
    });
    executed.push(rule.name);
  }

  return executed;
}

export function evaluateCondition(lead: Record<string, unknown>, condition: RuleCondition): boolean {
  const value = condition.field.split('.').reduce<unknown>(
    (current, key) => (current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined),
    lead,
  );

  switch (condition.operator) {
    case 'EQUALS': return String(value ?? '') === String(condition.value ?? '');
    case 'GT': return Number(value) > Number(condition.value);
    case 'GTE': return Number(value) >= Number(condition.value);
    case 'LT': return Number(value) < Number(condition.value);
    case 'LTE': return Number(value) <= Number(condition.value);
    case 'IN': return (Array.isArray(condition.value) ? condition.value : [condition.value])
      .map(String).includes(String(value));
    case 'IS_EMPTY': return value === null || value === undefined || value === '';
    case 'NOT_EMPTY': return value !== null && value !== undefined && value !== '';
    default: return false;
  }
}

async function executeAction(action: RuleActionSpec, ctx: AutomationContext): Promise<void> {
  switch (action.type) {
    case 'ASSIGN_ROUND_ROBIN':
    case 'ASSIGN_TO_SENIOR': {
      const current = await prisma.lead.findUnique({
        where: { id: ctx.leadId }, select: { assignedToId: true, name: true },
      });
      if (current?.assignedToId) return; // never reassign an owned lead automatically

      const assigneeId = action.type === 'ASSIGN_TO_SENIOR'
        ? await pickSeniorSalesperson(ctx.organizationId)
        : await pickNextSalesperson(ctx.organizationId);
      if (!assigneeId) return;

      await prisma.lead.update({ where: { id: ctx.leadId }, data: { assignedToId: assigneeId } });
      await recordActivitySafe({
        leadId: ctx.leadId, type: 'LEAD_ASSIGNED', actorType: 'SYSTEM',
        summary: `Auto-assigned by rule (${action.type === 'ASSIGN_TO_SENIOR' ? 'senior' : 'round robin'}).`,
      });
      await notify({
        organizationId: ctx.organizationId, userId: assigneeId, leadId: ctx.leadId,
        type: 'NEW_HOT_LEAD', severity: 'WARNING',
        title: `Lead assigned automatically: ${current?.name ?? 'New lead'}`,
        body: 'Assigned to you by an automation rule. Contact the lead now.',
      });
      return;
    }

    case 'START_FOLLOW_UP_SEQUENCE':
      await startFollowUpSequence(ctx.leadId);
      return;

    case 'SEND_NOTIFICATION': {
      const lead = await prisma.lead.findUnique({
        where: { id: ctx.leadId }, select: { assignedToId: true, name: true, score: true },
      });
      await notify({
        organizationId: ctx.organizationId, userId: lead?.assignedToId ?? null, leadId: ctx.leadId,
        type: 'NEW_HOT_LEAD', severity: 'WARNING',
        title: String(action.params?.title ?? `Action needed: ${lead?.name ?? 'lead'}`),
        body: String(action.params?.body ?? `This lead scored ${lead?.score ?? 0}/100 and needs attention.`),
      });
      return;
    }

    case 'NOTIFY_SALES_MANAGER': {
      const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId }, select: { name: true } });
      await notifyManagers({
        organizationId: ctx.organizationId, leadId: ctx.leadId,
        type: 'OVERDUE_FOLLOW_UP', severity: 'WARNING',
        title: String(action.params?.title ?? `Escalation: ${lead?.name ?? 'lead'}`),
        body: String(action.params?.body ?? 'An automation rule escalated this lead to management.'),
      });
      return;
    }

    case 'SET_STATUS': {
      const status = String(action.params?.status ?? '');
      if (!status) return;
      await prisma.lead.update({ where: { id: ctx.leadId }, data: { status } });
      return;
    }

    case 'SEND_FOLLOW_UP':
      await startFollowUpSequence(ctx.leadId);
      return;

    default:
      return;
  }
}

/** Flattens a lead into the shape automation conditions expect. */
export async function buildAutomationContext(leadId: string): Promise<AutomationContext | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  return {
    leadId: lead.id,
    organizationId: lead.organizationId,
    lead: {
      score: lead.score, temperature: lead.temperature, status: lead.status, source: lead.source,
      assignedToId: lead.assignedToId, budgetMax: lead.budgetMax, location: lead.location,
      propertyType: lead.propertyType, purchaseTimeline: lead.purchaseTimeline, intent: lead.intent,
    },
  };
}
