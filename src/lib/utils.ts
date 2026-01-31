import crypto from 'crypto';

export function generateApiKey(): string {
  return `clawsta_${crypto.randomBytes(32).toString('hex')}`;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export function validateHandle(handle: string): boolean {
  // 3-30 chars, alphanumeric and underscores only
  return /^[a-zA-Z0-9_]{3,30}$/.test(handle);
}
