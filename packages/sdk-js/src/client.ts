import type {
  LegionAuthConfig, AuthResult, User, Session,
  Organization, SignUpOptions, SignInOptions, APIError
} from './types'
import { SessionManager } from './session'

const DEFAULT_BASE_URL = 'https://legionauth-api.workers.dev'

export class LegionAuthClient {
  private baseUrl: string
  private publishableKey: string
  private sessionManager: SessionManager
  private _user: User | null = null
  private _session: Session | null = null

  constructor(config: LegionAuthConfig) {
    this.publishableKey = config.publishableKey
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
    this.sessionManager = new SessionManager()
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Publishable-Key': this.publishableKey,
      ...(options.headers as Record<string, string> ?? {}),
    }

    const token = this.sessionManager.getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    })

    const data = await response.json() as T | APIError

    if (!response.ok) {
      throw data as APIError
    }

    return data as T
  }

  // Sign up with email and password
  async signUp(email: string, password: string, opts?: SignUpOptions): Promise<AuthResult> {
    const result = await this.request<AuthResult>('/v1/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...opts }),
    })
    this._storeAuth(result)
    return result
  }

  // Sign in with email and password
  async signIn(email: string, password: string, opts?: SignInOptions): Promise<AuthResult> {
    const result = await this.request<AuthResult>('/v1/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...opts }),
    })
    this._storeAuth(result)
    return result
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await this.request<{ success: boolean }>('/v1/auth/sign-out', { method: 'POST' })
    } catch {
      // ignore errors
    }
    this._clearAuth()
  }

  // Send magic link
  async sendMagicLink(email: string): Promise<void> {
    await this.request<{ success: boolean }>('/v1/auth/magic-link/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  // Verify magic link token
  async verifyMagicLink(token: string): Promise<AuthResult> {
    const result = await this.request<AuthResult>('/v1/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
    this._storeAuth(result)
    return result
  }

  // Send email OTP
  async sendEmailOTP(email: string): Promise<void> {
    await this.request<{ success: boolean }>('/v1/auth/email-otp/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  // Verify email OTP
  async verifyEmailOTP(email: string, code: string): Promise<AuthResult> {
    const result = await this.request<AuthResult>('/v1/auth/email-otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
    this._storeAuth(result)
    return result
  }

  // Refresh session
  async refreshSession(): Promise<{ accessToken: string }> {
    const refreshToken = this.sessionManager.getRefreshToken()
    if (!refreshToken) throw new Error('No refresh token available')

    const result = await this.request<{ access_token: string; refresh_token: string }>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    this.sessionManager.setAccessToken(result.access_token)
    this.sessionManager.setRefreshToken(result.refresh_token)

    return { accessToken: result.access_token }
  }

  // Get current user
  async getUser(): Promise<User | null> {
    const token = this.sessionManager.getAccessToken()
    if (!token) return null

    try {
      const result = await this.request<{ user: User; session: Session }>('/v1/auth/me')
      this._user = result.user
      this._session = result.session
      return result.user
    } catch {
      return null
    }
  }

  // Update user
  async updateUser(data: Partial<User>): Promise<User> {
    const result = await this.request<{ user: User }>('/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    this._user = result.user
    return result.user
  }

  // Get session
  getSession(): Session | null {
    return this._session
  }

  // Get all sessions
  async getSessions(): Promise<Session[]> {
    const result = await this.request<{ sessions: Session[] }>('/v1/users/me/sessions')
    return result.sessions
  }

  // Revoke a session
  async revokeSession(sessionId: string): Promise<void> {
    await this.request<{ success: boolean }>(`/v1/users/me/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  }

  // Sign in with OAuth
  signInWithOAuth(provider: 'google' | 'github', redirectUrl?: string): void {
    const url = new URL(`${this.baseUrl}/v1/oauth/${provider}/authorize`)
    if (redirectUrl) url.searchParams.set('redirect_url', redirectUrl)
    window.location.href = url.toString()
  }

  // Get organizations
  async getOrganizations(): Promise<Organization[]> {
    const result = await this.request<{ organizations: Organization[] }>('/v1/organizations')
    return result.organizations
  }

  // Initialize from stored refresh token
  async initialize(): Promise<boolean> {
    const rt = this.sessionManager.getRefreshToken()
    if (!rt) return false

    try {
      const { accessToken } = await this.refreshSession()
      this.sessionManager.setAccessToken(accessToken)
      await this.getUser()
      this.sessionManager.startAutoRefresh(async (token) => {
        const r = await this.request<{ access_token: string; refresh_token: string }>('/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: token }),
        })
        this.sessionManager.setAccessToken(r.access_token)
        this.sessionManager.setRefreshToken(r.refresh_token)
      })
      return true
    } catch {
      return false
    }
  }

  private _storeAuth(result: AuthResult): void {
    this._user = result.user
    this._session = result.session
    this.sessionManager.setAccessToken(result.access_token)
    this.sessionManager.setRefreshToken(result.refresh_token)
    this.sessionManager.startAutoRefresh(async (token) => {
      const r = await this.request<{ access_token: string; refresh_token: string }>('/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: token }),
      })
      this.sessionManager.setAccessToken(r.access_token)
      this.sessionManager.setRefreshToken(r.refresh_token)
    })
  }

  private _clearAuth(): void {
    this._user = null
    this._session = null
    this.sessionManager.clearTokens()
  }
}
