import { describe, expect, it } from 'vitest';
import { normalizeQualification } from '@/services/qualification-parser';
import { MockAIProvider } from '@/providers/ai/mock';
import { buildExtractionPrompt } from '@/prompts/qualification';

describe('AI qualification parsing', () => {
  it('parses a well-formed response', () => {
    const result = normalizeQualification(JSON.stringify({
      intent: 'END_USE', location: 'Gurgaon', propertyType: '3bhk',
      budgetMin: 15_000_000, budgetMax: 20_000_000, purchaseTimeline: 'IMMEDIATE',
      summary: 'End-use buyer looking for a 3BHK in Gurgaon.', confidence: 0.88,
      needsHumanHandoff: false, handoffReason: null,
    }));

    expect(result.intent).toBe('END_USE');
    expect(result.propertyType).toBe('3BHK'); // normalized to upper case
    expect(result.offeringType).toBe('3BHK');
    expect(result.budgetMax).toBe(20_000_000);
    expect(result.purchaseTimeline).toBe('IMMEDIATE');
    expect(result.decisionTimeline).toBe('IMMEDIATE');
    expect(result.needsHumanHandoff).toBe(false);
  });

  it('normalizes generalized offeringType and decisionTimeline', () => {
    const result = normalizeQualification(JSON.stringify({
      intent: 'INVESTMENT', location: 'Mumbai', offeringType: 'pms',
      budgetMin: 5_000_000, budgetMax: 10_000_000, decisionTimeline: '1_3_MONTHS',
      summary: 'HNI investor exploring PMS options.', confidence: 0.95,
      needsHumanHandoff: false,
    }));

    expect(result.offeringType).toBe('PMS');
    expect(result.decisionTimeline).toBe('1_3_MONTHS');
    expect(result.purchaseTimeline).toBe('1_3_MONTHS');
    expect(result.budgetMin).toBe(5_000_000);
    expect(result.budgetMax).toBe(10_000_000);
  });

  it('extracts JSON wrapped in prose or code fences', () => {
    const result = normalizeQualification(
      'Here is the data:\n```json\n{"location":"Noida","confidence":0.8,"summary":"Buyer in Noida."}\n```\nLet me know.',
    );
    expect(result.location).toBe('Noida');
    expect(result.confidence).toBe(0.8);
  });

  it('escalates to a human when the response cannot be parsed', () => {
    const result = normalizeQualification('I am unable to help with that request.');
    expect(result.needsHumanHandoff).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.handoffReason).toBeTruthy();
  });

  it('rejects enum values the model invented', () => {
    const result = normalizeQualification(JSON.stringify({
      intent: 'SPECULATIVE', purchaseTimeline: 'NEXT_WEEK', confidence: 0.9, summary: 'x',
    }));
    expect(result.intent).toBeNull();
    expect(result.purchaseTimeline).toBeNull();
  });

  it('drops impossible numeric values rather than storing them', () => {
    const result = normalizeQualification(JSON.stringify({
      budgetMax: -5000, confidence: 7, summary: 'x',
    }));
    expect(result.budgetMax).toBeNull();
    expect(result.confidence).toBe(1); // clamped into range
  });

  it('discards a reversed budget range', () => {
    const result = normalizeQualification(JSON.stringify({
      budgetMin: 30_000_000, budgetMax: 10_000_000, confidence: 0.9, summary: 'x',
    }));
    expect(result.budgetMin).toBeNull();
    expect(result.budgetMax).toBe(10_000_000);
  });

  it('forces a handoff below the confidence threshold', () => {
    const result = normalizeQualification(JSON.stringify({
      confidence: 0.4, needsHumanHandoff: false, summary: 'Unclear requirement.',
    }));
    expect(result.needsHumanHandoff).toBe(true);
  });
});

describe('MockAIProvider', () => {
  const provider = new MockAIProvider();

  it('extracts requirements from a lead transcript', async () => {
    const transcript = [
      'Assistant: Which location are you considering?',
      'Lead: Looking at Golf Course Road for a 3BHK, budget around 2 cr, want to buy immediately for our own use.',
    ].join('\n');

    const result = await provider.extractQualification('', buildExtractionPrompt(transcript));

    expect(result.location).toBe('Golf Course Road');
    expect(result.propertyType).toBe('3BHK');
    expect(result.budgetMax).toBe(20_000_000);
    expect(result.purchaseTimeline).toBe('IMMEDIATE');
    expect(result.intent).toBe('END_USE');
    expect(result.needsHumanHandoff).toBe(false);
  });

  it('never treats assistant text as lead-stated facts', async () => {
    const transcript = [
      'Assistant: We have 3BHK options in Gurgaon at around 2 cr, available immediately.',
      'Lead: Ok.',
    ].join('\n');

    const result = await provider.extractQualification('', buildExtractionPrompt(transcript));

    expect(result.location).toBeNull();
    expect(result.propertyType).toBeNull();
    expect(result.budgetMax).toBeNull();
    expect(result.needsHumanHandoff).toBe(true); // low confidence -> escalate
  });

  it('escalates when the lead raises a commercial topic', async () => {
    const transcript = 'Lead: What is the best price you can give? Any discount?';
    const result = await provider.extractQualification('', buildExtractionPrompt(transcript));

    expect(result.needsHumanHandoff).toBe(true);
    expect(result.handoffReason).toMatch(/commercial|escalation/i);
  });

  it('parses budget ranges and lakh units', async () => {
    const range = await provider.extractQualification('', buildExtractionPrompt('Lead: Budget is 2-3 cr.'));
    expect(range.budgetMin).toBe(20_000_000);
    expect(range.budgetMax).toBe(30_000_000);

    const lakh = await provider.extractQualification('', buildExtractionPrompt('Lead: Around 85 lakh.'));
    expect(lakh.budgetMax).toBe(8_500_000);
  });
});
