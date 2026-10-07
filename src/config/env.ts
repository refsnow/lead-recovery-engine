import 'server-only';

/**
 * Server-only environment access. Never import this from a client component.
 */

function required(name: string, value: string | undefined, minLength = 1): string {
  if (!value || value.length < minLength) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing or invalid required environment variable: ${name}`);
    }
    return value ?? '';
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,
  databaseUrl: process.env.DATABASE_URL ?? '',

  /** Demo mode forces mock providers and exposes demo credentials on /login. */
  demoMode: (process.env.DEMO_MODE ?? 'true') === 'true',

  sessionSecret: required(
    'SESSION_SECRET',
    process.env.SESSION_SECRET ?? '4f769679466ccc2cd85c1360a160db480cda80a6a80e8290def64b26ed89c2bc',
    32,
  ),

  ai: {
    provider: (process.env.AI_PROVIDER ?? 'mock') as 'mock' | 'openai',
    openAiKey: process.env.OPENAI_API_KEY ?? '',
    openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },

  messaging: {
    provider: (process.env.MESSAGING_PROVIDER ?? 'mock') as 'mock' | 'whatsapp_cloud',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  },

  leadSource: {
    provider: (process.env.LEAD_SOURCE_PROVIDER ?? 'mock') as 'mock' | 'meta',
    appSecret: process.env.META_APP_SECRET ?? '',
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN ?? '',
    verifyToken: process.env.META_VERIFY_TOKEN ?? '',
  },

  cronSecret: process.env.CRON_SECRET ?? '',
} as const;

/** Guard against shipping demo credentials / mock providers to production. */
export function assertProductionSafety(): string[] {
  const problems: string[] = [];
  if (!isProduction) return problems;
  if (env.demoMode) problems.push('DEMO_MODE must be false in production.');
  if (env.sessionSecret.length < 32) problems.push('SESSION_SECRET must be at least 32 characters.');
  if (env.databaseUrl.startsWith('file:')) problems.push('SQLite is not supported in production; use PostgreSQL.');
  return problems;
}
