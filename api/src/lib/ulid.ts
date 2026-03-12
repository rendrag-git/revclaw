/**
 * Lightweight ULID generation for Cloudflare Workers.
 * ULIDs are time-sortable, globally unique identifiers.
 *
 * Format: 10 chars timestamp (48-bit ms) + 16 chars randomness (80-bit)
 * Encoding: Crockford's Base32
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(timestamp: number, length: number): string {
  let str = '';
  for (let i = length; i > 0; i--) {
    const mod = timestamp % 32;
    str = ENCODING[mod] + str;
    timestamp = (timestamp - mod) / 32;
  }
  return str;
}

function encodeRandom(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let str = '';
  for (let i = 0; i < length; i++) {
    str += ENCODING[arr[i] % 32];
  }
  return str;
}

export function ulid(): string {
  const timestamp = Date.now();
  return encodeTime(timestamp, 10) + encodeRandom(16);
}
