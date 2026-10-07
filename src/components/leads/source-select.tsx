'use client';

import { useState } from 'react';
import { LEAD_SOURCES } from '@/types/domain';

const LABELS: Record<string, string> = {
  META_LEAD_ADS: 'Meta Ads', GOOGLE_ADS: 'Google Ads', WEBSITE: 'Website',
  WHATSAPP: 'WhatsApp', REFERRAL: 'Referral', WALK_IN: 'Walk-in',
  ORGANIC: 'Organic', PORTAL: 'Property portal', MANUAL: 'Manual entry', OTHER: 'Other',
};

/**
 * Source picker for manual lead entry. Choosing "Other" reveals a short free-text
 * field — campaign and ad details are never required for a manually captured
 * lead, which typically has none.
 */
export function SourceSelect({ defaultValue = 'WALK_IN' }: { defaultValue?: string }) {
  const [source, setSource] = useState(defaultValue);

  return (
    <>
      <label className="block">
        <span className="label">Source *</span>
        <select
          name="source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="input mt-1"
        >
          {LEAD_SOURCES.map((option) => (
            <option key={option} value={option}>{LABELS[option] ?? option}</option>
          ))}
        </select>
      </label>

      {source === 'OTHER' ? (
        <label className="block">
          <span className="label">Describe the source *</span>
          <input
            name="sourceDetail"
            required
            maxLength={60}
            className="input mt-1"
            placeholder="Hoarding at Sector 54"
          />
        </label>
      ) : null}
    </>
  );
}
