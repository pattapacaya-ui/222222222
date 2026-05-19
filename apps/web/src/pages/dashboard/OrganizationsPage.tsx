import { useEffect, useState } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'
import { Building2, Plus, Users, Mail, Loader2 } from 'lucide-react'

interface Org { id: string; name: string; slug: string; role: string; created_at: number }
interface Member { id: string; user_id: string; email: string; first_name: string; last_name: string; role: string; created_at: number }

export default function OrganizationsPage() {
  const { accessToken } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    api.getOrganizations(accessToken).then(d => setOrgs(d.organizations)).finally(() => setLoading(false))
  }, [accessToken])

  async function loadMembers(org: Org) {
    if (!accessToken) return
    setSelectedOrg(org)
    const d = await api.getOrgMembers(accessToken, org.id)
    setMembers(d.members)
  }

  async function createOrg() {
    if (!accessToken || !newOrgName) return
    setCreating(true)
    try {
      const d = await api.createOrg(accessToken, { name: newOrgName })
      const newOrg = { ...d.organization, role: 'admin', created_at: Date.now() }
      setOrgs(prev => [newOrg, ...prev])
      setNewOrgName('')
      setShowCreate(false)
    } finally { setCreating(false) }
  }

  async function inviteMember() {
    if (!accessToken || !selectedOrg || !inviteEmail) return
    setInviting(true)
    try {
      await api.inviteMember(accessToken, selectedOrg.id, inviteEmail)
      setInviteEmail('')
      alert(`Invitation sent to ${inviteEmail}`)
    } finally { setInviting(false) }
  }

  return (
    <div style={{ padding: 32, display: 'flex', gap: 24 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Building2 size={20} color="#6366f1" />
              <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organizations</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>Organizations</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={16} /> New Organization
          </button>
        </div>

        {showCreate && (
          <div style={{
            background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12,
            padding: 20, marginBottom: 20,
          }}>
            <h3 style={{ color: '#e2e8f0', marginBottom: 12, fontSize: 15 }}>Create Organization</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                style={{ flex: 1 }}
              />
              <button onClick={createOrg} disabled={creating || !newOrgName} className="btn-primary">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create
              </button>
              <button onClick={() => setShowCreate(false)} style={{
                padding: '8px 16px', border: '1px solid #2d2d4e', borderRadius: 8,
                background: 'none', color: '#94a3b8', cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 16, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading organizations...</div>
          ) : orgs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              No organizations yet. Create one to get started.
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Organization</th><th>Your Role</th><th>Created</th></tr></thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => loadMembers(o)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: 14, fontWeight: 700,
                        }}>{o.name.charAt(0)}</div>
                        <div>
                          <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{o.name}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{o.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${o.role === 'admin' ? 'badge-primary' : 'badge-warning'}`}>{o.role}</span></td>
                    <td style={{ fontSize: 12 }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedOrg && (
        <div style={{ width: 340, flexShrink: 0 }}>
          <div style={{
            background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 16, overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #2d2d4e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Users size={16} color="#6366f1" />
                <h3 style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{selectedOrg.name}</h3>
              </div>
              <p style={{ color: '#64748b', fontSize: 12 }}>{members.length} members</p>
            </div>

            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2d2d4e' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="Invite by email..."
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button onClick={inviteMember} disabled={inviting || !inviteEmail} style={{
                  padding: '8px 12px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                }}>
                  {inviting ? <Loader2 size={12} /> : <Mail size={12} />} Invite
                </button>
              </div>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {members.map(m => {
                const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email
                return (
                  <div key={m.id} style={{
                    padding: '12px 16px', borderBottom: '1px solid rgba(45,45,78,0.4)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 13 }}>{name}</div>
                      <div style={{ color: '#64748b', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                    </div>
                    <span className={`badge ${m.role === 'admin' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                      {m.role}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
