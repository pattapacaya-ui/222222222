import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../../components/Logo'

/* ─── Data ─────────────────────────────────────────────── */
const features = [
  {
    icon: 'bi-shield-lock-fill',
    title: 'Multi-Factor Auth',
    desc: 'TOTP authenticator app with backup codes. Enforce MFA per user or organization-wide. RFC 6238 compliant via Web Crypto.',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.1)',
  },
  {
    icon: 'bi-lightning-charge-fill',
    title: 'Magic Links & OTP',
    desc: 'Passwordless flows via branded email magic links or 6-digit one-time codes with rate limiting built-in.',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
  },
  {
    icon: 'bi-building',
    title: 'Organizations',
    desc: 'Full multi-tenancy: create orgs, invite members by email, manage roles (admin/member), leave/delete flows.',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.1)',
  },
  {
    icon: 'bi-arrow-repeat',
    title: 'Session Rotation',
    desc: 'RS256 JWTs, 60s access tokens, 30-day rotating refresh tokens. Per-device session list with force-revoke.',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
  },
  {
    icon: 'bi-key-fill',
    title: 'API Keys',
    desc: 'HMAC-SHA256 hashed keys. Shown once on creation. Instant revocation. Scoped per application.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
  },
  {
    icon: 'bi-webhook',
    title: 'Signed Webhooks',
    desc: 'Real-time events signed with HMAC-SHA256. Full delivery logs, test endpoint, retry visibility.',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.1)',
  },
  {
    icon: 'bi-fingerprint',
    title: 'OAuth 2.0 + PKCE',
    desc: 'Google & GitHub SSO with PKCE flow. User upsert on first login. Unlink connections any time.',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.1)',
  },
  {
    icon: 'bi-speedometer2',
    title: 'Rate Limiting',
    desc: 'KV-based sliding window. 5/60s sign-in, 3/hr OTP, 10/hr sign-up. Returns X-RateLimit headers.',
    color: '#14b8a6',
    bg: 'rgba(20,184,166,0.1)',
  },
  {
    icon: 'bi-journal-text',
    title: 'Audit Logs',
    desc: 'Complete event trail in D1. Every sign-in, MFA change, org update, and API key operation logged.',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.1)',
  },
]

const comparison = [
  { feature: 'Free tier users',    us: '∞ Unlimited', clerk: '10,000',      auth0: '7,500',       firebase: '10,000'      },
  { feature: 'MFA / TOTP',         us: true,          clerk: true,           auth0: true,           firebase: false         },
  { feature: 'Magic Links',        us: true,          clerk: true,           auth0: true,           firebase: false         },
  { feature: 'Organizations',      us: true,          clerk: 'Paid',         auth0: 'Paid',         firebase: false         },
  { feature: 'Webhooks',           us: true,          clerk: 'Paid',         auth0: true,           firebase: false         },
  { feature: 'API Keys',           us: true,          clerk: true,           auth0: false,          firebase: false         },
  { feature: 'Signed webhooks',    us: true,          clerk: 'Paid',         auth0: 'Paid',         firebase: false         },
  { feature: 'Open source',        us: true,          clerk: false,          auth0: false,          firebase: false         },
  { feature: 'Self-hostable',      us: true,          clerk: false,          auth0: false,          firebase: false         },
  { feature: 'Edge runtime',       us: true,          clerk: true,           auth0: false,          firebase: false         },
  { feature: 'Price/mo',           us: 'Free forever',clerk: '$25+',        auth0: '$23+',         firebase: 'Usage-based' },
]

const codeExamples = {
  react: `import { LegionAuthProvider, useUser, SignIn } from '@legionauth/react'

function App() {
  return (
    <LegionAuthProvider publishableKey="la_pub_...">
      <Dashboard />
    </LegionAuthProvider>
  )
}

function Dashboard() {
  const { user, isSignedIn, isLoaded } = useUser()

  if (!isLoaded) return <Spinner />
  if (!isSignedIn) return <SignIn />

  return (
    <h1>
      Welcome, {user.first_name}!
      <span>{user.email}</span>
    </h1>
  )
}`,
  js: `import { LegionAuthClient } from '@legionauth/js'

const auth = new LegionAuthClient({
  publishableKey: 'la_pub_...',
})

// Sign up
const { user, access_token } = await auth.signUp({
  email: 'alice@example.com',
  password: 'SuperSecure123!',
})

// Sign in (password or magic link)
const result = await auth.signIn({
  email: 'alice@example.com',
  password: 'SuperSecure123!',
})

// Get authenticated user
const me = await auth.getUser()
console.log(me.first_name, me.email)`,
  curl: `# Sign up
curl -X POST https://api.legionauth.dev/v1/auth/sign-up \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"Secure1!"}'

# Sign in → returns access_token + refresh_token
curl -X POST https://api.legionauth.dev/v1/auth/sign-in \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"Secure1!"}'

# Get current user
curl https://api.legionauth.dev/v1/auth/me \\
  -H "Authorization: Bearer <access_token>"`,
}

