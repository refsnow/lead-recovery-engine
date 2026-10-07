import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env';
import { IntegrationError } from '@/lib/errors';
import type { ExternalLead, LeadSourceProvider } from '@/providers/types';

const GRAPH_VERSION = 'v21.0';

/**
 * Meta Lead Ads provider.
 *
 * NOT YET VERIFIED AGAINST A LIVE META APP — written to the documented Graph API
 * contract and exercised only via the mock. See README, Known Limitations.
 */
export class MetaLeadProvider implements LeadSourceProvider {
  readonly name = 'meta';
  readonly isMock = false;

  async fetchLead(leadgenId: string): Promise<ExternalLead> {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}`);
    url.searchParams.set(
      'fields',
      'id,created_time,field_data,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,form_id',
    );
    url.searchParams.set('access_token', env.leadSource.pageAccessToken);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new IntegrationError('meta', `Lead retrieval failed (HTTP ${response.status}).`, response.status >= 500);
      }
      const json = (await response.json()) as {
        id: string;
        created_time?: string;
        campaign_id?: string;
        campaign_name?: string;
        adset_id?: string;
        adset_name?: string;
        ad_id?: string;
        ad_name?: string;
        form_id?: string;
        field_data?: { name: string; values: string[] }[];
      };

      const fields = new Map((json.field_data ?? []).map((f) => [f.name, f.values[0] ?? '']));
      const name = fields.get('full_name')
        ?? [fields.get('first_name'), fields.get('last_name')].filter(Boolean).join(' ');
      const phone = fields.get('phone_number') ?? '';

      if (!name || !phone) {
        throw new IntegrationError('meta', 'Lead payload is missing a name or phone number.', false);
      }

      return {
        externalId: json.id,
        name,
        phone,
        email: fields.get('email') || undefined,
        campaignName: json.campaign_name,
        adName: json.ad_name,
        createdAt: json.created_time ? new Date(json.created_time) : new Date(),
        raw: Object.fromEntries(fields),
        attribution: {
          sourceType: 'PAID_SOCIAL',
          campaignExternalId: json.campaign_id ?? null,
          campaignName: json.campaign_name ?? null,
          adSetId: json.adset_id ?? null,
          adSetName: json.adset_name ?? null,
          adId: json.ad_id ?? null,
          adName: json.ad_name ?? null,
          formId: json.form_id ?? null,
          utmSource: 'facebook',
          utmMedium: 'paid_social',
          firstTouchAt: json.created_time ? new Date(json.created_time) : new Date(),
        },
      };
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      throw new IntegrationError('meta', (error as Error).message, true);
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchRecentLeads(): Promise<ExternalLead[]> {
    // Requires a form id per page; wired once forms are configured in Settings.
    throw new IntegrationError('meta', 'Polling requires a configured lead form. Use webhooks instead.', false);
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader || !env.leadSource.appSecret) return false;
    const expected = `sha256=${createHmac('sha256', env.leadSource.appSecret).update(rawBody, 'utf8').digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
