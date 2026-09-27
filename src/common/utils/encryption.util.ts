import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Encryption key must be ${KEY_LENGTH} bytes, received ${key.length}`,
    );
  }
}

/**
 * Authenticated encryption for secrets that must survive a database leak.
 * The auth tag is verified on decrypt, so tampered rows fail loudly instead of
 * returning garbage.
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedValue {
  assertKey(key);

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decrypt(value: EncryptedValue, key: Buffer): string {
  assertKey(key);

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(value.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Derives a stable 32 byte key from any passphrase, so operators can put a
 * readable secret in the environment instead of raw key bytes.
 */
export function deriveKey(passphrase: string): Buffer {
  return createHash('sha256').update(passphrase, 'utf8').digest();
}
