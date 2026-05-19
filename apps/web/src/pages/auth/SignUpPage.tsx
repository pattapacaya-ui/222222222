import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'
import type { ApiError } from '../../lib/api'
import Logo from '../../components/Logo'

/* ── Password Strength ─────────────────────────── */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const rules = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number',    ok: /[0-9]/.test(password) },
    { label: 'Symbol',    ok: /[^a-zA-Z0-9]/.test(password) },
  ]
  const score  = rules.filter(r => r.ok).length
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#10b981']
  const labels = ['Weak', 'Fair', 'Good', 'Strong']

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="pw-bar" style={{
            background: i < score ? colors[score - 1] : 'var(--surface-3)',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {rules.map(r => (
            <span key={r.label} style={{ fontSize: 11, color: r.ok ? '#10b981' : 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <i className={r.ok ? 'bi bi-check-circle-fill' : 'bi bi-circle'} style={{ fontSize: 10 }} />
              {r.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span style={{ fontSize: 11, color: colors[score - 1], fontWeight: 600 }}>
            {labels[score - 1]}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Component ─────────────────────────────────── */
export default function SignUpPage() {
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const API_URL = import.meta.env.VITE_API_URL ?? 'https://legionauth-api.workers.dev'

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await api.signUp({ email, password, first_name: firstName, last_name: lastName })
      setTokens(result.access_token, result.refresh_token, result.user, result.session)
      navigate('/dashboard')
    } catch (err) {
      setError((err as ApiError).error?.message ?? 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
      backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(124,58,237,0.12) 0%, transparent 70%)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, animation: 'slideUp 0.3s ease' }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link to="/"><Logo size={44} /></Link>
          <h1 style={{ marginTop: 16, fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Create your account
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13.5, marginTop: 5 }}>
            Free forever · No credit card required
          </p>
        </div>

        <div className="auth-card">

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <i className="bi bi-exclamation-circle-fill" />
              {error}
            </div>
          )}

          {/* Social */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <a href={`${API_URL}/v1/oauth/google/authorize`} className="social-btn">
              <svg width="17" height="17" viewBox="0 0 18 18">
                <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
                <path d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" fill="#FBBC05"/>
                <path d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" fill="#EA4335"/>
              </svg>
              Google
            </a>
            <a href={`${API_URL}/v1/oauth/github/authorize`} className="social-btn">
              <i className="bi bi-github" style={{ fontSize: 17 }} />
              GitHub
            </a>
          </div>

          <div className="divider" style={{ marginBottom: 20 }}>or sign up with email</div>

          <form onSubmit={handleSignUp}>
            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label className="field-label">First name</label>
                <div style={{ position: 'relative' }}>
                  <i className="bi bi-person" style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-4)', fontSize: 15, pointerEvents: 'none',
                  }} />
                  <input
                    type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                    placeholder="Alice" style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Last name</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Email address</label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-envelope" style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-4)', fontSize: 15, pointerEvents: 'none',
                }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label className="field-label">Password</label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-lock" style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-4)', fontSize: 15, pointerEvents: 'none',
                }} />
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a strong password" required minLength={8}
                  style={{ paddingLeft: 38, paddingRight: 42 }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 0,
                }}>
                  <i className={showPw ? 'bi bi-eye-slash' : 'bi bi-eye'} style={{ fontSize: 15 }} />
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-block">
              {loading
                ? <><i className="bi bi-arrow-repeat animate-spin" /> Creating account…</>
                : <><i className="bi bi-person-plus-fill" /> Create Account</>
              }
            </button>
          </form>

          {/* Terms */}
          <p style={{ fontSize: 11.5, color: 'var(--text-4)', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
            By creating an account you agree to our{' '}
            <a href="#" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Terms</a>
            {' & '}
            <a href="#" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Privacy Policy</a>
          </p>

          {/* Sign in link */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 20, textAlign: 'center' }}>
            <span style={{ color: 'var(--text-4)', fontSize: 13 }}>Already have an account? </span>
            <Link to="/sign-in" style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
