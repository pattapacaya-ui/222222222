# LegionAuth

**Production-grade authentication-as-a-service platform** — a complete Clerk-compatible alternative built on Cloudflare's edge infrastructure.

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare-orange)](https://dash.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Features

- **Passwords** — PBKDF2-SHA512 (310,000 iterations) + HaveIBeenPwned breach detection
- **JWT Tokens** — RS256 (RSA-2048), 60s access tokens, 30-day rotating refresh tokens
- **MFA / TOTP** — RFC 6238 TOTP with backup codes, full Web Crypto (no native deps)
- **Magic Links** — One-click email sign-in with 15-minute expiry
- **Email OTP** — 6-digit codes via Resend API with branded HTML templates
- **OAuth 2.0** — Google + GitHub sign-in with PKCE
- **Organizations** — Multi-tenant with roles (admin/member), invitations
- **API Keys** — HMAC-SHA256 hashed, shown only once on creation
- **Webhooks** — HMAC-SHA256 signed payloads with delivery logging and retry
- **Rate Limiting** — KV-based sliding window (5/60s sign-in, 3/3600s OTP, 10/3600s sign-up)
- **Session Management** — Refresh-token rotation, KV cache + D1 persistence
- **Audit Logging** — Full event trail stored in D1
- **Admin Dashboard** — Full React 18 SPA with 7 management pages

---

## Architecture

```
legionauth/
├── apps/
│   ├── api/          # Cloudflare Workers + Hono.js backend
│   └── web/          # React 18 + Vite + Tailwind CSS frontend
└── packages/
    ├── sdk-js/       # @legionauth/js — Vanilla JS client SDK
    └── sdk-react/    # @legionauth/react — React hooks + components
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Edge Runtime | Cloudflare Workers |
| Framework | Hono.js v4 |
| Database | Cloudflare D1 (SQLite) |
| Cache / Sessions | Cloudflare KV |
| Crypto | Web Crypto API (PBKDF2, RS256, HMAC-SHA1) |
| Email | Resend API |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 + Radix UI |
| State | Zustand |
| Package Manager | pnpm workspaces |

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Cloudflare account with Workers, D1, and KV access
- A valid [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with Workers/Pages/D1/KV permissions
- Resend account (optional — falls back to console logging)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Automated Deployment

```bash
export CLOUDFLARE_API_TOKEN=<your-token>
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
export RESEND_API_KEY=<your-resend-key>   # optional

chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` will:
1. Create the D1 database (`legionauth-db`)
2. Create KV namespaces (sessions, JWKS)
3. Generate an RSA-2048 key pair
4. Inject secrets into the Worker
5. Run D1 migrations
6. Deploy the Cloudflare Worker
7. Build the frontend
8. Deploy to Cloudflare Pages

### 3. Manual Step-by-Step

```bash
# 1. Create D1 database
wrangler d1 create legionauth-db

# 2. Create KV namespaces
wrangler kv:namespace create SESSIONS_KV
wrangler kv:namespace create JWKS_KV

# 3. Update wrangler.toml with the returned IDs
# Edit apps/api/wrangler.toml — replace PLACEHOLDER_* values

# 4. Run migrations
cd apps/api
wrangler d1 migrations apply legionauth-db --remote

# 5. Generate RSA key pair and set secrets
node -e "
const { generateKeyPair } = require('crypto');
generateKeyPair('rsa', { modulusLength: 2048 }, (err, pub, priv) => {
  console.log('PRIVATE:', priv.export({ type: 'pkcs8', format: 'pem' }));
  console.log('PUBLIC:', pub.export({ type: 'spki', format: 'pem' }));
});
"
wrangler secret put JWT_PRIVATE_KEY
wrangler secret put JWT_PUBLIC_KEY
wrangler secret put ADMIN_API_KEY   # any secure random string

# 6. Deploy Worker
wrangler deploy

# 7. Build + deploy frontend
cd ../web
VITE_API_URL=https://legionauth-api.<account>.workers.dev npx vite build
wrangler pages deploy dist --project-name legionauth
```

---

## API Reference

Base URL: `https://legionauth-api.<account>.workers.dev/v1`

All endpoints return JSON. Errors follow:
```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message", "status": 400 } }
```

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/sign-up` | Register a new user |
| `POST` | `/auth/sign-in` | Sign in with email + password |
| `POST` | `/auth/sign-out` | Revoke current session |
| `POST` | `/auth/refresh` | Rotate refresh token, get new access token |
| `GET`  | `/auth/me` | Get current user |
| `POST` | `/auth/magic-link` | Send magic link email |
| `POST` | `/auth/magic-link/verify` | Verify magic link token |
| `POST` | `/auth/otp/send` | Send email OTP |
| `POST` | `/auth/otp/verify` | Verify email OTP |
| `POST` | `/auth/verify-email` | Verify email address |
| `POST` | `/auth/forgot-password` | Send password reset email |
| `POST` | `/auth/reset-password` | Reset password with token |
| `POST` | `/auth/change-password` | Change password (authenticated) |
| `POST` | `/auth/mfa/totp/setup` | Initialize TOTP setup |
| `POST` | `/auth/mfa/totp/confirm` | Confirm + enable TOTP |
| `POST` | `/auth/mfa/totp/disable` | Disable TOTP |
| `POST` | `/auth/mfa/backup-codes/regenerate` | Regenerate backup codes |

#### Sign Up
```http
POST /v1/auth/sign-up
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SuperSecure123!",
  "first_name": "Alice",
  "last_name": "Smith"
}
```

Response `201`:
```json
{
  "user": { "id": "user_abc123", "email": "user@example.com", ... },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "session": { "id": "sess_xyz", ... }
}
```

#### Sign In
```http
POST /v1/auth/sign-in
Content-Type: application/json

