import type { Env, SessionRecord } from '../types';
import { signAccessToken, signRefreshToken, verifyToken } from './jwt';

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const KV_SESSION_TTL = 3600; // Cache in KV for 1h

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export async function createSession(
  env: Env,
  userId: string,
  appId: string,
  meta: { ip?: string; userAgent?: string; deviceInfo?: Record<string, unknown> }
): Promise<{ session: SessionRecord; accessToken: string; refreshToken: string }> {
  const sessionId = generateId('session');
  const refreshTokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const refreshToken = Array.from(refreshTokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL * 1000;

  const session: SessionRecord = {
    id: sessionId,
    user_id: userId,
    application_id: appId,
    refresh_token: refreshToken,
    status: 'active',
    device_info: JSON.stringify(meta.deviceInfo ?? {}),
    ip_address: meta.ip ?? null,
    user_agent: meta.userAgent ?? null,
    last_active_at: now,
    expires_at: expiresAt,
    created_at: now,
  };

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, application_id, refresh_token, status, device_info, ip_address, user_agent, last_active_at, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    session.id, session.user_id, session.application_id, session.refresh_token,
    session.status, session.device_info, session.ip_address, session.user_agent,
    session.last_active_at, session.expires_at, session.created_at
  ).run();

  // Cache in KV
  await env.SESSIONS_KV.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: KV_SESSION_TTL }
  );

  const privateKey = env.JWT_PRIVATE_KEY;
  if (!privateKey) throw new Error('JWT_PRIVATE_KEY not configured');

  const tokenPayload = {
    sub: userId,
    sid: sessionId,
    app: appId,
  };

  const accessToken = await signAccessToken(tokenPayload, privateKey);
  const refreshTokenJWT = await signRefreshToken({ ...tokenPayload, jti: refreshToken }, privateKey);

  return { session, accessToken, refreshToken: refreshTokenJWT };
}

export async function getSession(env: Env, sessionId: string): Promise<SessionRecord | null> {
  // Check KV first
  const cached = await env.SESSIONS_KV.get(`session:${sessionId}`, 'json');
  if (cached) return cached as SessionRecord;

  // Fallback to D1
  const row = await env.DB.prepare(
    `SELECT * FROM sessions WHERE id = ? AND status = 'active' AND expires_at > ?`
  ).bind(sessionId, Date.now()).first() as SessionRecord | null;

  if (row) {
    await env.SESSIONS_KV.put(`session:${sessionId}`, JSON.stringify(row), { expirationTtl: KV_SESSION_TTL });
  }

  return row;
}

export async function refreshSession(
  env: Env,
  refreshTokenJWT: string
): Promise<{ accessToken: string; refreshToken: string; session: SessionRecord } | null> {
  const publicKey = env.JWT_PUBLIC_KEY;
  if (!publicKey) return null;

  let claims: Record<string, unknown>;
  try {
    claims = await verifyToken(refreshTokenJWT, publicKey);
  } catch {
    return null;
  }

  if (claims['type'] !== 'refresh') return null;
  const jti = claims['jti'] as string;
  const sessionId = claims['sid'] as string;

  // Find session by refresh_token
  const session = await env.DB.prepare(
    `SELECT * FROM sessions WHERE id = ? AND refresh_token = ? AND status = 'active' AND expires_at > ?`
  ).bind(sessionId, jti, Date.now()).first() as SessionRecord | null;

  if (!session) return null;

  // Rotate refresh token
  const newRefreshBytes = crypto.getRandomValues(new Uint8Array(32));
  const newRefreshRaw = Array.from(newRefreshBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const now = Date.now();

  await env.DB.prepare(
    `UPDATE sessions SET refresh_token = ?, last_active_at = ? WHERE id = ?`
  ).bind(newRefreshRaw, now, session.id).run();

  // Invalidate old KV cache
  await env.SESSIONS_KV.delete(`session:${sessionId}`);

  const privateKey = env.JWT_PRIVATE_KEY!;
  const tokenPayload = { sub: session.user_id, sid: session.id, app: session.application_id };
  const accessToken = await signAccessToken(tokenPayload, privateKey);
  const newRefreshJWT = await signRefreshToken({ ...tokenPayload, jti: newRefreshRaw }, privateKey);

  const updatedSession = { ...session, refresh_token: newRefreshRaw, last_active_at: now };
  await env.SESSIONS_KV.put(`session:${sessionId}`, JSON.stringify(updatedSession), { expirationTtl: KV_SESSION_TTL });

  return { accessToken, refreshToken: newRefreshJWT, session: updatedSession };
}

export async function revokeSession(env: Env, sessionId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE sessions SET status = 'revoked' WHERE id = ?`
  ).bind(sessionId).run();
  await env.SESSIONS_KV.delete(`session:${sessionId}`);
}

export async function getUserSessions(db: D1Database, userId: string): Promise<SessionRecord[]> {
  const { results } = await db.prepare(
    `SELECT * FROM sessions WHERE user_id = ? AND status = 'active' AND expires_at > ? ORDER BY last_active_at DESC`
  ).bind(userId, Date.now()).all() as { results: SessionRecord[] };
  return results;
}

export async function revokeAllUserSessions(env: Env, userId: string, exceptSessionId?: string): Promise<void> {
  const sessions = await getUserSessions(env.DB, userId);
  for (const s of sessions) {
    if (s.id !== exceptSessionId) {
      await revokeSession(env, s.id);
    }
  }
}
