import { describe, expect, it } from 'vitest';
import { scoreLead, temperatureFor, deriveSignals, DEFAULT_SCORING_CONFIG } from '@/services/scoring.service';
import type { ScoringRule } from '@/types/domain';

describe('LeadScoringService', () => {
  it('scores an unqualified lead at zero and marks it cold', () => {
    const result = scoreLead({});
    expect(result.score).toBe(0);
    expect(result.temperature).toBe('COLD');
    expect(result.components.every((component) => !component.matched)).toBe(true);
  });

  it('scores a high-intent buyer as hot and explains every contributing signal', () => {
    const result = scoreLead({
      budgetMax: 20_000_000,
      location: 'Gurgaon',
      propertyType: '3BHK',
      purchaseTimeline: 'IMMEDIATE',
      intent: 'INVESTMENT',
      signals: { replied: true, askedPricing: true, requestedAppointment: true },
    });

    expect(result.temperature).toBe('HOT');
    expect(result.score).toBeGreaterThanOrEqual(70);

    const matched = result.components.filter((component) => component.matched).map((c) => c.ruleId);
    expect(matched).toContain('budget_qualified');
    expect(matched).toContain('location_match');
    expect(matched).toContain('timeline_immediate');
    expect(matched).toContain('appointment_intent');
  });

  it('never exceeds 100 even when every rule matches', () => {
    const result = scoreLead({
      budgetMax: 50_000_000, location: 'Golf Course Road', propertyType: 'VILLA',
      purchaseTimeline: 'IMMEDIATE', intent: 'INVESTMENT',
      signals: { replied: true, askedPricing: true, requestedAppointment: true },
    });
    expect(result.score).toBe(100);
  });

  it('applies operators correctly', () => {
    const rules: ScoringRule[] = [
      { id: 'gte', label: 'Budget over 1Cr', points: 10, field: 'budgetMax', operator: 'GTE', value: 10_000_000 },
      { id: 'lte', label: 'Budget under 50L', points: 10, field: 'budgetMax', operator: 'LTE', value: 5_000_000 },
      { id: 'in', label: 'Target city', points: 10, field: 'location', operator: 'IN', value: ['Gurgaon', 'Noida'] },
      { id: 'eq', label: 'Investment', points: 10, field: 'intent', operator: 'EQUALS', value: 'INVESTMENT' },
      { id: 'true', label: 'Replied', points: 10, field: 'signals.replied', operator: 'IS_TRUE' },
      { id: 'notEmpty', label: 'Has a type', points: 10, field: 'propertyType', operator: 'NOT_EMPTY' },
    ];
    const config = { rules, hotThreshold: 70, warmThreshold: 40 };

    const result = scoreLead({
      budgetMax: 12_000_000, location: 'Noida', intent: 'INVESTMENT',
      propertyType: '2BHK', signals: { replied: false },
    }, config);

    const matched = Object.fromEntries(result.components.map((c) => [c.ruleId, c.matched]));
    expect(matched.gte).toBe(true);
    expect(matched.lte).toBe(false);
    expect(matched.in).toBe(true);
    expect(matched.eq).toBe(true);
    expect(matched.true).toBe(false);
    expect(matched.notEmpty).toBe(true);
    expect(result.score).toBe(40);
  });

  it('matches IN and EQUALS case-insensitively', () => {
    const result = scoreLead({ location: 'GURGAON', propertyType: 'villa', intent: 'investment' });
    const matched = result.components.filter((c) => c.matched).map((c) => c.ruleId);
    expect(matched).toContain('location_match');
    expect(matched).toContain('property_match');
    expect(matched).toContain('investment_intent');
  });

  it('honours configurable thresholds', () => {
    const config = { ...DEFAULT_SCORING_CONFIG, hotThreshold: 50, warmThreshold: 20 };
    expect(temperatureFor(55, config)).toBe('HOT');
    expect(temperatureFor(30, config)).toBe('WARM');
    expect(temperatureFor(10, config)).toBe('COLD');
    // Boundaries are inclusive.
    expect(temperatureFor(50, config)).toBe('HOT');
    expect(temperatureFor(20, config)).toBe('WARM');
  });

  it('derives engagement signals only from lead-authored messages', () => {
    const signals = deriveSignals([
      { sender: 'AI', body: 'What is your budget and would you like a site visit?' },
      { sender: 'LEAD', body: 'What is the price? I would like to schedule a visit.' },
    ]);
    expect(signals.replied).toBe(true);
    expect(signals.askedPricing).toBe(true);
    expect(signals.requestedAppointment).toBe(true);

    // An assistant mentioning price must not create a lead signal.
    const aiOnly = deriveSignals([{ sender: 'AI', body: 'Our price list and site visit options…' }]);
    expect(aiOnly.replied).toBe(false);
    expect(aiOnly.askedPricing).toBe(false);
    expect(aiOnly.requestedAppointment).toBe(false);
  });

  it('scores a wealth management lead accurately with custom offering and signals', () => {
    const wmSignals = deriveSignals([
      { sender: 'LEAD', body: 'What are your AUM fee charges? I want an intro call with an advisor.' },
    ]);
    expect(wmSignals.replied).toBe(true);
    expect(wmSignals.askedPricing).toBe(true);
    expect(wmSignals.requestedAppointment).toBe(true);

    const wmRules: ScoringRule[] = [
      { id: 'surplus_gte_1cr', label: 'Surplus >= 1Cr', points: 30, field: 'budgetMax', operator: 'GTE', value: 10_000_000 },
      { id: 'pms_offering', label: 'PMS Offering', points: 20, field: 'offeringType', operator: 'IN', value: ['PMS', 'AIF'] },
      { id: 'immediate', label: 'Immediate Allocation', points: 20, field: 'decisionTimeline', operator: 'EQUALS', value: 'IMMEDIATE' },
      { id: 'consultation', label: 'Call Requested', points: 20, field: 'signals.requestedAppointment', operator: 'IS_TRUE' },
    ];

    const result = scoreLead({
      budgetMax: 25_000_000,
      offeringType: 'PMS',
      decisionTimeline: 'IMMEDIATE',
      signals: wmSignals,
    }, { rules: wmRules, hotThreshold: 70, warmThreshold: 40 });

    expect(result.score).toBe(90);
    expect(result.temperature).toBe('HOT');
    const matched = result.components.filter((c) => c.matched).map((c) => c.ruleId);
    expect(matched).toEqual(['surplus_gte_1cr', 'pms_offering', 'immediate', 'consultation']);
  });
});
