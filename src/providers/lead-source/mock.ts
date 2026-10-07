import { randomUUID } from 'node:crypto';
import type { ExternalLead, LeadSourceProvider } from '@/providers/types';

const FIRST_NAMES = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Neha', 'Arjun', 'Kavita', 'Rohit', 'Anjali'];
const LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Mehta', 'Kapoor', 'Reddy', 'Nair', 'Singh', 'Joshi', 'Malhotra'];
const CAMPAIGNS = ['Luxury Gurgaon 3BHK', 'Gurgaon Investment Properties', 'Golf Course Road', 'New Launch Campaign'];
const AD_SETS = ['HNI | Gurgaon | 35-55', 'Investors | NCR | 30-50', 'Lookalike 1% | Buyers', 'Retargeting | Site visitors'];
const CREATIVES = ['3BHK Family Creative', 'Golf View Carousel', 'Possession Soon Video', 'Price Reveal Static'];
const FORMS = ['Gurgaon 3BHK Form', 'Site Visit Booking Form', 'Brochure Download Form'];

/**
 * Simulates Meta Lead Ads so lead ingestion works with no credentials.
 */
export class MockMetaLeadProvider implements LeadSourceProvider {
  readonly name = 'mock-meta';
  readonly isMock = true;

  async fetchLead(leadgenId: string): Promise<ExternalLead> {
    return generateLead(leadgenId);
  }

  async fetchRecentLeads(since: Date): Promise<ExternalLead[]> {
    const count = 1 + Math.floor(Math.random() * 3);
    return Array.from({ length: count }, () => {
      const lead = generateLead(`mock_lead_${randomUUID()}`);
      lead.createdAt = new Date(since.getTime() + Math.random() * (Date.now() - since.getTime()));
      return lead;
    });
  }

  verifyWebhookSignature(_rawBody: string, signatureHeader: string | null): boolean {
    return signatureHeader === 'mock-signature';
  }
}

function generateLead(externalId: string): ExternalLead {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const campaignName = pick(CAMPAIGNS);
  const adName = pick(CREATIVES);
  const formName = pick(FORMS);
  const slug = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  return {
    externalId,
    name: `${first} ${last}`,
    phone: `+9198${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    campaignName,
    adName,
    createdAt: new Date(),
    // Mirrors the shape the real Graph API returns, so the ingestion path is
    // exercised identically with and without credentials.
    attribution: {
      sourceType: 'PAID_SOCIAL',
      campaignExternalId: `camp_${hash(campaignName)}`,
      campaignName,
      adSetId: `adset_${hash(campaignName + 'set')}`,
      adSetName: pick(AD_SETS),
      adId: `ad_${hash(adName)}`,
      adName,
      formId: `form_${hash(formName)}`,
      formName,
      utmSource: 'facebook',
      utmMedium: 'paid_social',
      utmCampaign: slug,
      utmContent: adName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    },
  };
}

function hash(value: string): string {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total = (total * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(total).toString(36).slice(0, 8);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}
