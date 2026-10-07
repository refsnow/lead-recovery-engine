import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { recordActivitySafe } from '@/services/activity.service';
import { notifyManagers } from '@/services/notification.service';
import type { ActorContext } from '@/services/lead.service';
import type { AppointmentStatus } from '@/types/domain';

export async function bookAppointment(actor: ActorContext, leadId: string, input: {
  scheduledFor: Date; salespersonId?: string | null; location?: string; notes?: string;
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
  });
  if (!lead) throw new NotFoundError('Lead');
  if (input.scheduledFor.getTime() < Date.now() - 60_000) {
    throw new ValidationError('An appointment cannot be scheduled in the past.');
  }

  const salespersonId = input.salespersonId ?? lead.assignedToId ?? actor.id;
  const belongs = await prisma.user.count({
    where: { id: salespersonId, organizationId: actor.organizationId },
  });
  if (!belongs) throw new ValidationError('The selected salesperson is not part of this organization.');

  const appointment = await prisma.appointment.create({
    data: {
      leadId, salespersonId, scheduledFor: input.scheduledFor,
      location: input.location ?? null, notes: input.notes ?? null,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: 'APPOINTMENT', lastActivityAt: new Date() },
  });

  // Booking an appointment ends automated messaging.
  await prisma.followUp.updateMany({
    where: { leadId, status: 'PENDING', automated: true },
    data: { status: 'CANCELLED', notes: 'Cancelled: an appointment was booked.' },
  });

  await recordActivitySafe({
    leadId, type: 'APPOINTMENT_BOOKED', actorId: actor.id, actorType: 'USER',
    summary: `Site visit booked for ${input.scheduledFor.toLocaleString('en-IN')}.`,
  });

  await notifyManagers({
    organizationId: actor.organizationId, type: 'APPOINTMENT_BOOKED', leadId,
    title: `Appointment booked: ${lead.name}`,
    body: `${input.scheduledFor.toLocaleString('en-IN')}${input.location ? ` at ${input.location}` : ''}.`,
  });

  return appointment;
}

export async function updateAppointmentStatus(actor: ActorContext, appointmentId: string, input: {
  status: AppointmentStatus; notes?: string;
}) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, lead: { organizationId: actor.organizationId } },
    include: { lead: { select: { id: true, status: true } } },
  });
  if (!appointment) throw new NotFoundError('Appointment');

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: input.status, notes: input.notes ?? appointment.notes },
  });

  await recordActivitySafe({
    leadId: appointment.leadId, type: 'STATUS_CHANGED', actorId: actor.id, actorType: 'USER',
    summary: `Appointment marked ${input.status.toLowerCase().replace('_', ' ')}.`,
  });

  // A no-show or cancellation returns the lead to active follow-up, not limbo.
  if (['NO_SHOW', 'CANCELLED'].includes(input.status) && appointment.lead.status === 'APPOINTMENT') {
    await prisma.lead.update({
      where: { id: appointment.leadId },
      data: { status: 'FOLLOW_UP', lastActivityAt: new Date() },
    });
  }

  return updated;
}

export async function listAppointments(organizationId: string, options: {
  salespersonId?: string; from?: Date; to?: Date; status?: AppointmentStatus;
} = {}) {
  return prisma.appointment.findMany({
    where: {
      lead: { organizationId },
      ...(options.salespersonId ? { salespersonId: options.salespersonId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.from || options.to ? { scheduledFor: { gte: options.from, lte: options.to } } : {}),
    },
    include: {
      lead: { select: { id: true, name: true, phone: true, score: true, temperature: true } },
      salesperson: { select: { id: true, name: true } },
    },
    orderBy: { scheduledFor: 'asc' },
  });
}
