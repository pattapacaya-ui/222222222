import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import type { AuthContext } from '../middleware/auth';
import { dispatchWebhook } from '../services/webhook';
import { sendEmail, orgInviteEmail } from '../services/email';

const orgs = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /v1/organizations
orgs.get('/', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const { results } = await c.env.DB.prepare(
    `SELECT o.*, om.role FROM organizations o
     JOIN organization_members om ON o.id = om.organization_id
     WHERE om.user_id = ?
     ORDER BY o.created_at DESC`
  ).bind(user.id).all() as {
    results: Array<{
      id: string; name: string; slug: string; image_url: string | null;
      public_metadata: string; created_at: number; updated_at: number; role: string;
    }>
  };

  return c.json({ organizations: results.map(o => ({
    ...o,
    public_metadata: JSON.parse(o.public_metadata ?? '{}') as Record<string, unknown>,
  })) });
});

// POST /v1/organizations
orgs.post('/', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const body = await c.req.json() as { name: string; slug?: string; image_url?: string };

  if (!body.name) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name is required', status: 400 } }, 400);
  }

  const slug = body.slug ?? slugify(body.name);
  const existing = await c.env.DB.prepare(
    `SELECT id FROM organizations WHERE application_id = ? AND slug = ?`
  ).bind(user.application_id, slug).first();

  if (existing) {
    return c.json({ error: { code: 'SLUG_TAKEN', message: 'Organization slug already taken', status: 409 } }, 409);
  }

  const orgId = generateId('org');
  const memberId = generateId('member');
  const now = Date.now();

  await c.env.DB.prepare(
    `INSERT INTO organizations (id, application_id, name, slug, image_url, public_metadata, private_metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '{}', '{}', ?, ?)`
  ).bind(orgId, user.application_id, body.name, slug, body.image_url ?? null, now, now).run();

  await c.env.DB.prepare(
    `INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at)
     VALUES (?, ?, ?, 'admin', ?, ?)`
  ).bind(memberId, orgId, user.id, now, now).run();

  await dispatchWebhook(c.env, user.application_id, 'organization.created', { id: orgId, name: body.name });

  const org = await c.env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first();
  return c.json({ organization: org }, 201);
});

// GET /v1/organizations/:id
orgs.get('/:id', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first() as { role: string } | null;

  if (!member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Organization not found', status: 404 } }, 404);
  }

  const org = await c.env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first();
  return c.json({ organization: org, membership: member });
});

// PATCH /v1/organizations/:id
orgs.patch('/:id', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first() as { role: string } | null;

  if (!member || member.role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only admins can update organizations', status: 403 } }, 403);
  }

  const body = await c.req.json() as { name?: string; image_url?: string; public_metadata?: Record<string, unknown> };
  const updates: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [Date.now()];

  if (body.name) { updates.push('name = ?'); values.push(body.name); }
  if (body.image_url !== undefined) { updates.push('image_url = ?'); values.push(body.image_url); }
  if (body.public_metadata !== undefined) { updates.push('public_metadata = ?'); values.push(JSON.stringify(body.public_metadata)); }

  values.push(orgId ?? '');
  await c.env.DB.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const org = await c.env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first();
  return c.json({ organization: org });
});

// DELETE /v1/organizations/:id
orgs.delete('/:id', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first() as { role: string } | null;

  if (!member || member.role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only admins can delete organizations', status: 403 } }, 403);
  }

  await c.env.DB.prepare(`DELETE FROM organization_members WHERE organization_id = ?`).bind(orgId).run();
  await c.env.DB.prepare(`DELETE FROM organizations WHERE id = ?`).bind(orgId).run();

  return c.json({ success: true });
});

