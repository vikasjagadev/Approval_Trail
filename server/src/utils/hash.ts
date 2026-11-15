import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function stableJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const sortedEntries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableJson((obj as Record<string, unknown>)[key])}`
  );
  return '{' + sortedEntries.join(',') + '}';
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

