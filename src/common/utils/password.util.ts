import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  
  return `${salt}:${derivedKey.toString('hex')}`;
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