// GET /v1/organizations/:id/members
orgs.get('/:id/members', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first();

  if (!member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Organization not found', status: 404 } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT om.id, om.role, om.created_at, om.updated_at,
            u.id as user_id, u.email, u.first_name, u.last_name, u.image_url
     FROM organization_members om
     JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = ?
     ORDER BY om.created_at ASC`
  ).bind(orgId).all();

  return c.json({ members: results });
});

// PATCH /v1/organizations/:id/members/:userId
orgs.patch('/:id/members/:userId', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first() as { role: string } | null;

  if (!member || member.role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only admins can update member roles', status: 403 } }, 403);
  }

  const body = await c.req.json() as { role: string };
  await c.env.DB.prepare(
    `UPDATE organization_members SET role = ?, updated_at = ? WHERE organization_id = ? AND user_id = ?`
  ).bind(body.role, Date.now(), orgId, targetUserId).run();

  return c.json({ success: true });
});

// DELETE /v1/organizations/:id/members/:userId
orgs.delete('/:id/members/:userId', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first() as { role: string } | null;

  if (!member || (member.role !== 'admin' && user.id !== targetUserId)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions', status: 403 } }, 403);
  }

  await c.env.DB.prepare(
    `DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, targetUserId).run();

  return c.json({ success: true });
});

// POST /v1/organizations/:id/invitations
orgs.post('/:id/invitations', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first() as { role: string } | null;

  if (!member || member.role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only admins can invite members', status: 403 } }, 403);
  }

  const body = await c.req.json() as { email: string; role?: string };
  if (!body.email) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'email is required', status: 400 } }, 400);
  }

  const org = await c.env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first() as { name: string } | null;
  if (!org) return c.json({ error: { code: 'NOT_FOUND', message: 'Organization not found', status: 404 } }, 404);

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const invId = generateId('inv');
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 3600 * 1000;

  await c.env.DB.prepare(
    `INSERT INTO organization_invitations (id, organization_id, email, role, token, status, invited_by_user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).bind(invId, orgId, body.email.toLowerCase(), body.role ?? 'member', token, user.id, expiresAt, now).run();

  const inviteUrl = `${c.env.FRONTEND_URL}/accept-invitation?token=${token}`;
  await sendEmail(c.env, {
    to: body.email,
    subject: `You've been invited to ${org.name} on LegionAuth`,
    ...orgInviteEmail(org.name, inviteUrl),
  });

  return c.json({ invitation: { id: invId, email: body.email, role: body.role ?? 'member', expires_at: expiresAt } }, 201);
});

// GET /v1/organizations/:id/invitations
orgs.get('/:id/invitations', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first() as { role: string } | null;

  if (!member) return c.json({ error: { code: 'NOT_FOUND', message: 'Organization not found', status: 404 } }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM organization_invitations WHERE organization_id = ? AND status = 'pending' AND expires_at > ?`
  ).bind(orgId, Date.now()).all();

  return c.json({ invitations: results });
});

// DELETE /v1/organizations/:id/invitations/:invitationId
orgs.delete('/:id/invitations/:invitationId', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const orgId = c.req.param('id');
  const invId = c.req.param('invitationId');

  const member = await c.env.DB.prepare(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(orgId, user.id).first() as { role: string } | null;

  if (!member || member.role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only admins can revoke invitations', status: 403 } }, 403);
  }

  await c.env.DB.prepare(
    `UPDATE organization_invitations SET status = 'revoked' WHERE id = ? AND organization_id = ?`
  ).bind(invId, orgId).run();

  return c.json({ success: true });
});

// POST /v1/organizations/accept-invitation
orgs.post('/accept-invitation', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const body = await c.req.json() as { token: string };

  if (!body.token) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'token is required', status: 400 } }, 400);
  }

  const inv = await c.env.DB.prepare(
    `SELECT * FROM organization_invitations WHERE token = ? AND status = 'pending' AND expires_at > ?`
  ).bind(body.token, Date.now()).first() as {
    id: string; organization_id: string; email: string; role: string
  } | null;

  if (!inv) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired invitation', status: 400 } }, 400);
  }

  // Check not already a member
  const existing = await c.env.DB.prepare(
    `SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ?`
  ).bind(inv.organization_id, user.id).first();

  if (existing) {
    return c.json({ error: { code: 'ALREADY_MEMBER', message: 'You are already a member of this organization', status: 409 } }, 409);
  }

  const memberId = generateId('member');
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(memberId, inv.organization_id, user.id, inv.role, now, now).run();

  await c.env.DB.prepare(
    `UPDATE organization_invitations SET status = 'accepted' WHERE id = ?`
  ).bind(inv.id).run();

  return c.json({ success: true, organization_id: inv.organization_id, role: inv.role });
});

export default orgs;
