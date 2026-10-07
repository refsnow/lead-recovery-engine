import type { AIMessage, AIProvider } from '@/providers/types';
import type { QualificationResult, PurchaseTimeline, Intent } from '@/types/domain';

/**
 * Deterministic, offline AI provider used in demo/development mode.
 *
 * It performs genuine rule-based extraction over the transcript rather than
 * returning canned output, so the qualification pipeline is exercised end to
 * end without an API key. It never fabricates a value the transcript does not
 * contain — the same contract the real provider is held to.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock-ai';
  readonly isMock = true;

  async complete(messages: AIMessage[]): Promise<string> {
    const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    const missing = /Still missing: ([^\n.]+)/.exec(last)?.[1]?.split(',').map((s) => s.trim()) ?? [];

    if (!missing.length) {
      return 'Thank you for sharing those details. One of our property consultants will call you shortly to take this forward.';
    }

    const ask: Record<string, string> = {
      intent: 'are you looking at this for investment or for your own use',
      location: 'which locality are you considering',
      propertyType: 'what configuration are you looking for (2BHK, 3BHK, villa or plot)',
      budget: 'what budget range are you working with',
      timeline: 'when are you planning to make the purchase',
    };

    const questions = missing.slice(0, 2).map((key) => ask[key] ?? key);
    return `Thanks for reaching out! To help you with the right options, could you tell me ${questions.join(', and ')}?`;
  }

  async extractQualification(_systemPrompt: string, extractionPrompt: string): Promise<QualificationResult> {
    const transcript = extractionPrompt
      .split('--- TRANSCRIPT ---')[1]
      ?.split('--- END TRANSCRIPT ---')[0] ?? '';
    // Only lead-authored lines are evidence; assistant lines must not become facts.
    const leadText = transcript
      .split('\n')
      .filter((line) => /^lead:/i.test(line.trim()))
      .join(' ')
      .toLowerCase();

    const intent = extractIntent(leadText);
    const location = extractLocation(leadText);
    const propertyType = extractPropertyType(leadText);
    const { budgetMin, budgetMax } = extractBudget(leadText);
    const purchaseTimeline = extractTimeline(leadText);

    const known = [intent, location, propertyType, budgetMax, purchaseTimeline].filter(Boolean).length;
    const confidence = leadText.trim() ? Math.min(0.95, 0.35 + known * 0.12) : 0.1;

    const escalationTrigger = /discount|negotiat|lowest price|best price|complaint|legal|loan approval|site visit|call me|speak to someone/.test(leadText);
    const needsHumanHandoff = escalationTrigger || confidence < 0.6;
    const handoffReason = escalationTrigger
      ? 'Lead raised a commercial or escalation topic that must be handled by a person.'
      : confidence < 0.6
        ? 'Qualification confidence below threshold; a consultant should confirm requirements.'
        : null;

    return {
      intent,
      location,
      propertyType,
      budgetMin,
      budgetMax,
      purchaseTimeline,
      summary: buildSummary({ intent, location, propertyType, budgetMax, purchaseTimeline }),
      confidence: Number(confidence.toFixed(2)),
      needsHumanHandoff,
      handoffReason,
      answers: {},
    };
  }
}

const LOCATIONS = [
  'gurgaon', 'gurugram', 'golf course road', 'dwarka expressway', 'sohna road', 'new gurgaon',
  'noida', 'greater noida', 'noida extension', 'delhi', 'south delhi', 'faridabad', 'ghaziabad',
  'mumbai', 'thane', 'navi mumbai', 'pune', 'bangalore', 'bengaluru', 'whitefield', 'hyderabad',
  'gachibowli', 'chennai',
];

function extractIntent(text: string): Intent | null {
  if (/invest|rental yield|returns|appreciation|portfolio/.test(text)) return 'INVESTMENT';
  if (/own use|personal use|self use|family|shifting|move in|end use/.test(text)) return 'END_USE';
  return null;
}

function extractLocation(text: string): string | null {
  const match = LOCATIONS.find((loc) => text.includes(loc));
  if (!match) return null;
  return match.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractPropertyType(text: string): string | null {
  const bhk = /(\d)\s*bhk/.exec(text);
  if (bhk) return `${bhk[1]}BHK`;
  if (/villa|independent floor|builder floor/.test(text)) return 'VILLA';
  if (/plot|land/.test(text)) return 'PLOT';
  if (/office|shop|retail|commercial/.test(text)) return 'COMMERCIAL';
  if (/penthouse/.test(text)) return 'PENTHOUSE';
  return null;
}

/** Understands "2 cr", "1.5 crore", "85 lakh", "2-3 cr". */
function extractBudget(text: string): { budgetMin: number | null; budgetMax: number | null } {
  const range = /(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(cr|crore|l|lakh|lac)/.exec(text);
  if (range) {
    const unit = unitMultiplier(range[3]);
    return { budgetMin: Math.round(Number(range[1]) * unit), budgetMax: Math.round(Number(range[2]) * unit) };
  }
  const single = /(\d+(?:\.\d+)?)\s*(cr|crore|l|lakh|lac)/.exec(text);
  if (single) {
    const value = Math.round(Number(single[1]) * unitMultiplier(single[2]));
    return { budgetMin: null, budgetMax: value };
  }
  return { budgetMin: null, budgetMax: null };
}

function unitMultiplier(unit: string | undefined): number {
  return unit && /^(cr|crore)$/.test(unit) ? 10_000_000 : 100_000;
}

function extractTimeline(text: string): PurchaseTimeline | null {
  if (/immediate|urgent|this month|asap|right away|ready to book/.test(text)) return 'IMMEDIATE';
  if (/1-3 month|two month|2 month|next month|3 month|couple of month/.test(text)) return '1_3_MONTHS';
  if (/3-6 month|6 month|four month|five month/.test(text)) return '3_6_MONTHS';
  if (/this year|6-12|next year|8 month|10 month/.test(text)) return '6_12_MONTHS';
  if (/just looking|exploring|browsing|no hurry|researching/.test(text)) return 'EXPLORING';
  return null;
}

function buildSummary(data: {
  intent: Intent | null; location: string | null; propertyType: string | null;
  budgetMax: number | null; purchaseTimeline: PurchaseTimeline | null;
}): string {
  const parts: string[] = [];
  parts.push(data.intent === 'INVESTMENT' ? 'Investment buyer' : data.intent === 'END_USE' ? 'End-use buyer' : 'Buyer');
  if (data.propertyType) parts.push(`looking for a ${data.propertyType}`);
  if (data.location) parts.push(`in ${data.location}`);
  if (data.budgetMax) {
    const value = data.budgetMax >= 10_000_000
      ? `₹${(data.budgetMax / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`
      : `₹${(data.budgetMax / 100_000).toFixed(0)} L`;
    parts.push(`with a budget around ${value}`);
  }
  if (data.purchaseTimeline) {
    const label: Record<PurchaseTimeline, string> = {
      IMMEDIATE: 'planning to purchase immediately',
      '1_3_MONTHS': 'planning to purchase within 1-3 months',
      '3_6_MONTHS': 'planning to purchase within 3-6 months',
      '6_12_MONTHS': 'planning to purchase within 6-12 months',
      EXPLORING: 'still exploring options',
    };
    parts.push(label[data.purchaseTimeline]);
  }
  if (parts.length === 1) return 'Not enough information collected yet to qualify this lead.';
  return `${parts.join(' ')}.`;
}
