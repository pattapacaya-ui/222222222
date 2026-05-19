import type { Env } from '../types';

const ALG = 'RS256';
const ACCESS_TOKEN_TTL = 60; // 60 seconds
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '=='.slice((b64.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export async function generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;
  const privateBuf = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const publicBuf = await crypto.subtle.exportKey('spki', pair.publicKey);
  const privateKey = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(privateBuf as ArrayBuffer))).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  const publicKey = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(publicBuf as ArrayBuffer))).match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`;
  return { privateKey, publicKey };
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify']
  );
}

async function signJWT(payload: Record<string, unknown>, privateKeyPem: string, expiresIn: number): Promise<string> {
  const header = { alg: ALG, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + expiresIn };
  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importPrivateKey(privateKeyPem);
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const sigB64 = base64urlEncode(sigBuf);
  return `${signingInput}.${sigB64}`;
}

export async function signAccessToken(payload: Record<string, unknown>, privateKey: string): Promise<string> {
  return signJWT({ ...payload, type: 'access' }, privateKey, ACCESS_TOKEN_TTL);
}

export async function signRefreshToken(payload: Record<string, unknown>, privateKey: string): Promise<string> {
  return signJWT({ ...payload, type: 'refresh' }, privateKey, REFRESH_TOKEN_TTL);
}

export async function verifyToken(token: string, publicKeyPem: string): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = base64urlDecode(sigB64);
  const key = await importPublicKey(publicKeyPem);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, new TextEncoder().encode(signingInput));
  if (!valid) throw new Error('Invalid JWT signature');
  const claims = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims['exp'] === 'number' && claims['exp'] < now) throw new Error('JWT expired');
  return claims;
}

export async function getJWKS(env: Env): Promise<{ keys: unknown[] }> {
  const cached = await env.JWKS_KV.get('jwks', 'json');
  if (cached) return cached as { keys: unknown[] };

  if (!env.JWT_PUBLIC_KEY) {
    return { keys: [] };
  }

  const key = await importPublicKey(env.JWT_PUBLIC_KEY);
  const jwk = await crypto.subtle.exportKey('jwk', key) as unknown as Record<string, unknown>;
  jwk['use'] = 'sig';
  jwk['alg'] = ALG;
  jwk['kid'] = 'legionauth-key-1';
  const jwks = { keys: [jwk] };
  await env.JWKS_KV.put('jwks', JSON.stringify(jwks), { expirationTtl: 86400 });
  return jwks;
}
