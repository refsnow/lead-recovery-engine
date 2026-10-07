import { prisma } from '@/db/client';
import { parseJson } from '@/lib/json';
import {
  DEFAULT_HOT_THRESHOLD, DEFAULT_SCORING_RULES, DEFAULT_WARM_THRESHOLD,
} from '@/config/defaults';
import type { LeadTemperature, ScoreComponent, ScoreResult, ScoringRule } from '@/types/domain';

/**
 * Behavioural signals derived from the lead's conversation. Kept separate from
 * stored lead columns so scoring can consider engagement, not just form data.
 */
export interface LeadSignals {
  replied: boolean;
  askedPricing: boolean;
  requestedAppointment: boolean;
}

export interface ScorableLead {
  budgetMin?: number | null;
  budgetMax?: number | null;
  location?: string | null;
  propertyType?: string | null;
  offeringType?: string | null;
  purchaseTimeline?: string | null;
  decisionTimeline?: string | null;
  intent?: string | null;
  signals?: Partial<LeadSignals>;
  [key: string]: unknown;
}

export interface ScoringConfiguration {
  rules: ScoringRule[];
  hotThreshold: number;
  warmThreshold: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfiguration = {
  rules: DEFAULT_SCORING_RULES,
  hotThreshold: DEFAULT_HOT_THRESHOLD,
  warmThreshold: DEFAULT_WARM_THRESHOLD,
};

/**
 * Pure scoring function — no database access, no UI concerns.
 * Every rule contributes an explained component so the UI can always answer
 * "why did this lead get this score?".
 */
export function scoreLead(lead: ScorableLead, config: ScoringConfiguration = DEFAULT_SCORING_CONFIG): ScoreResult {
  const components: ScoreComponent[] = config.rules.map((rule) => ({
    ruleId: rule.id,
    label: rule.label,
    points: rule.points,
    matched: evaluateRule(lead, rule),
  }));

  const rawScore = components
    .filter((component) => component.matched)
    .reduce((total, component) => total + component.points, 0);

  // Scores are always presented out of 100.
  const score = Math.max(0, Math.min(100, rawScore));

  return { score, temperature: temperatureFor(score, config), components };
}

export function temperatureFor(score: number, config: ScoringConfiguration = DEFAULT_SCORING_CONFIG): LeadTemperature {
  if (score >= config.hotThreshold) return 'HOT';
  if (score >= config.warmThreshold) return 'WARM';
  return 'COLD';
}

function evaluateRule(lead: ScorableLead, rule: ScoringRule): boolean {
  const value = readField(lead, rule.field);

  switch (rule.operator) {
    case 'NOT_EMPTY':
      return value !== null && value !== undefined && value !== '' && value !== 0;
    case 'IS_TRUE':
      return value === true;
    case 'EQUALS':
      return String(value ?? '').toUpperCase() === String(rule.value ?? '').toUpperCase();
    case 'IN': {
      const allowed = (Array.isArray(rule.value) ? rule.value : [rule.value])
        .map((item) => String(item ?? '').toUpperCase());
      return value !== null && value !== undefined && allowed.includes(String(value).toUpperCase());
    }
    case 'GTE':
      return typeof value === 'number' && value >= Number(rule.value);
    case 'LTE':
      return typeof value === 'number' && value <= Number(rule.value);
    default:
      return false;
  }
}

/** Supports dotted paths such as `signals.replied`. */
function readField(lead: ScorableLead, field: string): unknown {
  return field.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, lead);
}

/** Loads an organization's scoring configuration, falling back to defaults. */
export async function getScoringConfig(organizationId: string): Promise<ScoringConfiguration> {
  const stored = await prisma.scoringConfig.findUnique({ where: { organizationId } });
  if (!stored) return DEFAULT_SCORING_CONFIG;

  const rules = parseJson<ScoringRule[]>(stored.rules, DEFAULT_SCORING_RULES);
  return {
    rules: rules.length ? rules : DEFAULT_SCORING_RULES,
    hotThreshold: stored.hotThreshold,
    warmThreshold: stored.warmThreshold,
  };
}

/** Derives engagement signals from a lead's messages. */
export function deriveSignals(messages: { sender: string; body: string }[]): LeadSignals {
  const leadMessages = messages.filter((message) => message.sender === 'LEAD');
  const text = leadMessages.map((message) => message.body.toLowerCase()).join(' ');

  return {
    replied: leadMessages.length > 0,
    askedPricing: /price|cost|rate|per sq|psf|budget|payment plan|how much|fee|charges|expense|aum/.test(text),
    requestedAppointment: /site visit|visit|appointment|meet|schedule|come see|show me|call me|consultation|demo|intro call/.test(text),
  };
}
