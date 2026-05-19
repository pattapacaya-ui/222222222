import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'
import type { User } from '../../lib/api'

/* ── User Detail Slide-over ──────────────────────── */
function UserPanel({ user, token, onClose, onUpdate }: {
  user: User; token: string; onClose: () => void; onUpdate: (u: User) => void
}) {
  const [busy, setBusy] = useState(false)
  const dn = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || user.id

  async function ban()    { setBusy(true); try { await api.adminBanUser(token, user.id);   onUpdate({...user, banned:true})  } finally { setBusy(false) } }
  async function unban()  { setBusy(true); try { await api.adminUnbanUser(token, user.id); onUpdate({...user, banned:false}) } finally { setBusy(false) } }
  async function del()    {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return
    setBusy(true); try { await api.adminDeleteUser(token, user.id); onClose() } finally { setBusy(false) }
  }

  return (
    <>
      {/* backdrop */}
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(3px)', zIndex:199 }} onClick={onClose} />
      {/* panel */}
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:380,
        background:'var(--surface)', borderLeft:'1px solid var(--border-2)',
        padding:28, overflowY:'auto', zIndex:200,
        boxShadow:'-12px 0 40px rgba(0,0,0,0.5)',
        animation:'slideUp 0.2s ease',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em' }}>User Details</h3>
          <button onClick={onClose} className="btn btn-icon"><i className="bi bi-x-lg" style={{fontSize:16}} /></button>
        </div>

        {/* Avatar */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:24, padding:'20px 0', borderBottom:'1px solid var(--border)' }}>
          <div style={{
            width:64, height:64, borderRadius:'50%', marginBottom:12,
            background:'linear-gradient(135deg,#7c3aed,#6366f1)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:24, fontWeight:700, color:'white',
          }}>
            {user.image_url ? <img src={user.image_url} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}} alt="" /> : dn.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontWeight:700, color:'var(--text)', fontSize:15 }}>{dn}</div>
          <div style={{ color:'var(--text-4)', fontSize:13, marginTop:3 }}>{user.email}</div>
          <div style={{ marginTop:10, display:'flex', gap:8 }}>
            <span className={`badge ${user.email_verified ? 'badge-success' : 'badge-warning'}`}>
              <i className={`bi bi-${user.email_verified ? 'check-circle-fill' : 'clock'}`} />
              {user.email_verified ? 'Verified' : 'Unverified'}
            </span>
            {user.banned && <span className="badge badge-danger"><i className="bi bi-slash-circle-fill" /> Banned</span>}
          </div>
        </div>

        {/* Meta */}
        {[
          { icon:'bi-hash',           label:'User ID',    val:user.id           },
          { icon:'bi-calendar3',      label:'Joined',     val:new Date(user.created_at ?? 0).toLocaleDateString() },
          { icon:'bi-clock',          label:'Last login', val:user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never' },
        ].map(row => (
          <div key={row.label} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:14 }}>
            <i className={`bi ${row.icon}`} style={{ fontSize:15, color:'var(--text-4)', marginTop:1, flexShrink:0 }} />
            <div>
              <div style={{ fontSize:11, color:'var(--text-4)', fontWeight:500, marginBottom:2 }}>{row.label}</div>
              <div style={{ fontSize:13, color:'var(--text-2)', fontFamily:row.label==='User ID'?"'JetBrains Mono',monospace":'inherit', wordBreak:'break-all' }}>{row.val}</div>
            </div>
          </div>
        ))}

        {/* Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:24 }}>
          {user.banned
            ? <button onClick={unban} disabled={busy} className="btn btn-secondary btn-block">
                <i className="bi bi-person-check-fill" /> Unban User
              </button>
            : <button onClick={ban} disabled={busy} className="btn btn-danger btn-block">
                <i className="bi bi-slash-circle-fill" /> Ban User
              </button>
          }
          <button onClick={del} disabled={busy} style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', borderRadius:'var(--radius)', padding:'10px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:14, fontWeight:600, fontFamily:'inherit' }}>
            <i className="bi bi-trash3-fill" /> Delete User
          </button>
        </div>
      </div>
    </>
  )
}

/* ── Main Component ──────────────────────────────── */
export default function UsersPage() {
  const { accessToken } = useAuthStore()
  const [users,    setUsers]    = useState<User[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<User | null>(null)

  const LIMIT = 20

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const d = await api.adminGetUsers(accessToken, page, LIMIT, search)
      setUsers(d.users)
      setTotal(d.pagination.total)
    } finally { setLoading(false) }
  }, [accessToken, page, search])

  useEffect(() => { load() }, [load])

  const pages = Math.ceil(total / LIMIT)

  return (
    <div style={{ padding:'28px 32px', maxWidth:1280 }}>
      {/* Header */}
      <div className="page-header" style={{ padding:0, marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text)' }}>Users</h1>
          <p style={{ fontSize:13, color:'var(--text-3)', marginTop:3 }}>{total.toLocaleString()} total users</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div className="search-wrap">
            <i className="bi bi-search" />
            <input
              type="text" value={search} placeholder="Search users…"
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-4)' }}>
            <i className="bi bi-arrow-repeat animate-spin" style={{ fontSize:24 }} />
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-people" />
            <h3>{search ? 'No matching users' : 'No users yet'}</h3>
            <p>{search ? `No users match "${search}"` : 'Users will appear here once they sign up.'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Last Sign In</th>
                <th>Joined</th>
                <th style={{ textAlign:'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const dn = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id
                return (
                  <tr key={u.id} style={{ cursor:'pointer' }} onClick={() => setSelected(u)}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{
                          width:34, height:34, borderRadius:'50%', flexShrink:0,
                          background:'linear-gradient(135deg,#7c3aed,#6366f1)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'white', fontSize:12, fontWeight:700,
                        }}>
                          {u.image_url ? <img src={u.image_url} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}} alt="" /> : dn.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color:'var(--text)', fontSize:13.5, fontWeight:500 }}>{dn}</div>
                          <div style={{ color:'var(--text-4)', fontSize:12 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.banned
                        ? <span className="badge badge-danger"><i className="bi bi-slash-circle-fill" /> Banned</span>
                        : u.email_verified
                          ? <span className="badge badge-success"><i className="bi bi-check-circle-fill" /> Active</span>
                          : <span className="badge badge-warning"><i className="bi bi-clock" /> Unverified</span>
                      }
                    </td>
                    <td style={{ fontSize:12.5 }}>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : <span style={{color:'var(--text-4)'}}>Never</span>}</td>
                    <td style={{ fontSize:12.5 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign:'right' }}>
                      <button className="btn btn-icon" onClick={e => { e.stopPropagation(); setSelected(u) }}>
                        <i className="bi bi-three-dots" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:12.5, color:'var(--text-4)' }}>Page {page} of {pages}</span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost btn-sm" disabled={page<=1} onClick={() => setPage(p=>p-1)}>
                <i className="bi bi-chevron-left" /> Prev
              </button>
              <button className="btn btn-ghost btn-sm" disabled={page>=pages} onClick={() => setPage(p=>p+1)}>
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && accessToken && (
        <UserPanel
          user={selected} token={accessToken}
          onClose={() => setSelected(null)}
          onUpdate={u => setUsers(prev => prev.map(x => x.id===u.id ? u : x))}
        />
      )}
    </div>
  )
}
