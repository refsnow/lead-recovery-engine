import { env } from '@/config/env';
import type { AIProvider } from '@/providers/types';
import { MockAIProvider } from '@/providers/ai/mock';
import { OpenAIProvider } from '@/providers/ai/openai';

let cached: AIProvider | null = null;

/**
 * Resolves the active AI provider. Falls back to the mock provider whenever
 * credentials are absent so the application never crashes for a missing key —
 * but it refuses to silently mock in production (see `assertProductionSafety`).
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  cached = env.ai.provider === 'openai' && env.ai.openAiKey ? new OpenAIProvider() : new MockAIProvider();
  return cached;
}

export function resetAIProvider(): void {
  cached = null;
}
