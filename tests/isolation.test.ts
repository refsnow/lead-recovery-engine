import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actorFor, cleanupTestData, createTestOrg, prisma } from './helpers';
import { createLead, getLeadDetail, listLeads, updateLead, assignLead } from '@/services/lead.service';
import { createFollowUp, completeFollowUp } from '@/services/followup.service';
import { bookAppointment } from '@/services/appointment.service';
import { recordConversion } from '@/services/conversion.service';
import { getTodayMetrics } from '@/services/dashboard.service';
import { leadFilterSchema } from '@/lib/validation';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * Multi-tenancy is the security boundary that matters most: a user must never
 * be able to read or mutate another organization's data, whatever id they send.
 */
describe('Organization isolation', () => {
  let orgA: Awaited<ReturnType<typeof createTestOrg>>;
  let orgB: Awaited<ReturnType<typeof createTestOrg>>;
  let leadA: { id: string };
  let leadB: { id: string };

  beforeAll(async () => {
    orgA = await createTestOrg('Alpha Realty');
    orgB = await createTestOrg('Beta Realty');

    leadA = await createLead({
      organizationId: orgA.organization.id, name: 'Alpha Lead', phone: '+919810000011',
      assignedToId: orgA.salesperson.id,
    });
    leadB = await createLead({
      organizationId: orgB.organization.id, name: 'Beta Lead', phone: '+919810000012',
      assignedToId: orgB.salesperson.id,
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('does not return another organization\'s leads in a listing', async () => {
    const result = await listLeads(
      actorFor(orgA.owner, 'OWNER'),
      leadFilterSchema.parse({ pageSize: 100 }),
    );
    const ids = result.items.map((lead) => lead.id);
    expect(ids).toContain(leadA.id);
    expect(ids).not.toContain(leadB.id);
  });

  it('reports a cross-organization lead as not found, not forbidden', async () => {
    // Returning 404 rather than 403 avoids confirming that the record exists.
    await expect(getLeadDetail(actorFor(orgA.owner, 'OWNER'), leadB.id))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to update a lead in another organization', async () => {
    await expect(updateLead(actorFor(orgA.owner, 'OWNER'), leadB.id, { status: 'WON' }))
      .rejects.toBeInstanceOf(NotFoundError);

    const untouched = await prisma.lead.findUnique({ where: { id: leadB.id } });
    expect(untouched?.status).toBe('NEW');
  });

  it('refuses to assign a lead to a user from another organization', async () => {
    await expect(assignLead(actorFor(orgA.owner, 'OWNER'), leadA.id, orgB.salesperson.id))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses to create a follow-up on another organization\'s lead', async () => {
    await expect(createFollowUp(actorFor(orgA.owner, 'OWNER'), leadB.id, {
      type: 'CALL', scheduledFor: new Date(Date.now() + 3_600_000),
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to complete another organization\'s follow-up', async () => {
    const followUp = await createFollowUp(actorFor(orgB.owner, 'OWNER'), leadB.id, {
      type: 'CALL', scheduledFor: new Date(Date.now() + 3_600_000),
    });

    await expect(completeFollowUp(actorFor(orgA.owner, 'OWNER'), followUp.id, { status: 'COMPLETED' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to book an appointment or record revenue across organizations', async () => {
    await expect(bookAppointment(actorFor(orgA.owner, 'OWNER'), leadB.id, {
      scheduledFor: new Date(Date.now() + 86_400_000),
    })).rejects.toBeInstanceOf(NotFoundError);

    await expect(recordConversion(actorFor(orgA.owner, 'OWNER'), leadB.id, { revenue: 1_000_000 }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('scopes dashboard metrics to the caller\'s organization', async () => {
    const metricsA = await getTodayMetrics(actorFor(orgA.owner, 'OWNER'));
    const metricsB = await getTodayMetrics(actorFor(orgB.owner, 'OWNER'));
    expect(metricsA.newLeads).toBe(1);
    expect(metricsB.newLeads).toBe(1);
  });
});

/**
 * Within an organization, a salesperson sees only their own leads.
 */
describe('Salesperson row-level visibility', () => {
  let org: Awaited<ReturnType<typeof createTestOrg>>;
  let ownLead: { id: string };
  let otherLead: { id: string };

  beforeAll(async () => {
    org = await createTestOrg('Row Level Realty');
    ownLead = await createLead({
      organizationId: org.organization.id, name: 'Mine', phone: '+919810000021',
      assignedToId: org.salesperson.id,
    });
    otherLead = await createLead({
      organizationId: org.organization.id, name: 'Not mine', phone: '+919810000022',
      assignedToId: org.secondSalesperson.id,
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('lists only leads assigned to the salesperson', async () => {
    const result = await listLeads(
      actorFor(org.salesperson, 'SALESPERSON'),
      leadFilterSchema.parse({ pageSize: 100 }),
    );
    const ids = result.items.map((lead) => lead.id);
    expect(ids).toContain(ownLead.id);
    expect(ids).not.toContain(otherLead.id);
  });

  it('hides a colleague\'s lead detail from a salesperson', async () => {
    await expect(getLeadDetail(actorFor(org.salesperson, 'SALESPERSON'), otherLead.id))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('allows a manager to see every lead in the organization', async () => {
    const result = await listLeads(
      actorFor(org.owner, 'OWNER'),
      leadFilterSchema.parse({ pageSize: 100 }),
    );
    const ids = result.items.map((lead) => lead.id);
    expect(ids).toEqual(expect.arrayContaining([ownLead.id, otherLead.id]));
  });
});
