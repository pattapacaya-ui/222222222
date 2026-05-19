import { Hono } from 'hono';
import type { Env, APIKeyRecord } from '../types';
import { requireAuth } from '../middleware/auth';
import type { AuthContext } from '../middleware/auth';

const apiKeys = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

// GET /v1/api-keys
apiKeys.get('/', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, key_prefix, last_used_at, expires_at, revoked_at, created_at
     FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`
  ).bind(user.id).all() as { results: Array<Omit<APIKeyRecord, 'key_hash' | 'user_id' | 'application_id'>> };

  return c.json({ api_keys: results });
});

// POST /v1/api-keys
apiKeys.post('/', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const body = await c.req.json() as { name: string; expires_in_days?: number };

  if (!body.name) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name is required', status: 400 } }, 400);
  }

  // Generate key: la_live_<32 random bytes hex>
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const fullKey = `la_live_${keyHex}`;
  const keyPrefix = `la_live_${keyHex.slice(0, 8)}...`;

  // Hash the key for storage
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(fullKey));
  const keyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const keyId = generateId('key');
  const now = Date.now();
  const expiresAt = body.expires_in_days ? now + body.expires_in_days * 86400000 : null;

  await c.env.DB.prepare(
    `INSERT INTO api_keys (id, user_id, application_id, name, key_hash, key_prefix, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(keyId, user.id, user.application_id, body.name, keyHash, keyPrefix, expiresAt, now).run();

  return c.json({
    api_key: {
      id: keyId,
      name: body.name,
      key: fullKey, // Only shown ONCE
      key_prefix: keyPrefix,
      expires_at: expiresAt,
      created_at: now,
    },
    warning: 'Save this key now. It will not be shown again.',
  }, 201);
});

// DELETE /v1/api-keys/:id
apiKeys.delete('/:id', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const keyId = c.req.param('id');

  const key = await c.env.DB.prepare(
    `SELECT id FROM api_keys WHERE id = ? AND user_id = ?`
  ).bind(keyId, user.id).first();

  if (!key) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'API key not found', status: 404 } }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE api_keys SET revoked_at = ? WHERE id = ?`
  ).bind(Date.now(), keyId).run();

  return c.json({ success: true });
});

export default apiKeys;
