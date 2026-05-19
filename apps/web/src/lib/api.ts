const API_URL = import.meta.env.VITE_API_URL ?? 'https://legionauth-api.workers.dev'

export interface ApiError {
  error: {
    code: string
    message: string
    status: number
  }
}

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
  mfa_enabled?: boolean
  public_metadata: Record<string, unknown>
  created_at: number
  updated_at: number
  application_id?: string
}

export interface Session {
  id: string
  status: string
  ip_address: string | null
  user_agent: string | null
  last_active_at: number
  expires_at: number
  created_at: number
  email?: string
  first_name?: string
  last_name?: string
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  const data = await response.json() as T | ApiError

  if (!response.ok) {
    throw data as ApiError
  }

  return data as T
}

export const api = {
  // Auth
  signUp: (data: { email: string; password: string; first_name?: string; last_name?: string }) =>
    request<{ user: User; access_token: string; refresh_token: string; session: { id: string; expires_at: number } }>('/v1/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  signIn: (data: { email: string; password: string; totp_code?: string }) =>
    request<{ user: User; access_token: string; refresh_token: string; session: { id: string; expires_at: number } }>('/v1/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  signOut: (token: string) =>
    request<{ success: boolean }>('/v1/auth/sign-out', { method: 'POST' }, token),

  refresh: (refreshToken: string) =>
    request<{ access_token: string; refresh_token: string; session: { id: string; expires_at: number } }>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  me: (token: string) =>
    request<{ user: User; session: Session }>('/v1/auth/me', {}, token),

  sendMagicLink: (email: string) =>
    request<{ success: boolean }>('/v1/auth/magic-link/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyMagicLink: (token: string) =>
    request<{ user: User; access_token: string; refresh_token: string; session: { id: string; expires_at: number } }>('/v1/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  sendEmailOTP: (email: string) =>
    request<{ success: boolean }>('/v1/auth/email-otp/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyEmailOTP: (email: string, code: string) =>
    request<{ user: User; access_token: string; refresh_token: string; session: { id: string; expires_at: number } }>('/v1/auth/email-otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  forgotPassword: (email: string) =>
    request<{ success: boolean }>('/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Users
  updateUser: (token: string, data: Partial<User>) =>
    request<{ user: User }>('/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, token),

  getSessions: (token: string) =>
    request<{ sessions: Session[] }>('/v1/users/me/sessions', {}, token),

  revokeSession: (token: string, sessionId: string) =>
    request<{ success: boolean }>(`/v1/users/me/sessions/${sessionId}`, {
      method: 'DELETE',
    }, token),

  revokeAllSessions: (token: string) =>
    request<{ success: boolean }>('/v1/users/me/sessions', {
      method: 'DELETE',
    }, token),

  // Admin
  adminGetUsers: (token: string, params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', params.page.toString())
    if (params?.limit) q.set('limit', params.limit.toString())
    if (params?.search) q.set('search', params.search)
    if (params?.status) q.set('status', params.status)
    return request<{ users: User[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
      `/v1/admin/users?${q.toString()}`, {}, token
    )
  },

  adminGetStats: (token: string) =>
    request<{
      stats: { total_users: number; active_sessions: number; total_organizations: number; active_api_keys: number };
      recent_signins: Array<{ email: string; first_name: string; last_name: string; created_at: number; ip_address: string }>
    }>('/v1/admin/stats', {}, token),

  adminGetSessions: (token: string, page = 1) =>
    request<{ sessions: Session[] }>(`/v1/admin/sessions?page=${page}`, {}, token),

  adminBanUser: (token: string, userId: string) =>
    request<{ success: boolean }>(`/v1/admin/users/${userId}/ban`, { method: 'POST' }, token),

  adminUnbanUser: (token: string, userId: string) =>
    request<{ success: boolean }>(`/v1/admin/users/${userId}/unban`, { method: 'POST' }, token),

  adminDeleteUser: (token: string, userId: string) =>
    request<{ success: boolean }>(`/v1/admin/users/${userId}`, { method: 'DELETE' }, token),

  adminRevokeSession: (token: string, sessionId: string) =>
    request<{ success: boolean }>(`/v1/admin/sessions/${sessionId}`, { method: 'DELETE' }, token),

  // Organizations
  getOrganizations: (token: string) =>
    request<{ organizations: Array<{ id: string; name: string; slug: string; role: string; created_at: number }> }>(
      '/v1/organizations', {}, token
    ),

  createOrg: (token: string, data: { name: string; slug?: string }) =>
    request<{ organization: { id: string; name: string; slug: string } }>('/v1/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  getOrgMembers: (token: string, orgId: string) =>
    request<{ members: Array<{ id: string; user_id: string; email: string; first_name: string; last_name: string; role: string; created_at: number }> }>(
      `/v1/organizations/${orgId}/members`, {}, token
    ),

  inviteMember: (token: string, orgId: string, email: string, role = 'member') =>
    request<{ invitation: { id: string; email: string; role: string; expires_at: number } }>(
      `/v1/organizations/${orgId}/invitations`,
      { method: 'POST', body: JSON.stringify({ email, role }) },
      token
    ),

  // API Keys
  getAPIKeys: (token: string) =>
    request<{ api_keys: Array<{ id: string; name: string; key_prefix: string; last_used_at: number | null; created_at: number }> }>(
      '/v1/api-keys', {}, token
    ),

  createAPIKey: (token: string, name: string, expires_in_days?: number) =>
    request<{ api_key: { id: string; name: string; key: string; key_prefix: string; created_at: number }; warning: string }>(
      '/v1/api-keys', { method: 'POST', body: JSON.stringify({ name, expires_in_days }) }, token
    ),

  revokeAPIKey: (token: string, keyId: string) =>
    request<{ success: boolean }>(`/v1/api-keys/${keyId}`, { method: 'DELETE' }, token),

  // Webhooks
  getWebhooks: (token: string) =>
    request<{ webhooks: Array<{ id: string; url: string; events: string[]; enabled: boolean; created_at: number }> }>(
      '/v1/webhooks', {}, token
    ),

  createWebhook: (token: string, url: string, events: string[]) =>
    request<{ webhook: { id: string; url: string; events: string[]; secret: string; enabled: boolean }; warning: string }>(
      '/v1/webhooks', { method: 'POST', body: JSON.stringify({ url, events }) }, token
    ),

  deleteWebhook: (token: string, id: string) =>
    request<{ success: boolean }>(`/v1/webhooks/${id}`, { method: 'DELETE' }, token),

  getWebhookDeliveries: (token: string, webhookId: string) =>
    request<{ deliveries: Array<{ id: string; event_type: string; response_status: number; delivered_at: number | null; created_at: number }> }>(
      `/v1/webhooks/${webhookId}/deliveries`, {}, token
    ),

  testWebhook: (token: string, id: string) =>
    request<{ success: boolean; status: number; message: string }>(`/v1/webhooks/${id}/test`, { method: 'POST' }, token),

  // MFA
  setupTOTP: (token: string) =>
    request<{ secret: string; qr_uri: string; backup_codes: string[] }>('/v1/auth/mfa/totp/setup', { method: 'POST' }, token),

  confirmTOTP: (token: string, code: string) =>
    request<{ success: boolean; backup_codes: string[] }>('/v1/auth/mfa/totp/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token),

  disableTOTP: (token: string, code: string) =>
    request<{ success: boolean }>('/v1/auth/mfa/totp/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token),
}

export const API_URL_BASE = API_URL
