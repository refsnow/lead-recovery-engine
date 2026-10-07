import { env } from '@/config/env';
import { IntegrationError } from '@/lib/errors';
import type { AIMessage, AIProvider } from '@/providers/types';
import type { QualificationResult } from '@/types/domain';
import { normalizeQualification } from '@/services/qualification-parser';

/**
 * OpenAI-backed provider. Used only when AI_PROVIDER=openai and a key is set.
 * The API key never leaves the server; this module is server-only by virtue of
 * importing `@/config/env`.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly isMock = false;

  private async request(body: Record<string, unknown>): Promise<string> {
    const attempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.ai.openAiKey}`,
          },
          body: JSON.stringify({ model: env.ai.openAiModel, ...body }),
          signal: controller.signal,
        });

        if (response.status === 429 || response.status >= 500) {
          throw new IntegrationError('openai', `Upstream returned ${response.status}.`, true);
        }
        if (!response.ok) {
          const text = await response.text();
          throw new IntegrationError('openai', `Request rejected (${response.status}): ${text.slice(0, 200)}`, false);
        }

        const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const content = json.choices?.[0]?.message?.content;
        if (!content) throw new IntegrationError('openai', 'Response contained no content.', true);
        return content;
      } catch (error) {
        lastError = error as Error;
        const retryable = !(error instanceof IntegrationError) || error.retryable;
        if (!retryable || attempt === attempts) break;
        await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError instanceof IntegrationError
      ? lastError
      : new IntegrationError('openai', lastError?.message ?? 'Unknown AI provider failure.', true);
  }

  async complete(messages: AIMessage[], options?: { maxTokens?: number }): Promise<string> {
    return this.request({ messages, max_tokens: options?.maxTokens ?? 200, temperature: 0.3 });
  }

  async extractQualification(systemPrompt: string, extractionPrompt: string): Promise<QualificationResult> {
    const raw = await this.request({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: extractionPrompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    // Model output is untrusted: normalize + clamp before it reaches the database.
    return normalizeQualification(raw);
  }
}
