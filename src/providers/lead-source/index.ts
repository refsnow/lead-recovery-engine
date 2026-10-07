import { env } from '@/config/env';
import type { LeadSourceProvider } from '@/providers/types';
import { MockMetaLeadProvider } from '@/providers/lead-source/mock';
import { MetaLeadProvider } from '@/providers/lead-source/meta';

let cached: LeadSourceProvider | null = null;

export function getLeadSourceProvider(): LeadSourceProvider {
  if (cached) return cached;
  const configured = env.leadSource.provider === 'meta' && env.leadSource.pageAccessToken;
  cached = configured ? new MetaLeadProvider() : new MockMetaLeadProvider();
  return cached;
}

export function resetLeadSourceProvider(): void {
  cached = null;
}