{ "email": "user@example.com", "password": "SuperSecure123!" }
```

If MFA is enabled, response `200` includes `{ "mfa_required": true, "session_id": "sess_..." }`.  
Complete sign-in with:
```http
POST /v1/auth/sign-in
{ "session_id": "sess_...", "totp_code": "123456" }
```

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/me` | Get profile |
| `PATCH` | `/users/me` | Update profile |
| `DELETE` | `/users/me` | Delete account |
| `GET` | `/users/me/sessions` | List all sessions |
| `DELETE` | `/users/me/sessions/:id` | Revoke a session |
| `DELETE` | `/users/me/sessions` | Revoke all other sessions |
| `GET` | `/users/me/oauth-connections` | List OAuth connections |
| `DELETE` | `/users/me/oauth-connections/:id` | Unlink OAuth provider |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sessions` | List sessions |
| `DELETE` | `/sessions/:id` | Revoke session |

### Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/organizations` | List user's organizations |
| `POST` | `/organizations` | Create organization |
| `GET` | `/organizations/:id` | Get organization |
| `PATCH` | `/organizations/:id` | Update organization |
| `DELETE` | `/organizations/:id` | Delete organization |
| `GET` | `/organizations/:id/members` | List members |
| `PATCH` | `/organizations/:id/members/:userId` | Update member role |
| `DELETE` | `/organizations/:id/members/:userId` | Remove member |
| `POST` | `/organizations/:id/invitations` | Invite user by email |
| `GET` | `/organizations/:id/invitations` | List invitations |
| `DELETE` | `/organizations/:id/invitations/:invId` | Revoke invitation |
| `POST` | `/organizations/invitations/accept` | Accept invitation |

### API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api-keys` | List API keys |
| `POST` | `/api-keys` | Create API key (secret shown once) |
| `DELETE` | `/api-keys/:id` | Revoke API key |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/webhooks` | List webhooks |
| `POST` | `/webhooks` | Create webhook (secret shown once) |
| `PATCH` | `/webhooks/:id` | Update webhook |
| `DELETE` | `/webhooks/:id` | Delete webhook |
| `GET` | `/webhooks/:id/deliveries` | List delivery logs |
| `POST` | `/webhooks/:id/test` | Send test event |

### OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/oauth/google` | Redirect to Google OAuth |
| `GET` | `/oauth/google/callback` | Handle Google callback |
| `GET` | `/oauth/github` | Redirect to GitHub OAuth |
| `GET` | `/oauth/github/callback` | Handle GitHub callback |

### Admin (requires `X-Admin-Key` header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/users` | List all users (paginated, searchable) |
| `GET` | `/admin/users/:id` | Get user |
| `PATCH` | `/admin/users/:id` | Update user |
| `DELETE` | `/admin/users/:id` | Delete user |
| `POST` | `/admin/users/:id/ban` | Ban user + revoke sessions |
| `POST` | `/admin/users/:id/unban` | Unban user |
| `GET` | `/admin/sessions` | List active sessions |
| `DELETE` | `/admin/sessions/:id` | Force-revoke session |
| `GET` | `/admin/stats` | Usage statistics |

### Well-Known

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/jwks.json` | JWKS public keys for JWT verification |
| `GET /.well-known/openid-configuration` | OpenID Connect discovery document |

---

## JavaScript SDK

```bash
npm install @legionauth/js
```

```typescript
import { LegionAuthClient } from '@legionauth/js';

const auth = new LegionAuthClient({
  apiUrl: 'https://legionauth-api.<account>.workers.dev',
});

// Sign up
const { user, accessToken } = await auth.signUp({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'Alice',
});

// Sign in
const result = await auth.signIn({
  email: 'user@example.com',
  password: 'SecurePass123!',
});

