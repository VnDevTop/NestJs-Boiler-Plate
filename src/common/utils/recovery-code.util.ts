import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  HASH_PREFIX,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
} from '../constants/index.js';

// Crockford style base32 without I, L, O and U, so a code read out loud or
// copied from a printout cannot be mistyped.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(RECOVERY_CODE_LENGTH);
    let code = '';

    for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) {
      code += ALPHABET[bytes[i] % ALPHABET.length];
    }

    return code;
  });
}

/**
 * Recovery codes are bearer credentials, so they are stored the same way user
 * passwords are: salted hashes, never in the clear.
 */
export function hashRecoveryCode(code: string): string {
  const salt = randomBytes(16).toString('hex');
  const digest = createHash('sha256')
    .update(`${HASH_PREFIX}$${salt}:${code}`)
    .digest('hex');

  return `${HASH_PREFIX}$${salt}:${digest}`;
}

export function verifyRecoveryCode(code: string, stored: string): boolean {
  const separator = stored.indexOf('$');

  if (separator < 0 || stored.slice(0, separator) !== HASH_PREFIX) {
    return false;
  }

  const [salt, expected] = stored.slice(separator + 1).split(':');

  if (!salt || !expected) {
    return false;
  }

  const actual = createHash('sha256')
    .update(`${HASH_PREFIX}$${salt}:${code}`)
    .digest('hex');

  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
