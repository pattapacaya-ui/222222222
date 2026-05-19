import { Hono } from 'hono';
import type { Env, UserRecord } from '../types';
import { hashPassword, verifyPassword, isPasswordBreached } from '../services/password';
import { createSession, revokeSession, revokeAllUserSessions, refreshSession } from '../services/session';
import { storeOTP, verifyOTP, storeToken, verifyToken } from '../services/otp';
import { sendEmail, magicLinkEmail, otpEmail, welcomeEmail, passwordResetEmail } from '../services/email';
import { generateTOTPSecret, getTOTPUri, verifyTOTP, generateBackupCodes } from '../services/totp';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/ratelimit';
import { dispatchWebhook } from '../services/webhook';
import type { AuthContext } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// Default app ID for platform sign-ins
const PLATFORM_APP_ID = 'app_platform';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

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
    public_metadata: JSON.parse(user.public_metadata ?? '{}'),
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

async function ensurePlatformApp(env: Env): Promise<void> {
  const existing = await env.DB.prepare(
    `SELECT id FROM applications WHERE id = ?`
  ).bind(PLATFORM_APP_ID).first();
  if (!existing) {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO applications (id, name, publishable_key, secret_key_hash, allowed_origins, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      PLATFORM_APP_ID, 'LegionAuth Platform', 'la_pub_platform',
      'platform', '["*"]', '{}', now, now
    ).run();
  }
}

// POST /v1/auth/sign-up
auth.post('/sign-up', rateLimit('signup', 10, 3600), async (c) => {
  await ensurePlatformApp(c.env);
  const body = await c.req.json() as {
    email: string; password: string;
    first_name?: string; last_name?: string; username?: string;
    application_id?: string;
  };

  if (!body.email || !body.password) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required', status: 400 } }, 400);
  }

  if (body.password.length < 8) {
    return c.json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters', status: 400 } }, 400);
  }

  const appId = body.application_id ?? PLATFORM_APP_ID;

  // Check if email exists
  const existing = await c.env.DB.prepare(
    `SELECT id FROM users WHERE application_id = ? AND email = ?`
  ).bind(appId, body.email.toLowerCase()).first();

  if (existing) {
    return c.json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists', status: 409 } }, 409);
  }

  // Check password breach
  const breached = await isPasswordBreached(body.password);
  if (breached) {
    return c.json({ error: { code: 'PASSWORD_BREACHED', message: 'This password has appeared in data breaches. Please choose a different password.', status: 400 } }, 400);
  }

  const passwordHash = await hashPassword(body.password);
  const userId = generateId('user');
  const now = Date.now();

  await c.env.DB.prepare(
    `INSERT INTO users (id, application_id, email, first_name, last_name, username, password_hash, email_verified, phone_verified, banned, public_metadata, private_metadata, unsafe_metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, '{}', '{}', '{}', ?, ?)`
  ).bind(
    userId, appId, body.email.toLowerCase(),
    body.first_name ?? null, body.last_name ?? null, body.username ?? null,
    passwordHash, now, now
  ).run();

  const ip = c.req.header('CF-Connecting-IP') ?? undefined;
  const ua = c.req.header('User-Agent') ?? undefined;
  const { session, accessToken, refreshToken } = await createSession(c.env, userId, appId, { ip, userAgent: ua });

  // Send verification email
  const verifyToken2 = await storeToken(c.env.DB, {
    userId, applicationId: appId, email: body.email.toLowerCase(),
    type: 'email_verification', ttlSeconds: 86400
  });
  const verifyUrl = `${c.env.FRONTEND_URL}/verify-email?token=${verifyToken2}`;
  await sendEmail(c.env, {
    to: body.email,
    subject: 'Verify your email - LegionAuth',
    ...magicLinkEmail(verifyUrl),
  });

  // Welcome email
  const name = body.first_name ?? body.email.split('@')[0] ?? 'there';
  await sendEmail(c.env, {
    to: body.email,
    subject: 'Welcome to LegionAuth!',
    ...welcomeEmail(name),
  });

  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first() as UserRecord;

  // Audit log
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, application_id, user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(generateId('al'), appId, userId, 'user.created', 'user', userId, '{}', ip ?? null, ua ?? null, now).run();

  await dispatchWebhook(c.env, appId, 'user.created', safeUser(user));

  return c.json({
    user: safeUser(user),
    session: { id: session.id, expires_at: session.expires_at },
    access_token: accessToken,
    refresh_token: refreshToken,
  }, 201);
});

