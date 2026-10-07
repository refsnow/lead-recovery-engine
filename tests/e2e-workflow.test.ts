import { afterEach, describe, expect, it } from 'vitest';
import { actorFor, cleanupTestData, createTestOrg, prisma } from './helpers';
import { createLead } from '@/services/lead.service';
import { ingestLead, ingestInboundMessage } from '@/services/ingestion.service';
import { recordInboundMessage } from '@/services/conversation.service';
import { qualifyLead, runQualificationTurn, handOffToHuman } from '@/services/qualification.service';
import { startFollowUpSequence, createFollowUp, completeFollowUp } from '@/services/followup.service';
import { bookAppointment } from '@/services/appointment.service';
import { recordConversion } from '@/services/conversion.service';
import { buildAutomationContext, runAutomations } from '@/services/automation.service';
import { getFunnel, getTodayMetrics } from '@/services/dashboard.service';
import { getRevenueReport, getSalesReport } from '@/services/reports.service';
import { getTeamStats } from '@/services/team.service';
import { DEFAULT_QUALIFICATION_QUESTIONS, DEFAULT_FOLLOW_UP_SEQUENCE } from '@/config/defaults';

afterEach(async () => {
  await cleanupTestData();
});

/** Gives an organization the same configuration the demo seed installs. */
async function configureOrg(organizationId: string) {
  await prisma.qualificationQuestion.createMany({
    data: DEFAULT_QUALIFICATION_QUESTIONS.map((question) => ({ ...question, organizationId })),
  });
  await prisma.followUpStep.createMany({
    data: DEFAULT_FOLLOW_UP_SEQUENCE.map((step) => ({ ...step, organizationId })),
  });
  await prisma.knowledgeEntry.create({
    data: {
      organizationId, category: 'AMENITIES',
      question: 'Is parking available?',
      answer: 'Yes, two covered parking spaces are included with selected units.',
    },
  });
  await prisma.automationRule.create({
    data: {
      organizationId, name: 'Assign and start sequence', trigger: 'LEAD_CREATED',
      conditions: JSON.stringify([{ field: 'assignedToId', operator: 'IS_EMPTY' }]),
      actions: JSON.stringify([{ type: 'ASSIGN_ROUND_ROBIN' }, { type: 'START_FOLLOW_UP_SEQUENCE' }]),
    },
  });
}

