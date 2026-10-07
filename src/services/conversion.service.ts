import { prisma } from '@/db/client';
import { NotFoundError } from '@/lib/errors';
import { recordActivitySafe } from '@/services/activity.service';
import { notifyManagers } from '@/services/notification.service';
import { formatINR } from '@/lib/format';
import type { ActorContext } from '@/services/lead.service';

/**
 * Records revenue against a lead and closes it as WON. This is what makes
 * revenue attribution by source, campaign and salesperson possible.
 */
export async function recordConversion(actor: ActorContext, leadId: string, input: {
  revenue: number; product?: string; notes?: string; convertedAt?: Date;
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
  });
  if (!lead) throw new NotFoundError('Lead');

  const conversion = await prisma.conversion.create({
    data: {
      leadId, revenue: input.revenue, product: input.product ?? null,
      notes: input.notes ?? null, convertedAt: input.convertedAt ?? new Date(),
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: 'WON', lastActivityAt: new Date() },
  });
  await prisma.followUp.updateMany({
    where: { leadId, status: 'PENDING' },
    data: { status: 'CANCELLED', notes: 'Cancelled: the lead converted.' },
  });

  await recordActivitySafe({
    leadId, type: 'CONVERSION_RECORDED', actorId: actor.id, actorType: 'USER',
    summary: `Conversion recorded: ${formatINR(input.revenue)}${input.product ? ` — ${input.product}` : ''}.`,
    metadata: { revenue: input.revenue },
  });

  await notifyManagers({
    organizationId: actor.organizationId, type: 'CONVERSION', leadId,
    title: `Conversion: ${lead.name}`,
    body: `${formatINR(input.revenue)} closed by ${actor.name}.`,
  });

  return conversion;
}