// POST /v1/auth/sign-in
auth.post('/sign-in', rateLimit('signin', 5, 60), async (c) => {
  await ensurePlatformApp(c.env);
  const body = await c.req.json() as {
    email: string; password: string; totp_code?: string; application_id?: string;
  };

  if (!body.email || !body.password) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required', status: 400 } }, 400);
  }

  const appId = body.application_id ?? PLATFORM_APP_ID;
  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE application_id = ? AND email = ?`
  ).bind(appId, body.email.toLowerCase()).first() as UserRecord | null;

  if (!user) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', status: 401 } }, 401);
  }

  if (user.banned) {
    return c.json({ error: { code: 'USER_BANNED', message: 'Your account has been suspended', status: 403 } }, 403);
  }

  if (!user.password_hash) {
    return c.json({ error: { code: 'NO_PASSWORD', message: 'This account does not have a password set. Try signing in with a social provider.', status: 400 } }, 400);
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', status: 401 } }, 401);
  }

  // Check MFA
  const mfa = await c.env.DB.prepare(
    `SELECT * FROM mfa_configs WHERE user_id = ?`
  ).bind(user.id).first() as { totp_enabled: number; totp_secret: string | null; backup_codes: string } | null;

  if (mfa?.totp_enabled) {
    if (!body.totp_code) {
      return c.json({ error: { code: 'MFA_REQUIRED', message: 'Two-factor authentication code required', status: 400 }, mfa_required: true }, 400);
    }

    let mfaValid = false;
    if (mfa.totp_secret) {
      mfaValid = await verifyTOTP(body.totp_code, mfa.totp_secret);
    }

    if (!mfaValid) {
      // Check backup codes
      let codes: string[] = [];
      try { codes = JSON.parse(mfa.backup_codes) as string[]; } catch { /* */ }
      const codeIdx = codes.indexOf(body.totp_code);
      if (codeIdx !== -1) {
        codes.splice(codeIdx, 1);
        await c.env.DB.prepare(`UPDATE mfa_configs SET backup_codes = ? WHERE user_id = ?`)
          .bind(JSON.stringify(codes), user.id).run();
        mfaValid = true;
      }
    }

    if (!mfaValid) {
      return c.json({ error: { code: 'INVALID_MFA_CODE', message: 'Invalid two-factor authentication code', status: 401 } }, 401);
    }
  }

  const ip = c.req.header('CF-Connecting-IP') ?? undefined;
  const ua = c.req.header('User-Agent') ?? undefined;
  const { session, accessToken, refreshToken } = await createSession(c.env, user.id, appId, { ip, userAgent: ua });

  const now = Date.now();
  await c.env.DB.prepare(`UPDATE users SET last_sign_in_at = ? WHERE id = ?`).bind(now, user.id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, application_id, user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(generateId('al'), appId, user.id, 'user.signed_in', 'user', user.id, '{}', ip ?? null, ua ?? null, now).run();

  await dispatchWebhook(c.env, appId, 'session.created', { user_id: user.id, session_id: session.id });

  const updatedUser = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(user.id).first() as UserRecord;

  return c.json({
    user: safeUser(updatedUser),
    session: { id: session.id, expires_at: session.expires_at },
    access_token: accessToken,
    refresh_token: refreshToken,
  });
});

// POST /v1/auth/sign-out
auth.post('/sign-out', requireAuth, async (c) => {
  const { session } = c.get('auth');
  await revokeSession(c.env, session.id);
  await dispatchWebhook(c.env, session.application_id, 'session.ended', { session_id: session.id });
  return c.json({ success: true });
});

// POST /v1/auth/refresh
auth.post('/refresh', async (c) => {
  const body = await c.req.json() as { refresh_token: string };
  if (!body.refresh_token) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'refresh_token is required', status: 400 } }, 400);
  }

  const result = await refreshSession(c.env, body.refresh_token);
  if (!result) {
    return c.json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token', status: 401 } }, 401);
  }

  return c.json({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
    session: { id: result.session.id, expires_at: result.session.expires_at },
  });
});

// POST /v1/auth/magic-link/send
auth.post('/magic-link/send', rateLimit('magic-link', 5, 3600), async (c) => {
  await ensurePlatformApp(c.env);
  const body = await c.req.json() as { email: string; application_id?: string };
  if (!body.email) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required', status: 400 } }, 400);
  }

  const appId = body.application_id ?? PLATFORM_APP_ID;
  const token = await storeToken(c.env.DB, {
    applicationId: appId, email: body.email.toLowerCase(),
    type: 'magic_link', ttlSeconds: 900 // 15 min
  });

  const url = `${c.env.FRONTEND_URL}/auth/magic-link?token=${token}`;
  await sendEmail(c.env, {
    to: body.email,
    subject: 'Your magic sign-in link - LegionAuth',
    ...magicLinkEmail(url),
  });

  return c.json({ success: true, message: 'Magic link sent to your email' });
});

// POST /v1/auth/magic-link/verify
auth.post('/magic-link/verify', async (c) => {
  await ensurePlatformApp(c.env);
  const body = await c.req.json() as { token: string; application_id?: string };
  if (!body.token) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Token is required', status: 400 } }, 400);
  }

  const appId = body.application_id ?? PLATFORM_APP_ID;
  const result = await verifyToken(c.env.DB, body.token, 'magic_link');
  if (!result.valid) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired magic link', status: 400 } }, 400);
  }

  const email = result.email!;
  let user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE application_id = ? AND email = ?`
  ).bind(appId, email).first() as UserRecord | null;

  const now = Date.now();
  if (!user) {
    const userId = generateId('user');
    await c.env.DB.prepare(
      `INSERT INTO users (id, application_id, email, email_verified, phone_verified, banned, public_metadata, private_metadata, unsafe_metadata, created_at, updated_at)
       VALUES (?, ?, ?, 1, 0, 0, '{}', '{}', '{}', ?, ?)`
    ).bind(userId, appId, email, now, now).run();
    user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first() as UserRecord;
    await dispatchWebhook(c.env, appId, 'user.created', safeUser(user));
  } else {
    await c.env.DB.prepare(`UPDATE users SET email_verified = 1, last_sign_in_at = ? WHERE id = ?`).bind(now, user.id).run();
    user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(user.id).first() as UserRecord;
  }

  const ip = c.req.header('CF-Connecting-IP') ?? undefined;
  const ua = c.req.header('User-Agent') ?? undefined;
  const { session, accessToken, refreshToken } = await createSession(c.env, user.id, appId, { ip, userAgent: ua });

  return c.json({
    user: safeUser(user),
    session: { id: session.id, expires_at: session.expires_at },
    access_token: accessToken,
    refresh_token: refreshToken,
  });
});

