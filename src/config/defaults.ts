import type { ScoringRule } from '@/types/domain';

/**
 * Default scoring rules for an Indian real-estate organization.
 * These are seeded per-organization and then editable in Settings → Scoring;
 * nothing here is referenced directly by UI components.
 */
export const DEFAULT_SCORING_RULES: ScoringRule[] = [
  { id: 'budget_stated', label: 'Budget stated', points: 10, field: 'budgetMax', operator: 'NOT_EMPTY' },
  { id: 'budget_qualified', label: 'Budget ≥ ₹1 Cr', points: 10, field: 'budgetMax', operator: 'GTE', value: 10_000_000 },
  { id: 'location_match', label: 'Target location', points: 15, field: 'location', operator: 'IN',
    value: ['Gurgaon', 'Gurugram', 'Golf Course Road', 'Dwarka Expressway', 'Sohna Road', 'New Gurgaon'] },
  { id: 'property_match', label: 'Relevant property type', points: 15, field: 'propertyType', operator: 'IN',
    value: ['3BHK', '4BHK', 'VILLA', 'PENTHOUSE'] },
  { id: 'timeline_immediate', label: 'Immediate purchase timeline', points: 20, field: 'purchaseTimeline', operator: 'EQUALS', value: 'IMMEDIATE' },
  { id: 'timeline_near', label: 'Purchase within 1–3 months', points: 12, field: 'purchaseTimeline', operator: 'EQUALS', value: '1_3_MONTHS' },
  { id: 'engaged', label: 'Engaged with messages', points: 10, field: 'signals.replied', operator: 'IS_TRUE' },
  { id: 'asked_pricing', label: 'Asked about pricing', points: 10, field: 'signals.askedPricing', operator: 'IS_TRUE' },
  { id: 'appointment_intent', label: 'Requested a site visit', points: 20, field: 'signals.requestedAppointment', operator: 'IS_TRUE' },
  { id: 'investment_intent', label: 'Investment intent', points: 5, field: 'intent', operator: 'EQUALS', value: 'INVESTMENT' },
];

export const DEFAULT_HOT_THRESHOLD = 70;
export const DEFAULT_WARM_THRESHOLD = 40;

export const DEFAULT_QUALIFICATION_QUESTIONS = [
  { key: 'intent', prompt: 'Are you looking at this property for investment or for your own use?', order: 0 },
  { key: 'location', prompt: 'Which location or locality are you considering?', order: 1 },
  { key: 'propertyType', prompt: 'What type of property are you looking for — 2BHK, 3BHK, villa or plot?', order: 2 },
  { key: 'budget', prompt: 'What is your approximate budget range?', order: 3 },
  { key: 'timeline', prompt: 'When are you planning to make the purchase?', order: 4 },
];

/** The default automated follow-up cadence: T+0, +1h, +24h, +3d, +7d. */
export const DEFAULT_FOLLOW_UP_SEQUENCE = [
  {
    name: 'Instant response', delayMinutes: 0, order: 0, channel: 'WHATSAPP',
    messageTemplate: 'Hi {{name}}, thank you for your enquiry with {{organization}}. I am an automated assistant here to understand your requirement. Could you tell me which location you are considering?',
  },
  {
    name: '1 hour follow-up', delayMinutes: 60, order: 1, channel: 'WHATSAPP',
    messageTemplate: 'Hi {{name}}, just checking in on your property enquiry. Could you share the configuration and budget you have in mind so we can shortlist the right options?',
  },
  {
    name: '24 hour follow-up', delayMinutes: 1440, order: 2, channel: 'WHATSAPP',
    messageTemplate: 'Hello {{name}}, our consultant can walk you through the available options whenever convenient. Would you like a call today or tomorrow?',
  },
  {
    name: '3 day follow-up', delayMinutes: 4320, order: 3, channel: 'WHATSAPP',
    messageTemplate: 'Hi {{name}}, checking in once more regarding your enquiry with {{organization}}. Would you still like details on the options we discussed?',
  },
  {
    name: '7 day re-engagement', delayMinutes: 10_080, order: 4, channel: 'WHATSAPP',
    messageTemplate: 'Hi {{name}}, we are closing enquiries from last week. If you are still exploring, reply here and a consultant will assist you. Otherwise we will not follow up further.',
  },
];

