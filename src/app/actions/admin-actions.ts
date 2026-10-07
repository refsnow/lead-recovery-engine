'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { can, type Capability } from '@/lib/permissions';
import { AppError, AuthorizationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { hashPassword } from '@/lib/password';
import {
  automationRuleSchema, campaignSchema, createUserSchema, knowledgeEntrySchema, scoringConfigSchema,
} from '@/lib/validation';
import { writeAuditLog } from '@/services/activity.service';
import type { ActionState } from '@/app/actions/lead-actions';

export type { ActionState };

async function requireCapability(capability: Capability) {
  const user = await requireUser();
  if (!can(user.role, capability)) throw new AuthorizationError();
  return user;
}

async function run(label: string, handler: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    await logger.error('API', `Admin action ${label} failed`, { error: (error as Error).message });
    return { error: 'Something went wrong. The error has been logged; please try again.' };
  }
}

function fieldErrors(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }): ActionState {
  const errors = error.flatten().fieldErrors;
  return {
    error: Object.values(errors).flat().filter(Boolean)[0] ?? 'Please correct the highlighted fields.',
    fieldErrors: errors as Record<string, string[]>,
  };
}

// --- Knowledge base --------------------------------------------------------

export async function saveKnowledgeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('saveKnowledgeEntry', async () => {
    const user = await requireCapability('MANAGE_KNOWLEDGE_BASE');
    const parsed = knowledgeEntrySchema.safeParse({
      question: formData.get('question'),
      answer: formData.get('answer'),
      category: formData.get('category') || 'GENERAL',
      isApproved: formData.get('isApproved') !== null,
    });
    if (!parsed.success) return fieldErrors(parsed.error);

    const id = formData.get('id');
    if (id) {
      // Scoped update: an id from another organization matches nothing.
      const { count } = await prisma.knowledgeEntry.updateMany({
        where: { id: String(id), organizationId: user.organizationId },
        data: parsed.data,
      });
      if (!count) return { error: 'That knowledge base entry could not be found.' };
    } else {
      await prisma.knowledgeEntry.create({
        data: { ...parsed.data, organizationId: user.organizationId },
      });
    }

    revalidatePath('/knowledge-base');
    return { ok: true, message: id ? 'Entry updated.' : 'Entry added.' };
  });
}

export async function deleteKnowledgeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('deleteKnowledgeEntry', async () => {
    const user = await requireCapability('MANAGE_KNOWLEDGE_BASE');
    await prisma.knowledgeEntry.deleteMany({
      where: { id: String(formData.get('id')), organizationId: user.organizationId },
    });
    revalidatePath('/knowledge-base');
    return { ok: true, message: 'Entry removed.' };
  });
}

// --- Campaigns -------------------------------------------------------------

export async function saveCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('saveCampaign', async () => {
    const user = await requireCapability('MANAGE_CAMPAIGNS');
    const parsed = campaignSchema.safeParse({
      name: formData.get('name'),
      source: formData.get('source') || 'META_LEAD_ADS',
      spend: formData.get('spend') || 0,
      isActive: formData.get('isActive') !== null,
    });
    if (!parsed.success) return fieldErrors(parsed.error);

    const id = formData.get('id');
    if (id) {
      const { count } = await prisma.campaign.updateMany({
        where: { id: String(id), organizationId: user.organizationId },
        data: parsed.data,
      });
      if (!count) return { error: 'That campaign could not be found.' };
    } else {
      await prisma.campaign.create({ data: { ...parsed.data, organizationId: user.organizationId } });
    }

    revalidatePath('/campaigns');
    revalidatePath('/reports');
    return { ok: true, message: id ? 'Campaign updated.' : 'Campaign created.' };
  });
}

// --- Users -----------------------------------------------------------------

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('createUser', async () => {
    const user = await requireCapability('MANAGE_USERS');
    const parsed = createUserSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role') || 'SALESPERSON',
      phone: formData.get('phone') || undefined,
    });
    if (!parsed.success) return fieldErrors(parsed.error);

    // Only an owner may create another owner.
    if (parsed.data.role === 'OWNER' && user.role !== 'OWNER') {
      return { error: 'Only an owner can create another owner account.' };
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return { error: 'An account with that email address already exists.' };

    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        phone: parsed.data.phone ?? null,
        organizationId: user.organizationId,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });

    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id,
      action: 'USER_CREATED', entityType: 'User', entityId: created.id,
      metadata: { role: created.role },
    });

    revalidatePath('/settings');
    revalidatePath('/team');
    return { ok: true, message: `${created.name} was added to the team.` };
  });
}

