import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'
import type { ApiError } from '../../lib/api'
import Logo from '../../components/Logo'

type Step = 'credentials' | 'mfa' | 'magic-sent' | 'otp-verify'

export default function SignInPage() {
  const navigate   = useNavigate()
  const { setTokens } = useAuthStore()

  const [step,        setStep]        = useState<Step>('credentials')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [mfaCode,     setMfaCode]     = useState('')
  const [otpCode,     setOtpCode]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const API_URL = import.meta.env.VITE_API_URL ?? 'https://legionauth-api.workers.dev'

  /* ── Handlers ─────────────────────────────────────── */
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await api.signIn({ email, password, totp_code: mfaCode || undefined })
      setTokens(result.access_token, result.refresh_token, result.user, result.session)
      navigate('/dashboard')
    } catch (err) {
      const ae = err as ApiError
      if (ae.error?.code === 'MFA_REQUIRED') { setStep('mfa') }
      else setError(ae.error?.message ?? 'Sign in failed')
    } finally { setLoading(false) }
  }

  async function handleMagicLink() {
    if (!email) { setError('Enter your email address first'); return }
    setError(''); setLoading(true)
    try { await api.sendMagicLink(email); setStep('magic-sent') }
    catch (err) { setError((err as ApiError).error?.message ?? 'Failed to send magic link') }
    finally { setLoading(false) }
  }

  async function handleSendOTP() {
    if (!email) { setError('Enter your email address first'); return }
    setError(''); setLoading(true)
    try { await api.sendEmailOTP(email); setStep('otp-verify') }
    catch (err) { setError((err as ApiError).error?.message ?? 'Failed to send code') }
    finally { setLoading(false) }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const result = await api.verifyEmailOTP(email, otpCode)
      setTokens(result.access_token, result.refresh_token, result.user, result.session)
      navigate('/dashboard')
    } catch (err) { setError((err as ApiError).error?.message ?? 'Invalid code') }
    finally { setLoading(false) }
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email first'); return }
    setLoading(true)
    try { await api.forgotPassword(email); setError(''); alert('If that email exists, a reset link has been sent.') }
    catch { /* silent */ }
    finally { setLoading(false) }
  }

  /* ── Render ───────────────────────────────────────── */
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
            {step === 'mfa'        ? 'Two-Step Verification'  :
             step === 'magic-sent' ? 'Check your inbox'       :
             step === 'otp-verify' ? 'Enter your code'        :
             'Welcome back'}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13.5, marginTop: 5 }}>
            {step === 'credentials' && 'Sign in to your LegionAuth account'}
            {step === 'mfa'         && 'Enter the 6-digit code from your authenticator app'}
            {step === 'magic-sent'  && `Magic link sent to ${email}`}
            {step === 'otp-verify'  && `We sent a code to ${email}`}
          </p>
        </div>

        {/* Card */}
        <div className="auth-card">

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <i className="bi bi-exclamation-circle-fill" />
              {error}
            </div>
          )}

          {/* ── CREDENTIALS STEP ───────────────────────── */}
          {step === 'credentials' && (
            <>
              {/* Social buttons */}
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

              <div className="divider" style={{ marginBottom: 20 }}>or continue with email</div>

              <form onSubmit={handleSignIn}>
                {/* Email */}
                <div style={{ marginBottom: 14 }}>
                  <label className="field-label">Email address</label>
                  <div style={{ position: 'relative' }}>
                    <i className="bi bi-envelope" style={{
                      position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-4)', fontSize: 15, pointerEvents: 'none',
                    }} />
                    <input
                      type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="field-label" style={{ margin: 0 }}>Password</label>
                    <button type="button" onClick={handleForgotPassword} style={{
                      background: 'none', border: 'none', color: 'var(--indigo)',
                      fontSize: 12.5, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
                    }}>
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <i className="bi bi-lock" style={{
                      position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-4)', fontSize: 15, pointerEvents: 'none',
                    }} />
                    <input
                      type={showPw ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required
                      style={{ paddingLeft: 40, paddingRight: 42 }}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)',
                      display: 'flex', padding: 0,
                    }}>
                      <i className={showPw ? 'bi bi-eye-slash' : 'bi bi-eye'} style={{ fontSize: 15 }} />
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ marginBottom: 10 }}>
                  {loading
                    ? <><i className="bi bi-arrow-repeat animate-spin" /> Signing in…</>
                    : <><i className="bi bi-arrow-right-circle-fill" /> Sign In</>
                  }
                </button>
              </form>

              {/* Passwordless options */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                <button onClick={handleMagicLink} disabled={loading} className="btn btn-ghost btn-sm">
                  <i className="bi bi-magic" /> Magic Link
                </button>
                <button onClick={handleSendOTP} disabled={loading} className="btn btn-ghost btn-sm">
                  <i className="bi bi-123" /> Email Code
                </button>
              </div>
            </>
          )}

          {/* ── MFA STEP ───────────────────────────────── */}
          {step === 'mfa' && (
            <form onSubmit={handleSignIn}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, margin: '0 auto 20px',
                background: 'rgba(124,58,237,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="bi bi-shield-lock-fill" style={{ fontSize: 26, color: 'var(--primary)' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="field-label" style={{ textAlign: 'center', display: 'block' }}>Authentication Code</label>
                <input
                  type="text" value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="000 000" className="otp-input"
                  autoFocus maxLength={6}
                />
                <p className="field-hint" style={{ textAlign: 'center', marginTop: 8 }}>
                  Enter code from your authenticator app, or a backup code
                </p>
              </div>
              <button type="submit" disabled={loading || mfaCode.length < 6} className="btn btn-primary btn-block" style={{ marginBottom: 10 }}>
                {loading ? <><i className="bi bi-arrow-repeat animate-spin" /> Verifying…</> : <><i className="bi bi-check-circle-fill" /> Verify</>}
              </button>
              <button type="button" onClick={() => setStep('credentials')} className="btn btn-ghost btn-block">
                <i className="bi bi-arrow-left" /> Back
              </button>
            </form>
          )}

          {/* ── MAGIC LINK SENT ────────────────────────── */}
          {step === 'magic-sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: '0 auto 20px',
                background: 'rgba(16,185,129,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="bi bi-envelope-check-fill" style={{ fontSize: 30, color: '#10b981' }} />
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>
                We sent a magic sign-in link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
                Click the link in the email to sign in instantly.
              </p>
              <button onClick={() => setStep('credentials')} className="btn btn-ghost btn-block">
                <i className="bi bi-arrow-left" /> Back to sign in
              </button>
            </div>
          )}

          {/* ── OTP VERIFY ─────────────────────────────── */}
          {step === 'otp-verify' && (
            <form onSubmit={handleVerifyOTP}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, margin: '0 auto 20px',
                background: 'rgba(99,102,241,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="bi bi-chat-square-dots-fill" style={{ fontSize: 24, color: '#6366f1' }} />
              </div>
              <div style={{ marginBottom: 22 }}>
                <label className="field-label" style={{ textAlign: 'center', display: 'block' }}>6-Digit Code</label>
                <input
                  type="text" value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="000000" className="otp-input"
                  autoFocus maxLength={6}
                />
              </div>
              <button type="submit" disabled={loading || otpCode.length < 6} className="btn btn-primary btn-block" style={{ marginBottom: 10 }}>
                {loading ? <><i className="bi bi-arrow-repeat animate-spin" /> Verifying…</> : <><i className="bi bi-check-circle-fill" /> Verify Code</>}
              </button>
              <button type="button" onClick={() => setStep('credentials')} className="btn btn-ghost btn-block">
                <i className="bi bi-arrow-left" /> Back
              </button>
            </form>
          )}

          {/* Footer link */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 20, textAlign: 'center' }}>
            <span style={{ color: 'var(--text-4)', fontSize: 13 }}>Don't have an account? </span>
            <Link to="/sign-up" style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Sign up free
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
