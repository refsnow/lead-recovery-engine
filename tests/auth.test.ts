import { describe, expect, it, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';
import { can, leadVisibilityFilter, CAPABILITIES } from '@/lib/permissions';
import { enforceRateLimit, resetRateLimits } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';
import { USER_ROLES } from '@/types/domain';

describe('Password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces a different hash each time (unique salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('never stores the password in the hash', async () => {
    const hash = await hashPassword('secret-value-123');
    expect(hash).not.toContain('secret-value-123');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$abc$def')).toBe(false);
  });
});

describe('Permissions', () => {
  it('grants owners every capability', () => {
    for (const capability of Object.keys(CAPABILITIES) as (keyof typeof CAPABILITIES)[]) {
      expect(can('OWNER', capability)).toBe(true);
    }
  });

  it('withholds management capabilities from salespeople', () => {
    expect(can('SALESPERSON', 'VIEW_ALL_LEADS')).toBe(false);
    expect(can('SALESPERSON', 'ASSIGN_LEADS')).toBe(false);
    expect(can('SALESPERSON', 'MANAGE_USERS')).toBe(false);
    expect(can('SALESPERSON', 'VIEW_REVENUE')).toBe(false);
    expect(can('SALESPERSON', 'MANAGE_AUTOMATION')).toBe(false);

    // But they can do their job.
    expect(can('SALESPERSON', 'VIEW_ASSIGNED_LEADS')).toBe(true);
    expect(can('SALESPERSON', 'UPDATE_LEAD')).toBe(true);
    expect(can('SALESPERSON', 'RECORD_CONVERSION')).toBe(true);
  });

  it('gives sales managers oversight without organization administration', () => {
    expect(can('SALES_MANAGER', 'VIEW_ALL_LEADS')).toBe(true);
    expect(can('SALES_MANAGER', 'ASSIGN_LEADS')).toBe(true);
    expect(can('SALES_MANAGER', 'VIEW_TEAM')).toBe(true);
    expect(can('SALES_MANAGER', 'MANAGE_ORGANIZATION')).toBe(false);
    expect(can('SALES_MANAGER', 'MANAGE_USERS')).toBe(false);
  });

  it('reserves organization management for the owner alone', () => {
    for (const role of USER_ROLES) {
      expect(can(role, 'MANAGE_ORGANIZATION')).toBe(role === 'OWNER');
    }
  });

  it('constrains lead queries for salespeople only', () => {
    expect(leadVisibilityFilter({ id: 'u1', role: 'SALESPERSON' })).toEqual({ assignedToId: 'u1' });
    expect(leadVisibilityFilter({ id: 'u1', role: 'SALES_MANAGER' })).toEqual({});
    expect(leadVisibilityFilter({ id: 'u1', role: 'OWNER' })).toEqual({});
  });
});

describe('Rate limiting', () => {
  beforeEach(() => resetRateLimits());

  it('allows requests up to the limit and blocks beyond it', () => {
    for (let index = 0; index < 5; index += 1) {
      expect(() => enforceRateLimit('test-key', 5, 60_000)).not.toThrow();
    }
    expect(() => enforceRateLimit('test-key', 5, 60_000)).toThrow(RateLimitError);
  });

  it('tracks each key independently', () => {
    enforceRateLimit('key-a', 1, 60_000);
    expect(() => enforceRateLimit('key-b', 1, 60_000)).not.toThrow();
    expect(() => enforceRateLimit('key-a', 1, 60_000)).toThrow(RateLimitError);
  });

  it('reports how long the caller must wait', () => {
    enforceRateLimit('retry-key', 1, 60_000);
    try {
      enforceRateLimit('retry-key', 1, 60_000);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).status).toBe(429);
      expect((error as RateLimitError).details).toHaveProperty('retryAfterSeconds');
    }
  });

  it('opens a new window once the old one expires', async () => {
    enforceRateLimit('window-key', 1, 50);
    expect(() => enforceRateLimit('window-key', 1, 50)).toThrow(RateLimitError);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(() => enforceRateLimit('window-key', 1, 50)).not.toThrow();
  });
});
