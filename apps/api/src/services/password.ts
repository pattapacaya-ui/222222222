// PBKDF2 password hashing using Web Crypto API
// Format: pbkdf2:sha512:310000:${saltHex}:${hashHex}

const ITERATIONS = 310_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-512',
      salt,
      iterations: ITERATIONS,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:sha512:${ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[2] ?? '0', 10);
  const saltHex = parts[3] ?? '';
  const storedHashHex = parts[4] ?? '';
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-512',
      salt,
      iterations,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  const computedHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  // Constant-time comparison
  if (computedHex.length !== storedHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ storedHashHex.charCodeAt(i);
  }
  return diff === 0;
}

export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-1', enc.encode(password));
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!response.ok) return false;
    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [hash] = line.split(':');
      if (hash && hash.trim().toUpperCase() === suffix) return true;
    }
    return false;
  } catch {
    return false; // Don't block signup on network failure
  }
}
