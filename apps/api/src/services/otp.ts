import type { D1Database } from '@cloudflare/workers-types';

export function generateOTP(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = (bytes[0]! << 24 | bytes[1]! << 16 | bytes[2]! << 8 | bytes[3]!) >>> 0;
  return (num % 1_000_000).toString().padStart(6, '0');
}

export async function storeOTP(
  db: D1Database,
  opts: {
    userId?: string;
    applicationId: string;
    email?: string;
    phone?: string;
    type: string;
    ttlSeconds?: number;
  }
): Promise<string> {
  const token = generateOTP();
  const now = Date.now();
  const ttl = opts.ttlSeconds ?? 600; // 10 min default
  const id = `vt_${crypto.randomUUID().replace(/-/g, '')}`;
  await db.prepare(
    `INSERT INTO verification_tokens (id, user_id, application_id, email, phone, token, type, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    opts.userId ?? null,
    opts.applicationId,
    opts.email ?? null,
    opts.phone ?? null,
    token,
    opts.type,
    now + ttl * 1000,
    now
  ).run();
  return token;
}

export async function verifyOTP(
  db: D1Database,
  token: string,
  type: string,
  email?: string
): Promise<{ valid: boolean; userId?: string; email?: string }> {
  const now = Date.now();
  let row: { id: string; user_id: string | null; email: string | null; used_at: number | null } | null;

  if (email) {
    row = await db.prepare(
      `SELECT id, user_id, email, used_at FROM verification_tokens
       WHERE token = ? AND type = ? AND email = ? AND expires_at > ? AND used_at IS NULL`
    ).bind(token, type, email, now).first() as typeof row;
  } else {
    row = await db.prepare(
      `SELECT id, user_id, email, used_at FROM verification_tokens
       WHERE token = ? AND type = ? AND expires_at > ? AND used_at IS NULL`
    ).bind(token, type, now).first() as typeof row;
  }

  if (!row) return { valid: false };

  await db.prepare(
    `UPDATE verification_tokens SET used_at = ? WHERE id = ?`
  ).bind(now, row.id).run();

  return {
    valid: true,
    userId: row.user_id ?? undefined,
    email: row.email ?? undefined,
  };
}

export async function storeToken(
  db: D1Database,
  opts: {
    userId?: string;
    applicationId: string;
    email?: string;
    type: string;
    ttlSeconds: number;
  }
): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  const id = `vt_${crypto.randomUUID().replace(/-/g, '')}`;
  await db.prepare(
    `INSERT INTO verification_tokens (id, user_id, application_id, email, phone, token, type, expires_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`
  ).bind(
    id,
    opts.userId ?? null,
    opts.applicationId,
    opts.email ?? null,
    token,
    opts.type,
    now + opts.ttlSeconds * 1000,
    now
  ).run();
  return token;
}

export async function verifyToken(
  db: D1Database,
  token: string,
  type: string
): Promise<{ valid: boolean; userId?: string; email?: string }> {
  const now = Date.now();
  const row = await db.prepare(
    `SELECT id, user_id, email FROM verification_tokens
     WHERE token = ? AND type = ? AND expires_at > ? AND used_at IS NULL`
  ).bind(token, type, now).first() as { id: string; user_id: string | null; email: string | null } | null;

  if (!row) return { valid: false };

  await db.prepare(
    `UPDATE verification_tokens SET used_at = ? WHERE id = ?`
  ).bind(now, row.id).run();

  return {
    valid: true,
    userId: row.user_id ?? undefined,
    email: row.email ?? undefined,
  };
}
