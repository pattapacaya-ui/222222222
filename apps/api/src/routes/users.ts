import { Hono } from 'hono';
import type { Env, UserRecord, SessionRecord } from '../types';
import { requireAuth } from '../middleware/auth';
import { revokeSession, getUserSessions, revokeAllUserSessions } from '../services/session';
import { dispatchWebhook } from '../services/webhook';
import type { AuthContext } from '../middleware/auth';

const users = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

function safeUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    image_url: user.image_url,
    email_verified: user.email_verified === 1,
    phone_verified: user.phone_verified === 1,
    banned: user.banned === 1,
    last_sign_in_at: user.last_sign_in_at,
    public_metadata: JSON.parse(user.public_metadata ?? '{}') as Record<string, unknown>,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

// GET /v1/users/me
users.get('/me', requireAuth, async (c) => {
  const { user } = c.get('auth');
  return c.json({ user: safeUser(user) });
});

// PATCH /v1/users/me
users.patch('/me', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const body = await c.req.json() as {
    first_name?: string;
    last_name?: string;
    username?: string;
    image_url?: string;
    public_metadata?: Record<string, unknown>;
    unsafe_metadata?: Record<string, unknown>;
  };

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.first_name !== undefined) { updates.push('first_name = ?'); values.push(body.first_name); }
  if (body.last_name !== undefined) { updates.push('last_name = ?'); values.push(body.last_name); }
  if (body.username !== undefined) { updates.push('username = ?'); values.push(body.username); }
  if (body.image_url !== undefined) { updates.push('image_url = ?'); values.push(body.image_url); }
  if (body.public_metadata !== undefined) { updates.push('public_metadata = ?'); values.push(JSON.stringify(body.public_metadata)); }
  if (body.unsafe_metadata !== undefined) { updates.push('unsafe_metadata = ?'); values.push(JSON.stringify(body.unsafe_metadata)); }

  if (updates.length === 0) {
    return c.json({ user: safeUser(user) });
  }

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(user.id);

  await c.env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(user.id).first() as UserRecord;
  await dispatchWebhook(c.env, user.application_id, 'user.updated', safeUser(updated));

  return c.json({ user: safeUser(updated) });
});

// DELETE /v1/users/me
users.delete('/me', requireAuth, async (c) => {
  const { user } = c.get('auth');
  await revokeAllUserSessions(c.env, user.id);
  await c.env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id).run();
  await dispatchWebhook(c.env, user.application_id, 'user.deleted', { id: user.id });
  return c.json({ success: true, message: 'Account deleted' });
});

// GET /v1/users/me/sessions
users.get('/me/sessions', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const sessions = await getUserSessions(c.env.DB, user.id);
  return c.json({ sessions: sessions.map(s => ({
    id: s.id,
    status: s.status,
    ip_address: s.ip_address,
    user_agent: s.user_agent,
    device_info: JSON.parse(s.device_info ?? '{}') as Record<string, unknown>,
    last_active_at: s.last_active_at,
    expires_at: s.expires_at,
    created_at: s.created_at,
  })) });
});

// DELETE /v1/users/me/sessions/:id
users.delete('/me/sessions/:id', requireAuth, async (c) => {
  const { user, session: currentSession } = c.get('auth');
  const sessionId = c.req.param('id');

  // Verify session belongs to user
  const session = await c.env.DB.prepare(
    `SELECT id FROM sessions WHERE id = ? AND user_id = ?`
  ).bind(sessionId, user.id).first() as SessionRecord | null;

  if (!session) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found', status: 404 } }, 404);
  }

  await revokeSession(c.env, sessionId ?? '');
  return c.json({ success: true });
});

// DELETE /v1/users/me/sessions (revoke all except current)
users.delete('/me/sessions', requireAuth, async (c) => {
  const { user, session: currentSession } = c.get('auth');
  await revokeAllUserSessions(c.env, user.id, currentSession.id);
  return c.json({ success: true, message: 'All other sessions revoked' });
});

// GET /v1/users/me/oauth-connections
users.get('/me/oauth-connections', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const { results } = await c.env.DB.prepare(
    `SELECT id, provider, email, created_at FROM oauth_connections WHERE user_id = ?`
  ).bind(user.id).all() as { results: Array<{ id: string; provider: string; email: string | null; created_at: number }> };

  return c.json({ connections: results });
});

// DELETE /v1/users/me/oauth-connections/:provider
users.delete('/me/oauth-connections/:provider', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const provider = c.req.param('provider');
  await c.env.DB.prepare(
    `DELETE FROM oauth_connections WHERE user_id = ? AND provider = ?`
  ).bind(user.id, provider).run();
  return c.json({ success: true });
});

export default users;