// POST /v1/auth/email-otp/send
auth.post('/email-otp/send', rateLimit('otp-send', 3, 3600), async (c) => {
  await ensurePlatformApp(c.env);
  const body = await c.req.json() as { email: string; application_id?: string };
  if (!body.email) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required', status: 400 } }, 400);
  }

  const appId = body.application_id ?? PLATFORM_APP_ID;
  const otp = await storeOTP(c.env.DB, {
    applicationId: appId, email: body.email.toLowerCase(),
    type: 'email_otp', ttlSeconds: 600
  });

  await sendEmail(c.env, {
    to: body.email,
    subject: `${otp} is your LegionAuth verification code`,
    ...otpEmail(otp),
  });

  return c.json({ success: true, message: 'Verification code sent to your email' });
});

// POST /v1/auth/email-otp/verify
auth.post('/email-otp/verify', rateLimit('otp-verify', 5, 600), async (c) => {
  await ensurePlatformApp(c.env);
  const body = await c.req.json() as { email: string; code: string; application_id?: string };
  if (!body.email || !body.code) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Email and code are required', status: 400 } }, 400);
  }

  const appId = body.application_id ?? PLATFORM_APP_ID;
  const result = await verifyOTP(c.env.DB, body.code, 'email_otp', body.email.toLowerCase());
  if (!result.valid) {
    return c.json({ error: { code: 'INVALID_OTP', message: 'Invalid or expired verification code', status: 400 } }, 400);
  }

  const email = body.email.toLowerCase();
  let user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE application_id = ? AND email = ?`
  ).bind(appId, email).first() as UserRecord | null;

  const now = Date.now();
  if (!user) {
    const userId = generateId('user');
    await c.env.DB.prepare(
      `INSERT INTO users (id, application_id, email, email_verified, phone_verified, banned, public_metadata, private_metadata, unsafe_metadata, created_at, updated_at)
       VALUES (?, ?, ?, 1, 0, 0, '{}', '{}', '{}', ?, ?)`
    ).bind(userId, appId, email, now, now).run();
    user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first() as UserRecord;
    await dispatchWebhook(c.env, appId, 'user.created', safeUser(user));
  } else {
    await c.env.DB.prepare(`UPDATE users SET email_verified = 1, last_sign_in_at = ? WHERE id = ?`).bind(now, user.id).run();
    user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(user.id).first() as UserRecord;
  }

  const ip = c.req.header('CF-Connecting-IP') ?? undefined;
  const ua = c.req.header('User-Agent') ?? undefined;
  const { session, accessToken, refreshToken } = await createSession(c.env, user.id, appId, { ip, userAgent: ua });

  return c.json({
    user: safeUser(user),
    session: { id: session.id, expires_at: session.expires_at },
    access_token: accessToken,
    refresh_token: refreshToken,
  });
});

// POST /v1/auth/verify-email
auth.post('/verify-email', async (c) => {
  const body = await c.req.json() as { token: string };
  if (!body.token) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Token is required', status: 400 } }, 400);
  }

  const result = await verifyToken(c.env.DB, body.token, 'email_verification');
  if (!result.valid) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification token', status: 400 } }, 400);
  }

  if (result.userId) {
    await c.env.DB.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`).bind(result.userId).run();
  }

  return c.json({ success: true, message: 'Email verified successfully' });
});

