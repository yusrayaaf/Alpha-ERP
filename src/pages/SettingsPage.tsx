// src/pages/SettingsPage.tsx — Alpha Ultimate ERP v12
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'

interface Template { id:string; event_name:string; label:string; email_subj:string; email_body:string; wa_body:string; is_active:boolean }

const TABS = ['Company','Finance','HR','Notifications','WA Templates','Reports','Security','Theme'] as const
type Tab = typeof TABS[number]

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab]           = useState<Tab>('Company')
  const [settings, setSettings] = useState<Record<string,unknown>>({})
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [err, setErr]           = useState('')

  const [curPass, setCurPass]   = useState('')
  const [newPass, setNewPass]   = useState('')
  const [confPass, setConfPass] = useState('')
  const [passMsg, setPassMsg]   = useState('')
  const [passErr, setPassErr]   = useState('')
  const [changingPass, setChangingPass] = useState(false)

  const isSu = user?.role === 'superuser'

  useEffect(() => {
    Promise.all([
      api.get<{settings:Record<string,unknown>}>('/settings'),
      api.get<{templates:Template[]}>('/notifications/templates').catch(() => ({ templates:[] }))
    ]).then(([s, t]) => {
      setSettings(s.settings || {})
      setTemplates(t.templates || [])
    }).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  function set(key: string, val: unknown) {
    setSettings(s => ({ ...s, [key]: val }))
  }

  async function save() {
    setSaving(true); setMsg(''); setErr('')
    try {
      await api.post('/settings', { settings })
      setMsg('Settings saved successfully.')
      setTimeout(() => setMsg(''), 3000)
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function changePassword() {
    setPassErr(''); setPassMsg('')
    if (newPass !== confPass) { setPassErr('Passwords do not match.'); return }
    if (newPass.length < 8) { setPassErr('Minimum 8 characters.'); return }
    setChangingPass(true)
    try {
      const r = await api.post<{message:string}>('/users/change-password', { current_password: curPass, new_password: newPass })
      setPassMsg(r.message || 'Password changed.')
      setCurPass(''); setNewPass(''); setConfPass('')
    } catch(e:unknown) { setPassErr(e instanceof Error ? e.message : 'Failed') }
    finally { setChangingPass(false) }
  }

  async function saveTemplate(t: Template) {
    try {
      await api.post('/notifications/templates', { event_name: t.event_name, email_subj: t.email_subj, email_body: t.email_body, wa_body: t.wa_body, is_active: t.is_active })
      setMsg(`Template "${t.label}" saved.`); setTimeout(() => setMsg(''), 3000)
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Failed') }
  }

  function updateTemplate(idx: number, field: keyof Template, val: unknown) {
    setTemplates(p => { const c=[...p]; c[idx]={...c[idx],[field]:val as never}; return c })
  }

  if (loading) return <div className="loading-center"><div className="spinner"/></div>

  const s = settings

  return (
    <div>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 className="page-title">⚙️ System Settings</h1>
        <p className="page-subtitle">Configure your ERP system, notifications, and security</p>
      </div>

      {msg && <div className="alert-success">{msg}</div>}
      {err && <div className="alert-error">{err}</div>}

      <div className="tab-nav" style={{ overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── COMPANY ── */}
      {tab === 'Company' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
          {[
            ['company_name','Company Name'],['company_cr','CR Number'],['company_vat','VAT Number'],
            ['company_address','Address'],['company_phone','Phone'],['company_email','Email'],
            ['company_website','Website'],
          ].map(([k, l]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input className="input" value={String(s[k]??'')} onChange={e=>set(k,e.target.value)} disabled={!isSu} />
            </div>
          ))}
          <div>
            <label className="label">Currency</label>
            <select className="input" value={String(s['currency']??'SAR')} onChange={e=>set('currency',e.target.value)} disabled={!isSu}>
              {['SAR','USD','EUR','GBP','AED','BDT'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">VAT Rate (%)</label>
            <input type="number" className="input" value={String(s['vat_rate']??'15')} onChange={e=>set('vat_rate',e.target.value)} disabled={!isSu} />
          </div>
          {isSu && <div style={{ gridColumn:'1/-1' }}><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'⟳ Saving…':'💾 Save Company Settings'}</button></div>}
        </div>
      )}

      {/* ── FINANCE ── */}
      {tab === 'Finance' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
          {[['fiscal_year_start','Fiscal Year Start (MM)'],['timezone','Timezone'],['date_format','Date Format']].map(([k,l]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input className="input" value={String(s[k]??'')} onChange={e=>set(k,e.target.value)} disabled={!isSu} />
            </div>
          ))}
          {isSu && <div style={{ gridColumn:'1/-1' }}><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'⟳ Saving…':'💾 Save Finance Settings'}</button></div>}
        </div>
      )}

      {/* ── HR ── */}
      {tab === 'HR' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
          {[['salary_gosi_rate','GOSI Employee Rate (%)'],['salary_ot_rate','Overtime Hourly Rate'],['working_days_month','Working Days per Month']].map(([k,l]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input type="number" className="input" value={String(s[k]??'')} onChange={e=>set(k,e.target.value)} disabled={!isSu} />
            </div>
          ))}
          {isSu && <div style={{ gridColumn:'1/-1' }}><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'⟳ Saving…':'💾 Save HR Settings'}</button></div>}
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === 'Notifications' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
          <div className="card">
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--blue)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'.75rem', borderBottom:'1px solid var(--border)', paddingBottom:'.4rem' }}>
              📧 Email / SMTP
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'.75rem' }}>
              <label className="label" style={{ margin:0 }}>Enable Email Notifications</label>
              <input type="checkbox" checked={!!s['notif_email_enabled']} onChange={e=>set('notif_email_enabled',e.target.checked)} disabled={!isSu} style={{ width:18, height:18, accentColor:'var(--green)' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'.75rem' }}>
              {[['notif_email_smtp_host','SMTP Host'],['notif_email_smtp_port','SMTP Port'],['notif_email_user','SMTP Username'],['notif_email_pass','SMTP Password'],['notif_email_from','From Address']].map(([k,l]) => (
                <div key={k}>
                  <label className="label">{l}</label>
                  <input type={k.includes('pass')?'password':'text'} className="input" value={String(s[k]??'')} onChange={e=>set(k,e.target.value)} disabled={!isSu} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--green)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'.75rem', borderBottom:'1px solid var(--border)', paddingBottom:'.4rem' }}>
              💬 WhatsApp Business API
            </div>
            <div style={{ background:'var(--green-d)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'var(--radius)', padding:'.75rem', marginBottom:'.75rem', fontSize:'.78rem', color:'var(--text2)', lineHeight:1.6 }}>
              <strong style={{ color:'var(--green)' }}>Setup:</strong> Go to <strong>developers.facebook.com</strong> → Create App → WhatsApp product → Get Access Token & Phone Number ID. Free tier: 1,000 conversations/month.
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'.75rem' }}>
              <label className="label" style={{ margin:0 }}>Enable WhatsApp Notifications</label>
              <input type="checkbox" checked={!!s['notif_whatsapp_enabled']} onChange={e=>set('notif_whatsapp_enabled',e.target.checked)} disabled={!isSu} style={{ width:18, height:18, accentColor:'var(--green)' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'.75rem' }}>
              <div>
                <label className="label">Access Token</label>
                <input type="password" className="input" value={String(s['notif_whatsapp_token']??'')} onChange={e=>set('notif_whatsapp_token',e.target.value)} disabled={!isSu} placeholder="EAAxxxxxxxx…" />
              </div>
              <div>
                <label className="label">Phone Number ID</label>
                <input className="input" value={String(s['notif_whatsapp_phone_id']??'')} onChange={e=>set('notif_whatsapp_phone_id',e.target.value)} disabled={!isSu} />
              </div>
            </div>
          </div>

          {isSu && <button className="btn btn-primary" style={{ alignSelf:'flex-start' }} onClick={save} disabled={saving}>{saving?'⟳ Saving…':'💾 Save Notification Settings'}</button>}
        </div>
      )}

      {/* ── WA TEMPLATES ── */}
      {tab === 'WA Templates' && (
        <div>
          <div className="alert-info" style={{ marginBottom:'1rem' }}>
            Variables: <span className="mono">{'{{form_number}} {{submitted_by}} {{amount}} {{project_name}} {{approver_name}} {{comment}} {{status}}'}</span>
          </div>
          {templates.map((t, i) => (
            <div key={t.id} className="card" style={{ marginBottom:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.75rem', flexWrap:'wrap', gap:'.5rem' }}>
                <div style={{ fontWeight:700, color:'var(--blue)', fontSize:'.95rem' }}>{t.label}</div>
                <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
                  <label className="label" style={{ margin:0 }}>Active</label>
                  <input type="checkbox" checked={t.is_active} onChange={e=>updateTemplate(i,'is_active',e.target.checked)} disabled={!isSu} style={{ width:16, height:16, accentColor:'var(--green)' }} />
                  {isSu && <button className="btn btn-success btn-sm" onClick={()=>saveTemplate(t)}>Save</button>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
                <div>
                  <label className="label">Email Subject</label>
                  <input className="input" value={t.email_subj||''} onChange={e=>updateTemplate(i,'email_subj',e.target.value)} disabled={!isSu} />
                  <label className="label" style={{ marginTop:'.5rem' }}>Email Body</label>
                  <textarea className="input" style={{ minHeight:100 }} value={t.email_body||''} onChange={e=>updateTemplate(i,'email_body',e.target.value)} disabled={!isSu} />
                </div>
                <div>
                  <label className="label">💬 WhatsApp Message</label>
                  <textarea className="input" style={{ minHeight:145 }} value={t.wa_body||''} onChange={e=>updateTemplate(i,'wa_body',e.target.value)} disabled={!isSu} placeholder="WhatsApp supports *bold* and _italic_" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REPORTS ── */}
      {tab === 'Reports' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
          {[['report_title','Report Title'],['report_subtitle','Report Subtitle'],['report_footer','Report Footer']].map(([k,l]) => (
            <div key={k} style={{ gridColumn:k==='report_footer'?'1/-1':undefined }}>
              <label className="label">{l}</label>
              <input className="input" value={String(s[k]??'')} onChange={e=>set(k,e.target.value)} disabled={!isSu} />
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
            <label className="label" style={{ margin:0 }}>Show Logo in Reports</label>
            <input type="checkbox" checked={!!s['report_show_logo']} onChange={e=>set('report_show_logo',e.target.checked)} disabled={!isSu} style={{ width:18, height:18, accentColor:'var(--blue)' }} />
          </div>
          {isSu && <div style={{ gridColumn:'1/-1' }}><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'⟳ Saving…':'💾 Save Report Settings'}</button></div>}
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'Security' && (
        <div style={{ display:'grid', gap:'1.5rem' }}>
          <div className="card" style={{ maxWidth:480 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--blue)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'.75rem', borderBottom:'1px solid var(--border)', paddingBottom:'.4rem' }}>
              🔐 Change Your Password
            </div>
            {passMsg && <div className="alert-success">{passMsg}</div>}
            {passErr && <div className="alert-error">{passErr}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
              <div>
                <label className="label">Current Password</label>
                <input type="password" className="input" value={curPass} onChange={e=>setCurPass(e.target.value)} autoComplete="current-password" />
              </div>
              <div>
                <label className="label">New Password (min 8 chars)</label>
                <input type="password" className="input" value={newPass} onChange={e=>setNewPass(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" className="input" style={{ borderColor: confPass && confPass!==newPass ? 'var(--rose)' : undefined }} value={confPass} onChange={e=>setConfPass(e.target.value)} autoComplete="new-password" />
                {confPass && confPass!==newPass && <span style={{ fontSize:'.68rem', color:'var(--rose)', marginTop:'.2rem', display:'block' }}>Passwords do not match</span>}
              </div>
              <button className="btn btn-primary" onClick={changePassword} disabled={changingPass || !curPass || !newPass}>
                {changingPass ? '⟳ Changing…' : '🔐 Change Password'}
              </button>
            </div>
          </div>

          <div className="card" style={{ maxWidth:480 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--blue)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'.75rem', borderBottom:'1px solid var(--border)', paddingBottom:'.4rem' }}>
              👤 Your Account
            </div>
            {[['Username', user?.username||'—'], ['Full Name', user?.full_name||'—'], ['Role', user?.role||'—'], ['Department', user?.department||'—'], ['Email', user?.email||'—']].map(([l,v]) => (
              <div key={l} className="detail-row">
                <span className="detail-label">{l}</span>
                <span className="detail-value">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── THEME ── */}
      {tab === 'Theme' && (
        <div style={{ maxWidth:500 }}>
          <div className="card">
            <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>🎨 Appearance</h3>
            <p style={{ color:'var(--text2)', fontSize:'.85rem', marginBottom:'1.25rem' }}>
              Choose how Alpha Ultimate ERP looks. Your preference is saved locally.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              {([['dark', '🌙', 'Dark Mode', 'Premium dark theme — easy on the eyes'], ['light', '☀️', 'Light Mode', 'Clean light theme — great for daylight work']] as const).map(([t, icon, name, desc]) => (
                <div key={t}
                  onClick={theme !== t ? toggleTheme : undefined}
                  style={{
                    border:`2px solid ${theme === t ? 'var(--blue)' : 'var(--border2)'}`,
                    borderRadius:'var(--radius-lg)', padding:'1.25rem', cursor:'pointer',
                    background: theme === t ? 'var(--blue-d)' : 'var(--card)',
                    transition:'all .2s',
                  }}>
                  <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>{icon}</div>
                  <div style={{ fontWeight:700, color:'var(--text)', marginBottom:'.25rem' }}>{name}</div>
                  <div style={{ fontSize:'.78rem', color:'var(--text2)' }}>{desc}</div>
                  {theme === t && <div style={{ marginTop:'.75rem' }}><span className="badge badge-active">Active</span></div>}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop:'1.25rem' }} onClick={toggleTheme}>
              Switch to {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
