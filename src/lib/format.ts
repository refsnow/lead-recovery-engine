/** Indian-market currency formatting: ₹1.2 Cr / ₹45 L / ₹80,000 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  if (amount >= 10_000_000) {
    const cr = amount / 10_000_000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2).replace(/0$/, '')} Cr`;
  }
  if (amount >= 100_000) {
    const lakh = amount / 100_000;
    return `₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatBudgetRange(min: number | null | undefined, max: number | null | undefined): string {
  if (!min && !max) return '—';
  if (min && max && min !== max) return `${formatINR(min)} – ${formatINR(max)}`;
  return formatINR(max ?? min);
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/** "Amit Sharma" -> "AS" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Minutes -> "2h 15m" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