// POST /v1/auth/forgot-password
auth.post('/forgot-password', rateLimit('forgot-password', 3, 3600), async (c) => {
  await ensurePlatformApp(c.env);
  const body = await c.req.json() as { email: string; application_id?: string };
  if (!body.email) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required', status: 400 } }, 400);
  }

  const appId = body.application_id ?? PLATFORM_APP_ID;
  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE application_id = ? AND email = ?`
  ).bind(appId, body.email.toLowerCase()).first() as { id: string } | null;

  // Always return success to prevent email enumeration
  if (user) {
    const token = await storeToken(c.env.DB, {
      userId: user.id, applicationId: appId, email: body.email.toLowerCase(),
      type: 'password_reset', ttlSeconds: 3600
    });
    const url = `${c.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendEmail(c.env, {
      to: body.email,
      subject: 'Reset your password - LegionAuth',
      ...passwordResetEmail(url),
    });
  }

  return c.json({ success: true, message: 'If an account exists with this email, a password reset link has been sent.' });
});

// POST /v1/auth/reset-password
auth.post('/reset-password', async (c) => {
  const body = await c.req.json() as { token: string; new_password: string };
  if (!body.token || !body.new_password) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Token and new_password are required', status: 400 } }, 400);
  }

  if (body.new_password.length < 8) {
    return c.json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters', status: 400 } }, 400);
  }

  const result = await verifyToken(c.env.DB, body.token, 'password_reset');
  if (!result.valid || !result.userId) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token', status: 400 } }, 400);
  }

  const breached = await isPasswordBreached(body.new_password);
  if (breached) {
    return c.json({ error: { code: 'PASSWORD_BREACHED', message: 'This password has appeared in data breaches', status: 400 } }, 400);
  }

  const hash = await hashPassword(body.new_password);
  const now = Date.now();
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
    .bind(hash, now, result.userId).run();

  await revokeAllUserSessions(c.env, result.userId);
  return c.json({ success: true, message: 'Password reset successfully. Please sign in with your new password.' });
});

// POST /v1/auth/change-password
auth.post('/change-password', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const body = await c.req.json() as { current_password: string; new_password: string };

  if (!body.current_password || !body.new_password) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'current_password and new_password are required', status: 400 } }, 400);
  }

  if (!user.password_hash) {
    return c.json({ error: { code: 'NO_PASSWORD', message: 'No password set on this account', status: 400 } }, 400);
  }

  const valid = await verifyPassword(body.current_password, user.password_hash);
  if (!valid) {
    return c.json({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect', status: 401 } }, 401);
  }

  if (body.new_password.length < 8) {
    return c.json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters', status: 400 } }, 400);
  }

  const hash = await hashPassword(body.new_password);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
    .bind(hash, Date.now(), user.id).run();

  return c.json({ success: true, message: 'Password changed successfully' });
});

