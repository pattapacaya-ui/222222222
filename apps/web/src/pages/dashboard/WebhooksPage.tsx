import { useEffect, useState } from 'react'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'

const ALL_EVENTS = [
  'user.created','user.updated','user.deleted',
  'session.created','session.ended',
  'organization.created','organization.deleted',
  '*',
]

interface WebhookObj { id: string; url: string; events: string[]; enabled: boolean; created_at: number }
type Delivery = { id: string; event_type: string; response_status: number; created_at: number }

export default function WebhooksPage() {
  const { accessToken } = useAuthStore()
  const [webhooks,    setWebhooks]    = useState<WebhookObj[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)
  const [url,         setUrl]         = useState('')
  const [selEvents,   setSelEvents]   = useState(['user.created','session.created'])
  const [creating,    setCreating]    = useState(false)
  const [newSecret,   setNewSecret]   = useState<string|null>(null)
  const [copied,      setCopied]      = useState(false)
  const [expandedId,  setExpandedId]  = useState<string|null>(null)
  const [deliveries,  setDeliveries]  = useState<Record<string,Delivery[]>>({})
  const [testing,     setTesting]     = useState<string|null>(null)

  useEffect(() => {
    if (!accessToken) return
    api.getWebhooks(accessToken).then(d => setWebhooks(d.webhooks)).finally(() => setLoading(false))
  }, [accessToken])

  async function create() {
    if (!accessToken || !url) return
    setCreating(true)
    try {
      const d = await api.createWebhook(accessToken, url, selEvents)
      setNewSecret(d.webhook.secret)
      setWebhooks(prev => [d.webhook, ...prev])
      setUrl(''); setShowCreate(false)
    } finally { setCreating(false) }
  }

  async function del(id: string) {
    if (!accessToken || !confirm('Delete this webhook?')) return
    await api.deleteWebhook(accessToken, id)
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  async function loadDeliveries(id: string) {
    if (!accessToken) return
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    const d = await api.getWebhookDeliveries(accessToken, id)
    setDeliveries(prev => ({ ...prev, [id]: d.deliveries }))
  }

  async function test(id: string) {
    if (!accessToken) return
    setTesting(id)
    try { const d = await api.testWebhook(accessToken, id); alert(d.message) }
    finally { setTesting(null) }
  }

  async function copySecret(s: string) {
    await navigator.clipboard.writeText(s)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function toggleEvent(evt: string) {
    setSelEvents(prev => prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt])
  }

  return (
    <div style={{ padding:'28px 32px', maxWidth:1280 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text)' }}>Webhooks</h1>
          <p style={{ fontSize:13, color:'var(--text-3)', marginTop:3 }}>Receive real-time signed events from your application.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <i className="bi bi-plus-circle-fill" /> Add Webhook
        </button>
      </div>

      {/* Secret banner */}
      {newSecret && (
        <div className="alert alert-success" style={{ marginBottom:20, flexDirection:'column', alignItems:'stretch', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <i className="bi bi-shield-lock-fill" style={{fontSize:18}} />
            <strong>Signing secret — save it now, it won't be shown again</strong>
          </div>
          <div className="copy-box">
            <i className="bi bi-key" style={{color:'var(--text-4)',fontSize:14}} />
            <input type="text" value={newSecret} readOnly style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#6ee7b7'}} />
            <button className="btn btn-sm" onClick={() => copySecret(newSecret)} style={{ background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.25)', color:'#6ee7b7', borderRadius:6, padding:'4px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit', fontSize:12 }}>
              <i className={`bi bi-${copied ? 'check2' : 'clipboard'}`} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} style={{background:'none',border:'none',color:'#6ee7b7',fontSize:12,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
            <i className="bi bi-x" /> Dismiss
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth:520 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ width:36,height:36,borderRadius:8,background:'rgba(124,58,237,0.12)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <i className="bi bi-webhook" style={{color:'var(--primary)',fontSize:18}} />
              </div>
              <h3 className="modal-title">Add Webhook Endpoint</h3>
            </div>
            <p className="modal-desc">Enter your endpoint URL and select which events to receive.</p>
            <label className="field-label">Endpoint URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yourapp.com/webhooks" style={{ marginBottom:16 }} />
            <label className="field-label">Events</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:20 }}>
              {ALL_EVENTS.map(evt => (
                <button key={evt} onClick={() => toggleEvent(evt)} style={{
                  padding:'5px 10px', border:`1px solid ${selEvents.includes(evt) ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
                  borderRadius:6, background:selEvents.includes(evt) ? 'rgba(124,58,237,0.12)' : 'transparent',
                  color:selEvents.includes(evt) ? '#a78bfa' : 'var(--text-4)',
                  cursor:'pointer', fontSize:12, fontFamily:'inherit', display:'flex', alignItems:'center', gap:5,
                }}>
                  {selEvents.includes(evt) && <i className="bi bi-check2" style={{fontSize:11}} />}
                  {evt}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setUrl('') }} className="btn btn-ghost">Cancel</button>
              <button onClick={create} disabled={creating || !url} className="btn btn-primary">
                {creating ? <><i className="bi bi-arrow-repeat animate-spin" /> Creating…</> : <><i className="bi bi-plus-circle-fill" /> Create Webhook</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook list */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><i className="bi bi-arrow-repeat animate-spin" style={{fontSize:24,color:'var(--text-4)'}} /></div>
        ) : webhooks.length === 0 ? (
          <div className="empty-state" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
            <i className="bi bi-webhook" />
            <h3>No webhooks yet</h3>
            <p>Add a webhook endpoint to start receiving real-time events.</p>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary"><i className="bi bi-plus-circle-fill" /> Add Webhook</button>
          </div>
        ) : webhooks.map(w => (
          <div key={w.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:w.enabled ? '#10b981':'#ef4444', flexShrink:0, marginTop:6 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'var(--text)', fontSize:13.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:8 }}>
                  {w.url}
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {w.events.map(evt => (
                    <span key={evt} className="badge badge-primary" style={{ fontSize:10.5 }}>{evt}</span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={() => test(w.id)} disabled={testing === w.id} className="btn btn-ghost btn-sm">
                  {testing === w.id ? <i className="bi bi-arrow-repeat animate-spin" /> : <i className="bi bi-play-fill" />}
                  Test
                </button>
                <button onClick={() => loadDeliveries(w.id)} className="btn btn-ghost btn-sm">
                  <i className="bi bi-list-ul" />
                  Logs
                  <i className={`bi bi-chevron-${expandedId===w.id ? 'up' : 'down'}`} style={{fontSize:11}} />
                </button>
                <button onClick={() => del(w.id)} className="btn btn-danger btn-sm">
                  <i className="bi bi-trash3-fill" />
                </button>
              </div>
            </div>

            {expandedId === w.id && (
              <div style={{ borderTop:'1px solid var(--border)', maxHeight:280, overflowY:'auto', background:'var(--bg-2)' }}>
                {!deliveries[w.id] ? (
                  <div style={{padding:20,textAlign:'center'}}><i className="bi bi-arrow-repeat animate-spin" style={{fontSize:18,color:'var(--text-4)'}} /></div>
                ) : deliveries[w.id]!.length === 0 ? (
                  <div style={{padding:20,textAlign:'center',color:'var(--text-4)',fontSize:13}}>No deliveries yet</div>
                ) : (
                  <table className="data-table" style={{fontSize:12.5}}>
                    <thead><tr><th>Event</th><th>Status</th><th>Time</th></tr></thead>
                    <tbody>
                      {deliveries[w.id]!.map(d => (
                        <tr key={d.id}>
                          <td><code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{d.event_type}</code></td>
                          <td>
                            <span className={`badge ${d.response_status >= 200 && d.response_status < 300 ? 'badge-success' : 'badge-danger'}`}>
                              <i className={`bi bi-${d.response_status >= 200 && d.response_status < 300 ? 'check-circle-fill' : 'x-circle-fill'}`} />
                              {d.response_status ?? 'Failed'}
                            </span>
                          </td>
                          <td style={{color:'var(--text-3)'}}>{new Date(d.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
