/**
 * Domain vocabulary. The database stores these as strings (for SQLite/Postgres
 * portability); these unions + the zod schemas in src/lib/validation.ts are the
 * enforcement layer.
 */

export const LEAD_STATUSES = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'APPOINTMENT', 'WON', 'LOST', 'DORMANT',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TEMPERATURES = ['HOT', 'WARM', 'COLD'] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const LEAD_SOURCES = [
  'META_LEAD_ADS', 'GOOGLE_ADS', 'WEBSITE', 'WHATSAPP', 'REFERRAL', 'WALK_IN',
  'ORGANIC', 'PORTAL', 'MANUAL', 'OTHER',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/**
 * How a source was acquired. Derived from the source, never entered by hand —
 * it is what lets reporting group paid against organic without hard-coding a
 * list of channel names at every call site.
 */
export const SOURCE_TYPES = [
  'PAID_SOCIAL', 'PAID_SEARCH', 'ORGANIC', 'DIRECT', 'REFERRAL', 'OFFLINE', 'MESSAGING', 'UNKNOWN',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Detailed acquisition record. Everything except the `lastTouch*` fields
 * describes the FIRST touch and is written once, at lead creation.
 */
export interface LeadAttributionInput {
  sourceType?: SourceType;
  campaignExternalId?: string | null;
  campaignName?: string | null;
  adSetId?: string | null;
  adSetName?: string | null;
  adId?: string | null;
  adName?: string | null;
  formId?: string | null;
  formName?: string | null;
  landingPage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  firstTouchAt?: Date;
}

/** One step in the lead's acquisition-to-outcome journey. */
export interface JourneyStep {
  key: string;
  label: string;
  detail?: string;
  at: Date | null;
  reached: boolean;
}

export const INDUSTRIES = [
  'REAL_ESTATE', 'WEALTH_MANAGEMENT', 'FINANCIAL_SERVICES', 'B2B_SAAS', 'HEALTHCARE', 'CONSULTING', 'GENERAL',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const USER_ROLES = ['OWNER', 'ADMIN', 'SALES_MANAGER', 'SALESPERSON'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CHANNELS = ['WHATSAPP', 'SMS', 'EMAIL', 'CALL', 'IN_APP'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CONVERSATION_STATUSES = ['ACTIVE', 'AWAITING_REPLY', 'HANDED_OFF', 'CLOSED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_SENDERS = ['LEAD', 'AI', 'SALESPERSON', 'SYSTEM'] as const;
export type MessageSender = (typeof MESSAGE_SENDERS)[number];

export const MESSAGE_TYPES = ['TEXT', 'TEMPLATE', 'NOTE', 'SYSTEM'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const DELIVERY_STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const FOLLOW_UP_TYPES = ['CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'AUTOMATED'] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const FOLLOW_UP_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED', 'SKIPPED'] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const APPOINTMENT_STATUSES = ['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PURCHASE_TIMELINES = [
  'IMMEDIATE', '1_3_MONTHS', '3_6_MONTHS', '6_12_MONTHS', 'EXPLORING',
] as const;
export type PurchaseTimeline = (typeof PURCHASE_TIMELINES)[number];

export const INTENTS = ['INVESTMENT', 'END_USE', 'UNKNOWN'] as const;
export type Intent = (typeof INTENTS)[number];

export const ACTIVITY_TYPES = [
  'LEAD_CREATED', 'MESSAGE_SENT', 'LEAD_REPLIED', 'AI_QUALIFICATION_COMPLETED',
  'SCORE_CHANGED', 'LEAD_ASSIGNED', 'FOLLOW_UP_CREATED', 'FOLLOW_UP_COMPLETED',
  'APPOINTMENT_BOOKED', 'STATUS_CHANGED', 'LEAD_LOST', 'CONVERSION_RECORDED',
  'NOTE_ADDED', 'HANDED_OFF_TO_HUMAN', 'LEAD_RECOVERED',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'NEW_HOT_LEAD', 'UNASSIGNED_LEAD', 'OVERDUE_FOLLOW_UP', 'HIGH_INTENT_INACTIVE',
  'APPOINTMENT_BOOKED', 'LEAD_RECOVERED', 'CONVERSION', 'UNCONTACTED_LEAD',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const RISK_TYPES = [
  'UNCONTACTED', 'OVERDUE', 'DORMANT', 'HIGH_INTENT_INACTIVE', 'UNASSIGNED',
] as const;
export type RiskType = (typeof RISK_TYPES)[number];

export const AUTOMATION_TRIGGERS = [
  'LEAD_CREATED', 'LEAD_REPLIED', 'NO_RESPONSE_24H', 'FOLLOW_UP_OVERDUE', 'SCORE_CHANGED',
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_ACTIONS = [
  'ASSIGN_TO_SENIOR', 'ASSIGN_ROUND_ROBIN', 'SEND_NOTIFICATION', 'START_FOLLOW_UP_SEQUENCE',
  'SEND_FOLLOW_UP', 'NOTIFY_SALES_MANAGER', 'SET_STATUS',
] as const;
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

// --- Structured (JSON-serialized) payloads ---------------------------------

export interface ScoreComponent {
  ruleId: string;
  label: string;
  points: number;
  matched: boolean;
}

export interface ScoreResult {
  score: number;
  temperature: LeadTemperature;
  components: ScoreComponent[];
}

export interface ScoringRule {
  id: string;
  label: string;
  points: number;
  field: string;
  operator: 'EQUALS' | 'IN' | 'GTE' | 'LTE' | 'IS_TRUE' | 'NOT_EMPTY';
  value?: string | number | string[];
}

export interface RuleCondition {
  field: string;
  operator: 'EQUALS' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'IS_EMPTY' | 'NOT_EMPTY';
  value?: string | number | string[];
}

export interface RuleActionSpec {
  type: AutomationAction;
  params?: Record<string, string | number>;
}

export interface QualificationResult {
  intent: Intent | null;
  location: string | null;
  propertyType: string | null;
  offeringType?: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  purchaseTimeline: PurchaseTimeline | null;
  decisionTimeline?: PurchaseTimeline | null;
  summary: string;
  confidence: number;
  needsHumanHandoff: boolean;
  handoffReason: string | null;
  answers: Record<string, string>;
  attributes?: Record<string, unknown>;
}
