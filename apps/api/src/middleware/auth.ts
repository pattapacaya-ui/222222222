import type { Env, UserRecord, SessionRecord } from '../types';
import type { Context, Next } from 'hono';
import { verifyToken } from '../services/jwt';
import { getSession } from '../services/session';

export interface AuthContext {
  user: UserRecord;
  session: SessionRecord;
}

export const requireAuth = async (
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header', status: 401 } }, 401);
  }

  const token = authHeader.slice(7);
  const publicKey = c.env.JWT_PUBLIC_KEY;

  if (!publicKey) {
    return c.json({ error: { code: 'SERVER_ERROR', message: 'JWT not configured', status: 500 } }, 500);
  }

  let claims: Record<string, unknown>;
  try {
    claims = await verifyToken(token, publicKey);
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token', status: 401 } }, 401);
  }

  if (claims['type'] !== 'access') {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token type', status: 401 } }, 401);
  }

  const sessionId = claims['sid'] as string;
  const userId = claims['sub'] as string;

  const session = await getSession(c.env, sessionId);
  if (!session || session.status !== 'active') {
    return c.json({ error: { code: 'SESSION_EXPIRED', message: 'Session has been revoked or expired', status: 401 } }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE id = ? AND banned = 0`
  ).bind(userId).first() as UserRecord | null;

  if (!user) {
    return c.json({ error: { code: 'USER_NOT_FOUND', message: 'User not found or banned', status: 401 } }, 401);
  }

  // Update last_active_at
  await c.env.DB.prepare(
    `UPDATE sessions SET last_active_at = ? WHERE id = ?`
  ).bind(Date.now(), sessionId).run();

  c.set('auth', { user, session });
  await next();
};

export const requireAdminKey = async (
  c: Context<{ Bindings: Env }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization');
  const key = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!key) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization', status: 401 } }, 401);
  }

  // Compute HMAC-SHA256 hash of the key
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(key));
  const keyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const apiKey = await c.env.DB.prepare(
    `SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`
  ).bind(keyHash).first() as { id: string; user_id: string; application_id: string } | null;

  if (!apiKey) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key', status: 401 } }, 401);
  }

  // Update last_used_at
  await c.env.DB.prepare(
    `UPDATE api_keys SET last_used_at = ? WHERE id = ?`
  ).bind(Date.now(), apiKey.id).run();

  await next();
};
