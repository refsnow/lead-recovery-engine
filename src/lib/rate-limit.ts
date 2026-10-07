import { RateLimitError } from '@/lib/errors';

interface Bucket { count: number; resetAt: number }

/**
 * In-memory fixed-window rate limiter. Adequate for a single-instance MVP and
 * for protecting login/webhook endpoints. For multi-instance deployments this
 * should be swapped for a shared store (Redis/Upstash) behind the same
 * `enforceRateLimit` signature.
 */
const buckets = new Map<string, Bucket>();

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new RateLimitError(Math.ceil((bucket.resetAt - now) / 1000));
  }
}

export function resetRateLimits(): void {
  buckets.clear();
}

// Bound memory growth: sweep expired buckets periodically.
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, 60_000);
  if (typeof timer.unref === 'function') timer.unref();
}
