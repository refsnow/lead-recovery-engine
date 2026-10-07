import { prisma } from '@/db/client';
import type { JourneyStep, LeadAttributionInput, SourceType } from '@/types/domain';

/**
 * Lead source attribution.
 *
 * THE RULE THIS SERVICE EXISTS TO ENFORCE: first-touch attribution is durable.
 * A lead that arrives from a Meta ad and later converses on WhatsApp, books a
 * visit and converts still reports Meta Ads — with the original campaign, ad set
 * and creative — as its origin. Only `lastTouch*` moves.
 */

/** Channel category for each source. Used by reporting to group paid vs organic. */
const SOURCE_TYPE_BY_SOURCE: Record<string, SourceType> = {
  META_LEAD_ADS: 'PAID_SOCIAL',
  GOOGLE_ADS: 'PAID_SEARCH',
  WEBSITE: 'DIRECT',
  ORGANIC: 'ORGANIC',
  WHATSAPP: 'MESSAGING',
  REFERRAL: 'REFERRAL',
  WALK_IN: 'OFFLINE',
  PORTAL: 'PAID_SEARCH',
  MANUAL: 'OFFLINE',
  OTHER: 'UNKNOWN',
};

export function sourceTypeFor(source: string): SourceType {
  return SOURCE_TYPE_BY_SOURCE[source] ?? 'UNKNOWN';
}

const SOURCE_LABELS: Record<string, string> = {
  META_LEAD_ADS: 'Meta Ads',
  GOOGLE_ADS: 'Google Ads',
  WEBSITE: 'Website',
  WHATSAPP: 'WhatsApp',
  REFERRAL: 'Referral',
  WALK_IN: 'Walk-in',
  ORGANIC: 'Organic',
  PORTAL: 'Property Portal',
  MANUAL: 'Manual entry',
  OTHER: 'Other',
};

/** Display label for a source, falling back to the custom label for OTHER. */
export function sourceLabel(source: string, sourceDetail?: string | null): string {
  if (source === 'OTHER' && sourceDetail) return sourceDetail;
  return SOURCE_LABELS[source] ?? source;
}

/**
 * Writes the first-touch record for a newly created lead.
 * Idempotent: if attribution already exists it is left untouched, so a retried
 * ingestion or a redelivered webhook can never rewrite the origin.
 */
export async function recordFirstTouch(
  leadId: string,
  source: string,
  input: LeadAttributionInput = {},
): Promise<void> {
  const existing = await prisma.leadAttribution.findUnique({ where: { leadId } });
  if (existing) return;

  const firstTouchAt = input.firstTouchAt ?? new Date();

  await prisma.leadAttribution.create({
    data: {
      leadId,
      sourceType: input.sourceType ?? sourceTypeFor(source),
      campaignExternalId: input.campaignExternalId ?? null,
      campaignName: input.campaignName ?? null,
      adSetId: input.adSetId ?? null,
      adSetName: input.adSetName ?? null,
      adId: input.adId ?? null,
      adName: input.adName ?? null,
      formId: input.formId ?? null,
      formName: input.formName ?? null,
      landingPage: input.landingPage ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmContent: input.utmContent ?? null,
      utmTerm: input.utmTerm ?? null,
      referrer: input.referrer ?? null,
      firstTouchAt,
      // The first touch is also the most recent touch until something else happens.
      lastTouchSource: source,
      lastTouchCampaign: input.campaignName ?? null,
      lastTouchAt: firstTouchAt,
    },
  });
}

/**
 * Updates ONLY the last-touch fields. First-touch columns are never included in
 * this write, which is what makes the durability guarantee structural rather
 * than a matter of remembering to be careful at each call site.
 */
export async function recordLastTouch(
  leadId: string,
  source: string,
  campaignName?: string | null,
  at: Date = new Date(),
): Promise<void> {
  try {
    await prisma.leadAttribution.updateMany({
      where: { leadId },
      data: { lastTouchSource: source, lastTouchCampaign: campaignName ?? undefined, lastTouchAt: at },
    });
  } catch {
    // Attribution is descriptive, never load-bearing: a failure here must not
    // fail the interaction that triggered it.
  }
}

/** Parses UTM parameters and referrer out of a landing-page URL. */
export function parseUtmFromUrl(url: string): LeadAttributionInput {
  try {
    const parsed = new URL(url);
    const get = (key: string) => parsed.searchParams.get(key) || null;
    return {
      landingPage: `${parsed.origin}${parsed.pathname}`,
      utmSource: get('utm_source'),
      utmMedium: get('utm_medium'),
      utmCampaign: get('utm_campaign'),
      utmContent: get('utm_content'),
      utmTerm: get('utm_term'),
    };
  } catch {
    return {};
  }
}

/** Infers the source from UTM parameters when a form does not state one. */
export function sourceFromUtm(utmSource?: string | null, utmMedium?: string | null): string | null {
  const source = (utmSource ?? '').toLowerCase();
  const medium = (utmMedium ?? '').toLowerCase();

  if (/facebook|instagram|meta|fb/.test(source)) return 'META_LEAD_ADS';
  if (/google|adwords|gads/.test(source)) return medium.includes('organic') ? 'ORGANIC' : 'GOOGLE_ADS';
  if (/whatsapp/.test(source)) return 'WHATSAPP';
  if (medium.includes('referral')) return 'REFERRAL';
  if (medium.includes('organic')) return 'ORGANIC';
  if (medium.includes('cpc') || medium.includes('paid')) return 'GOOGLE_ADS';
  return null;
}

