import { z } from 'zod';
import {
  LEAD_STATUSES, LEAD_SOURCES, LEAD_TEMPERATURES, USER_ROLES, FOLLOW_UP_TYPES,
  FOLLOW_UP_STATUSES, APPOINTMENT_STATUSES, PURCHASE_TIMELINES, INTENTS, CHANNELS,
  AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS, SOURCE_TYPES,
} from '@/types/domain';

/** Indian mobile numbers, with or without +91. Kept permissive for imports. */
export const phoneSchema = z
  .string()
  .trim()
  .min(8, 'Phone number is too short.')
  .max(20, 'Phone number is too long.')
  .regex(/^[+]?[\d\s()-]{8,20}$/, 'Enter a valid phone number.');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');

/**
 * Detailed acquisition metadata. Every field is optional: a walk-in has none of
 * it, a Meta lead has all of it, and a website form sits somewhere between.
 */
export const attributionSchema = z.object({
  sourceType: z.enum(SOURCE_TYPES).optional(),
  campaignExternalId: z.string().trim().max(120).optional().nullable(),
  campaignName: z.string().trim().max(160).optional().nullable(),
  adSetId: z.string().trim().max(120).optional().nullable(),
  adSetName: z.string().trim().max(160).optional().nullable(),
  adId: z.string().trim().max(120).optional().nullable(),
  adName: z.string().trim().max(160).optional().nullable(),
  formId: z.string().trim().max(120).optional().nullable(),
  formName: z.string().trim().max(160).optional().nullable(),
  landingPage: z.string().trim().max(500).optional().nullable(),
  utmSource: z.string().trim().max(120).optional().nullable(),
  utmMedium: z.string().trim().max(120).optional().nullable(),
  utmCampaign: z.string().trim().max(160).optional().nullable(),
  utmContent: z.string().trim().max(160).optional().nullable(),
  utmTerm: z.string().trim().max(160).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  firstTouchAt: z.coerce.date().optional(),
});

export const createLeadSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  source: z.enum(LEAD_SOURCES).default('MANUAL'),
  campaignId: z.string().cuid().optional().nullable(),
  adName: z.string().trim().max(160).optional(),
  externalId: z.string().trim().max(160).optional(),
  /** Free-text channel label; only meaningful when source is OTHER. */
  sourceDetail: z.string().trim().max(60).optional().nullable(),
  attribution: attributionSchema.optional(),
  budgetMin: z.coerce.number().int().nonnegative().optional().nullable(),
  budgetMax: z.coerce.number().int().nonnegative().optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  propertyType: z.string().trim().max(60).optional().nullable(),
  offeringType: z.string().trim().max(100).optional().nullable(),
  purchaseTimeline: z.enum(PURCHASE_TIMELINES).optional().nullable(),
  decisionTimeline: z.enum(PURCHASE_TIMELINES).optional().nullable(),
  intent: z.enum(INTENTS).optional().nullable(),
  assignedToId: z.string().cuid().optional().nullable(),
  notes: z.string().trim().max(2000).optional(),
}).refine(
  (data) => !data.budgetMin || !data.budgetMax || data.budgetMin <= data.budgetMax,
  { message: 'Minimum budget cannot exceed maximum budget.', path: ['budgetMin'] },
).refine(
  (data) => data.source !== 'OTHER' || Boolean(data.sourceDetail?.trim()),
  { message: 'Describe the source when choosing "Other".', path: ['sourceDetail'] },
);

export const updateLeadSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(LEAD_TEMPERATURES).optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  budgetMin: z.coerce.number().int().nonnegative().nullable().optional(),
  budgetMax: z.coerce.number().int().nonnegative().nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  propertyType: z.string().trim().max(60).nullable().optional(),
  offeringType: z.string().trim().max(100).nullable().optional(),
  purchaseTimeline: z.enum(PURCHASE_TIMELINES).nullable().optional(),
  decisionTimeline: z.enum(PURCHASE_TIMELINES).nullable().optional(),
  intent: z.enum(INTENTS).nullable().optional(),
  lostReason: z.string().trim().max(500).nullable().optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
});

