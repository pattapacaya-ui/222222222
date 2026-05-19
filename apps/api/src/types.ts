export interface Env {
  DB: D1Database;
  SESSIONS_KV: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
  JWKS_KV: KVNamespace;
  APP_ENV: string;
  APP_NAME: string;
  FRONTEND_URL: string;
  JWT_PRIVATE_KEY?: string;
  JWT_PUBLIC_KEY?: string;
  RESEND_API_KEY?: string;
  DEFAULT_APP_SECRET?: string;
}

export interface UserRecord {
  id: string;
  application_id: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  password_hash: string | null;
  email_verified: number;
  phone_verified: number;
  banned: number;
  last_sign_in_at: number | null;
  external_id: string | null;
  public_metadata: string;
  private_metadata: string;
  unsafe_metadata: string;
  created_at: number;
  updated_at: number;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  application_id: string;
  refresh_token: string;
  status: string;
  device_info: string;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: number;
  expires_at: number;
  created_at: number;
}

export interface ApplicationRecord {
  id: string;
  name: string;
  publishable_key: string;
  secret_key_hash: string;
  allowed_origins: string;
  settings: string;
  created_at: number;
  updated_at: number;
}

export interface VerificationTokenRecord {
  id: string;
  user_id: string | null;
  application_id: string;
  email: string | null;
  phone: string | null;
  token: string;
  type: string;
  expires_at: number;
  used_at: number | null;
  created_at: number;
}

export interface MFAConfigRecord {
  id: string;
  user_id: string;
  totp_secret: string | null;
  totp_enabled: number;
  backup_codes: string;
  created_at: number;
  updated_at: number;
}

export interface OrganizationRecord {
  id: string;
  application_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  max_allowed_memberships: number;
  public_metadata: string;
  private_metadata: string;
  created_at: number;
  updated_at: number;
}

export interface OrgMemberRecord {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: number;
  updated_at: number;
}

export interface APIKeyRecord {
  id: string;
  user_id: string;
  application_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: number | null;
  expires_at: number | null;
  revoked_at: number | null;
  created_at: number;
}

export interface WebhookRecord {
  id: string;
  application_id: string;
  url: string;
  events: string;
  secret: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface AuditLogRecord {
  id: string;
  application_id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
}
