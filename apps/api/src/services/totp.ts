// RFC 6238 TOTP implementation using Web Crypto HMAC-SHA1

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Uint8Array): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_CHARS[(value << (5 - bits)) & 31];
  return result;
}

function base32Decode(str: string): Uint8Array {
  const upper = str.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of upper) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

function intToBytes(n: number): Uint8Array {
  const buf = new Uint8Array(8);
  let tmp = n;
  for (let i = 7; i >= 0; i--) {
    buf[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  return buf;
}

async function hotp(secret: Uint8Array, counter: number): Promise<number> {
  const key = await crypto.subtle.importKey(
    'raw', secret,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const msg = intToBytes(counter);
  const sig = await crypto.subtle.sign('HMAC', key, msg);
  const bytes = new Uint8Array(sig);
  const offset = (bytes[19] ?? 0) & 0x0f;
  const code = (
    ((bytes[offset] ?? 0) & 0x7f) << 24 |
    ((bytes[offset + 1] ?? 0) & 0xff) << 16 |
    ((bytes[offset + 2] ?? 0) & 0xff) << 8 |
    ((bytes[offset + 3] ?? 0) & 0xff)
  ) % 1_000_000;
  return code;
}

export function generateTOTPSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

export function getTOTPUri(secret: string, email: string, issuer: string): string {
  const enc = encodeURIComponent;
  return `otpauth://totp/${enc(issuer)}:${enc(email)}?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  const secretBytes = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let delta = -1; delta <= 1; delta++) {
    const code = await hotp(secretBytes, counter + delta);
    if (code.toString().padStart(6, '0') === token.trim()) return true;
  }
  return false;
}

export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    codes.push(`${hex.slice(0, 5)}-${hex.slice(5)}`);
  }
  return codes;
}
