// src/pages/UsersPage.tsx — Alpha Ultimate ERP v8
// Full user management: photo upload, ID photo, password reset by creator
import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

interface UserRow { id:string; username:string; email:string; full_name:string; role:string; department:string; phone:string; whatsapp_number:string; avatar_url:string; id_photo_url:string; is_active:boolean; created_at:string; last_login:string }

const inputS: React.CSSProperties = { width:'100%', background:'rgba(5,5,26,0.92)', border:'1px solid #201e58', color:'#ece9ff', padding:'0.55rem 0.8rem', borderRadius:8, fontSize:'0.875rem', fontFamily:'var(--font)', outline:'none', minHeight:38 }
const labelS: React.CSSProperties = { display:'block', fontSize:'0.58rem', fontWeight:700, color:'#7470b0', marginBottom:'0.25rem', textTransform:'uppercase', letterSpacing:'0.09em', fontFamily:'var(--font-mono)' }

const DEPTS = ['General','Management','Finance','Operations','HR','IT','Maintenance','Safety','Logistics','Field Team']

export default function UsersPage() {
  const { user } = useAuth()
  const isSu = user?.role === 'superuser'

  const [users, setUsers]       = useState<UserRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState('')
  const [msg, setMsg]           = useState('')
  const [selected, setSelected] = useState<UserRow|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState<'avatar'|'id'|null>(null)

  const photoRef = useRef<HTMLInputElement>(null)
  const idRef    = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ username:'', email:'', password:'', full_name:'', role:'staff', department:'General', phone:'', whatsapp_number:'' })
  const [resetPw, setResetPw]   = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    api.get<{users:UserRow[]}>('/users').then(d => setUsers(d.users)).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  function setF(k: string, v: string) { setForm(p => ({...p,[k]:v})) }

  async function createUser() {
    if (!form.username || !form.email || !form.password || !form.full_name) { setErr('All fields required'); return }
    try {
      const r = await api.post<{user:UserRow}>('/users', form)
      setUsers(p => [...p, r.user])
      setShowForm(false)
      setForm({ username:'', email:'', password:'', full_name:'', role:'staff', department:'General', phone:'', whatsapp_number:'' })
      setMsg('User created successfully.')
      setTimeout(() => setMsg(''), 3000)
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Failed') }
  }

  async function toggleActive(u: UserRow) {
    try {
      await api.patch('/users/update', { id:u.id, is_active: !u.is_active })
      setUsers(p => p.map(x => x.id===u.id ? { ...x, is_active: !u.is_active } : x))
      if (selected?.id === u.id) setSelected(s => s ? { ...s, is_active: !s.is_active } : s)
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Failed') }
  }

  async function resetPassword() {
    if (!resetPw || resetPw.length < 8) { setResetMsg('Min 8 characters'); return }
    if (!selected) return
    setResetting(true); setResetMsg('')
    try {
      await api.post('/users/change-password', { target_user_id: selected.id, new_password: resetPw })
      setResetMsg('Password reset successfully.'); setResetPw('')
    } catch(e:unknown) { setResetMsg(e instanceof Error ? e.message : 'Failed') }
    finally { setResetting(false) }
  }

  async function uploadPhoto(e: ChangeEvent<HTMLInputElement>, type: 'avatar'|'id') {
    const file = e.target.files?.[0]
    if (!file || !selected) return
    if (file.size > 5 * 1024 * 1024) { setErr('Max 5MB per photo'); return }
    setUploading(type)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1]
        const r = await api.post<{uploaded:{url:string;thumb_url:string}[]}>('/uploads/imgbb', {
          files: [{ name: file.name, type: file.type, size: file.size, data: base64 }],
          entity_type: 'user', entity_id: selected.id
        })
        const url = r.uploaded[0]?.url
        if (!url) throw new Error('No URL returned')
        const field = type === 'avatar' ? { avatar_url: url } : { id_photo_url: url }
        await api.patch('/users/update', { id: selected.id, ...field })
        setUsers(p => p.map(u => u.id===selected.id ? { ...u, ...field } : u))
        setSelected(s => s ? { ...s, ...field } : s)
        setMsg(`${type==='avatar'?'Profile':'ID'} photo updated.`)
        setTimeout(() => setMsg(''), 3000)
      } catch(err:unknown) { setErr(err instanceof Error ? err.message : 'Upload failed') }
      finally { setUploading(null) }
    }
    reader.readAsDataURL(file)
  }

  if (loading) return <div className="loading-center"><div className="spinner"/></div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <h1 className="page-title">👥 Users Management</h1>
        {isSu && <button className="btn btn-primary" onClick={()=>setShowForm(p=>!p)}>+ New User</button>}
      </div>

      {msg && <div className="alert-success">{msg}</div>}
      {err && <div className="alert-error" onClick={()=>setErr('')}>{err}</div>}

      {/* Create user form */}
      {showForm && isSu && (
        <div style={{ background:'rgba(14,13,46,0.9)', border:'1px solid var(--border2)', borderRadius:12, padding:'1.25rem', marginBottom:'1.25rem' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--blue)', letterSpacing:'0.1em', marginBottom:'0.75rem' }}>CREATE NEW USER</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'0.75rem' }}>
            {[['full_name','Full Name'],['username','Username'],['email','Email'],['password','Password'],['phone','Phone'],['whatsapp_number','WhatsApp Number']].map(([k,l]) => (
              <div key={k}>
                <label style={labelS}>{l}</label>
                <input type={k==='password'?'password':'text'} style={inputS} value={(form as Record<string,string>)[k]} onChange={e=>setF(k,e.target.value)} autoComplete={k==='password'?'new-password':'off'} />
              </div>
            ))}
            <div>
              <label style={labelS}>ROLE</label>
              <select style={{ ...inputS, color:'#ece9ff' }} value={form.role} onChange={e=>setF('role',e.target.value)}>
                {['staff','manager','superuser'].map(r => <option key={r} value={r} style={{ background:'#0e0d2e',color:'#ece9ff' }}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={labelS}>DEPARTMENT</label>
              <select style={{ ...inputS, color:'#ece9ff' }} value={form.department} onChange={e=>setF('department',e.target.value)}>
                {DEPTS.map(d => <option key={d} value={d} style={{ background:'#0e0d2e',color:'#ece9ff' }}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
            <button className="btn btn-primary" onClick={createUser}>✓ Create User</button>
            <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'1rem' }}>
        {/* Users table */}
        <div className="glass">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th><th>Role</th><th>Department</th><th>Contact</th><th>Last Login</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="clickable-row" onClick={()=>setSelected(s=>s?.id===u.id?null:u)}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:'1px solid var(--border2)' }} />
                        ) : (
                          <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(79,140,255,0.15)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', color:'var(--blue)', flexShrink:0 }}>
                            {u.full_name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight:700, fontSize:'0.88rem' }}>{u.full_name}</div>
                          <div style={{ fontSize:'0.7rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${u.role==='superuser'?'badge-active':u.role==='manager'?'badge-hold':'badge-pending'}`}>{u.role}</span></td>
                    <td style={{ fontSize:'0.82rem', color:'var(--text2)' }}>{u.department||'—'}</td>
                    <td style={{ fontSize:'0.78rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>
                      {u.phone||'—'}
                      {u.whatsapp_number && <div style={{ color:'var(--green)', fontSize:'0.68rem' }}>💬 {u.whatsapp_number}</div>}
                    </td>
                    <td style={{ fontSize:'0.72rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('en-GB') : 'Never'}
                    </td>
                    <td><span className={`badge ${u.is_active?'badge-active':'badge-inactive'}`}>{u.is_active?'Active':'Inactive'}</span></td>
                    <td>
                      {isSu && u.id !== user?.id && (
                        <button className={`btn btn-sm ${u.is_active?'btn-danger':'btn-success'}`}
                          onClick={e=>{e.stopPropagation(); toggleActive(u)}}>
                          {u.is_active?'Deactivate':'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User detail panel */}
        {selected && (
          <div style={{ background:'rgba(14,13,46,0.9)', border:'1px solid var(--border2)', borderRadius:14, padding:'1.5rem', animation:'fadeIn .2s' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--blue)', letterSpacing:'0.1em' }}>USER DETAILS — {selected.full_name.toUpperCase()}</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(null)}>✕ Close</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1.25rem' }}>
              {/* Photos */}
              <div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--violet)', marginBottom:'0.75rem', letterSpacing:'0.08em' }}>PHOTOS</div>
                <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
                  {/* Profile photo */}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ width:80, height:80, borderRadius:'50%', border:'2px solid var(--border2)', overflow:'hidden', marginBottom:'0.5rem', background:'rgba(14,13,46,0.8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {selected.avatar_url ? (
                        <img src={selected.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : <span style={{ fontSize:'2rem', color:'var(--text-dim)' }}>👤</span>}
                    </div>
                    <div style={{ fontSize:'0.62rem', color:'var(--text2)', fontFamily:'var(--font-mono)', marginBottom:'0.35rem' }}>PROFILE PHOTO</div>
                    {isSu && (
                      <>
                        <input ref={photoRef} type="file" accept="image/*" capture="user" onChange={e=>uploadPhoto(e,'avatar')} style={{ display:'none' }} />
                        <button className="btn btn-secondary btn-sm" onClick={()=>photoRef.current?.click()} disabled={uploading==='avatar'}>
                          {uploading==='avatar'?'⟳':'📷'} Upload
                        </button>
                      </>
                    )}
                  </div>
                  {/* ID photo */}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ width:120, height:80, borderRadius:8, border:'2px solid var(--border2)', overflow:'hidden', marginBottom:'0.5rem', background:'rgba(14,13,46,0.8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {selected.id_photo_url ? (
                        <img src={selected.id_photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : <span style={{ fontSize:'1.5rem', color:'var(--text-dim)' }}>🪪</span>}
                    </div>
                    <div style={{ fontSize:'0.62rem', color:'var(--text2)', fontFamily:'var(--font-mono)', marginBottom:'0.35rem' }}>ID / IQAMA PHOTO</div>
                    {isSu && (
                      <>
                        <input ref={idRef} type="file" accept="image/*" capture="environment" onChange={e=>uploadPhoto(e,'id')} style={{ display:'none' }} />
                        <button className="btn btn-secondary btn-sm" onClick={()=>idRef.current?.click()} disabled={uploading==='id'}>
                          {uploading==='id'?'⟳':'📷'} Upload
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--violet)', marginBottom:'0.75rem', letterSpacing:'0.08em' }}>INFORMATION</div>
                <div className="info-grid">
                  {[['Username',`@${selected.username}`],['Email',selected.email],['Role',selected.role],['Department',selected.department||'—'],['Phone',selected.phone||'—'],['WhatsApp',selected.whatsapp_number||'—'],['Status',selected.is_active?'Active':'Inactive'],['Last Login',selected.last_login?new Date(selected.last_login).toLocaleString('en-GB'):'Never']].map(([l,v]) => (
                    <div key={l} className="info-cell">
                      <div className="info-cell-label">{l}</div>
                      <div className="info-cell-value" style={{ color: l==='Status'?(selected.is_active?'var(--green)':'var(--rose)'):undefined }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset password (superuser only) */}
              {isSu && selected.id !== user?.id && (
                <div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--rose)', marginBottom:'0.75rem', letterSpacing:'0.08em' }}>🔐 RESET PASSWORD</div>
                  {resetMsg && <div className={resetMsg.includes('success') ? 'alert-success' : 'alert-error'} style={{ marginBottom:'0.5rem' }}>{resetMsg}</div>}
                  <div style={{ display:'flex', gap:'0.5rem' }}>
                    <input type="password" style={inputS} placeholder="New password (min 8 chars)" value={resetPw} onChange={e=>setResetPw(e.target.value)} autoComplete="new-password" />
                    <button className="btn btn-danger" onClick={resetPassword} disabled={resetting} style={{ whiteSpace:'nowrap', minWidth:100 }}>
                      {resetting?'⟳ Resetting…':'🔐 Reset'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