// Get current user
const user = await auth.getUser();

// Sign out
await auth.signOut();
```

### Session Management

The JS SDK stores the refresh token in `localStorage` and keeps the access token in memory. It auto-refreshes the access token 10 seconds before expiry.

---

## React SDK

```bash
npm install @legionauth/react
```

### Provider Setup

```tsx
import { LegionAuthProvider } from '@legionauth/react';

function App() {
  return (
    <LegionAuthProvider apiUrl="https://legionauth-api.<account>.workers.dev">
      <YourApp />
    </LegionAuthProvider>
  );
}
```

### Hooks

```tsx
import { useAuth, useUser, useSession } from '@legionauth/react';

function Dashboard() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const { session } = useSession();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Please sign in</div>;

  return (
    <div>
      <h1>Hello, {user.firstName}!</h1>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### Built-in Components

```tsx
import { SignIn, SignUp, UserButton, ProtectedRoute } from '@legionauth/react';

// Drop-in sign-in form
<SignIn onSuccess={(result) => navigate('/dashboard')} />

// Drop-in sign-up form
<SignUp onSuccess={(result) => navigate('/dashboard')} />

// User avatar + dropdown
<UserButton afterSignOutUrl="/sign-in" />

// Protected route wrapper
<ProtectedRoute fallback={<Navigate to="/sign-in" />}>
  <Dashboard />
</ProtectedRoute>
```

---

## Webhook Events

All webhooks are signed with `HMAC-SHA256`. Verify the `X-LegionAuth-Signature` header:

```typescript
const sig = request.headers.get('X-LegionAuth-Signature');
const expected = await crypto.subtle.sign(
  { name: 'HMAC', hash: 'SHA-256' },
  await crypto.subtle.importKey('raw', new TextEncoder().encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  new TextEncoder().encode(body)
);
// Compare sig === hex(expected)
```

Available events:

| Event | Description |
|-------|-------------|
| `user.created` | New user registered |
| `user.updated` | User profile changed |
| `user.deleted` | User account deleted |
| `session.created` | New session started |
| `session.ended` | Session revoked |
| `organization.created` | New organization created |
| `organization.deleted` | Organization deleted |
| `organization.member.added` | Member joined org |
| `organization.member.removed` | Member removed from org |

---

## D1 Schema (16 Tables)

```
applications          — Multi-app support
users                 — User accounts + metadata
sessions              — Auth sessions with KV cache
verification_tokens   — Email verification, password reset, magic links
mfa_configs           — TOTP secrets + backup codes
oauth_connections     — Linked OAuth providers
organizations         — Multi-tenant organizations
organization_members  — User ↔ Org with role
organization_invitations — Pending email invitations
api_keys              — HMAC-SHA256 hashed keys
webhooks              — Webhook endpoints + secrets
webhook_deliveries    — Delivery attempt logs
audit_logs            — Full event audit trail
roles                 — RBAC role definitions
permissions           — Permission definitions
role_permissions      — Role ↔ Permission mapping
user_roles            — User ↔ Role assignment
```

---

## Environment Variables / Secrets

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_PRIVATE_KEY` | RSA-2048 PEM private key | Yes |
| `JWT_PUBLIC_KEY` | RSA-2048 PEM public key | Yes |
| `ADMIN_API_KEY` | Secret for admin endpoints | Yes |
| `RESEND_API_KEY` | Resend email API key | No (console fallback) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | No |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | No |
| `APP_URL` | Frontend URL for redirects | No |

---

## Security

- **Passwords**: PBKDF2-SHA512 with 310,000 iterations + random 32-byte salt
- **Password breach check**: k-anonymity model against HaveIBeenPwned API
- **JWT**: RS256 asymmetric signing — private key never leaves the Worker
- **Refresh tokens**: Rotated on every use (refresh token rotation)
- **Sessions**: Stored in KV (fast) with D1 as source of truth
- **Rate limiting**: Sliding window via KV — blocks brute force attacks
- **TOTP**: RFC 6238 compliant with ±1 window tolerance (30s drift)
- **API keys**: Stored as HMAC-SHA256 hash — plaintext never persisted
- **Webhooks**: HMAC-SHA256 signed — receivers can verify authenticity
- **SQL injection**: Parameterized queries throughout
- **CORS**: Configured per-environment via Hono middleware
- **Headers**: `Strict-Transport-Security`, `X-Content-Type-Options` via `secureHeaders`

---

## Development

```bash
# Start API dev server (requires wrangler login)
cd apps/api
wrangler dev

# Start frontend dev server
cd apps/web
VITE_API_URL=http://localhost:8787 npm run dev

# Type-check API
cd apps/api
npx tsc --noEmit

# Build frontend
cd apps/web
npx vite build
```

---

## License

MIT © LegionAuth Contributors
