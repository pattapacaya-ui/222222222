import { useEffect, useState } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'

interface APIKey { id: string; name: string; key_prefix: string; last_used_at: number | null; created_at: number }

export default function APIKeysPage() {
  const { accessToken } = useAuthStore()
  const [keys,       setKeys]       = useState<APIKey[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name,       setName]       = useState('')
  const [creating,   setCreating]   = useState(false)
  const [newKey,     setNewKey]     = useState<string | null>(null)
  const [copied,     setCopied]     = useState(false)

  useEffect(() => {
    if (!accessToken) return
    api.getAPIKeys(accessToken).then(d => setKeys(d.api_keys)).finally(() => setLoading(false))
  }, [accessToken])

  async function createKey() {
    if (!accessToken || !name.trim()) return
    setCreating(true)
    try {
      const d = await api.createAPIKey(accessToken, name.trim())
      setNewKey(d.api_key.key)
      setKeys(prev => [{ id:d.api_key.id, name:d.api_key.name, key_prefix:d.api_key.key_prefix, last_used_at:null, created_at:d.api_key.created_at }, ...prev])
      setName('')
      setShowCreate(false)
    } finally { setCreating(false) }
  }

  async function revoke(id: string) {
    if (!accessToken || !confirm('Revoke this API key? This cannot be undone.')) return
    await api.revokeAPIKey(accessToken, id)
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding:'28px 32px', maxWidth:1280 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text)' }}>API Keys</h1>
          <p style={{ fontSize:13, color:'var(--text-3)', marginTop:3 }}>Manage programmatic access tokens for your application.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <i className="bi bi-plus-circle-fill" /> Create API Key
        </button>
      </div>

      {/* New key revealed banner */}
      {newKey && (
        <div className="alert alert-success" style={{ marginBottom:20, flexDirection:'column', alignItems:'stretch', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <i className="bi bi-check-circle-fill" style={{ fontSize:18 }} />
            <strong>API key created! Save it now — it won't be shown again.</strong>
          </div>
          <div className="copy-box">
            <i className="bi bi-key-fill" style={{ color:'var(--text-4)', fontSize:14 }} />
            <input type="text" value={newKey} readOnly style={{ flex:1, fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#6ee7b7' }} />
            <button className="btn btn-sm" onClick={() => copy(newKey)} style={{ background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.25)', color:'#6ee7b7', borderRadius:6, padding:'4px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit', fontSize:12 }}>
              <i className={`bi bi-${copied ? 'check2' : 'clipboard'}`} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} style={{ background:'none', border:'none', color:'#6ee7b7', fontSize:12, cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
            <i className="bi bi-x" /> Dismiss
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ width:36,height:36,borderRadius:8,background:'rgba(124,58,237,0.12)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <i className="bi bi-key-fill" style={{ color:'var(--primary)', fontSize:18 }} />
              </div>
              <h3 className="modal-title">Create API Key</h3>
            </div>
            <p className="modal-desc">Give your key a descriptive name so you can identify it later.</p>
            <label className="field-label">Key name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Production Server, CI/CD Pipeline"
              onKeyDown={e => e.key==='Enter' && createKey()}
              autoFocus style={{ marginBottom:20 }}
            />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setName('') }} className="btn btn-ghost">Cancel</button>
              <button onClick={createKey} disabled={creating || !name.trim()} className="btn btn-primary">
                {creating ? <><i className="bi bi-arrow-repeat animate-spin" /> Creating…</> : <><i className="bi bi-plus-circle-fill" /> Create Key</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys table */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><i className="bi bi-arrow-repeat animate-spin" style={{ fontSize:24, color:'var(--text-4)' }} /></div>
        ) : keys.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-key" />
            <h3>No API keys</h3>
            <p>Create your first API key to enable programmatic access.</p>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary"><i className="bi bi-plus-circle-fill" /> Create API Key</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Last Used</th>
                <th>Created</th>
                <th style={{ textAlign:'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <i className="bi bi-key-fill" style={{ color:'var(--primary)', fontSize:15 }} />
                      <span style={{ color:'var(--text)', fontWeight:500, fontSize:13.5 }}>{k.name}</span>
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", background:'var(--surface-2)', padding:'2px 8px', borderRadius:4, color:'var(--text-3)' }}>
                      {k.key_prefix}…
                    </code>
                  </td>
                  <td style={{ fontSize:12.5 }}>
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : <span style={{color:'var(--text-4)'}}>Never</span>}
                  </td>
                  <td style={{ fontSize:12.5 }}>{new Date(k.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign:'right' }}>
                    <button onClick={() => revoke(k.id)} className="btn btn-danger btn-sm">
                      <i className="bi bi-trash3" /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="alert alert-info" style={{ marginTop:20 }}>
        <i className="bi bi-info-circle-fill" />
        <span>API keys are hashed with HMAC-SHA256. The plaintext is only shown once on creation.</span>
      </div>
    </div>
  )
}
