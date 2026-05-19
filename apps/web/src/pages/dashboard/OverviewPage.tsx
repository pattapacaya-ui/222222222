import { useEffect, useState } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'

interface Stats {
  total_users: number
  active_sessions: number
  total_organizations: number
  active_api_keys: number
}

interface RecentSignin {
  email: string
  first_name: string
  last_name: string
  created_at: number
  ip_address: string
}

const statDefs = [
  { key: 'total_users',          icon: 'bi-people-fill',       label: 'Total Users',       color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  { key: 'active_sessions',      icon: 'bi-shield-check',      label: 'Active Sessions',   color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  { key: 'total_organizations',  icon: 'bi-building',          label: 'Organizations',     color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  { key: 'active_api_keys',      icon: 'bi-key-fill',          label: 'Active API Keys',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
] as const

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function OverviewPage() {
  const { accessToken, user } = useAuthStore()
  const [stats,         setStats]         = useState<Stats | null>(null)
  const [recentSignins, setRecentSignins] = useState<RecentSignin[]>([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!accessToken) return
    api.adminGetStats(accessToken)
      .then(data => {
        setStats(data.stats)
        setRecentSignins(data.recent_signins as RecentSignin[])
      })
      .catch(() => setStats({ total_users: 0, active_sessions: 0, total_organizations: 0, active_api_keys: 0 }))
      .finally(() => setLoading(false))
  }, [accessToken])

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }
  const name = user?.first_name ?? user?.email?.split('@')[0] ?? 'there'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280 }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <i className="bi bi-bar-chart-line-fill" style={{ color: 'var(--primary)', fontSize: 14 }} />
          <span style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overview</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
          {greeting()}, {name} 👋
        </h1>
        <p style={{ color: 'var(--text-3)', marginTop: 5, fontSize: 14 }}>
          Here's what's happening across your LegionAuth platform.
        </p>
      </div>

      {/* ── Stat Cards ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 16, marginBottom: 32 }}>
        {statDefs.map(def => {
          const val = stats?.[def.key] ?? 0
          return (
            <div key={def.key} className="stat-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {loading
                ? <div style={{ width: 42, height: 42, borderRadius: 'var(--radius)', background: 'var(--surface-2)' }} className="shimmer" />
                : (
                  <div className="stat-icon" style={{ background: def.bg, color: def.color }}>
                    <i className={`bi ${def.icon}`} />
                  </div>
                )}
              <div>
                {loading
                  ? <div style={{ width: 56, height: 28, background: 'var(--surface-2)', borderRadius: 6, marginBottom: 6 }} className="shimmer" />
                  : <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.03em' }}>{fmt(val)}</div>
                }
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>{def.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Recent Sign-ins ─────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="bi bi-clock-history" style={{ color: 'var(--primary)', fontSize: 16 }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Recent Sign-ins</h2>
          </div>
          <span className="badge badge-neutral">
            <i className="bi bi-clock" /> Last 10
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 32 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)' }} className="shimmer" />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '40%', height: 13, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 6 }} className="shimmer" />
                  <div style={{ width: '60%', height: 11, background: 'var(--surface-2)', borderRadius: 4 }} className="shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : recentSignins.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-person-check" />
            <h3>No sign-ins yet</h3>
            <p>Sign-ins will appear here once users start authenticating.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>IP Address</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentSignins.map((s, i) => {
                const displayName = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email
                const initials    = displayName.charAt(0).toUpperCase()
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg,#7c3aed,#6366f1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: 12, fontWeight: 700,
                        }}>{initials}</div>
                        <div>
                          <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{displayName}</div>
                          <div style={{ color: 'var(--text-4)', fontSize: 12 }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 4 }}>
                        {s.ip_address ?? '—'}
                      </code>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                      {new Date(s.created_at).toLocaleString()}
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
