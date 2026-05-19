CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  publishable_key TEXT UNIQUE NOT NULL,
  secret_key_hash TEXT NOT NULL,
  allowed_origins TEXT NOT NULL DEFAULT '[]',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  image_url TEXT,
  password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  last_sign_in_at INTEGER,
  external_id TEXT,
  public_metadata TEXT NOT NULL DEFAULT '{}',
  private_metadata TEXT NOT NULL DEFAULT '{}',
  unsafe_metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(application_id, email);
CREATE INDEX IF NOT EXISTS idx_users_app ON users(application_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  refresh_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  device_info TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  application_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  token TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mfa_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  backup_codes TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS oauth_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  email TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT,
  max_allowed_memberships INTEGER NOT NULL DEFAULT 100,
  public_metadata TEXT NOT NULL DEFAULT '{}',
  private_metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_slug ON organizations(application_id, slug);

CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(organization_id, user_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by_user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  secret TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at INTEGER,
  failed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_app ON audit_logs(application_id, created_at);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  application_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  organization_id TEXT,
  PRIMARY KEY (user_id, role_id)
);
