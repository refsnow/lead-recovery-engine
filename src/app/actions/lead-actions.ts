'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { AppError, AuthorizationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  addNoteSchema, assignLeadSchema, createAppointmentSchema, createConversionSchema,
  createFollowUpSchema, createLeadSchema, completeFollowUpSchema, sendMessageSchema, updateLeadSchema,
} from '@/lib/validation';
import { assignLead, createLead, rescoreLead, updateLead, type ActorContext } from '@/services/lead.service';
import { addNote, sendOutboundMessage } from '@/services/conversation.service';
import { completeFollowUp, createFollowUp, startFollowUpSequence } from '@/services/followup.service';
import { bookAppointment } from '@/services/appointment.service';
import { recordConversion } from '@/services/conversion.service';
import { qualifyLead } from '@/services/qualification.service';
import { writeAuditLog } from '@/services/activity.service';
import { runAutomations, buildAutomationContext } from '@/services/automation.service';

export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

async function actor(): Promise<ActorContext> {
  const user = await requireUser();
  return { id: user.id, role: user.role, organizationId: user.organizationId, name: user.name };
}

/**
 * Wraps an action so a thrown AppError becomes a readable message instead of a
 * crashed page, and unexpected errors are logged without leaking internals.
 */
async function run(
  label: string,
  handler: () => Promise<ActionState>,
): Promise<ActionState> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    // A redirect() inside an action throws a control-flow signal; let it pass.
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    await logger.error('API', `Action ${label} failed`, { error: (error as Error).message });
    return { error: 'Something went wrong. The error has been logged; please try again.' };
  }
}

function parseFormErrors(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }): ActionState {
  const fieldErrors = error.flatten().fieldErrors;
  const first = Object.values(fieldErrors).flat().filter(Boolean)[0];
  return {
    error: first ?? 'Please correct the highlighted fields.',
    fieldErrors: fieldErrors as Record<string, string[]>,
  };
}

// ---------------------------------------------------------------------------

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('createLead', async () => {
    const user = await actor();
    const parsed = createLeadSchema.safeParse({
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email') || undefined,
      source: formData.get('source') || 'MANUAL',
      sourceDetail: formData.get('sourceDetail') || undefined,
      campaignId: formData.get('campaignId') || undefined,
      location: formData.get('location') || undefined,
      propertyType: formData.get('propertyType') || undefined,
      budgetMax: formData.get('budgetMax') || undefined,
      purchaseTimeline: formData.get('purchaseTimeline') || undefined,
      intent: formData.get('intent') || undefined,
      assignedToId: formData.get('assignedToId') || undefined,
    });
    if (!parsed.success) return parseFormErrors(parsed.error);

    const lead = await createLead({ ...parsed.data, organizationId: user.organizationId }, user);

    const ctx = await buildAutomationContext(lead.id);
    if (ctx) await runAutomations('LEAD_CREATED', ctx);

    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id,
      action: 'LEAD_CREATED', entityType: 'Lead', entityId: lead.id,
    });

    revalidatePath('/leads');
    revalidatePath('/dashboard');
    redirect(`/leads/${lead.id}`);
  });
}

export async function updateLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('updateLead', async () => {
    const user = await actor();
    const leadId = String(formData.get('leadId'));

    const payload: Record<string, unknown> = {};
    for (const key of ['status', 'temperature', 'location', 'propertyType', 'purchaseTimeline', 'intent', 'lostReason', 'budgetMax', 'budgetMin', 'name', 'phone', 'email']) {
      const value = formData.get(key);
      if (value !== null && value !== '') payload[key] = value;
    }

    const parsed = updateLeadSchema.safeParse(payload);
    if (!parsed.success) return parseFormErrors(parsed.error);

    await updateLead(user, leadId, parsed.data);
    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id,
      action: 'LEAD_UPDATED', entityType: 'Lead', entityId: leadId, metadata: parsed.data,
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/leads');
    return { ok: true, message: 'Lead updated.' };
  });
}

export async function assignLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('assignLead', async () => {
    const user = await actor();
    if (!can(user.role, 'ASSIGN_LEADS')) throw new AuthorizationError('Only managers can reassign leads.');

    const leadId = String(formData.get('leadId'));
    const raw = formData.get('assignedToId');
    const parsed = assignLeadSchema.safeParse({ assignedToId: raw ? String(raw) : null });
    if (!parsed.success) return parseFormErrors(parsed.error);

    await assignLead(user, leadId, parsed.data.assignedToId);
    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id,
      action: 'LEAD_ASSIGNED', entityType: 'Lead', entityId: leadId,
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/leads');
    return { ok: true, message: 'Lead reassigned.' };
  });
}

