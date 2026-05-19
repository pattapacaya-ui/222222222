import { useState } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'
import type { ApiError } from '../../lib/api'
import { API_URL_BASE } from '../../lib/api'

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', marginBottom:20 }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
        <i className={`bi ${icon}`} style={{ fontSize:17, color:'var(--primary)' }} />
        <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em' }}>{title}</h2>
      </div>
      <div style={{ padding:24 }}>{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, accessToken, setTokens } = useAuthStore()

  // Profile
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName,  setLastName]  = useState(user?.last_name ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  // Password
  const [curPw,    setCurPw]    = useState('')
  const [newPw,    setNewPw]    = useState('')
  const [pwError,  setPwError]  = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [showCur,  setShowCur]  = useState(false)
  const [showNew,  setShowNew]  = useState(false)

  // TOTP
  const [totpSetup,   setTotpSetup]   = useState<{ secret: string; qr_uri: string; backup_codes: string[] } | null>(null)
  const [totpCode,    setTotpCode]    = useState('')
  const [totpLoading, setTotpLoading] = useState(false)
  const [totpError,   setTotpError]   = useState('')

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setSaving(true)
    try {
      await api.updateUser(accessToken, { first_name: firstName, last_name: lastName })
      const { user: u, session } = await api.me(accessToken)
      const rt = localStorage.getItem('legion_refresh_token') ?? ''
      setTokens(accessToken, rt, u, session)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setPwError(''); setPwSaving(true)
    try {
      await fetch(`${API_URL_BASE}/v1/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ current_password: curPw, new_password: newPw }),
      })
      setCurPw(''); setNewPw('')
      alert('Password changed successfully!')
    } catch (err) {
      setPwError((err as ApiError).error?.message ?? 'Failed to change password')
    } finally { setPwSaving(false) }
  }

  async function setupTOTP() {
    if (!accessToken) return
    setTotpLoading(true); setTotpError('')
    try { setTotpSetup(await api.setupTOTP(accessToken)) }
    catch (err) { setTotpError((err as ApiError).error?.message ?? 'Failed') }
    finally { setTotpLoading(false) }
  }

  async function confirmTOTP() {
    if (!accessToken || !totpCode) return
    setTotpLoading(true); setTotpError('')
    try {
      const d = await api.confirmTOTP(accessToken, totpCode)
      if (d.success) {
        alert(`TOTP enabled!\n\nBackup codes (save these):\n${(d.backup_codes as string[]).join('\n')}`)
        setTotpSetup(null); setTotpCode('')
      }
    } catch (err) { setTotpError((err as ApiError).error?.message ?? 'Invalid code') }
    finally { setTotpLoading(false) }
  }

  return (
    <div style={{ padding:'28px 32px', maxWidth:720 }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text)' }}>Account Settings</h1>
        <p style={{ fontSize:13, color:'var(--text-3)', marginTop:3 }}>Manage your profile, password, and security preferences.</p>
      </div>

      {/* ── Profile ─────────────────────────────────── */}
      <Section title="Personal Information" icon="bi-person-fill">
        <form onSubmit={saveProfile}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label className="field-label">First name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Alice" />
            </div>
            <div>
              <label className="field-label">Last name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <label className="field-label">Email address</label>
            <div style={{ position:'relative' }}>
              <input value={user?.email ?? ''} disabled style={{ paddingRight:90 }} />
              <span className="badge badge-neutral" style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)' }}>
                <i className="bi bi-lock-fill" style={{fontSize:10}} /> Locked
              </span>
            </div>
            <p className="field-hint">Email cannot be changed from settings. Contact support.</p>
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving   ? <><i className="bi bi-arrow-repeat animate-spin" /> Saving…</> :
             saved    ? <><i className="bi bi-check2-circle" /> Saved!</> :
                        <><i className="bi bi-floppy2-fill" /> Save Changes</>
            }
          </button>
        </form>
      </Section>

      {/* ── Password ────────────────────────────────── */}
      <Section title="Password" icon="bi-lock-fill">
        {pwError && <div className="alert alert-error" style={{ marginBottom:16 }}><i className="bi bi-exclamation-circle-fill" />{pwError}</div>}
        <form onSubmit={changePassword}>
          <div style={{ marginBottom:14 }}>
            <label className="field-label">Current password</label>
            <div style={{ position:'relative' }}>
              <i className="bi bi-lock" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-4)', fontSize:14, pointerEvents:'none' }} />
              <input type={showCur?'text':'password'} value={curPw} onChange={e => setCurPw(e.target.value)} required style={{ paddingLeft:38, paddingRight:40 }} />
              <button type="button" onClick={() => setShowCur(!showCur)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-4)', display:'flex', padding:0 }}>
                <i className={`bi bi-${showCur ? 'eye-slash' : 'eye'}`} style={{ fontSize:14 }} />
              </button>
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <label className="field-label">New password</label>
            <div style={{ position:'relative' }}>
              <i className="bi bi-lock-fill" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-4)', fontSize:14, pointerEvents:'none' }} />
              <input type={showNew?'text':'password'} value={newPw} onChange={e => setNewPw(e.target.value)} minLength={8} required style={{ paddingLeft:38, paddingRight:40 }} />
              <button type="button" onClick={() => setShowNew(!showNew)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-4)', display:'flex', padding:0 }}>
                <i className={`bi bi-${showNew ? 'eye-slash' : 'eye'}`} style={{ fontSize:14 }} />
              </button>
            </div>
          </div>
          <button type="submit" disabled={pwSaving} className="btn btn-primary">
            {pwSaving ? <><i className="bi bi-arrow-repeat animate-spin" /> Updating…</> : <><i className="bi bi-shield-check" /> Update Password</>}
          </button>
        </form>
      </Section>

      {/* ── Two-Factor Auth ──────────────────────────── */}
      <Section title="Two-Factor Authentication" icon="bi-shield-lock-fill">
        {totpError && <div className="alert alert-error" style={{ marginBottom:16 }}><i className="bi bi-exclamation-circle-fill" />{totpError}</div>}

        {!totpSetup ? (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'14px 16px', background:'var(--surface-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
              <i className={`bi bi-${user?.mfa_enabled ? 'shield-fill-check' : 'shield-exclamation'}`}
                style={{ fontSize:22, color: user?.mfa_enabled ? '#10b981' : '#f59e0b' }} />
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>
                  {user?.mfa_enabled ? 'Two-factor authentication is enabled' : '2FA is not enabled'}
                </div>
                <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:2 }}>
                  {user?.mfa_enabled ? 'Your account is protected with TOTP.' : 'Add an extra layer of security using an authenticator app.'}
                </div>
              </div>
              {user?.mfa_enabled && <span className="badge badge-success" style={{ marginLeft:'auto' }}><i className="bi bi-check-circle-fill" /> Active</span>}
            </div>
            <button onClick={setupTOTP} disabled={totpLoading} className="btn btn-secondary">
              {totpLoading ? <><i className="bi bi-arrow-repeat animate-spin" /> Setting up…</> :
                             <><i className="bi bi-qr-code" /> {user?.mfa_enabled ? 'Reconfigure TOTP' : 'Set Up Authenticator App'}</>
              }
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color:'var(--text-3)', fontSize:13.5, marginBottom:20 }}>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
            </p>
            {/* QR Code */}
            <div style={{ background:'white', padding:12, borderRadius:12, display:'inline-block', marginBottom:20 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(totpSetup.qr_uri)}`}
                alt="TOTP QR Code" width={160} height={160}
              />
            </div>
            {/* Manual code */}
            <div style={{ marginBottom:20 }}>
              <label className="field-label">Or enter this secret manually</label>
              <div className="copy-box">
                <i className="bi bi-key" style={{color:'var(--text-4)',fontSize:13}} />
                <code style={{flex:1,fontSize:13,letterSpacing:'0.08em',color:'#a78bfa',fontFamily:"'JetBrains Mono',monospace"}}>{totpSetup.secret}</code>
                <button className="btn btn-sm btn-ghost" style={{padding:'3px 8px'}} onClick={() => navigator.clipboard.writeText(totpSetup.secret)}>
                  <i className="bi bi-clipboard" />
                </button>
              </div>
            </div>
            {/* Confirm code */}
            <div style={{ marginBottom:20 }}>
              <label className="field-label">Enter the 6-digit code to verify</label>
              <input
                type="text" value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="000000" className="otp-input"
                maxLength={6} style={{ maxWidth:180 }}
              />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={confirmTOTP} disabled={totpLoading || totpCode.length < 6} className="btn btn-primary">
                {totpLoading ? <><i className="bi bi-arrow-repeat animate-spin" /> Verifying…</> : <><i className="bi bi-check-circle-fill" /> Enable TOTP</>}
              </button>
              <button onClick={() => { setTotpSetup(null); setTotpCode('') }} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* ── Danger Zone ──────────────────────────────── */}
      <Section title="Danger Zone" icon="bi-exclamation-triangle-fill">
        <p style={{ fontSize:13.5, color:'var(--text-3)', marginBottom:16 }}>
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button className="btn btn-danger" onClick={() => {
          if (confirm('Are you absolutely sure? This will permanently delete your account.')) {
            if (accessToken) api.deleteMe(accessToken).then(() => window.location.href = '/')
          }
        }}>
          <i className="bi bi-trash3-fill" /> Delete My Account
        </button>
      </Section>
    </div>
  )
}
