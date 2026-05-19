import type { Session } from './types'

const REFRESH_TOKEN_KEY = 'la_refresh_token'
const ACCESS_TOKEN_KEY = 'la_access_token'
const REFRESH_INTERVAL = 50_000 // 50 seconds

export class SessionManager {
  private accessToken: string | null = null
  private _refreshInterval: ReturnType<typeof setInterval> | null = null
  private _onRefresh: ((token: string) => Promise<void>) | null = null

  setAccessToken(token: string): void {
    this.accessToken = token
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  setRefreshToken(token: string): void {
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, token)
    } catch {
      // localStorage may not be available in SSR
    }
  }

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY)
    } catch {
      return null
    }
  }

  clearTokens(): void {
    this.accessToken = null
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(ACCESS_TOKEN_KEY)
    } catch {
      // ignore
    }
    this.stopAutoRefresh()
  }

  startAutoRefresh(onRefresh: (token: string) => Promise<void>): void {
    this._onRefresh = onRefresh
    this.stopAutoRefresh()
    this._refreshInterval = setInterval(async () => {
      const rt = this.getRefreshToken()
      if (rt && this._onRefresh) {
        try {
          await this._onRefresh(rt)
        } catch {
          this.clearTokens()
        }
      }
    }, REFRESH_INTERVAL)
  }

  stopAutoRefresh(): void {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval)
      this._refreshInterval = null
    }
  }
}