// GET /v1/auth/me
auth.get('/me', requireAuth, async (c) => {
  const { user, session } = c.get('auth');
  const mfa = await c.env.DB.prepare(
    `SELECT totp_enabled FROM mfa_configs WHERE user_id = ?`
  ).bind(user.id).first() as { totp_enabled: number } | null;

  return c.json({
    user: { ...safeUser(user), mfa_enabled: mfa?.totp_enabled === 1 },
    session: { id: session.id, expires_at: session.expires_at, last_active_at: session.last_active_at },
  });
});

// POST /v1/auth/mfa/totp/setup
auth.post('/mfa/totp/setup', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const secret = generateTOTPSecret();
  const uri = getTOTPUri(secret, user.email ?? user.id, 'LegionAuth');

  // Store temporarily in KV until confirmed
  await c.env.SESSIONS_KV.put(
    `totp_setup:${user.id}`,
    JSON.stringify({ secret }),
    { expirationTtl: 600 }
  );

  const backupCodes = generateBackupCodes();

  return c.json({ secret, qr_uri: uri, backup_codes: backupCodes });
});

// POST /v1/auth/mfa/totp/confirm
auth.post('/mfa/totp/confirm', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const body = await c.req.json() as { code: string };

  const pending = await c.env.SESSIONS_KV.get(`totp_setup:${user.id}`, 'json') as { secret: string } | null;
  if (!pending) {
    return c.json({ error: { code: 'NO_SETUP', message: 'No TOTP setup in progress. Call /mfa/totp/setup first.', status: 400 } }, 400);
  }

  const valid = await verifyTOTP(body.code, pending.secret);
  if (!valid) {
    return c.json({ error: { code: 'INVALID_TOTP', message: 'Invalid TOTP code', status: 400 } }, 400);
  }

  const backupCodes = generateBackupCodes();
  const now = Date.now();

  const existing = await c.env.DB.prepare(`SELECT id FROM mfa_configs WHERE user_id = ?`).bind(user.id).first();
  if (existing) {
    await c.env.DB.prepare(
      `UPDATE mfa_configs SET totp_secret = ?, totp_enabled = 1, backup_codes = ?, updated_at = ? WHERE user_id = ?`
    ).bind(pending.secret, JSON.stringify(backupCodes), now, user.id).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO mfa_configs (id, user_id, totp_secret, totp_enabled, backup_codes, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`
    ).bind(generateId('mfa'), user.id, pending.secret, JSON.stringify(backupCodes), now, now).run();
  }

  await c.env.SESSIONS_KV.delete(`totp_setup:${user.id}`);

  return c.json({ success: true, backup_codes: backupCodes, message: 'TOTP enabled successfully' });
});

// POST /v1/auth/mfa/totp/disable
auth.post('/mfa/totp/disable', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const body = await c.req.json() as { code: string };

  const mfa = await c.env.DB.prepare(`SELECT * FROM mfa_configs WHERE user_id = ?`)
    .bind(user.id).first() as { totp_enabled: number; totp_secret: string | null; backup_codes: string } | null;

  if (!mfa?.totp_enabled) {
    return c.json({ error: { code: 'MFA_NOT_ENABLED', message: 'TOTP is not enabled', status: 400 } }, 400);
  }

  let valid = false;
  if (mfa.totp_secret) valid = await verifyTOTP(body.code, mfa.totp_secret);
  if (!valid) {
    let codes: string[] = [];
    try { codes = JSON.parse(mfa.backup_codes) as string[]; } catch { /* */ }
    valid = codes.includes(body.code);
  }

  if (!valid) {
    return c.json({ error: { code: 'INVALID_CODE', message: 'Invalid TOTP or backup code', status: 401 } }, 401);
  }

  await c.env.DB.prepare(
    `UPDATE mfa_configs SET totp_enabled = 0, totp_secret = NULL, backup_codes = '[]', updated_at = ? WHERE user_id = ?`
  ).bind(Date.now(), user.id).run();

  return c.json({ success: true, message: 'TOTP disabled' });
});

// POST /v1/auth/mfa/backup-codes/regenerate
auth.post('/mfa/backup-codes/regenerate', requireAuth, async (c) => {
  const { user } = c.get('auth');
  const codes = generateBackupCodes();
  await c.env.DB.prepare(
    `UPDATE mfa_configs SET backup_codes = ?, updated_at = ? WHERE user_id = ?`
  ).bind(JSON.stringify(codes), Date.now(), user.id).run();
  return c.json({ backup_codes: codes });
});

export default auth;
