import { Hono } from 'hono';
import type { Env, UserRecord } from '../types';
import { requireAuth } from '../middleware/auth';
import { createSession } from '../services/session';
import type { AuthContext } from '../middleware/auth';

const oauth = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

const PROVIDERS: Record<string, {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string;
}> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: 'openid email profile',
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: 'user:email read:user',
  },
};

// GET /v1/oauth/:provider/authorize
oauth.get('/:provider/authorize', async (c) => {
  const provider = c.req.param('provider');
  const config = PROVIDERS[provider];

  if (!config) {
    return c.json({ error: { code: 'UNSUPPORTED_PROVIDER', message: `Provider ${provider} is not supported`, status: 400 } }, 400);
  }

  const clientId = c.env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID` as keyof Env] as string | undefined;
  if (!clientId) {
    return c.json({ error: { code: 'PROVIDER_NOT_CONFIGURED', message: `OAuth provider ${provider} is not configured. Please add OAUTH_${provider.toUpperCase()}_CLIENT_ID to worker secrets.`, status: 501 } }, 501);
  }

  // Generate state and PKCE
  const stateBytes = crypto.getRandomValues(new Uint8Array(16));
  const state = Array.from(stateBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const codeVerifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = Array.from(codeVerifierBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Store in KV for 10 min
  await c.env.SESSIONS_KV.put(
    `oauth_state:${state}`,
    JSON.stringify({ codeVerifier, provider }),
    { expirationTtl: 600 }
  );

  const redirectUri = `${c.req.url.split('/v1')[0]}/v1/oauth/${provider}/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes,
    state,
  });

  return Response.redirect(`${config.authUrl}?${params.toString()}`);
});

// GET /v1/oauth/:provider/callback
oauth.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  const config = PROVIDERS[provider];

  if (!config) {
    return Response.redirect(`${c.env.FRONTEND_URL}/sign-in?error=unsupported_provider`);
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error || !code || !state) {
    return Response.redirect(`${c.env.FRONTEND_URL}/sign-in?error=${error ?? 'oauth_error'}`);
  }

  const stateData = await c.env.SESSIONS_KV.get(`oauth_state:${state}`, 'json') as { codeVerifier: string; provider: string } | null;
  if (!stateData || stateData.provider !== provider) {
    return Response.redirect(`${c.env.FRONTEND_URL}/sign-in?error=invalid_state`);
  }

  await c.env.SESSIONS_KV.delete(`oauth_state:${state}`);

  const clientId = c.env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID` as keyof Env] as string;
  const clientSecret = c.env[`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET` as keyof Env] as string;
  const redirectUri = `${c.req.url.split('/callback')[0]}/callback`;

  // Exchange code for tokens
  const tokenResp = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenResp.json() as Record<string, string>;
  if (!tokens['access_token']) {
    return Response.redirect(`${c.env.FRONTEND_URL}/sign-in?error=token_exchange_failed`);
  }

  // Get user info
  const userResp = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${tokens['access_token']}`,
      Accept: 'application/json',
    },
  });

  const providerUser = await userResp.json() as Record<string, string>;

  let email = providerUser['email'];
  let providerUserId = providerUser['id'] ?? providerUser['sub'];
  let firstName = providerUser['given_name'] ?? providerUser['name']?.split(' ')[0];
  let lastName = providerUser['family_name'] ?? providerUser['name']?.split(' ').slice(1).join(' ');
  let avatarUrl = providerUser['picture'] ?? providerUser['avatar_url'];

  // For GitHub, fetch email separately if not provided
  if (provider === 'github' && !email) {
    try {
      const emailResp = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens['access_token']}` },
      });
      const emails = await emailResp.json() as Array<{ email: string; primary: boolean }>;
      email = emails.find(e => e.primary)?.email ?? emails[0]?.email;
    } catch { /* */ }
  }

  if (!email) {
    return Response.redirect(`${c.env.FRONTEND_URL}/sign-in?error=no_email`);
  }

  const appId = 'app_platform';
  const now = Date.now();

  // Find or create user
  let user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE application_id = ? AND email = ?`
  ).bind(appId, email.toLowerCase()).first() as UserRecord | null;

  if (!user) {
    const userId = generateId('user');
    await c.env.DB.prepare(
      `INSERT INTO users (id, application_id, email, first_name, last_name, image_url, email_verified, phone_verified, banned, public_metadata, private_metadata, unsafe_metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, '{}', '{}', '{}', ?, ?)`
    ).bind(userId, appId, email.toLowerCase(), firstName ?? null, lastName ?? null, avatarUrl ?? null, now, now).run();
    user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first() as UserRecord;
  }

  // Upsert OAuth connection
  const oauthConnId = generateId('oauth');
  await c.env.DB.prepare(
    `INSERT INTO oauth_connections (id, user_id, provider, provider_user_id, access_token, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET
       access_token = excluded.access_token, updated_at = excluded.updated_at`
  ).bind(oauthConnId, user.id, provider, providerUserId, tokens['access_token'], email.toLowerCase(), now, now).run();

  await c.env.DB.prepare(`UPDATE users SET last_sign_in_at = ? WHERE id = ?`).bind(now, user.id).run();

  const ip = c.req.header('CF-Connecting-IP') ?? undefined;
  const ua = c.req.header('User-Agent') ?? undefined;
  const { accessToken, refreshToken } = await createSession(c.env, user.id, appId, { ip, userAgent: ua });

  // Redirect to frontend with tokens
  const frontendUrl = new URL(`${c.env.FRONTEND_URL}/auth/oauth-callback`);
  frontendUrl.searchParams.set('access_token', accessToken);
  frontendUrl.searchParams.set('refresh_token', refreshToken);

  return Response.redirect(frontendUrl.toString());
});

export default oauth;