export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('sendMessage', async () => {
    const user = await actor();
    const leadId = String(formData.get('leadId'));
    const parsed = sendMessageSchema.safeParse({
      body: formData.get('body'),
      channel: formData.get('channel') || 'WHATSAPP',
    });
    if (!parsed.success) return parseFormErrors(parsed.error);

    const result = await sendOutboundMessage({
      leadId, body: parsed.data.body, channel: parsed.data.channel,
      sender: 'SALESPERSON', senderName: user.name, senderId: user.id,
    });

    revalidatePath(`/leads/${leadId}`);
    return result.delivered
      ? { ok: true, message: 'Message sent.' }
      : { error: `The message could not be delivered: ${result.failureReason ?? 'unknown error'}. It has been recorded as failed.` };
  });
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('addNote', async () => {
    const user = await actor();
    const leadId = String(formData.get('leadId'));
    const parsed = addNoteSchema.safeParse({ body: formData.get('body') });
    if (!parsed.success) return parseFormErrors(parsed.error);

    await addNote(leadId, parsed.data.body, { id: user.id, name: user.name });
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message: 'Note added.' };
  });
}

export async function createFollowUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('createFollowUp', async () => {
    const user = await actor();
    const leadId = String(formData.get('leadId'));
    const parsed = createFollowUpSchema.safeParse({
      type: formData.get('type') || 'CALL',
      scheduledFor: formData.get('scheduledFor'),
      notes: formData.get('notes') || undefined,
      assignedToId: formData.get('assignedToId') || undefined,
    });
    if (!parsed.success) return parseFormErrors(parsed.error);

    await createFollowUp(user, leadId, parsed.data);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/follow-ups');
    return { ok: true, message: 'Follow-up scheduled.' };
  });
}

export async function completeFollowUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('completeFollowUp', async () => {
    const user = await actor();
    const followUpId = String(formData.get('followUpId'));
    const parsed = completeFollowUpSchema.safeParse({
      status: formData.get('status') || 'COMPLETED',
      notes: formData.get('notes') || undefined,
    });
    if (!parsed.success) return parseFormErrors(parsed.error);

    await completeFollowUp(user, followUpId, parsed.data);
    revalidatePath('/follow-ups');
    revalidatePath('/dashboard');
    const leadId = formData.get('leadId');
    if (leadId) revalidatePath(`/leads/${String(leadId)}`);
    return { ok: true, message: 'Follow-up updated.' };
  });
}

export async function bookAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('bookAppointment', async () => {
    const user = await actor();
    const leadId = String(formData.get('leadId'));
    const parsed = createAppointmentSchema.safeParse({
      scheduledFor: formData.get('scheduledFor'),
      location: formData.get('location') || undefined,
      notes: formData.get('notes') || undefined,
      salespersonId: formData.get('salespersonId') || undefined,
    });
    if (!parsed.success) return parseFormErrors(parsed.error);

    await bookAppointment(user, leadId, parsed.data);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/appointments');
    return { ok: true, message: 'Appointment booked.' };
  });
}

export async function recordConversionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('recordConversion', async () => {
    const user = await actor();
    if (!can(user.role, 'RECORD_CONVERSION')) throw new AuthorizationError();

    const leadId = String(formData.get('leadId'));
    const parsed = createConversionSchema.safeParse({
      revenue: formData.get('revenue'),
      product: formData.get('product') || undefined,
      notes: formData.get('notes') || undefined,
    });
    if (!parsed.success) return parseFormErrors(parsed.error);

    await recordConversion(user, leadId, parsed.data);
    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id,
      action: 'CONVERSION_RECORDED', entityType: 'Lead', entityId: leadId,
      metadata: { revenue: parsed.data.revenue },
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/reports');
    return { ok: true, message: 'Conversion recorded.' };
  });
}

export async function qualifyLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('qualifyLead', async () => {
    await actor();
    const leadId = String(formData.get('leadId'));
    const result = await qualifyLead(leadId);
    revalidatePath(`/leads/${leadId}`);
    return {
      ok: true,
      message: result.needsHumanHandoff
        ? `Qualification complete — handed off to a human: ${result.handoffReason}`
        : `Qualification complete (${Math.round(result.confidence * 100)}% confidence).`,
    };
  });
}

export async function rescoreLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('rescoreLead', async () => {
    const user = await actor();
    const leadId = String(formData.get('leadId'));
    const { scored } = await rescoreLead(leadId, user);
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message: `Score recalculated: ${scored.score}/100 (${scored.temperature}).` };
  });
}

export async function startSequenceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('startSequence', async () => {
    await actor();
    const leadId = String(formData.get('leadId'));
    const steps = await startFollowUpSequence(leadId);
    revalidatePath(`/leads/${leadId}`);
    return steps
      ? { ok: true, message: `Automated follow-up sequence started (${steps} steps).` }
      : { ok: true, message: 'A follow-up sequence is already running for this lead.' };
  });
}