export async function toggleUserActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('toggleUserActive', async () => {
    const actor = await requireCapability('MANAGE_USERS');
    const userId = String(formData.get('userId'));
    if (userId === actor.id) return { error: 'You cannot deactivate your own account.' };

    const target = await prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
    });
    if (!target) return { error: 'That user could not be found.' };
    if (target.role === 'OWNER' && actor.role !== 'OWNER') {
      return { error: 'Only an owner can change another owner account.' };
    }

    await prisma.user.update({ where: { id: userId }, data: { isActive: !target.isActive } });
    // Deactivating a user must immediately invalidate their live sessions.
    if (target.isActive) await prisma.session.deleteMany({ where: { userId } });

    await writeAuditLog({
      organizationId: actor.organizationId, userId: actor.id,
      action: target.isActive ? 'USER_DEACTIVATED' : 'USER_REACTIVATED',
      entityType: 'User', entityId: userId,
    });

    revalidatePath('/settings');
    return { ok: true, message: `${target.name} was ${target.isActive ? 'deactivated' : 'reactivated'}.` };
  });
}

// --- Scoring ---------------------------------------------------------------

export async function saveScoringConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('saveScoringConfig', async () => {
    const user = await requireCapability('MANAGE_AUTOMATION');

    // Rules arrive as parallel arrays from the form's repeated fields.
    const ids = formData.getAll('ruleId').map(String);
    const rules = ids.map((id, index) => ({
      id,
      label: String(formData.getAll('ruleLabel')[index] ?? ''),
      points: Number(formData.getAll('rulePoints')[index] ?? 0),
      field: String(formData.getAll('ruleField')[index] ?? ''),
      operator: String(formData.getAll('ruleOperator')[index] ?? 'NOT_EMPTY'),
      value: parseRuleValue(String(formData.getAll('ruleValue')[index] ?? '')),
    }));

    const parsed = scoringConfigSchema.safeParse({
      hotThreshold: formData.get('hotThreshold'),
      warmThreshold: formData.get('warmThreshold'),
      rules,
    });
    if (!parsed.success) return fieldErrors(parsed.error);

    await prisma.scoringConfig.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        rules: JSON.stringify(parsed.data.rules),
        hotThreshold: parsed.data.hotThreshold,
        warmThreshold: parsed.data.warmThreshold,
      },
      update: {
        rules: JSON.stringify(parsed.data.rules),
        hotThreshold: parsed.data.hotThreshold,
        warmThreshold: parsed.data.warmThreshold,
      },
    });

    revalidatePath('/settings/scoring');
    return {
      ok: true,
      message: 'Scoring updated. New scores apply as leads are rescored — use "Recalculate score" on a lead to apply immediately.',
    };
  });
}

function parseRuleValue(raw: string): string | number | string[] | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (value.includes(',')) return value.split(',').map((part) => part.trim()).filter(Boolean);
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && value !== '' ? asNumber : value;
}

// --- Automation ------------------------------------------------------------

export async function toggleAutomationRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('toggleAutomationRule', async () => {
    const user = await requireCapability('MANAGE_AUTOMATION');
    const id = String(formData.get('id'));

    const rule = await prisma.automationRule.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!rule) return { error: 'That automation rule could not be found.' };

    await prisma.automationRule.update({ where: { id }, data: { isActive: !rule.isActive } });
    revalidatePath('/automations');
    return { ok: true, message: `Rule ${rule.isActive ? 'paused' : 'activated'}.` };
  });
}

export async function saveAutomationRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('saveAutomationRule', async () => {
    const user = await requireCapability('MANAGE_AUTOMATION');

    const conditionField = String(formData.get('conditionField') ?? '').trim();
    const conditions = conditionField
      ? [{
          field: conditionField,
          operator: String(formData.get('conditionOperator') ?? 'EQUALS'),
          value: parseRuleValue(String(formData.get('conditionValue') ?? '')),
        }]
      : [];

    const actions = formData.getAll('actionType').map((type) => ({ type: String(type) }));

    const parsed = automationRuleSchema.safeParse({
      name: formData.get('name'),
      trigger: formData.get('trigger'),
      isActive: true,
      conditions,
      actions,
    });
    if (!parsed.success) return fieldErrors(parsed.error);

    await prisma.automationRule.create({
      data: {
        organizationId: user.organizationId,
        name: parsed.data.name,
        trigger: parsed.data.trigger,
        isActive: parsed.data.isActive,
        conditions: JSON.stringify(parsed.data.conditions),
        actions: JSON.stringify(parsed.data.actions),
      },
    });

    revalidatePath('/automations');
    return { ok: true, message: 'Automation rule created.' };
  });
}
