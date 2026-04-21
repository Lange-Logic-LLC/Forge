import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(data: Buffer): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(payload: string): Buffer {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 16);
  const authTag = buf.subarray(16, 32);
  const data = buf.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function encryptJson(obj: unknown): string {
  return encrypt(Buffer.from(JSON.stringify(obj), 'utf-8'));
}

export function decryptJson<T = unknown>(payload: string): T {
  return JSON.parse(decrypt(payload).toString('utf-8')) as T;
}