describe('End-to-end: lead to revenue', () => {
  it('runs the complete workflow from ingestion to revenue attribution', async () => {
    const { organization, owner } = await createTestOrg('E2E Realty');
    await configureOrg(organization.id);
    const ownerActor = actorFor(owner, 'OWNER');

    // --- 1. INGESTION ------------------------------------------------------
    const lead = await ingestLead(organization.id, {
      externalId: 'meta_e2e_1',
      name: 'Rahul Sharma',
      phone: '+919810050001',
      email: 'rahul.sharma@example.com',
      campaignName: 'Luxury Gurgaon 3BHK',
      adName: 'Luxury Gurgaon 3BHK — Creative 2',
      createdAt: new Date(),
    });

    expect(lead.status).toBe('NEW');
    expect(lead.source).toBe('META_LEAD_ADS');
    expect(lead.campaignId).not.toBeNull();

    // --- 2. AUTOMATION: assignment + sequence ------------------------------
    const assigned = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(assigned!.assignedToId).not.toBeNull();

    const sequenced = await prisma.followUp.count({
      where: { leadId: lead.id, automated: true },
    });
    expect(sequenced).toBe(DEFAULT_FOLLOW_UP_SEQUENCE.length);

    // --- 3. THE LEAD REPLIES ----------------------------------------------
    await recordInboundMessage({
      leadId: lead.id,
      body: 'Looking at Golf Course Road for a 3BHK, budget around 2 cr, planning to buy immediately for our own use.',
    });

    // A reply stops the automated sequence.
    expect(await prisma.followUp.count({
      where: { leadId: lead.id, automated: true, status: 'PENDING' },
    })).toBe(0);

    // --- 4. AI QUALIFICATION ----------------------------------------------
    const qualification = await qualifyLead(lead.id);

    expect(qualification.location).toBe('Golf Course Road');
    expect(qualification.propertyType).toBe('3BHK');
    expect(qualification.budgetMax).toBe(20_000_000);
    expect(qualification.purchaseTimeline).toBe('IMMEDIATE');
    expect(qualification.intent).toBe('END_USE');
    expect(qualification.needsHumanHandoff).toBe(false);

    const qualified = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(qualified!.status).toBe('QUALIFIED');
    expect(qualified!.aiSummary).toBeTruthy();

    // --- 5. SCORING --------------------------------------------------------
    expect(qualified!.score).toBeGreaterThanOrEqual(70);
    expect(qualified!.temperature).toBe('HOT');

    const breakdown = JSON.parse(qualified!.scoreBreakdown ?? '[]') as { matched: boolean; label: string }[];
    expect(breakdown.some((component) => component.matched)).toBe(true);

    // --- 6. HUMAN FOLLOW-UP ------------------------------------------------
    const followUp = await createFollowUp(ownerActor, lead.id, {
      type: 'CALL',
      scheduledFor: new Date(Date.now() + 3_600_000),
      notes: 'Call to confirm the site visit.',
    });
    await completeFollowUp(ownerActor, followUp.id, {
      status: 'COMPLETED', notes: 'Spoke to the customer; visit confirmed.',
    });

    // --- 7. APPOINTMENT ----------------------------------------------------
    const appointment = await bookAppointment(ownerActor, lead.id, {
      scheduledFor: new Date(Date.now() + 2 * 86_400_000),
      location: 'Site office, Sector 65, Gurugram',
    });
    expect(appointment.status).toBe('SCHEDULED');
    expect((await prisma.lead.findUnique({ where: { id: lead.id } }))!.status).toBe('APPOINTMENT');

    // --- 8. CONVERSION -----------------------------------------------------
    const conversion = await recordConversion(ownerActor, lead.id, {
      revenue: 19_500_000,
      product: '3BHK — Golf Course Road',
    });
    expect(conversion.revenue).toBe(19_500_000);

    const won = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(won!.status).toBe('WON');
    expect(await prisma.followUp.count({ where: { leadId: lead.id, status: 'PENDING' } })).toBe(0);

    // --- 9. THE TIMELINE TELLS THE WHOLE STORY -----------------------------
    const activities = await prisma.activity.findMany({ where: { leadId: lead.id } });
    const types = activities.map((activity) => activity.type);

    expect(types).toEqual(expect.arrayContaining([
      'LEAD_CREATED', 'LEAD_REPLIED', 'AI_QUALIFICATION_COMPLETED', 'SCORE_CHANGED',
      'LEAD_ASSIGNED', 'FOLLOW_UP_CREATED', 'FOLLOW_UP_COMPLETED',
      'APPOINTMENT_BOOKED', 'CONVERSION_RECORDED',
    ]));

    // --- 10. IT SHOWS UP IN REPORTING --------------------------------------
    const funnel = await getFunnel(ownerActor);
    const stage = (key: string) => funnel.find((row) => row.key === key)!.count;
    expect(stage('leads')).toBe(1);
    expect(stage('contacted')).toBe(1);
    expect(stage('qualified')).toBe(1);
    expect(stage('appointment')).toBe(1);
    expect(stage('won')).toBe(1);

    const sales = await getSalesReport(organization.id);
    expect(sales.won).toBe(1);
    expect(sales.revenue).toBe(19_500_000);
    expect(sales.conversionRate).toBe(1);

    const revenue = await getRevenueReport(organization.id);
    expect(revenue.total).toBe(19_500_000);
    expect(revenue.bySource[0]!.key).toBe('META_LEAD_ADS');
    expect(revenue.byCampaign[0]!.label).toBe('Luxury Gurgaon 3BHK');
    expect(revenue.bySalesperson[0]!.revenue).toBe(19_500_000);

    const team = await getTeamStats(organization.id);
    const performer = team.find((person) => person.won === 1);
    expect(performer).toBeDefined();
    expect(performer!.revenue).toBe(19_500_000);

    const metrics = await getTodayMetrics(ownerActor);
    expect(metrics.conversions).toBe(1);
    expect(metrics.revenueToday).toBe(19_500_000);
  });

  it('escalates a price-shopping lead to a human instead of answering', async () => {
    const { organization } = await createTestOrg('Handoff Realty');
    await configureOrg(organization.id);

    const lead = await createLead({
      organizationId: organization.id, name: 'Price Shopper', phone: '+919810050002',
    });
    await startFollowUpSequence(lead.id);

    await recordInboundMessage({
      leadId: lead.id,
      body: 'What is the best price you can give me? Any discount available?',
    });

    const result = await qualifyLead(lead.id);
    expect(result.needsHumanHandoff).toBe(true);

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated!.needsHumanHandoff).toBe(true);
    expect(updated!.handoffReason).toBeTruthy();

    // Automated messaging must stop the moment a human is required.
    expect(await prisma.followUp.count({
      where: { leadId: lead.id, automated: true, status: 'PENDING' },
    })).toBe(0);

    const conversations = await prisma.conversation.findMany({ where: { leadId: lead.id } });
    expect(conversations.every((conversation) => conversation.status === 'HANDED_OFF')).toBe(true);

    const activity = await prisma.activity.findFirst({
      where: { leadId: lead.id, type: 'HANDED_OFF_TO_HUMAN' },
    });
    expect(activity).not.toBeNull();
  });

  it('does not send another AI message after a handoff', async () => {
    const { organization } = await createTestOrg('No Reply After Handoff');
    await configureOrg(organization.id);

    const lead = await createLead({
      organizationId: organization.id, name: 'Escalated', phone: '+919810050003',
    });
    await handOffToHuman(lead.id, 'Commercial question raised.');

    const before = await prisma.message.count({ where: { conversation: { leadId: lead.id } } });
    await runQualificationTurn(lead.id);
    const after = await prisma.message.count({ where: { conversation: { leadId: lead.id } } });

    expect(after).toBe(before);
  });

  it('routes an inbound message from an unknown number into a new lead', async () => {
    const { organization } = await createTestOrg('Inbound Realty');
    await configureOrg(organization.id);

    const lead = await ingestInboundMessage(organization.id, {
      from: '919810050004',
      body: 'Hi, I saw your advertisement. Looking for a 3BHK in Gurgaon around 2 cr.',
      senderName: 'Priya Verma',
    });

    expect(lead.source).toBe('WHATSAPP');
    expect(lead.name).toBe('Priya Verma');
    expect(lead.phone).toBe('+919810050004');

    const qualified = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(qualified!.location).toBe('Gurgaon');
    expect(qualified!.propertyType).toBe('3BHK');

    // A second message from the same number must attach to the same lead.
    const again = await ingestInboundMessage(organization.id, {
      from: '+91 98100 50004', body: 'Can we schedule a visit this weekend?',
    });
    expect(again.id).toBe(lead.id);
    expect(await prisma.lead.count({ where: { organizationId: organization.id } })).toBe(1);
  });

  it('degrades to a human handoff when qualification has nothing to work with', async () => {
    const { organization } = await createTestOrg('Empty Transcript Realty');
    await configureOrg(organization.id);

    const lead = await createLead({
      organizationId: organization.id, name: 'Silent Lead', phone: '+919810050005',
    });

    const result = await qualifyLead(lead.id);
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.needsHumanHandoff).toBe(true);
    // Nothing may be invented from an empty conversation.
    expect(result.location).toBeNull();
    expect(result.budgetMax).toBeNull();
  });

  it('fires NO_RESPONSE_24H automations for a lead that went quiet', async () => {
    const { organization, salesperson } = await createTestOrg('Quiet Realty');

    await prisma.automationRule.create({
      data: {
        organizationId: organization.id, name: 'Nudge after 24h', trigger: 'NO_RESPONSE_24H',
        conditions: JSON.stringify([]),
        actions: JSON.stringify([{ type: 'SEND_NOTIFICATION' }]),
      },
    });

    const lead = await createLead({
      organizationId: organization.id, name: 'Quiet Lead',
      phone: '+919810050006', assignedToId: salesperson.id,
    });

    const ctx = await buildAutomationContext(lead.id);
    const executed = await runAutomations('NO_RESPONSE_24H', ctx!);

    expect(executed).toContain('Nudge after 24h');
    expect(await prisma.notification.count({ where: { leadId: lead.id } })).toBeGreaterThan(0);
  });
});
