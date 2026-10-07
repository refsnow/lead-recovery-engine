import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string, salt: Buffer, keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * scrypt password hashing. Format: scrypt$<saltHex>$<hashHex>
 * scrypt is memory-hard and ships with Node, avoiding a native bcrypt build.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  // Length check first: timingSafeEqual throws on mismatched lengths.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
