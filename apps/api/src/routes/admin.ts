import { Hono } from 'hono';
import type { Env, UserRecord, SessionRecord } from '../types';
import { requireAdminKey } from '../middleware/auth';
import { revokeSession } from '../services/session';

const admin = new Hono<{ Bindings: Env }>();

// GET /v1/admin/users
admin.get('/users', requireAdminKey, async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const offset = (page - 1) * limit;
  const search = c.req.query('search');
  const status = c.req.query('status'); // 'banned', 'active'

  let query = `SELECT * FROM users`;
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (search) {
    conditions.push(`(email LIKE ? OR username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (status === 'banned') { conditions.push('banned = 1'); }
  else if (status === 'active') { conditions.push('banned = 0'); }

  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all() as { results: UserRecord[] };

  // Count
  let countQuery = `SELECT COUNT(*) as total FROM users`;
  const countParams: (string | number)[] = [];
  const countConditions: string[] = [];
  if (search) {
    countConditions.push(`(email LIKE ? OR username LIKE ?)`);
    countParams.push(`%${search}%`, `%${search}%`);
  }
  if (status === 'banned') countConditions.push('banned = 1');
  else if (status === 'active') countConditions.push('banned = 0');
  if (countConditions.length) countQuery += ` WHERE ${countConditions.join(' AND ')}`;
  const countRow = await c.env.DB.prepare(countQuery).bind(...countParams).first() as { total: number };

  return c.json({
    users: results.map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      image_url: u.image_url,
      email_verified: u.email_verified === 1,
      banned: u.banned === 1,
      last_sign_in_at: u.last_sign_in_at,
      created_at: u.created_at,
      application_id: u.application_id,
    })),
    pagination: { page, limit, total: countRow?.total ?? 0, pages: Math.ceil((countRow?.total ?? 0) / limit) },
  });
});

// GET /v1/admin/users/:id
admin.get('/users/:id', requireAdminKey, async (c) => {
  const userId = c.req.param('id');
  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first() as UserRecord | null;
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found', status: 404 } }, 404);
  return c.json({ user });
});

// PATCH /v1/admin/users/:id
admin.patch('/users/:id', requireAdminKey, async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json() as {
    first_name?: string; last_name?: string; email?: string;
    public_metadata?: Record<string, unknown>; private_metadata?: Record<string, unknown>;
  };

  const updates: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [Date.now()];

  if (body.first_name !== undefined) { updates.push('first_name = ?'); values.push(body.first_name); }
  if (body.last_name !== undefined) { updates.push('last_name = ?'); values.push(body.last_name); }
  if (body.email !== undefined) { updates.push('email = ?'); values.push(body.email); }
  if (body.public_metadata !== undefined) { updates.push('public_metadata = ?'); values.push(JSON.stringify(body.public_metadata)); }
  if (body.private_metadata !== undefined) { updates.push('private_metadata = ?'); values.push(JSON.stringify(body.private_metadata)); }

  values.push(userId ?? '');
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first() as UserRecord;
  return c.json({ user });
});

// DELETE /v1/admin/users/:id
admin.delete('/users/:id', requireAdminKey, async (c) => {
  const userId = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
  await c.env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
  return c.json({ success: true });
});

// POST /v1/admin/users/:id/ban
admin.post('/users/:id/ban', requireAdminKey, async (c) => {
  const userId = c.req.param('id');
  await c.env.DB.prepare(`UPDATE users SET banned = 1, updated_at = ? WHERE id = ?`).bind(Date.now(), userId).run();
  // Revoke all sessions
  const { results } = await c.env.DB.prepare(
    `SELECT id FROM sessions WHERE user_id = ? AND status = 'active'`
  ).bind(userId).all() as { results: Array<{ id: string }> };
  for (const s of results) await revokeSession(c.env, s.id);
  return c.json({ success: true });
});

// POST /v1/admin/users/:id/unban
admin.post('/users/:id/unban', requireAdminKey, async (c) => {
  const userId = c.req.param('id');
  await c.env.DB.prepare(`UPDATE users SET banned = 0, updated_at = ? WHERE id = ?`).bind(Date.now(), userId).run();
  return c.json({ success: true });
});

// GET /v1/admin/sessions
admin.get('/sessions', requireAdminKey, async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const offset = (page - 1) * limit;

  const { results } = await c.env.DB.prepare(
    `SELECT s.*, u.email, u.first_name, u.last_name FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.status = 'active' AND s.expires_at > ?
     ORDER BY s.last_active_at DESC LIMIT ? OFFSET ?`
  ).bind(Date.now(), limit, offset).all() as { results: Array<SessionRecord & { email: string; first_name: string; last_name: string }> };

  return c.json({ sessions: results });
});

// DELETE /v1/admin/sessions/:id
admin.delete('/sessions/:id', requireAdminKey, async (c) => {
  const sessionId = c.req.param('id');
  await revokeSession(c.env, sessionId ?? '');
  return c.json({ success: true });
});

// GET /v1/admin/stats
admin.get('/stats', requireAdminKey, async (c) => {
  const [userCount, sessionCount, orgCount, keyCount] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM users`).first() as Promise<{ count: number }>,
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM sessions WHERE status = 'active' AND expires_at > ?`).bind(Date.now()).first() as Promise<{ count: number }>,
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM organizations`).first() as Promise<{ count: number }>,
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM api_keys WHERE revoked_at IS NULL`).first() as Promise<{ count: number }>,
  ]);

  const recentSignins = await c.env.DB.prepare(
    `SELECT u.email, u.first_name, u.last_name, s.created_at, s.ip_address
     FROM sessions s JOIN users u ON s.user_id = u.id
     ORDER BY s.created_at DESC LIMIT 10`
  ).all();

  return c.json({
    stats: {
      total_users: userCount?.count ?? 0,
      active_sessions: sessionCount?.count ?? 0,
      total_organizations: orgCount?.count ?? 0,
      active_api_keys: keyCount?.count ?? 0,
    },
    recent_signins: recentSignins.results,
  });
});

export default admin;
