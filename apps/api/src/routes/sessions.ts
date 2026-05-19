import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { getUserSessions, revokeSession } from '../services/session';
import type { AuthContext } from '../middleware/auth';

const sessions = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// GET /v1/sessions
sessions.get('/', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const userSessions = await getUserSessions(c.env.DB, user.id);
  return c.json({
    sessions: userSessions.map(s => ({
      id: s.id,
      status: s.status,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      last_active_at: s.last_active_at,
      expires_at: s.expires_at,
      created_at: s.created_at,
    }))
  });
});

// DELETE /v1/sessions/:id
sessions.delete('/:id', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const sessionId = c.req.param('id');

  const session = await c.env.DB.prepare(
    `SELECT id FROM sessions WHERE id = ? AND user_id = ?`
  ).bind(sessionId, user.id).first();

  if (!session) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found', status: 404 } }, 404);
  }

  await revokeSession(c.env, sessionId ?? '');
  return c.json({ success: true });
});

export default sessions;
