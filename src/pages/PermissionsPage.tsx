// src/pages/PermissionsPage.tsx — Alpha Ultimate ERP v8
// Advanced Permission Matrix — 7 granular access levels per module
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

interface UserRow { id:string; full_name:string; username:string; role:string; department:string }
interface Matrix { [userId:string]: { [module:string]: string } }

const MODULES = [
  { key:'finance',       label:'Finance (Expenses & Invoices)', icon:'💰' },
  { key:'approvals',     label:'Approvals',                     icon:'✅' },
  { key:'assets',        label:'Assets',                        icon:'🏗️' },
  { key:'investments',   label:'Investments',                   icon:'📈' },
  { key:'liabilities',   label:'Liabilities',                   icon:'🏦' },
  { key:'budget',        label:'Budget',                        icon:'📊' },
  { key:'workers',       label:'Workers / HR',                  icon:'👷' },
  { key:'salary',        label:'Salary & Payroll',              icon:'💳' },
  { key:'timesheet',     label:'Timesheet & Attendance',        icon:'🕐' },
  { key:'users',         label:'Users Management',              icon:'👤' },
  { key:'reports',       label:'Reports',                       icon:'📋' },
  { key:'notifications', label:'Notifications',                 icon:'🔔' },
  { key:'forms',         label:'Form Builder',                  icon:'🛠️' },
  { key:'settings',      label:'System Settings',               icon:'⚙️' },
  { key:'crm',           label:'CRM (Customers & Leads)',        icon:'🏢' },
  { key:'projects',      label:'Projects & Tasks',               icon:'📁' },
]

const ACCESS_LEVELS = [
  { value: 'none',                label: 'No Access',               color: '#40406a', desc: 'Cannot see this module at all' },
  { value: 'submit_only',         label: 'Submit Only',             color: '#ff8800', desc: 'Can fill & submit forms. Cannot view any records, even own.' },
  { value: 'view_own',            label: 'View Own',                color: '#4f8cff', desc: 'Can submit and view only their own submissions.' },
  { value: 'view_all',            label: 'View All',                color: '#00d4ff', desc: 'Can view all records (no detail breakdown).' },
  { value: 'view_with_details',   label: 'View + Details',          color: '#bf5fff', desc: 'Can view all records with full line-item detail.' },
  { value: 'report_view',         label: 'Report View',             color: '#ffe135', desc: 'Can view reports summary only.' },
  { value: 'report_with_details', label: 'Report + Details',        color: '#00ffb3', desc: 'Can view and export all reports with details.' },
  { value: 'full_control',        label: 'Full Control',            color: '#ff3cac', desc: 'Full CRUD + approve + export. Admin-level for this module.' },
]

const levelColor = (v: string) => ACCESS_LEVELS.find(l => l.value===v)?.color ?? '#40406a'

