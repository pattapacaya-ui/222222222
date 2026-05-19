import { create } from 'zustand'
import { api } from './api'
import type { User, Session } from './api'

const REFRESH_TOKEN_KEY = 'legion_refresh_token'
const REFRESH_INTERVAL = 50_000 // 50 seconds

interface AuthState {
  isLoaded: boolean
  isSignedIn: boolean
  user: User | null
  session: Session | null
  accessToken: string | null
  _refreshTimer: ReturnType<typeof setInterval> | null

  initAuth: () => Promise<void>
  setTokens: (accessToken: string, refreshToken: string, user: User, session: Session) => void
  signOut: () => Promise<void>
  refreshTokens: () => Promise<void>
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoaded: false,
  isSignedIn: false,
  user: null,
  session: null,
  accessToken: null,
  _refreshTimer: null,

  initAuth: async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) {
      set({ isLoaded: true, isSignedIn: false })
      return
    }

    try {
      const result = await api.refresh(refreshToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refresh_token)

      const { user, session } = await api.me(result.access_token)
      set({
        isLoaded: true,
        isSignedIn: true,
        user,
        session,
        accessToken: result.access_token,
      })

      // Start auto-refresh
      const timer = setInterval(() => {
        void get().refreshTokens()
      }, REFRESH_INTERVAL)
      set({ _refreshTimer: timer })
    } catch {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      set({ isLoaded: true, isSignedIn: false })
    }
  },

  setTokens: (accessToken, refreshToken, user, session) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    const { _refreshTimer } = get()
    if (_refreshTimer) clearInterval(_refreshTimer)

    const timer = setInterval(() => {
      void get().refreshTokens()
    }, REFRESH_INTERVAL)

    set({
      isLoaded: true,
      isSignedIn: true,
      user,
      session,
      accessToken,
      _refreshTimer: timer,
    })
  },

  signOut: async () => {
    const { accessToken, _refreshTimer } = get()
    if (_refreshTimer) clearInterval(_refreshTimer)

    if (accessToken) {
      try { await api.signOut(accessToken) } catch { /* */ }
    }

    get().clearAuth()
  },

  refreshTokens: async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) {
      get().clearAuth()
      return
    }

    try {
      const result = await api.refresh(refreshToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refresh_token)
      const { user, session } = await api.me(result.access_token)
      set({ accessToken: result.access_token, user, session })
    } catch {
      get().clearAuth()
    }
  },

  clearAuth: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    set({
      isLoaded: true,
      isSignedIn: false,
      user: null,
      session: null,
      accessToken: null,
      _refreshTimer: null,
    })
  },
}))