export const leadFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(LEAD_TEMPERATURES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  campaignId: z.string().optional(),
  assignedToId: z.string().optional(),
  risk: z.enum(['UNCONTACTED', 'OVERDUE', 'DORMANT', 'HIGH_INTENT_INACTIVE', 'UNASSIGNED']).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sort: z.enum(['createdAt', 'score', 'lastActivityAt', 'nextFollowUpAt', 'name']).default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type LeadFilterInput = z.infer<typeof leadFilterSchema>;

export const assignLeadSchema = z.object({
  assignedToId: z.string().cuid().nullable(),
});

export const createFollowUpSchema = z.object({
  type: z.enum(FOLLOW_UP_TYPES).default('CALL'),
  scheduledFor: z.coerce.date(),
  assignedToId: z.string().cuid().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const completeFollowUpSchema = z.object({
  status: z.enum(FOLLOW_UP_STATUSES).default('COMPLETED'),
  notes: z.string().trim().max(1000).optional(),
});

export const createAppointmentSchema = z.object({
  scheduledFor: z.coerce.date(),
  salespersonId: z.string().cuid().nullable().optional(),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  notes: z.string().trim().max(1000).optional(),
});

export const createConversionSchema = z.object({
  revenue: z.coerce.number().positive('Revenue must be greater than zero.').max(100_000_000_000),
  product: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  convertedAt: z.coerce.date().optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty.').max(4000),
  channel: z.enum(CHANNELS).default('WHATSAPP'),
});

export const addNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note cannot be empty.').max(2000),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters.').max(200),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
  role: z.enum(USER_ROLES).default('SALESPERSON'),
  phone: phoneSchema.optional(),
});

export const knowledgeEntrySchema = z.object({
  question: z.string().trim().min(5, 'Question is too short.').max(400),
  answer: z.string().trim().min(5, 'Answer is too short.').max(4000),
  category: z.string().trim().max(60).default('GENERAL'),
  isApproved: z.coerce.boolean().default(true),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(160),
  source: z.enum(LEAD_SOURCES).default('META_LEAD_ADS'),
  spend: z.coerce.number().nonnegative().default(0),
  isActive: z.coerce.boolean().default(true),
});

export const scoringConfigSchema = z.object({
  hotThreshold: z.coerce.number().int().min(1).max(100),
  warmThreshold: z.coerce.number().int().min(0).max(99),
  rules: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(120),
    points: z.coerce.number().int().min(-100).max(100),
    field: z.string().min(1).max(60),
    operator: z.enum(['EQUALS', 'IN', 'GTE', 'LTE', 'IS_TRUE', 'NOT_EMPTY']),
    value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  })).min(1, 'At least one scoring rule is required.'),
}).refine((data) => data.warmThreshold < data.hotThreshold, {
  message: 'Warm threshold must be below the hot threshold.',
  path: ['warmThreshold'],
});

export const automationRuleSchema = z.object({
  name: z.string().trim().min(2).max(160),
  trigger: z.enum(AUTOMATION_TRIGGERS),
  isActive: z.coerce.boolean().default(true),
  conditions: z.array(z.object({
    field: z.string().min(1),
    operator: z.enum(['EQUALS', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'IS_EMPTY', 'NOT_EMPTY']),
    value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  })).default([]),
  actions: z.array(z.object({
    type: z.enum(AUTOMATION_ACTIONS),
    params: z.record(z.union([z.string(), z.number()])).optional(),
  })).min(1, 'At least one action is required.'),
});

export const qualificationQuestionSchema = z.object({
  questions: z.array(z.object({
    key: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(5).max(400),
    order: z.coerce.number().int().min(0),
    isActive: z.coerce.boolean().default(true),
  })).max(20),
});

export const followUpSequenceSchema = z.object({
  steps: z.array(z.object({
    id: z.string().optional(),
    name: z.string().trim().min(2).max(120),
    delayMinutes: z.coerce.number().int().min(0).max(525_600),
    channel: z.enum(CHANNELS).default('WHATSAPP'),
    messageTemplate: z.string().trim().min(5).max(2000),
    order: z.coerce.number().int().min(0),
    isActive: z.coerce.boolean().default(true),
    stopOnReply: z.coerce.boolean().default(true),
    stopOnAppointment: z.coerce.boolean().default(true),
  })).max(20),
});

/** Meta Lead Ads webhook envelope (only the fields we consume). */
export const metaWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    time: z.number().optional(),
    changes: z.array(z.object({
      field: z.string(),
      value: z.object({
        leadgen_id: z.string(),
        page_id: z.string().optional(),
        form_id: z.string().optional(),
        ad_id: z.string().optional(),
        campaign_name: z.string().optional(),
        ad_name: z.string().optional(),
        created_time: z.number().optional(),
      }),
    })).default([]),
  })).default([]),
});

/** WhatsApp Cloud API inbound webhook envelope. */
export const whatsappWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      field: z.string(),
      value: z.object({
        messaging_product: z.string().optional(),
        metadata: z.object({ phone_number_id: z.string().optional() }).optional(),
        contacts: z.array(z.object({
          wa_id: z.string(),
          profile: z.object({ name: z.string().optional() }).optional(),
        })).optional(),
        messages: z.array(z.object({
          from: z.string(),
          id: z.string(),
          timestamp: z.string().optional(),
          type: z.string(),
          text: z.object({ body: z.string() }).optional(),
        })).optional(),
        statuses: z.array(z.object({
          id: z.string(),
          status: z.string(),
          recipient_id: z.string().optional(),
        })).optional(),
      }),
    })).default([]),
  })).default([]),
});
