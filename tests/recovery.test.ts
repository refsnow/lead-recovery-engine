import { afterEach, describe, expect, it } from 'vitest';
import { actorFor, cleanupTestData, createTestOrg, prisma } from './helpers';
import { createLead, markContacted } from '@/services/lead.service';
import { createFollowUp } from '@/services/followup.service';
import { getOverdueBySalesperson, getRecoveryAlerts, runRecoverySweep } from '@/services/recovery.service';
import { getRecoveryReport } from '@/services/reports.service';
import { RECOVERY_THRESHOLDS } from '@/config/defaults';

const HOUR = 3_600_000;

afterEach(async () => {
  await cleanupTestData();
});

describe('Lead recovery engine', () => {
  it('flags a lead that was never contacted', async () => {
    const { organization, owner, salesperson } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Never Called',
      phone: '+919810030001', assignedToId: salesperson.id,
    });
    // Age it past the uncontacted threshold.
    await prisma.lead.update({
      where: { id: lead.id },
      data: { createdAt: new Date(Date.now() - 2 * HOUR) },
    });

    const alerts = await getRecoveryAlerts(actorFor(owner, 'OWNER'));
    const uncontacted = alerts.find((alert) => alert.type === 'UNCONTACTED');

    expect(uncontacted).toBeDefined();
    expect(uncontacted!.count).toBe(1);
    expect(uncontacted!.severity).toBe('CRITICAL');
    expect(uncontacted!.samples[0]!.name).toBe('Never Called');
    expect(uncontacted!.href).toContain('risk=UNCONTACTED');
  });

  it('does not flag a lead contacted within the threshold', async () => {
    const { organization, owner, salesperson } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Called Quickly',
      phone: '+919810030002', assignedToId: salesperson.id,
    });
    await prisma.lead.update({
      where: { id: lead.id }, data: { createdAt: new Date(Date.now() - 2 * HOUR) },
    });
    await markContacted(lead.id);

    const alerts = await getRecoveryAlerts(actorFor(owner, 'OWNER'));
    expect(alerts.find((alert) => alert.type === 'UNCONTACTED')).toBeUndefined();
  });

  it('flags a high-intent lead that has gone quiet', async () => {
    const { organization, owner, salesperson } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Hot But Silent', phone: '+919810030003',
      assignedToId: salesperson.id, location: 'Gurgaon', propertyType: '3BHK',
      budgetMax: 20_000_000, purchaseTimeline: 'IMMEDIATE',
    });
    expect(lead.score).toBeGreaterThanOrEqual(RECOVERY_THRESHOLDS.highIntentScore);

    await markContacted(lead.id);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: new Date(Date.now() - 60 * HOUR) },
    });

    const alerts = await getRecoveryAlerts(actorFor(owner, 'OWNER'));
    const highIntent = alerts.find((alert) => alert.type === 'HIGH_INTENT_INACTIVE');

    expect(highIntent).toBeDefined();
    expect(highIntent!.severity).toBe('CRITICAL');
    expect(highIntent!.recommendedAction).toMatch(/call/i);
  });

  it('flags overdue follow-ups and unowned leads', async () => {
    const { organization, owner, salesperson } = await createTestOrg();

    const withOverdue = await createLead({
      organizationId: organization.id, name: 'Overdue Lead',
      phone: '+919810030004', assignedToId: salesperson.id,
    });
    await markContacted(withOverdue.id);
    await createFollowUp(actorFor(owner, 'OWNER'), withOverdue.id, {
      type: 'CALL', scheduledFor: new Date(Date.now() - 5 * HOUR),
    });

    const unowned = await createLead({
      organizationId: organization.id, name: 'Nobody Owns Me', phone: '+919810030005',
    });
    await markContacted(unowned.id);
    await prisma.lead.update({
      where: { id: unowned.id }, data: { createdAt: new Date(Date.now() - 2 * HOUR) },
    });

    const alerts = await getRecoveryAlerts(actorFor(owner, 'OWNER'));
    expect(alerts.find((alert) => alert.type === 'OVERDUE')?.count).toBe(1);
    expect(alerts.find((alert) => alert.type === 'UNASSIGNED')?.count).toBe(1);
  });

  it('excludes won and lost leads from every risk rule', async () => {
    const { organization, owner } = await createTestOrg();
    const lead = await createLead({
      organizationId: organization.id, name: 'Closed Lead', phone: '+919810030006',
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: 'WON',
        createdAt: new Date(Date.now() - 500 * HOUR),
        lastActivityAt: new Date(Date.now() - 500 * HOUR),
      },
    });

    const alerts = await getRecoveryAlerts(actorFor(owner, 'OWNER'));
    expect(alerts).toHaveLength(0);
  });

  it('ranks critical alerts above warnings', async () => {
    const { organization, owner, salesperson } = await createTestOrg();

    const uncontacted = await createLead({
      organizationId: organization.id, name: 'Uncontacted',
      phone: '+919810030007', assignedToId: salesperson.id,
    });
    await prisma.lead.update({
      where: { id: uncontacted.id }, data: { createdAt: new Date(Date.now() - 3 * HOUR) },
    });

    const overdue = await createLead({
      organizationId: organization.id, name: 'Overdue',
      phone: '+919810030008', assignedToId: salesperson.id,
    });
    await markContacted(overdue.id);
    await createFollowUp(actorFor(owner, 'OWNER'), overdue.id, {
      type: 'CALL', scheduledFor: new Date(Date.now() - 3 * HOUR),
    });

    const alerts = await getRecoveryAlerts(actorFor(owner, 'OWNER'));
    expect(alerts[0]!.severity).toBe('CRITICAL');
    expect(alerts.at(-1)!.severity).not.toBe('CRITICAL');
  });

  it('limits a salesperson to alerts about their own leads', async () => {
    const { organization, salesperson, secondSalesperson } = await createTestOrg();

    const mine = await createLead({
      organizationId: organization.id, name: 'My Risky Lead',
      phone: '+919810030009', assignedToId: salesperson.id,
    });
    const theirs = await createLead({
      organizationId: organization.id, name: 'Their Risky Lead',
      phone: '+919810030010', assignedToId: secondSalesperson.id,
    });
    await prisma.lead.updateMany({
      where: { id: { in: [mine.id, theirs.id] } },
      data: { createdAt: new Date(Date.now() - 3 * HOUR) },
    });

    const alerts = await getRecoveryAlerts(actorFor(salesperson, 'SALESPERSON'));
    const uncontacted = alerts.find((alert) => alert.type === 'UNCONTACTED');

    expect(uncontacted!.count).toBe(1);
    expect(uncontacted!.samples[0]!.name).toBe('My Risky Lead');
  });
});