/* ─── Cell helper ───────────────────────────────────────── */
function Cell({ val }: { val: boolean | string }) {
  if (val === true)  return <span style={{ color: '#34d399', fontSize: 18 }}><i className="bi bi-check-circle-fill" /></span>
  if (val === false) return <span style={{ color: '#475569', fontSize: 18 }}><i className="bi bi-x-circle" /></span>
  return <span style={{ color: val.includes('Paid') || val.startsWith('$') ? '#fbbf24' : val === '∞ Unlimited' || val === 'Free forever' ? '#34d399' : '#94a3b8', fontWeight: 500 }}>{val}</span>
}

/* ─── Component ─────────────────────────────────────────── */
export default function LandingPage() {
  const [tab, setTab] = useState<'react' | 'js' | 'curl'>('react')
  const API_URL = import.meta.env.VITE_API_URL ?? 'https://legionauth-api.workers.dev'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', overflowX: 'hidden' }}>

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(20px)',
        padding: '0 32px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <Logo size={30} showText />
          <div style={{ display: 'flex', gap: 4 }}>
            {['Features', 'Pricing', 'Docs'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} style={{
                padding: '6px 12px', borderRadius: 6, color: 'var(--text-3)',
                fontSize: 13.5, fontWeight: 500, textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent' }}
              >{l}</a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            style={{ padding: '6px 12px', color: 'var(--text-3)', fontSize: 13.5, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-github" style={{ fontSize: 15 }} /> GitHub
          </a>
          <Link to="/sign-in" style={{
            padding: '7px 16px', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-2)', fontSize: 13.5, fontWeight: 500, textDecoration: 'none',
            border: '1px solid var(--border-2)', background: 'var(--surface-2)',
            transition: 'all 0.2s',
          }}>Sign In</Link>
          <Link to="/sign-up" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
            Get Started <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="hero-gradient" style={{ position: 'relative', padding: '100px 24px 80px', textAlign: 'center', overflow: 'hidden' }}>
        <div className="hero-grid" />

        {/* Glow orbs */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 400,
          background: 'radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 840, margin: '0 auto' }}>
          {/* Pill badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <span className="nav-pill">
              <i className="bi bi-stars" />
              Built on Cloudflare Workers · No cold starts
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(42px,7vw,82px)', fontWeight: 900,
            lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: 24,
          }}>
            <span className="gradient-text">Authentication</span>
            <br />
            <span style={{ color: 'var(--text)' }}>that just works.</span>
          </h1>

          <p style={{ fontSize: 'clamp(16px,2vw,20px)', color: 'var(--text-3)', maxWidth: 580, margin: '0 auto 44px', lineHeight: 1.65 }}>
            Drop-in auth for any app. Sign-up, MFA, magic links, organizations,
            webhooks, OAuth — full Clerk-feature-parity at <strong style={{ color: 'var(--text-2)' }}>$0/month, forever.</strong>
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/sign-up" className="btn btn-primary btn-xl" style={{ textDecoration: 'none' }}>
              <i className="bi bi-rocket-takeoff-fill" />
              Start Building Free
            </Link>
            <a href="#features" className="btn btn-secondary btn-xl" style={{ textDecoration: 'none' }}>
              <i className="bi bi-play-circle" />
              See Features
            </a>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 0, justifyContent: 'center',
            marginTop: 72, borderTop: '1px solid var(--border)', paddingTop: 48,
            flexWrap: 'wrap',
          }}>
            {[
              { icon: 'bi-infinity',          num: 'Unlimited', label: 'Free Users'      },
              { icon: 'bi-shield-check',       num: 'RS256',     label: 'JWT Signing'     },
              { icon: 'bi-lightning-fill',     num: '< 5ms',     label: 'Edge Latency'    },
              { icon: 'bi-code-slash',         num: '100%',      label: 'Open Source'     },
              { icon: 'bi-cloud-check-fill',   num: '16',        label: 'DB Tables'       },
            ].map((s, i) => (
              <div key={i} style={{
                flex: '1 1 140px', textAlign: 'center', padding: '0 24px',
                borderRight: i < 4 ? '1px solid var(--border)' : 'none',
              }}>
                <i className={s.icon} style={{ fontSize: 22, color: 'var(--primary)', display: 'block', marginBottom: 8 }} />
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{s.num}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <section id="features" style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="nav-pill" style={{ marginBottom: 20, display: 'inline-flex' }}>
            <i className="bi bi-grid-3x3-gap-fill" /> Features
          </span>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.03em', marginTop: 16, marginBottom: 16 }}>
            Everything authentication needs
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
            Production-grade auth primitives, not demos. Every feature built on cryptographic best practices.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {features.map(f => (
            <div key={f.title} className="glass-card" style={{ padding: '26px 28px' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = f.color + '40')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="feature-icon" style={{ background: f.bg, color: f.color }}>
                <i className={f.icon} />
              </div>
              <h3 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SDK SHOWCASE ───────────────────────────────────── */}
      <section id="docs" style={{ padding: '80px 32px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="nav-pill" style={{ marginBottom: 20, display: 'inline-flex' }}>
            <i className="bi bi-braces-asterisk" /> SDKs
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 800, letterSpacing: '-0.03em', marginTop: 16, marginBottom: 14 }}>
            Integrate in minutes
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 15 }}>
            React hooks, vanilla JS client, or raw REST API — pick your flavor.
          </p>
        </div>

        {/* Install strip */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
        }}>
          {[
            { pkg: 'npm install @legionauth/react', icon: 'bi-npm' },
            { pkg: 'npm install @legionauth/js',    icon: 'bi-filetype-js' },
          ].map(item => (
            <div key={item.pkg} className="copy-box" style={{ flex: 1, minWidth: 260 }}>
              <i className={item.icon} style={{ color: 'var(--text-4)', fontSize: 15 }} />
              <code style={{ flex: 1, fontSize: 12.5, color: 'var(--text-3)' }}>{item.pkg}</code>
              <button
                className="btn-icon btn"
                onClick={() => navigator.clipboard.writeText(item.pkg)}
                title="Copy"
                style={{ padding: '2px 6px', fontSize: 14 }}
              >
                <i className="bi bi-clipboard" />
              </button>
            </div>
          ))}
        </div>

        {/* Code tabs */}
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--border-2)',
          borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px', background: 'var(--surface)' }}>
            {([
              { k: 'react', icon: 'bi-filetype-tsx', label: 'React' },
              { k: 'js',    icon: 'bi-filetype-js',  label: 'JavaScript' },
              { k: 'curl',  icon: 'bi-terminal',     label: 'cURL' },
            ] as const).map(t => (
              <button key={t.k} className={`code-tab ${tab === t.k ? 'active' : ''}`} onClick={() => setTab(t.k)}>
                <i className={t.icon} /> {t.label}
              </button>
            ))}
          </div>
          <pre style={{
            padding: '24px 28px', fontSize: 13, lineHeight: 1.8,
            color: '#c4b5fd', fontFamily: "'JetBrains Mono','Fira Code',monospace",
            overflowX: 'auto', margin: 0, background: 'transparent',
          }}>
            <code>{codeExamples[tab]}</code>
          </pre>
        </div>
      </section>

      {/* ── ARCHITECTURE STRIP ─────────────────────────────── */}
      <section style={{ padding: '0 32px 80px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 40px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
          gap: 24,
        }}>
          {[
            { icon: 'bi-cloud-lightning-fill', label: 'Cloudflare Workers',  sub: 'Edge runtime',         color: '#f97316' },
            { icon: 'bi-database-fill',        label: 'D1 — SQLite',         sub: '16 tables, migrations', color: '#06b6d4' },
            { icon: 'bi-lightning-fill',       label: 'KV Store',            sub: 'Sessions & JWKS cache', color: '#a78bfa' },
            { icon: 'bi-lock-fill',            label: 'Web Crypto API',      sub: 'PBKDF2 · RS256 · HMAC', color: '#10b981' },
            { icon: 'bi-envelope-fill',        label: 'Resend Email',        sub: 'Branded templates',     color: '#f59e0b' },
            { icon: 'bi-hono',                 label: 'Hono.js v4',          sub: 'Ultra-fast framework',  color: '#e879f9' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: item.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: item.color, flexShrink: 0,
              }}>
                <i className={item.icon} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMPARISON TABLE ───────────────────────────────── */}
      <section id="pricing" style={{ padding: '80px 32px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="nav-pill" style={{ marginBottom: 20, display: 'inline-flex' }}>
            <i className="bi bi-bar-chart-fill" /> Pricing
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 800, letterSpacing: '-0.03em', marginTop: 16, marginBottom: 14 }}>
            Why pay for auth?
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 15 }}>
            LegionAuth gives you every feature. Forever free.
          </p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="compare-table">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th style={{ textAlign: 'left', color: 'var(--text-4)' }}>Feature</th>
                  <th className="compare-col-us" style={{ textAlign: 'center', color: '#a78bfa' }}>
                    <i className="bi bi-hexagon-fill" style={{ marginRight: 6 }} />LegionAuth
                  </th>
                  <th style={{ textAlign: 'center', color: 'var(--text-4)' }}>Clerk</th>
                  <th style={{ textAlign: 'center', color: 'var(--text-4)' }}>Auth0</th>
                  <th style={{ textAlign: 'center', color: 'var(--text-4)' }}>Firebase</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-2)', fontWeight: 500 }}>{row.feature}</td>
                    <td className="compare-col-us" style={{ textAlign: 'center' }}><Cell val={row.us} /></td>
                    <td style={{ textAlign: 'center' }}><Cell val={row.clerk} /></td>
                    <td style={{ textAlign: 'center' }}><Cell val={row.auth0} /></td>
                    <td style={{ textAlign: 'center' }}><Cell val={row.firebase} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Link to="/sign-up" className="btn btn-primary btn-xl" style={{ textDecoration: 'none' }}>
            <i className="bi bi-rocket-takeoff-fill" />
            Get Started — It's Free
          </Link>
          <p style={{ color: 'var(--text-4)', fontSize: 12.5, marginTop: 12 }}>
            No credit card · No rate limits · No expiry
          </p>
        </div>
      </section>

      {/* ── TESTIMONIAL / CTA BANNER ───────────────────────── */}
      <section style={{ padding: '0 32px 96px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(99,102,241,0.1) 50%, rgba(6,182,212,0.08) 100%)',
          border: '1px solid rgba(124,58,237,0.25)',
          borderRadius: 24, padding: '56px 48px',
          textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -60, width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <i className="bi bi-hexagon-fill" style={{ fontSize: 40, color: 'var(--primary)', marginBottom: 20, display: 'block' }} />
          <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Ready to ship auth in minutes?
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 16, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Deploy to Cloudflare with one command. Full production setup in under 5 minutes.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/sign-up" className="btn btn-primary btn-xl" style={{ textDecoration: 'none' }}>
              <i className="bi bi-rocket-takeoff-fill" /> Start Building
            </Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-xl" style={{ textDecoration: 'none' }}>
              <i className="bi bi-github" /> View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '40px 32px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <Logo size={26} showText />
            <p style={{ color: 'var(--text-4)', fontSize: 12.5, marginTop: 8 }}>
              Open-source auth-as-a-service on Cloudflare.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[
              { label: 'Features', href: '#features' },
              { label: 'Pricing',  href: '#pricing'  },
              { label: 'Docs',     href: '#docs'      },
              { label: 'GitHub',   href: 'https://github.com' },
              { label: 'Sign In',  href: '/sign-in',  internal: true },
              { label: 'Sign Up',  href: '/sign-up',  internal: true },
            ].map(l => l.internal
              ? <Link key={l.label} to={l.href!} style={{ color: 'var(--text-4)', fontSize: 13, textDecoration: 'none' }}>{l.label}</Link>
              : <a key={l.label} href={l.href} style={{ color: 'var(--text-4)', fontSize: 13, textDecoration: 'none' }}>{l.label}</a>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-4)', fontSize: 12 }}>
            <i className="bi bi-cloud-fill" style={{ color: '#f97316' }} />
            <span>Powered by Cloudflare</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
