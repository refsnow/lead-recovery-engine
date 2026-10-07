import { afterEach, describe, expect, it } from 'vitest';
import { cleanupTestData, createTestOrg, prisma } from './helpers';
import { createLead } from '@/services/lead.service';
import { buildAutomationContext, evaluateCondition, runAutomations } from '@/services/automation.service';

afterEach(async () => {
  await cleanupTestData();
});

describe('Condition evaluation', () => {
  const lead = { score: 85, status: 'NEW', assignedToId: null, location: 'Gurgaon', budgetMax: 20_000_000 };

  it('evaluates every operator', () => {
    expect(evaluateCondition(lead, { field: 'score', operator: 'GT', value: 70 })).toBe(true);
    expect(evaluateCondition(lead, { field: 'score', operator: 'GT', value: 90 })).toBe(false);
    expect(evaluateCondition(lead, { field: 'score', operator: 'GTE', value: 85 })).toBe(true);
    expect(evaluateCondition(lead, { field: 'score', operator: 'LT', value: 90 })).toBe(true);
    expect(evaluateCondition(lead, { field: 'score', operator: 'LTE', value: 85 })).toBe(true);
    expect(evaluateCondition(lead, { field: 'status', operator: 'EQUALS', value: 'NEW' })).toBe(true);
    expect(evaluateCondition(lead, { field: 'status', operator: 'IN', value: ['NEW', 'CONTACTED'] })).toBe(true);
    expect(evaluateCondition(lead, { field: 'assignedToId', operator: 'IS_EMPTY' })).toBe(true);
    expect(evaluateCondition(lead, { field: 'location', operator: 'NOT_EMPTY' })).toBe(true);
    expect(evaluateCondition(lead, { field: 'missing', operator: 'NOT_EMPTY' })).toBe(false);
  });
});

describe('Automation execution', () => {
  it('assigns an unowned lead round-robin and starts the sequence', async () => {
    const { organization, salesperson, secondSalesperson } = await createTestOrg();

    await prisma.automationRule.create({
      data: {
        organizationId: organization.id, name: 'Assign and sequence', trigger: 'LEAD_CREATED',
        conditions: JSON.stringify([{ field: 'assignedToId', operator: 'IS_EMPTY' }]),
        actions: JSON.stringify([{ type: 'ASSIGN_ROUND_ROBIN' }, { type: 'START_FOLLOW_UP_SEQUENCE' }]),
      },
    });

    const lead = await createLead({
      organizationId: organization.id, name: 'Auto Assigned', phone: '+919810040001',
    });

    const ctx = await buildAutomationContext(lead.id);
    const executed = await runAutomations('LEAD_CREATED', ctx!);
    expect(executed).toContain('Assign and sequence');

    // Either salesperson is valid when both have an empty queue; what matters
    // is that the lead ends up owned by someone.
    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect([salesperson.id, secondSalesperson.id]).toContain(updated!.assignedToId);

    const followUps = await prisma.followUp.count({ where: { leadId: lead.id, automated: true } });
    expect(followUps).toBeGreaterThan(0);
  });

  it('skips a rule whose conditions do not match', async () => {
    const { organization } = await createTestOrg();

    await prisma.automationRule.create({
      data: {
        organizationId: organization.id, name: 'High score only', trigger: 'LEAD_CREATED',
        conditions: JSON.stringify([{ field: 'score', operator: 'GT', value: 70 }]),
        actions: JSON.stringify([{ type: 'START_FOLLOW_UP_SEQUENCE' }]),
      },
    });

    const lead = await createLead({
      organizationId: organization.id, name: 'Low Score', phone: '+919810040002',
    });

    const ctx = await buildAutomationContext(lead.id);
    const executed = await runAutomations('LEAD_CREATED', ctx!);

    expect(executed).toHaveLength(0);
    expect(await prisma.followUp.count({ where: { leadId: lead.id } })).toBe(0);
  });

  it('never reassigns a lead that already has an owner', async () => {
    const { organization, salesperson, secondSalesperson } = await createTestOrg();

    await prisma.automationRule.create({
      data: {
        organizationId: organization.id, name: 'Round robin', trigger: 'LEAD_CREATED',
        conditions: JSON.stringify([]),
        actions: JSON.stringify([{ type: 'ASSIGN_ROUND_ROBIN' }]),
      },
    });

    const lead = await createLead({
      organizationId: organization.id, name: 'Already Owned',
      phone: '+919810040003', assignedToId: secondSalesperson.id,
    });

    const ctx = await buildAutomationContext(lead.id);
    await runAutomations('LEAD_CREATED', ctx!);

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated!.assignedToId).toBe(secondSalesperson.id);
    expect(updated!.assignedToId).not.toBe(salesperson.id);
  });

  it('ignores paused rules', async () => {
    const { organization } = await createTestOrg();

    await prisma.automationRule.create({
      data: {
        organizationId: organization.id, name: 'Paused rule', trigger: 'LEAD_CREATED',
        isActive: false,
        conditions: JSON.stringify([]),
        actions: JSON.stringify([{ type: 'START_FOLLOW_UP_SEQUENCE' }]),
      },
    });

    const lead = await createLead({
      organizationId: organization.id, name: 'No Automation', phone: '+919810040004',
    });

    const ctx = await buildAutomationContext(lead.id);
    expect(await runAutomations('LEAD_CREATED', ctx!)).toHaveLength(0);
  });

  it('continues after a failing action and still records the run', async () => {
    const { organization } = await createTestOrg();

    await prisma.automationRule.create({
      data: {
        organizationId: organization.id, name: 'Mixed actions', trigger: 'LEAD_CREATED',
        conditions: JSON.stringify([]),
        // SET_STATUS with no status is a no-op; the notification must still fire.
        actions: JSON.stringify([{ type: 'SET_STATUS' }, { type: 'SEND_NOTIFICATION' }]),
      },
    });

    const lead = await createLead({
      organizationId: organization.id, name: 'Resilient', phone: '+919810040005',
    });

    const ctx = await buildAutomationContext(lead.id);
    const executed = await runAutomations('LEAD_CREATED', ctx!);
    expect(executed).toContain('Mixed actions');

    const rule = await prisma.automationRule.findFirst({ where: { organizationId: organization.id } });
    expect(rule!.runCount).toBe(1);
    expect(rule!.lastRunAt).not.toBeNull();
  });

  it('only runs rules belonging to the lead\'s own organization', async () => {
    const orgA = await createTestOrg('Auto A');
    const orgB = await createTestOrg('Auto B');

    await prisma.automationRule.create({
      data: {
        organizationId: orgB.organization.id, name: 'Org B rule', trigger: 'LEAD_CREATED',
        conditions: JSON.stringify([]),
        actions: JSON.stringify([{ type: 'START_FOLLOW_UP_SEQUENCE' }]),
      },
    });

    const lead = await createLead({
      organizationId: orgA.organization.id, name: 'Org A Lead', phone: '+919810040006',
    });

    const ctx = await buildAutomationContext(lead.id);
    expect(await runAutomations('LEAD_CREATED', ctx!)).toHaveLength(0);
    expect(await prisma.followUp.count({ where: { leadId: lead.id } })).toBe(0);
  });
});
