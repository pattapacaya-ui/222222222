import { useEffect, useState } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'

interface Org { id: string; name: string; slug: string; role: string; created_at: number }
interface Member { id: string; user_id: string; email: string; first_name: string; last_name: string; role: string; created_at: number }

const ORG_COLORS = [
  'linear-gradient(135deg,#7c3aed,#6366f1)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
]

function getOrgColor(name: string) {
  return ORG_COLORS[name.charCodeAt(0) % ORG_COLORS.length]
}

export default function OrganizationsPage() {
  const { accessToken } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!accessToken) return
    api.getOrganizations(accessToken)
      .then(d => setOrgs(d.organizations ?? []))
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false))
  }, [accessToken])

  function flash(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function loadMembers(org: Org) {
    if (!accessToken) return
    setSelectedOrg(org)
    setLoadingMembers(true)
    try {
      const d = await api.getOrgMembers(accessToken, org.id)
      setMembers(d.members ?? [])
    } catch {
      setMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }

  async function createOrg() {
    if (!accessToken || !newOrgName.trim()) return
    setCreating(true)
    try {
      const d = await api.createOrg(accessToken, { name: newOrgName.trim() })
      const newOrg = { ...d.organization, role: 'admin', created_at: Date.now() }
      setOrgs(prev => [newOrg, ...prev])
      setNewOrgName('')
      setShowCreate(false)
      flash('Organization created successfully!')
    } finally {
      setCreating(false)
    }
  }

  async function inviteMember() {
    if (!accessToken || !selectedOrg || !inviteEmail.trim()) return
    setInviting(true)
    try {
      await api.inviteMember(accessToken, selectedOrg.id, inviteEmail.trim())
      setInviteEmail('')
      setShowInvite(false)
      flash(`Invitation sent to ${inviteEmail}`)
    } finally {
      setInviting(false)
    }
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <i className="bi bi-building" style={{ color: 'var(--primary)', fontSize: 14 }} />
            <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Organizations
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Organizations</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14, margin: '4px 0 0' }}>
            Manage teams and collaborate with members
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <i className="bi bi-plus-lg" />
          New Organization
        </button>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <i className="bi bi-check-circle-fill" />
          {successMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left: Orgs list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Create modal inline */}
          {showCreate && (
            <div className="glass-card" style={{ padding: 24, marginBottom: 20, border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'linear-gradient(135deg,var(--primary),var(--indigo))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className="bi bi-building-add" style={{ color: 'white', fontSize: 16 }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Create Organization</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Set up a new team workspace</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="field-label">Organization Name</label>
                  <input
                    value={newOrgName}
                    onChange={e => setNewOrgName(e.target.value)}
                    placeholder="Acme Corp"
                    onKeyDown={e => e.key === 'Enter' && createOrg()}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={createOrg} disabled={creating || !newOrgName.trim()}>
                    {creating ? <i className="bi bi-arrow-repeat animate-spin" /> : <i className="bi bi-check-lg" />}
                    {creating ? 'Creating...' : 'Create Organization'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setNewOrgName('') }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Orgs Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {[1,2,3].map(i => (
                <div key={i} className="glass-card shimmer" style={{ padding: 20, height: 100 }} />
              ))}
            </div>
          ) : orgs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <i className="bi bi-building" style={{ fontSize: 28, color: 'var(--text-4)' }} />
              </div>
              <div className="empty-state-title">No organizations yet</div>
              <div className="empty-state-desc">Create an organization to collaborate with your team</div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <i className="bi bi-plus-lg" />
                Create Organization
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {orgs.map(org => (
                <OrgCard
                  key={org.id}
                  org={org}
                  selected={selectedOrg?.id === org.id}
                  onClick={() => loadMembers(org)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Members Panel */}
        {selectedOrg && (
          <div style={{ width: 360, flexShrink: 0 }}>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              {/* Panel header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: getOrgColor(selectedOrg.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 15,
                    }}>
                      {selectedOrg.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{selectedOrg.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{selectedOrg.slug}</div>
                    </div>
                  </div>
                  <button
                    className="btn btn-icon"
                    style={{ width: 28, height: 28 }}
                    onClick={() => setSelectedOrg(null)}
                  >
                    <i className="bi bi-x-lg" style={{ fontSize: 12 }} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    <i className="bi bi-people" style={{ marginRight: 4 }} />
                    {loadingMembers ? '...' : members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                  <span className={`badge ${selectedOrg.role === 'admin' ? 'badge-primary' : 'badge-warning'}`}>
                    {selectedOrg.role}
                  </span>
                </div>
              </div>

              {/* Invite bar */}
              {selectedOrg.role === 'admin' && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  {showInvite ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        style={{ fontSize: 13 }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          value={inviteRole}
                          onChange={e => setInviteRole(e.target.value)}
                          style={{ fontSize: 12, padding: '6px 8px' }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={inviteMember} disabled={inviting || !inviteEmail.trim()} style={{ flex: 1 }}>
                          {inviting ? <i className="bi bi-arrow-repeat animate-spin" /> : <i className="bi bi-envelope-plus" />}
                          {inviting ? 'Sending...' : 'Send Invite'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowInvite(false)}>
                          <i className="bi bi-x" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm btn-block"
                      onClick={() => setShowInvite(true)}
                    >
                      <i className="bi bi-person-plus" />
                      Invite Member
                    </button>
                  )}
                </div>
              )}

              {/* Members list */}
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {loadingMembers ? (
                  <div style={{ padding: 20 }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                        <div className="shimmer" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div className="shimmer" style={{ height: 12, borderRadius: 4, marginBottom: 4, width: '60%' }} />
                          <div className="shimmer" style={{ height: 10, borderRadius: 4, width: '80%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : members.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                    <i className="bi bi-people" style={{ fontSize: 28, color: 'var(--text-4)', display: 'block', marginBottom: 8 }} />
                    <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No members yet</div>
                  </div>
                ) : (
                  members.map(m => {
                    const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email?.split('@')[0] || 'User'
                    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <div key={m.id} style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: 10,
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'linear-gradient(135deg,var(--primary),var(--indigo))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{name}</div>
                          <div style={{
                            color: 'var(--text-3)', fontSize: 11,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{m.email}</div>
                        </div>
                        <span className={`badge ${m.role === 'admin' ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                          {m.role}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Panel footer */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>
                  Created {new Date(selectedOrg.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OrgCard({ org, selected, onClick }: { org: Org; selected: boolean; onClick: () => void }) {
  const initials = org.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div
      className="glass-card"
      onClick={onClick}
      style={{
        padding: 20,
        cursor: 'pointer',
        border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
        boxShadow: selected ? '0 0 0 1px var(--primary), 0 0 20px rgba(124,58,237,0.15)' : undefined,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        if (!selected) (e.currentTarget as HTMLElement).style.border = '1px solid var(--border-2)'
      }}
      onMouseLeave={e => {
        if (!selected) (e.currentTarget as HTMLElement).style.border = '1px solid var(--border)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: getOrgColor(org.name),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{org.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{org.slug}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`badge ${org.role === 'admin' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: 10 }}>
              <i className={`bi bi-${org.role === 'admin' ? 'shield-check' : 'person'}`} />
              {org.role}
            </span>
          </div>
        </div>
        {selected && (
          <i className="bi bi-check-circle-fill" style={{ color: 'var(--primary)', fontSize: 16, flexShrink: 0 }} />
        )}
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
          <i className="bi bi-calendar3" style={{ marginRight: 4 }} />
          {new Date(org.created_at).toLocaleDateString()}
        </span>
        <span style={{ fontSize: 11, color: selected ? 'var(--primary)' : 'var(--text-4)' }}>
          {selected ? (
            <><i className="bi bi-people-fill" style={{ marginRight: 4 }} />Viewing members</>
          ) : (
            <><i className="bi bi-arrow-right" style={{ marginRight: 4 }} />View members</>
          )}
        </span>
      </div>
    </div>
  )
}
