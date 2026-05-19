import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/auth-store'
import Logo from '../../components/Logo'
import { useState } from 'react'

const navItems = [
  { to: '/dashboard',               icon: 'bi-grid-1x2-fill',   label: 'Overview',      end: true  },
  { to: '/dashboard/users',         icon: 'bi-people-fill',      label: 'Users'                     },
  { to: '/dashboard/sessions',      icon: 'bi-shield-check',     label: 'Sessions'                  },
  { to: '/dashboard/organizations', icon: 'bi-building',         label: 'Organizations'             },
  { to: '/dashboard/api-keys',      icon: 'bi-key-fill',         label: 'API Keys'                  },
  { to: '/dashboard/webhooks',      icon: 'bi-webhook',          label: 'Webhooks'                  },
  { to: '/dashboard/settings',      icon: 'bi-gear-fill',        label: 'Settings'                  },
]

export default function DashboardLayout() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('') ||
    user?.email?.[0]?.toUpperCase() || '?'

  async function handleSignOut() {
    await signOut()
    navigate('/sign-in')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside style={{
        width: 220, minHeight: '100vh', background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', flexShrink: 0,
      }}>

        {/* Logo zone */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <Logo size={26} showText />
          <div style={{
            marginTop: 10, padding: '4px 10px',
            background: 'rgba(124,58,237,0.1)',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 6, fontSize: 10.5, color: '#a78bfa', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-block',
          }}>
            Dashboard
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          <div style={{ marginBottom: 4, padding: '6px 10px', fontSize: 10.5, color: 'var(--text-4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Management
          </div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="sidebar-item"
              style={({ isActive }) => ({
                background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                color: isActive ? '#a78bfa' : 'var(--text-3)',
                marginBottom: 2,
              })}
            >
              <i className={`bi ${item.icon}`} />
              {item.label}
            </NavLink>
          ))}

          <div style={{ marginTop: 16, marginBottom: 4, padding: '6px 10px', fontSize: 10.5, color: 'var(--text-4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Resources
          </div>
          {[
            { icon: 'bi-file-text', label: 'API Docs', href: '#' },
            { icon: 'bi-github',    label: 'GitHub',   href: 'https://github.com' },
          ].map(item => (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
              className="sidebar-item" style={{ marginBottom: 2, color: 'var(--text-3)', textDecoration: 'none' }}>
              <i className={`bi ${item.icon}`} />
              {item.label}
              <i className="bi bi-arrow-up-right" style={{ fontSize: 11, marginLeft: 'auto', opacity: 0.5 }} />
            </a>
          ))}
        </nav>

        {/* User section */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 8px', position: 'relative' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
              borderRadius: 8, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {user?.image_url
                ? <img src={user.image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {user?.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user?.email?.split('@')[0]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
            <i className={`bi bi-chevron-${userMenuOpen ? 'up' : 'down'}`} style={{ fontSize: 12, color: 'var(--text-4)', flexShrink: 0 }} />
          </div>

          {/* User dropdown */}
          {userMenuOpen && (
            <div style={{
              position: 'absolute', bottom: 68, left: 8, right: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border-2)',
              borderRadius: 10, padding: 6, zIndex: 50,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              animation: 'slideUp 0.15s ease',
            }}>
              <NavLink to="/dashboard/settings" onClick={() => setUserMenuOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
                  borderRadius: 6, color: 'var(--text-2)', textDecoration: 'none', fontSize: 13,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <i className="bi bi-person-circle" style={{ fontSize: 15 }} /> Profile Settings
              </NavLink>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button onClick={handleSignOut} style={{
                width: '100%', padding: '9px 11px', background: 'none', border: 'none',
                display: 'flex', alignItems: 'center', gap: 9, color: '#f87171',
                fontSize: 13, cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit', fontWeight: 500,
                transition: 'background 0.12s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <i className="bi bi-box-arrow-right" style={{ fontSize: 15 }} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}
