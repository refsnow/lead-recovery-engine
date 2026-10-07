import { INTENTS, PURCHASE_TIMELINES } from '@/types/domain';
import type { Intent, PurchaseTimeline, QualificationResult } from '@/types/domain';

const MAX_BUDGET = 100_000_000_000; // ₹10,000 Cr — guards against model unit errors.

/**
 * Normalizes untrusted AI output into a safe QualificationResult.
 *
 * Model output is never written to the database unvalidated: unknown enum
 * values become null, out-of-range numbers are dropped, strings are trimmed and
 * length-capped, and unparseable output degrades to a low-confidence handoff
 * rather than throwing.
 */
export function normalizeQualification(raw: string | unknown): QualificationResult {
  const data = typeof raw === 'string' ? safeParse(raw) : (raw as Record<string, unknown> | null);

  if (!data || typeof data !== 'object') {
    return handoffResult('AI response could not be parsed; a consultant should qualify this lead manually.');
  }

  const budgetMin = numberOrNull(data.budgetMin);
  const budgetMax = numberOrNull(data.budgetMax);
  // A reversed range is a model error, not lead data — keep the wider bound only.
  const rangeValid = budgetMin === null || budgetMax === null || budgetMin <= budgetMax;

  const confidence = clamp(floatOrZero(data.confidence), 0, 1);
  const explicitHandoff = data.needsHumanHandoff === true;

  const rawOffering = data.offeringType ?? data.propertyType;
  const offeringType = stringOrNull(rawOffering, 100)?.toUpperCase() ?? null;
  const rawTimeline = data.decisionTimeline ?? data.purchaseTimeline;
  const timeline = enumOrNull<PurchaseTimeline>(rawTimeline, PURCHASE_TIMELINES);

  return {
    intent: enumOrNull<Intent>(data.intent, INTENTS),
    location: stringOrNull(data.location, 120),
    propertyType: stringOrNull(data.propertyType ?? offeringType, 60)?.toUpperCase() ?? null,
    offeringType,
    budgetMin: rangeValid ? budgetMin : null,
    budgetMax,
    purchaseTimeline: timeline,
    decisionTimeline: timeline,
    summary: stringOrNull(data.summary, 300) ?? 'No qualification summary available.',
    confidence,
    needsHumanHandoff: explicitHandoff || confidence < 0.6,
    handoffReason: explicitHandoff
      ? stringOrNull(data.handoffReason, 300) ?? 'Escalated by the qualification assistant.'
      : confidence < 0.6
        ? 'Qualification confidence below the 60% threshold.'
        : null,
    answers: recordOfStrings(data.answers),
  };
}

function safeParse(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  // Models sometimes wrap JSON in prose or code fences; take the outermost object.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function handoffResult(reason: string): QualificationResult {
  return {
    intent: null, location: null, propertyType: null, offeringType: null, budgetMin: null, budgetMax: null,
    purchaseTimeline: null, decisionTimeline: null, summary: 'Automatic qualification was not possible for this lead.',
    confidence: 0, needsHumanHandoff: true, handoffReason: reason, answers: {},
  };
}

function enumOrNull<T extends string>(value: unknown, allowed: readonly string[]): T | null {
  return typeof value === 'string' && allowed.includes(value) ? (value as T) : null;
}

function stringOrNull(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/** Confidence is fractional, so it must not be rounded like a rupee amount. */
function floatOrZero(value: unknown): number {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : 0;
}

/** Budget amounts: whole rupees, bounded, never negative. */
function numberOrNull(value: unknown): number | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num) || num < 0 || num > MAX_BUDGET) return null;
  return Math.round(num);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function recordOfStrings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string') result[key.slice(0, 40)] = val.slice(0, 500);
  }
  return result;
}