/** Thresholds that define "at risk" for the lead recovery engine. */
export const RECOVERY_THRESHOLDS = {
  /** A new lead not contacted within this many minutes is UNCONTACTED. */
  uncontactedMinutes: 30,
  /** No activity for this many hours makes a lead DORMANT. */
  dormantHours: 72,
  /** A lead scoring at or above this with no recent activity is HIGH_INTENT_INACTIVE. */
  highIntentScore: 70,
  highIntentInactiveHours: 48,
  /** An unassigned lead older than this many minutes is flagged. */
  unassignedMinutes: 15,
} as const;

export interface IndustryPreset {
  name: string;
  scoringRules: ScoringRule[];
  qualificationQuestions: { key: string; prompt: string; order: number }[];
  followUpSequence: { name: string; delayMinutes: number; order: number; channel: string; messageTemplate: string }[];
}

export const INDUSTRY_PRESETS: Record<string, IndustryPreset> = {
  REAL_ESTATE: {
    name: 'Real Estate',
    scoringRules: DEFAULT_SCORING_RULES,
    qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
    followUpSequence: DEFAULT_FOLLOW_UP_SEQUENCE,
  },
  WEALTH_MANAGEMENT: {
    name: 'Wealth Management & Advisory',
    scoringRules: [
      { id: 'wm_surplus_stated', label: 'Investable surplus stated', points: 10, field: 'budgetMax', operator: 'NOT_EMPTY' },
      { id: 'wm_hni', label: 'Investable surplus ≥ ₹1 Cr', points: 20, field: 'budgetMax', operator: 'GTE', value: 10_000_000 },
      { id: 'wm_uhni', label: 'Investable surplus ≥ ₹5 Cr', points: 10, field: 'budgetMax', operator: 'GTE', value: 50_000_000 },
      { id: 'wm_offering_pms', label: 'Interested in PMS or AIF', points: 15, field: 'offeringType', operator: 'IN', value: ['PMS', 'AIF', 'PORTFOLIO_MANAGEMENT', 'PRIVATE_EQUITY'] },
      { id: 'wm_timeline_immediate', label: 'Allocation timeline immediate', points: 20, field: 'purchaseTimeline', operator: 'EQUALS', value: 'IMMEDIATE' },
      { id: 'wm_engaged', label: 'Engaged with advisor messages', points: 10, field: 'signals.replied', operator: 'IS_TRUE' },
      { id: 'wm_fee_inquiry', label: 'Asked about advisory fees / AUM charges', points: 10, field: 'signals.askedPricing', operator: 'IS_TRUE' },
      { id: 'wm_meeting_booked', label: 'Requested portfolio review call', points: 20, field: 'signals.requestedAppointment', operator: 'IS_TRUE' },
    ],
    qualificationQuestions: [
      { key: 'intent', prompt: 'What is your primary investment goal — wealth preservation, long-term capital appreciation, or tax optimization?', order: 0 },
      { key: 'budget', prompt: 'What is the approximate investable portfolio size you are looking to allocate (e.g. ₹50L, ₹1–5 Cr, ₹5 Cr+)?', order: 1 },
      { key: 'offeringType', prompt: 'Are you exploring Portfolio Management Services (PMS), AIFs, or customized equity/mutual fund advisory?', order: 2 },
      { key: 'location', prompt: 'Which city or region are you based out of?', order: 3 },
      { key: 'timeline', prompt: 'When are you planning to begin deployment or restructuring your portfolio?', order: 4 },
    ],
    followUpSequence: [
      {
        name: 'Instant advisory intro', delayMinutes: 0, order: 0, channel: 'WHATSAPP',
        messageTemplate: 'Hi {{name}}, thank you for requesting the Wealth Advisory Overview from {{organization}}. I am an automated assistant here to understand your allocation goals. What is your primary investment focus right now?',
      },
      {
        name: '1 hour check-in', delayMinutes: 60, order: 1, channel: 'WHATSAPP',
        messageTemplate: 'Hi {{name}}, just following up on your portfolio inquiry. Would you like a confidential overview of our current PMS & AIF model portfolios?',
      },
      {
        name: '24 hour advisory consultation', delayMinutes: 1440, order: 2, channel: 'WHATSAPP',
        messageTemplate: 'Hello {{name}}, our senior wealth director can host a 15-minute introductory portfolio review whenever convenient for you. Would tomorrow or Friday work better?',
      },
      {
        name: '3 day check-in', delayMinutes: 4320, order: 3, channel: 'WHATSAPP',
        messageTemplate: 'Hi {{name}}, sharing our latest quarterly market and asset-allocation strategy note. Please let me know if you would like to connect with our advisory team.',
      },
      {
        name: '7 day closing', delayMinutes: 10_080, order: 4, channel: 'WHATSAPP',
        messageTemplate: 'Hi {{name}}, we are concluding initial follow-ups for this week. Feel free to message here whenever you are ready to review your investment strategy.',
      },
    ],
  },
  FINANCIAL_SERVICES: {
    name: 'Financial & Lending Services',
    scoringRules: [
      { id: 'fs_amount_stated', label: 'Loan / capital amount stated', points: 10, field: 'budgetMax', operator: 'NOT_EMPTY' },
      { id: 'fs_large_ticket', label: 'Ticket size ≥ ₹50 Lakhs', points: 20, field: 'budgetMax', operator: 'GTE', value: 5_000_000 },
      { id: 'fs_timeline_immediate', label: 'Urgent capital requirement', points: 25, field: 'purchaseTimeline', operator: 'EQUALS', value: 'IMMEDIATE' },
      { id: 'fs_engaged', label: 'Active communication', points: 10, field: 'signals.replied', operator: 'IS_TRUE' },
      { id: 'fs_rate_inquiry', label: 'Inquired on interest rates / terms', points: 10, field: 'signals.askedPricing', operator: 'IS_TRUE' },
      { id: 'fs_call_requested', label: 'Requested loan officer call', points: 20, field: 'signals.requestedAppointment', operator: 'IS_TRUE' },
    ],
    qualificationQuestions: [
      { key: 'intent', prompt: 'Are you seeking financing for business expansion, working capital, or asset acquisition?', order: 0 },
      { key: 'budget', prompt: 'What is the required funding or loan amount you have in mind?', order: 1 },
      { key: 'offeringType', prompt: 'What type of facility are you looking for — secured loan, term loan, or working capital line?', order: 2 },
      { key: 'timeline', prompt: 'How soon do you require sanction and disbursement?', order: 3 },
    ],
    followUpSequence: [
      {
        name: 'Instant response', delayMinutes: 0, order: 0, channel: 'WHATSAPP',
        messageTemplate: 'Hi {{name}}, thank you for your financing inquiry with {{organization}}. Could you share the approximate capital amount you are looking to secure?',
      },
      {
        name: '24 hour check-in', delayMinutes: 1440, order: 1, channel: 'WHATSAPP',
        messageTemplate: 'Hello {{name}}, our senior credit specialist can discuss pre-qualification and eligible loan brackets. Would you be free for a 5-minute call today?',
      },
    ],
  },
  B2B_SAAS: {
    name: 'B2B Software & Technology',
    scoringRules: [
      { id: 'b2b_budget_stated', label: 'Annual budget stated', points: 15, field: 'budgetMax', operator: 'NOT_EMPTY' },
      { id: 'b2b_enterprise_tier', label: 'Budget ≥ ₹20 Lakhs / $25k', points: 20, field: 'budgetMax', operator: 'GTE', value: 2_000_000 },
      { id: 'b2b_immediate', label: 'Immediate purchase timeline', points: 20, field: 'purchaseTimeline', operator: 'EQUALS', value: 'IMMEDIATE' },
      { id: 'b2b_engaged', label: 'Replied to messages', points: 10, field: 'signals.replied', operator: 'IS_TRUE' },
      { id: 'b2b_pricing', label: 'Inquired about pricing/licensing', points: 10, field: 'signals.askedPricing', operator: 'IS_TRUE' },
      { id: 'b2b_demo_booked', label: 'Requested product demo', points: 25, field: 'signals.requestedAppointment', operator: 'IS_TRUE' },
    ],
    qualificationQuestions: [
      { key: 'intent', prompt: 'What is the main challenge your team is looking to solve with our platform?', order: 0 },
      { key: 'offeringType', prompt: 'Which edition or tier are you evaluating — Team, Professional, or Enterprise?', order: 1 },
      { key: 'budget', prompt: 'What is your planned annual budget for this initiative?', order: 2 },
      { key: 'timeline', prompt: 'When are you targeting to complete evaluation and deploy?', order: 3 },
    ],
    followUpSequence: [
      {
        name: 'Instant response', delayMinutes: 0, order: 0, channel: 'WHATSAPP',
        messageTemplate: 'Hi {{name}}, thanks for your interest in {{organization}}! What specific platform capabilities is your team most interested in seeing?',
      },
      {
        name: '24 hour demo invite', delayMinutes: 1440, order: 1, channel: 'WHATSAPP',
        messageTemplate: 'Hi {{name}}, our solutions engineer can walk your team through a tailored 20-minute product tour. What time works best for you this week?',
      },
    ],
  },
};
