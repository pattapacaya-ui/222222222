export interface User {
  id: string
  email: string | null
  username: string | null
  first_name: string | null
  last_name: string | null
  image_url: string | null
  email_verified: boolean
  phone_verified: boolean
  banned: boolean
  last_sign_in_at: number | null
  public_metadata: Record<string, unknown>
  created_at: number
  updated_at: number
}

export interface Session {
  id: string
  status: string
  ip_address: string | null
  user_agent: string | null
  last_active_at: number
  expires_at: number
  created_at: number
}

export interface Organization {
  id: string
  name: string
  slug: string
  image_url: string | null
  role?: string
  public_metadata: Record<string, unknown>
  created_at: number
  updated_at: number
}

export interface OrgMembership {
  id: string
  organization_id: string
  user_id: string
  role: string
  created_at: number
}

export interface AuthResult {
  user: User
  session: Session
  access_token: string
  refresh_token: string
}

export interface SignUpOptions {
  first_name?: string
  last_name?: string
  username?: string
}

export interface SignInOptions {
  totp_code?: string
}

export interface LegionAuthConfig {
  publishableKey: string
  baseUrl?: string
}

export interface APIError {
  error: {
    code: string
    message: string
    status: number
  }
}