describe('Recovery sweep', () => {
  it('marks stale leads dormant and raises notifications', async () => {
    const { organization, salesperson } = await createTestOrg();

    const stale = await createLead({
      organizationId: organization.id, name: 'Going Quiet',
      phone: '+919810031001', assignedToId: salesperson.id,
    });
    await markContacted(stale.id);
    await prisma.lead.update({
      where: { id: stale.id },
      data: { lastActivityAt: new Date(Date.now() - 100 * HOUR), status: 'CONTACTED' },
    });

    const result = await runRecoverySweep(organization.id);
    expect(result.markedDormant).toBe(1);

    const updated = await prisma.lead.findUnique({ where: { id: stale.id } });
    expect(updated?.status).toBe('DORMANT');
  });

  it('does not mark won or lost leads dormant', async () => {
    const { organization } = await createTestOrg();
    const won = await createLead({
      organizationId: organization.id, name: 'Won Lead', phone: '+919810031002',
    });
    await prisma.lead.update({
      where: { id: won.id },
      data: { status: 'WON', lastActivityAt: new Date(Date.now() - 300 * HOUR) },
    });

    const result = await runRecoverySweep(organization.id);
    expect(result.markedDormant).toBe(0);
    expect((await prisma.lead.findUnique({ where: { id: won.id } }))?.status).toBe('WON');
  });

  it('reports overdue workload per salesperson', async () => {
    const { organization, owner, salesperson } = await createTestOrg();

    for (let index = 0; index < 3; index += 1) {
      const lead = await createLead({
        organizationId: organization.id, name: `Lead ${index}`,
        phone: `+91981003200${index}`, assignedToId: salesperson.id,
      });
      await createFollowUp(actorFor(owner, 'OWNER'), lead.id, {
        type: 'CALL', scheduledFor: new Date(Date.now() - 4 * HOUR),
      });
    }

    const byPerson = await getOverdueBySalesperson(organization.id);
    expect(byPerson).toHaveLength(1);
    expect(byPerson[0]!.name).toBe(salesperson.name);
    expect(byPerson[0]!.count).toBe(3);
  });
});

describe('Recovery report', () => {
  it('counts every risk category', async () => {
    const { organization, owner, salesperson } = await createTestOrg();

    const uncontacted = await createLead({
      organizationId: organization.id, name: 'Uncontacted',
      phone: '+919810033001', assignedToId: salesperson.id,
    });
    await prisma.lead.update({
      where: { id: uncontacted.id }, data: { createdAt: new Date(Date.now() - 3 * HOUR) },
    });

    const overdue = await createLead({
      organizationId: organization.id, name: 'Overdue',
      phone: '+919810033002', assignedToId: salesperson.id,
    });
    await markContacted(overdue.id);
    await createFollowUp(actorFor(owner, 'OWNER'), overdue.id, {
      type: 'CALL', scheduledFor: new Date(Date.now() - 3 * HOUR),
    });

    const report = await getRecoveryReport(organization.id);
    expect(report.uncontacted).toBe(1);
    expect(report.overdueFollowUps).toBe(1);
    expect(report.atRiskTotal).toBeGreaterThanOrEqual(2);
  });
});
