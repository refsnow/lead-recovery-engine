import { describe, expect, it } from 'vitest';
import {
  createLeadSchema, leadFilterSchema, loginSchema, createConversionSchema,
  scoringConfigSchema, createUserSchema, metaWebhookSchema, whatsappWebhookSchema,
} from '@/lib/validation';

describe('Input validation', () => {
  it('requires a name and phone number for a lead', () => {
    expect(createLeadSchema.safeParse({}).success).toBe(false);
    expect(createLeadSchema.safeParse({ name: 'A', phone: '+919810000000' }).success).toBe(false); // name too short
    expect(createLeadSchema.safeParse({ name: 'Rahul Sharma', phone: 'abc' }).success).toBe(false);
    expect(createLeadSchema.safeParse({ name: 'Rahul Sharma', phone: '+919810000000' }).success).toBe(true);
  });

  it('rejects a budget range where the minimum exceeds the maximum', () => {
    const result = createLeadSchema.safeParse({
      name: 'Rahul Sharma', phone: '+919810000000',
      budgetMin: 30_000_000, budgetMax: 10_000_000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown enum values', () => {
    expect(createLeadSchema.safeParse({
      name: 'Rahul Sharma', phone: '+919810000000', source: 'TIKTOK',
    }).success).toBe(false);
  });

  it('normalizes an empty email to undefined rather than failing', () => {
    const result = createLeadSchema.safeParse({ name: 'Rahul Sharma', phone: '+919810000000', email: '' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBeUndefined();
  });

  it('applies safe defaults to lead filters', () => {
    const filters = leadFilterSchema.parse({});
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(25);
    expect(filters.sort).toBe('createdAt');
    expect(filters.dir).toBe('desc');
  });

  it('caps the page size so a client cannot request the whole table', () => {
    expect(leadFilterSchema.safeParse({ pageSize: 10_000 }).success).toBe(false);
    expect(leadFilterSchema.parse({ pageSize: 100 }).pageSize).toBe(100);
  });

  it('lower-cases email addresses on sign-in', () => {
    const result = loginSchema.safeParse({ email: '  Owner@DemoRealty.TEST ', password: 'demo123' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe('owner@demorealty.test');
  });

  it('requires positive revenue for a conversion', () => {
    expect(createConversionSchema.safeParse({ revenue: 0 }).success).toBe(false);
    expect(createConversionSchema.safeParse({ revenue: -100 }).success).toBe(false);
    expect(createConversionSchema.safeParse({ revenue: 18_500_000 }).success).toBe(true);
  });

  it('requires a minimum password length for new accounts', () => {
    const base = { name: 'New User', email: 'new@test.local', role: 'SALESPERSON' as const };
    expect(createUserSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, password: 'longenough123' }).success).toBe(true);
  });

  it('rejects a scoring configuration whose thresholds are inverted', () => {
    const rules = [{ id: 'r', label: 'Rule', points: 10, field: 'budgetMax', operator: 'NOT_EMPTY' as const }];
    expect(scoringConfigSchema.safeParse({ hotThreshold: 40, warmThreshold: 70, rules }).success).toBe(false);
    expect(scoringConfigSchema.safeParse({ hotThreshold: 70, warmThreshold: 40, rules }).success).toBe(true);
  });

  it('rejects a scoring configuration with no rules', () => {
    expect(scoringConfigSchema.safeParse({ hotThreshold: 70, warmThreshold: 40, rules: [] }).success).toBe(false);
  });
});

describe('Webhook payload validation', () => {
  it('accepts a well-formed Meta leadgen payload', () => {
    const result = metaWebhookSchema.safeParse({
      object: 'page',
      entry: [{
        id: '123', time: 1_700_000_000,
        changes: [{ field: 'leadgen', value: { leadgen_id: 'lead_1', page_id: '123' } }],
      }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a Meta payload with no leadgen id', () => {
    expect(metaWebhookSchema.safeParse({
      object: 'page',
      entry: [{ id: '123', changes: [{ field: 'leadgen', value: {} }] }],
    }).success).toBe(false);
  });

  it('accepts a WhatsApp inbound text payload', () => {
    const result = whatsappWebhookSchema.safeParse({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            messages: [{ from: '919810000000', id: 'wamid.1', type: 'text', text: { body: 'Hello' } }],
          },
        }],
      }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a status-only WhatsApp callback', () => {
    const result = whatsappWebhookSchema.safeParse({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba',
        changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }],
      }],
    });
    expect(result.success).toBe(true);
  });
});
