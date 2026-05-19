import { Hono } from 'hono';
import type { Env, WebhookRecord } from '../types';
import { requireAuth } from '../middleware/auth';
import { signWebhookPayload } from '../services/webhook';
import type { AuthContext } from '../middleware/auth';

const webhooks = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

// GET /v1/webhooks
webhooks.get('/', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const { results } = await c.env.DB.prepare(
    `SELECT id, url, events, enabled, created_at, updated_at FROM webhooks WHERE application_id = ?`
  ).bind(user.application_id).all() as {
    results: Array<{ id: string; url: string; events: string; enabled: number; created_at: number; updated_at: number }>
  };

  return c.json({
    webhooks: results.map(w => ({
      ...w,
      events: JSON.parse(w.events) as string[],
      enabled: w.enabled === 1,
    }))
  });
});

// POST /v1/webhooks
webhooks.post('/', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const body = await c.req.json() as { url: string; events: string[] };

  if (!body.url || !body.events?.length) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'url and events are required', status: 400 } }, 400);
  }

  const secretBytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const whId = generateId('wh');
  const now = Date.now();

  await c.env.DB.prepare(
    `INSERT INTO webhooks (id, application_id, url, events, secret, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(whId, user.application_id, body.url, JSON.stringify(body.events), secret, now, now).run();

  return c.json({
    webhook: {
      id: whId,
      url: body.url,
      events: body.events,
      secret, // Only shown on creation
      enabled: true,
      created_at: now,
    },
    warning: 'Save the signing secret now. It will not be shown again.',
  }, 201);
});

// PATCH /v1/webhooks/:id
webhooks.patch('/:id', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const whId = c.req.param('id');

  const wh = await c.env.DB.prepare(
    `SELECT id FROM webhooks WHERE id = ? AND application_id = ?`
  ).bind(whId, user.application_id).first();

  if (!wh) return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found', status: 404 } }, 404);

  const body = await c.req.json() as { url?: string; events?: string[]; enabled?: boolean };
  const updates: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [Date.now()];

  if (body.url !== undefined) { updates.push('url = ?'); values.push(body.url); }
  if (body.events !== undefined) { updates.push('events = ?'); values.push(JSON.stringify(body.events)); }
  if (body.enabled !== undefined) { updates.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }

  values.push(whId ?? '');
  await c.env.DB.prepare(`UPDATE webhooks SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await c.env.DB.prepare(`SELECT id, url, events, enabled, created_at, updated_at FROM webhooks WHERE id = ?`).bind(whId).first() as WebhookRecord;
  return c.json({ webhook: { ...updated, events: JSON.parse(updated.events) as string[], enabled: updated.enabled === 1 } });
});

// DELETE /v1/webhooks/:id
webhooks.delete('/:id', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const whId = c.req.param('id');

  const wh = await c.env.DB.prepare(
    `SELECT id FROM webhooks WHERE id = ? AND application_id = ?`
  ).bind(whId, user.application_id).first();

  if (!wh) return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found', status: 404 } }, 404);

  await c.env.DB.prepare(`DELETE FROM webhooks WHERE id = ?`).bind(whId).run();
  return c.json({ success: true });
});

// GET /v1/webhooks/:id/deliveries
webhooks.get('/:id/deliveries', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const whId = c.req.param('id');

  const wh = await c.env.DB.prepare(
    `SELECT id FROM webhooks WHERE id = ? AND application_id = ?`
  ).bind(whId, user.application_id).first();

  if (!wh) return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found', status: 404 } }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT id, event_type, response_status, delivered_at, failed_at, created_at
     FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 50`
  ).bind(whId).all();

  return c.json({ deliveries: results });
});

// POST /v1/webhooks/:id/test
webhooks.post('/:id/test', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const whId = c.req.param('id');

  const wh = await c.env.DB.prepare(
    `SELECT * FROM webhooks WHERE id = ? AND application_id = ?`
  ).bind(whId, user.application_id).first() as WebhookRecord | null;

  if (!wh) return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found', status: 404 } }, 404);

  const payload = JSON.stringify({
    type: 'test.event',
    data: { message: 'This is a test webhook delivery from LegionAuth' },
    timestamp: new Date().toISOString(),
  });

  const signature = await signWebhookPayload(payload, wh.secret);

  try {
    const response = await fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LegionAuth-Signature': `sha256=${signature}`,
        'X-LegionAuth-Event': 'test.event',
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    return c.json({
      success: response.ok,
      status: response.status,
      message: response.ok ? 'Test event delivered successfully' : `Delivery failed with status ${response.status}`,
    });
  } catch (err) {
    return c.json({
      success: false,
      message: `Delivery failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }
});

export default webhooks;