export interface AttributionSummary {
  source: string;
  sourceLabel: string;
  sourceType: SourceType;
  campaignName: string | null;
  adSetName: string | null;
  adName: string | null;
  formName: string | null;
  landingPage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  firstTouchAt: Date;
  lastTouchSource: string | null;
  lastTouchCampaign: string | null;
  lastTouchAt: Date | null;
}

interface LeadForAttribution {
  source: string;
  sourceDetail: string | null;
  adName: string | null;
  createdAt: Date;
  campaign?: { name: string } | null;
  attribution?: {
    sourceType: string;
    campaignName: string | null;
    adSetName: string | null;
    adName: string | null;
    formName: string | null;
    landingPage: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    referrer: string | null;
    firstTouchAt: Date;
    lastTouchSource: string | null;
    lastTouchCampaign: string | null;
    lastTouchAt: Date | null;
  } | null;
}

/**
 * Builds the attribution view for a lead.
 *
 * Leads created before attribution existed have no LeadAttribution row; those
 * degrade to what the Lead record itself carries (source, campaign, ad) rather
 * than showing nothing. Backwards compatibility without a backfill.
 */
export function summariseAttribution(lead: LeadForAttribution): AttributionSummary {
  const record = lead.attribution;

  return {
    source: lead.source,
    sourceLabel: sourceLabel(lead.source, lead.sourceDetail),
    sourceType: (record?.sourceType as SourceType) ?? sourceTypeFor(lead.source),
    campaignName: record?.campaignName ?? lead.campaign?.name ?? null,
    adSetName: record?.adSetName ?? null,
    adName: record?.adName ?? lead.adName ?? null,
    formName: record?.formName ?? null,
    landingPage: record?.landingPage ?? null,
    utmSource: record?.utmSource ?? null,
    utmMedium: record?.utmMedium ?? null,
    utmCampaign: record?.utmCampaign ?? null,
    utmContent: record?.utmContent ?? null,
    utmTerm: record?.utmTerm ?? null,
    referrer: record?.referrer ?? null,
    firstTouchAt: record?.firstTouchAt ?? lead.createdAt,
    lastTouchSource: record?.lastTouchSource ?? null,
    lastTouchCampaign: record?.lastTouchCampaign ?? null,
    lastTouchAt: record?.lastTouchAt ?? null,
  };
}

interface LeadForJourney {
  source: string;
  sourceDetail: string | null;
  createdAt: Date;
  firstContactedAt: Date | null;
  aiConfidence: number | null;
  assignedToId: string | null;
  status: string;
  attribution?: { formName: string | null; campaignName: string | null; firstTouchAt: Date } | null;
  conversations?: { channel: string; messages: { sender: string; createdAt: Date }[] }[];
  appointments?: { scheduledFor: Date }[];
  conversions?: { convertedAt: Date }[];
  activities?: { type: string; createdAt: Date }[];
}

/**
 * The lead's path from acquisition to outcome, as a list of reached and
 * not-yet-reached steps. Derived entirely from existing records — nothing new
 * is written to build it.
 */
export function buildJourney(lead: LeadForJourney): JourneyStep[] {
  const activityAt = (type: string) =>
    lead.activities?.find((activity) => activity.type === type)?.createdAt ?? null;

  const messages = (lead.conversations ?? []).flatMap((conversation) =>
    conversation.messages.map((message) => ({ ...message, channel: conversation.channel })),
  );
  const firstOutbound = messages.find((message) => message.sender === 'AI' || message.sender === 'SYSTEM');
  const firstSalesperson = messages.find((message) => message.sender === 'SALESPERSON');
  const appointment = lead.appointments?.[0]?.scheduledFor ?? null;
  const conversion = lead.conversions?.[0]?.convertedAt ?? null;

  const steps: JourneyStep[] = [
    {
      key: 'source',
      label: sourceLabel(lead.source, lead.sourceDetail),
      detail: lead.attribution?.campaignName ?? undefined,
      at: lead.attribution?.firstTouchAt ?? lead.createdAt,
      reached: true,
    },
    {
      key: 'form',
      label: lead.attribution?.formName ? 'Lead form' : 'Enquiry captured',
      detail: lead.attribution?.formName ?? undefined,
      at: lead.createdAt,
      reached: true,
    },
    {
      key: 'leadloop',
      label: 'Leadloop',
      detail: 'Scored and routed',
      at: lead.createdAt,
      reached: true,
    },
    {
      key: 'qualification',
      label: 'AI qualification',
      at: activityAt('AI_QUALIFICATION_COMPLETED'),
      reached: (lead.aiConfidence ?? 0) > 0 || activityAt('AI_QUALIFICATION_COMPLETED') !== null,
    },
    {
      key: 'outreach',
      label: 'First outreach',
      detail: firstOutbound?.channel,
      at: firstOutbound?.createdAt ?? lead.firstContactedAt,
      reached: firstOutbound !== undefined || lead.firstContactedAt !== null,
    },
    {
      key: 'salesperson',
      label: 'Salesperson',
      at: firstSalesperson?.createdAt ?? activityAt('LEAD_ASSIGNED'),
      reached: lead.assignedToId !== null,
    },
    {
      key: 'appointment',
      label: 'Appointment',
      at: appointment,
      reached: appointment !== null,
    },
    {
      key: 'conversion',
      label: 'Conversion',
      at: conversion,
      reached: conversion !== null || lead.status === 'WON',
    },
  ];

  return steps;
}
