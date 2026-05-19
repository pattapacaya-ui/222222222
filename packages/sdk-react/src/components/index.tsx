import { useState } from 'react'
import type { ReactNode } from 'react'
import { useLegionAuth } from '../context'
import type { LegionAuthClient } from '@legionauth/js'

// ------- SignIn -------
export interface SignInProps {
  redirectUrl?: string
  afterSignInUrl?: string
  appearance?: { primaryColor?: string }
}

export function SignIn({ redirectUrl, afterSignInUrl = '/', appearance }: SignInProps) {
  const { client } = useLegionAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const primary = appearance?.primaryColor ?? '#6366f1'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await client.signIn(email, password)
      window.location.href = afterSignInUrl
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } }
      setError(apiErr.error?.message ?? 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 16, padding: 32,
      maxWidth: 400, margin: '0 auto', color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          background: `linear-gradient(135deg,${primary},#8b5cf6)`,
          width: 40, height: 40, borderRadius: 10, margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 64 64">
            <path d="M32 4L8 14V32C8 46.4 18.8 59.8 32 62C45.2 59.8 56 46.4 56 32V14L32 4Z" fill="white" fillOpacity="0.3"/>
            <text x="22" y="44" fontFamily="Arial" fontSize="22" fontWeight="700" fontStyle="italic" fill="white">L</text>
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Sign in</h2>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Social buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => client.signInWithOAuth('google')}
          style={{
            flex: 1, padding: '9px 14px', border: '1px solid #2d2d4e', borderRadius: 8,
            background: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18">
            <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
            <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
            <path d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" fill="#FBBC05"/>
            <path d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" fill="#EA4335"/>
          </svg>
          Google
        </button>
        <button
          onClick={() => client.signInWithOAuth('github')}
          style={{
            flex: 1, padding: '9px 14px', border: '1px solid #2d2d4e', borderRadius: 8,
            background: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: '#2d2d4e' }} />
        <span style={{ color: '#64748b', fontSize: 12 }}>or</span>
        <div style={{ flex: 1, height: 1, background: '#2d2d4e' }} />
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={{
              width: '100%', padding: '9px 12px', background: '#0f0f15',
              border: '1px solid #2d2d4e', borderRadius: 8, color: '#e2e8f0',
              fontSize: 14, boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{
              width: '100%', padding: '9px 12px', background: '#0f0f15',
              border: '1px solid #2d2d4e', borderRadius: 8, color: '#e2e8f0',
              fontSize: 14, boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '10px', background: `linear-gradient(135deg,${primary},#8b5cf6)`,
            border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#64748b' }}>
        Secured by <strong style={{ color: '#6366f1' }}>LegionAuth</strong>
      </div>
    </div>
  )
}

// ------- SignUp -------
export interface SignUpProps {
  redirectUrl?: string
  afterSignUpUrl?: string
  appearance?: { primaryColor?: string }
}

export function SignUp({ afterSignUpUrl = '/', appearance }: SignUpProps) {
  const { client } = useLegionAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const primary = appearance?.primaryColor ?? '#6366f1'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await client.signUp(email, password, { first_name: firstName })
      window.location.href = afterSignUpUrl
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } }
      setError(apiErr.error?.message ?? 'Sign up failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 16, padding: 32,
      maxWidth: 400, margin: '0 auto', color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 24 }}>Create account</h2>
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name"
          style={{ width: '100%', marginBottom: 12, padding: '9px 12px', background: '#0f0f15', border: '1px solid #2d2d4e', borderRadius: 8, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email"
          style={{ width: '100%', marginBottom: 12, padding: '9px 12px', background: '#0f0f15', border: '1px solid #2d2d4e', borderRadius: 8, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password" minLength={8}
          style={{ width: '100%', marginBottom: 20, padding: '9px 12px', background: '#0f0f15', border: '1px solid #2d2d4e', borderRadius: 8, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '10px', background: `linear-gradient(135deg,${primary},#8b5cf6)`,
          border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}

// ------- UserButton -------
export function UserButton() {
  const { user, signOut } = useLegionAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  const initials = [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join('') ||
    user.email?.[0]?.toUpperCase() || '?'

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 13, fontWeight: 700,
        }}
      >
        {user.image_url ? (
          <img src={user.image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : initials}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12,
          padding: 6, minWidth: 200, zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #2d2d4e', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
              {user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.email}
            </div>
            {user.first_name && <div style={{ fontSize: 12, color: '#64748b' }}>{user.email}</div>}
          </div>
          <button
            onClick={async () => { await signOut(); setOpen(false) }}
            style={{
              width: '100%', padding: '8px 12px', background: 'none', border: 'none',
              color: '#ef4444', fontSize: 13, cursor: 'pointer', textAlign: 'left',
              borderRadius: 6,
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

// ------- ProtectedRoute -------
export interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
  fallback?: ReactNode
}

export function ProtectedRoute({ children, redirectTo = '/sign-in', fallback }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useLegionAuth()

  if (!isLoaded) {
    return fallback ? <>{fallback}</> : (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: '#94a3b8' }}>
        Loading...
      </div>
    )
  }

  if (!isSignedIn) {
    window.location.href = redirectTo
    return null
  }

  return <>{children}</>
}
