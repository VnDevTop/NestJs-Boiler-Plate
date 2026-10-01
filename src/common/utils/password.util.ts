import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * A password to show once and hand over, for a seed that has no password of its
 * own.
 *
 * base64url rather than picking from an alphabet by `byte % length`, because
 * that would favour the first 256 % length characters. 24 characters is 144 bits,
 * far more than any human chosen password.
 */
export function generatePassword(length = 24): string {
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64url')
    .slice(0, length);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const [salt, storedHash] = passwordHash.split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const storedHashBuffer = Buffer.from(storedHash, 'hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  if (storedHashBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedHashBuffer, derivedKey);
}

/**
 * sha256 of a bearer token, for lookup by equality.
 *
 * Not a password hash and deliberately not scrypt: a reset token is 256 bits of
 * randomness, so there is nothing to brute force, and the lookup has to be an
 * indexed equality match rather than a per-row key derivation. scrypt here would
 * make every reset attempt cost a full key derivation and could not use an index.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyTokenHash(token: string, tokenHash: string): boolean {
  const expected = Buffer.from(tokenHash, 'hex');
  const actual = Buffer.from(hashToken(token), 'hex');

  // timingSafeEqual throws on a length mismatch, and a wrong length is itself an
  // answer, so the length is checked before the comparison.
  if (expected.length !== actual.length || expected.length === 0) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
