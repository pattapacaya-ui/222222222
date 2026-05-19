import { useEffect, useState } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'
import type { Session } from '../../lib/api'

export default function SessionsPage() {
  const { accessToken } = useAuthStore()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!accessToken) return
    api.adminGetSessions(accessToken)
      .then(d => setSessions(d.sessions))
      .finally(() => setLoading(false))
  }, [accessToken])

  async function revoke(id: string) {
    if (!accessToken || !confirm('Force-revoke this session?')) return
    await api.adminRevokeSession(accessToken, id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  function timeAgo(ts: number) {
    const diff = Date.now() - ts
    if (diff < 60_000)      return 'just now'
    if (diff < 3_600_000)   return `${Math.floor(diff/60_000)}m ago`
    if (diff < 86_400_000)  return `${Math.floor(diff/3_600_000)}h ago`
    return `${Math.floor(diff/86_400_000)}d ago`
  }

  function parseUA(ua?: string | null) {
    if (!ua) return { browser: 'Unknown', os: '' }
    const browser = ua.includes('Firefox') ? 'Firefox'
      : ua.includes('Chrome') ? 'Chrome'
      : ua.includes('Safari') ? 'Safari'
      : ua.includes('Edge')   ? 'Edge'
      : 'Browser'
    const os = ua.includes('Windows') ? 'Windows'
      : ua.includes('Mac')    ? 'macOS'
      : ua.includes('iPhone') ? 'iOS'
      : ua.includes('Android')? 'Android'
      : ua.includes('Linux')  ? 'Linux'
      : ''
    return { browser, os }
  }

  return (
    <div style={{ padding:'28px 32px', maxWidth:1280 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text)' }}>Sessions</h1>
        <p style={{ fontSize:13, color:'var(--text-3)', marginTop:3 }}>
          {sessions.length} active session{sessions.length !== 1 ? 's' : ''} — force-revoke any from here.
        </p>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><i className="bi bi-arrow-repeat animate-spin" style={{ fontSize:24, color:'var(--text-4)' }} /></div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-shield-check" />
            <h3>No active sessions</h3>
            <p>Active sessions will appear here.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Browser / OS</th>
                <th>IP Address</th>
                <th>Last Active</th>
                <th>Expires</th>
                <th style={{ textAlign:'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s: Session & { email?: string; first_name?: string; last_name?: string }) => {
                const ua    = parseUA(s.user_agent)
                const email = (s as { email?: string }).email ?? ''
                const dn    = [(s as { first_name?: string }).first_name, (s as { last_name?: string }).last_name].filter(Boolean).join(' ') || email
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <div style={{
                          width:32, height:32, borderRadius:'50%', flexShrink:0,
                          background:'linear-gradient(135deg,#7c3aed,#6366f1)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:12, fontWeight:700, color:'white',
                        }}>
                          {dn.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{dn || 'Unknown'}</div>
                          <div style={{ fontSize:11.5, color:'var(--text-4)' }}>{email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <i className={`bi bi-${ua.browser.toLowerCase() === 'chrome' ? 'browser-chrome' : ua.browser.toLowerCase() === 'firefox' ? 'browser-firefox' : ua.browser.toLowerCase() === 'safari' ? 'browser-safari' : 'browser-edge'}`}
                          style={{ fontSize:15, color:'var(--text-3)' }} />
                        <span style={{ fontSize:13, color:'var(--text-2)' }}>{ua.browser}</span>
                        {ua.os && <span style={{ fontSize:11, color:'var(--text-4)' }}>· {ua.os}</span>}
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", background:'var(--surface-2)', padding:'2px 7px', borderRadius:4, color:'var(--text-3)' }}>
                        {s.ip_address ?? '—'}
                      </code>
                    </td>
                    <td style={{ fontSize:12.5, color:'var(--text-3)' }}>{timeAgo(s.last_active_at ?? s.created_at)}</td>
                    <td style={{ fontSize:12.5, color:'var(--text-3)' }}>
                      {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ textAlign:'right' }}>
                      <button onClick={() => revoke(s.id)} className="btn btn-danger btn-sm">
                        <i className="bi bi-x-circle-fill" /> Revoke
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
