export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function daysAgo(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - days * DAY);
}

export function hoursAgo(hours: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - hours * HOUR);
}

export function minutesFromNow(minutes: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + minutes * MINUTE);
}

/** "3 days ago", "in 2 hours", "just now" */
export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const target = typeof date === 'string' ? new Date(date) : date;
  const diff = target.getTime() - Date.now();
  const abs = Math.abs(diff);
  const suffix = diff < 0 ? 'ago' : 'from now';

  if (abs < 45 * 1000) return 'just now';
  if (abs < HOUR) return `${Math.round(abs / MINUTE)}m ${suffix}`;
  if (abs < DAY) return `${Math.round(abs / HOUR)}h ${suffix}`;
  if (abs < 30 * DAY) return `${Math.round(abs / DAY)}d ${suffix}`;
  return target.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