export default function PermissionsPage() {
  const { user } = useAuth()
  const [users, setUsers]     = useState<UserRow[]>([])
  const [matrix, setMatrix]   = useState<Matrix>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string|null>(null)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')
  const [selected, setSelected] = useState<string|null>(null)

  useEffect(() => {
    api.get<{users:UserRow[]; matrix:Matrix}>('/permissions')
      .then(d => { setUsers(d.users.filter(u => u.role !== 'superuser')); setMatrix(d.matrix) })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  function setLevel(userId: string, module: string, level: string) {
    setMatrix(m => ({ ...m, [userId]: { ...(m[userId]||{}), [module]: level } }))
  }

  async function save(userId: string) {
    setSaving(userId); setMsg(''); setErr('')
    try {
      await api.put('/permissions', { userId, permissions: matrix[userId] || {} })
      setMsg('Permissions saved successfully.')
      setTimeout(() => setMsg(''), 3000)
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(null) }
  }

  if (!user || user.role !== 'superuser') return (
    <div style={{ padding:'2rem', color:'#ff3cac' }}>Access denied. Superuser only.</div>
  )

  const selectedUser = users.find(u => u.id === selected)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 className="page-title">🔐 Permission Matrix</h1>
          <p style={{ color:'var(--text2)', fontSize:'0.85rem', margin:'0.25rem 0 0' }}>
            Assign granular access levels per module for each user
          </p>
        </div>
      </div>

      {msg && <div className="alert-success">{msg}</div>}
      {err && <div className="alert-error">{err}</div>}

      {/* Access Level Legend */}
      <div style={{ background:'rgba(14,13,46,0.85)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem', marginBottom:'1.5rem' }}>
        <div className="section-label" style={{ marginBottom:'0.75rem' }}>ACCESS LEVEL GUIDE</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'0.5rem' }}>
          {ACCESS_LEVELS.map(l => (
            <div key={l.value} style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem', padding:'0.4rem 0.6rem', borderRadius:8, background:'rgba(255,255,255,0.03)', border:`1px solid rgba(255,255,255,0.06)` }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:l.color, flexShrink:0, marginTop:4 }} />
              <div>
                <div style={{ fontSize:'0.78rem', fontWeight:700, color:l.color, fontFamily:'var(--font)' }}>{l.label}</div>
                <div style={{ fontSize:'0.65rem', color:'var(--text2)', lineHeight:1.3 }}>{l.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'1rem' }}>
        {/* User list */}
        <div style={{ background:'rgba(14,13,46,0.85)', border:'1px solid var(--border)', borderRadius:12, padding:'0.75rem', height:'fit-content' }}>
          <div className="section-label" style={{ marginBottom:'0.75rem' }}>SELECT USER</div>
          {loading ? <div style={{ color:'var(--text2)', fontSize:'0.82rem' }}>Loading…</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              {users.map(u => (
                <div key={u.id}
                  onClick={() => setSelected(u.id)}
                  style={{ padding:'0.6rem 0.8rem', borderRadius:9, cursor:'pointer', border:`1px solid ${selected===u.id?'var(--blue)':'transparent'}`, background: selected===u.id ? 'rgba(79,140,255,0.1)' : 'rgba(255,255,255,0.02)', transition:'all .15s' }}>
                  <div style={{ fontWeight:700, fontSize:'0.88rem', color: selected===u.id?'var(--blue)':'var(--text)' }}>{u.full_name}</div>
                  <div style={{ fontSize:'0.68rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>{u.role} · {u.department||'—'}</div>
                </div>
              ))}
              {users.length === 0 && <div style={{ color:'var(--text2)', fontSize:'0.82rem' }}>No non-superuser accounts found.</div>}
            </div>
          )}
        </div>

        {/* Permission matrix */}
        <div>
          {!selected ? (
            <div style={{ background:'rgba(14,13,46,0.85)', border:'1px dashed var(--border)', borderRadius:12, padding:'3rem', textAlign:'center', color:'var(--text2)' }}>
              ← Select a user to configure permissions
            </div>
          ) : (
            <div style={{ background:'rgba(14,13,46,0.85)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.5rem' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:'1rem', color:'var(--text)', fontFamily:'var(--font)' }}>{selectedUser?.full_name}</div>
                  <div style={{ fontSize:'0.68rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>{selectedUser?.role} · @{selectedUser?.username}</div>
                </div>
                <button className="btn btn-primary" onClick={() => save(selected)} disabled={saving===selected}>
                  {saving===selected ? '⟳ Saving…' : '💾 Save Permissions'}
                </button>
              </div>
              <div style={{ padding:'0.75rem' }}>
                {MODULES.map(mod => {
                  const current = matrix[selected]?.[mod.key] ?? 'none'
                  return (
                    <div key={mod.key} style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:'0.75rem', alignItems:'center', padding:'0.6rem 0.5rem', borderBottom:'1px solid rgba(32,30,88,0.4)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <span style={{ fontSize:'1.1rem' }}>{mod.icon}</span>
                        <span style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text)', fontFamily:'var(--font)' }}>{mod.label}</span>
                      </div>
                      <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' }}>
                        {ACCESS_LEVELS.map(level => (
                          <button key={level.value}
                            onClick={() => setLevel(selected, mod.key, level.value)}
                            title={level.desc}
                            style={{
                              padding:'0.25rem 0.55rem', borderRadius:6, fontSize:'0.65rem', fontWeight:700, cursor:'pointer',
                              fontFamily:'var(--font-mono)', letterSpacing:'0.04em', border:'1px solid',
                              transition:'all .13s',
                              borderColor: current===level.value ? level.color : 'rgba(255,255,255,0.08)',
                              background:  current===level.value ? `${level.color}25` : 'rgba(255,255,255,0.03)',
                              color:       current===level.value ? level.color : 'var(--text2)',
                              transform:   current===level.value ? 'scale(1.05)' : 'scale(1)',
                            }}>
                            {level.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'1rem', borderTop:'1px solid var(--border)' }}>
                <button className="btn btn-primary" onClick={() => save(selected)} disabled={saving===selected}>
                  {saving===selected ? '⟳ Saving…' : '💾 Save All Permissions for this User'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
