// src/pages/FormBuilderPage.tsx — Alpha Ultimate ERP v8
// Visual Drag-and-Drop Form Builder for Superusers
import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

type FieldType = 'text'|'number'|'email'|'phone'|'date'|'time'|'textarea'|'select'|'checkbox'|'file'|'currency'|'section_header'|'signature'

interface FieldDef {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  width?: 'full'|'half'|'third'
  description?: string
}

interface FormDef {
  id?: string
  name: string
  description?: string
  module: string
  fields: FieldDef[]
  settings: { allow_attachments:boolean; requires_approval:boolean; notify_on_submit:boolean }
  status: 'active'|'draft'|'archived'
}

const FIELD_TYPES: { type:FieldType; label:string; icon:string }[] = [
  { type:'text',           label:'Text Input',       icon:'📝' },
  { type:'number',         label:'Number',            icon:'🔢' },
  { type:'currency',       label:'Currency Amount',   icon:'💰' },
  { type:'email',          label:'Email',             icon:'📧' },
  { type:'phone',          label:'Phone',             icon:'📱' },
  { type:'date',           label:'Date',              icon:'📅' },
  { type:'time',           label:'Time',              icon:'🕐' },
  { type:'textarea',       label:'Long Text',         icon:'📄' },
  { type:'select',         label:'Dropdown',          icon:'▼' },
  { type:'checkbox',       label:'Checkbox',          icon:'☑️' },
  { type:'file',           label:'File / Photo',      icon:'📎' },
  { type:'section_header', label:'Section Header',    icon:'━━' },
  { type:'signature',      label:'Signature Field',   icon:'✍️' },
]

const MODULES = ['finance','assets','investments','liabilities','workers','general']

function genId() { return 'f_' + Math.random().toString(36).slice(2, 9) }

const emptyForm = (): FormDef => ({
  name:'', description:'', module:'general',
  fields:[],
  settings:{ allow_attachments:true, requires_approval:true, notify_on_submit:true },
  status:'draft'
})

const inputS: React.CSSProperties = { width:'100%', background:'rgba(5,5,26,0.92)', border:'1px solid #201e58', color:'#ece9ff', padding:'0.5rem 0.75rem', borderRadius:8, fontSize:'0.85rem', fontFamily:'var(--font)', outline:'none' }
const labelS: React.CSSProperties = { display:'block', fontSize:'0.58rem', fontWeight:700, color:'#7470b0', marginBottom:'0.2rem', textTransform:'uppercase', letterSpacing:'0.09em', fontFamily:'var(--font-mono)' }

export default function FormBuilderPage() {
  const { user } = useAuth()
  const [forms, setForms]     = useState<FormDef[]>([])
  const [form, setForm]       = useState<FormDef>(emptyForm())
  const [editing, setEditing] = useState<string|null>(null)
  const [selField, setSelField] = useState<string|null>(null)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')
  const [dragIdx, setDragIdx] = useState<number|null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  const dragOver = useRef<number|null>(null)

  useEffect(() => {
    api.get<{forms:FormDef[]}>('/forms').then(d => setForms(d.forms)).catch(e => setErr(e.message))
  }, [])

  if (user?.role !== 'superuser') return (
    <div style={{ padding:'2rem', color:'#ff3cac' }}>Access denied. Superuser only.</div>
  )

  function addField(type: FieldType) {
    const field: FieldDef = { id:genId(), type, label: FIELD_TYPES.find(f=>f.type===type)?.label ?? type, required:false, width:'full', options: type==='select' ? ['Option 1','Option 2'] : undefined }
    setForm(f => ({ ...f, fields:[...f.fields, field] }))
    setSelField(field.id)
  }

  function updateField(id: string, patch: Partial<FieldDef>) {
    setForm(f => ({ ...f, fields: f.fields.map(field => field.id===id ? { ...field, ...patch } : field) }))
  }

  function removeField(id: string) {
    setForm(f => ({ ...f, fields: f.fields.filter(field => field.id!==id) }))
    if (selField === id) setSelField(null)
  }

  function moveField(from: number, to: number) {
    setForm(f => {
      const arr = [...f.fields]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return { ...f, fields: arr }
    })
  }

  async function save() {
    if (!form.name.trim()) { setErr('Form name required'); return }
    setSaving(true); setMsg(''); setErr('')
    try {
      if (editing) {
        await api.post('/forms/update', { id:editing, ...form })
        setMsg('Form updated.')
        setForms(prev => prev.map(f => f.id===editing ? { ...form, id:editing } : f))
      } else {
        const r = await api.post<{form:{id:string}&FormDef}>('/forms', form)
        setMsg('Form created.')
        setForms(prev => [r.form, ...prev])
        setEditing(r.form.id)
        setForm({ ...form, id:r.form.id })
      }
      setTimeout(() => setMsg(''), 3000)
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  function loadForm(f: FormDef) {
    setForm({ ...f, fields: Array.isArray(f.fields) ? f.fields : [] })
    setEditing(f.id ?? null)
    setSelField(null)
    setPreviewMode(false)
  }

  const selectedField = form.fields.find(f => f.id === selField) ?? null

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 className="page-title">🛠️ Form Builder</h1>
          <p style={{ color:'var(--text2)', fontSize:'0.82rem', margin:'0.25rem 0 0' }}>Visually design custom forms with drag-and-drop fields</p>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPreviewMode(p=>!p)}>
            {previewMode ? '✏️ Edit Mode' : '👁 Preview'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={()=>{ setForm(emptyForm()); setEditing(null); setSelField(null) }}>
            + New Form
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '⟳ Saving…' : '💾 Save Form'}
          </button>
        </div>
      </div>

      {msg && <div className="alert-success">{msg}</div>}
      {err && <div className="alert-error">{err}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr 260px', gap:'1rem', minHeight:'70vh' }}>

        {/* Left: Existing forms + field palette */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {/* Saved forms */}
          <div style={{ background:'rgba(14,13,46,0.85)', border:'1px solid var(--border)', borderRadius:10, padding:'0.75rem' }}>
            <div className="section-label" style={{ marginBottom:'0.5rem' }}>SAVED FORMS</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', maxHeight:160, overflowY:'auto' }}>
              {forms.map(f => (
                <div key={f.id} onClick={()=>loadForm(f)}
                  style={{ padding:'0.4rem 0.6rem', borderRadius:7, cursor:'pointer', border:`1px solid ${editing===f.id?'var(--blue)':'transparent'}`, background: editing===f.id?'rgba(79,140,255,0.1)':'rgba(255,255,255,0.02)', fontSize:'0.78rem', color: editing===f.id?'var(--blue)':'var(--text)' }}>
                  {f.name}
                </div>
              ))}
              {forms.length===0 && <div style={{ fontSize:'0.72rem', color:'var(--text2)' }}>No forms yet</div>}
            </div>
          </div>

          {/* Field palette */}
          {!previewMode && (
            <div style={{ background:'rgba(14,13,46,0.85)', border:'1px solid var(--border)', borderRadius:10, padding:'0.75rem', flex:1 }}>
              <div className="section-label" style={{ marginBottom:'0.5rem' }}>ADD FIELD</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                {FIELD_TYPES.map(ft => (
                  <button key={ft.type} onClick={()=>addField(ft.type)}
                    style={{ background:'rgba(79,140,255,0.06)', border:'1px solid rgba(79,140,255,0.15)', borderRadius:7, padding:'0.35rem 0.6rem', color:'var(--text)', fontSize:'0.72rem', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:'0.4rem', fontFamily:'var(--font)', fontWeight:600 }}>
                    <span>{ft.icon}</span>{ft.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Form canvas */}
        <div style={{ background:'rgba(14,13,46,0.85)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          {/* Form header editor */}
          {!previewMode && (
            <div style={{ padding:'1rem', borderBottom:'1px solid var(--border)', background:'rgba(5,5,26,0.5)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'0.75rem', alignItems:'end' }}>
                <div>
                  <label style={labelS}>FORM NAME</label>
                  <input style={inputS} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="My Custom Form" />
                </div>
                <div>
                  <label style={labelS}>MODULE</label>
                  <select style={{ ...inputS, color:'#ece9ff' }} value={form.module} onChange={e=>setForm(f=>({...f,module:e.target.value}))}>
                    {MODULES.map(m => <option key={m} value={m} style={{ background:'#0e0d2e',color:'#ece9ff' }}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelS}>STATUS</label>
                  <select style={{ ...inputS, color:'#ece9ff', width:100 }} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as FormDef['status']}))}>
                    {['draft','active','archived'].map(s => <option key={s} value={s} style={{ background:'#0e0d2e',color:'#ece9ff' }}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop:'0.5rem' }}>
                <label style={labelS}>DESCRIPTION</label>
                <input style={inputS} value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What is this form for?" />
              </div>
            </div>
          )}

          {/* Fields canvas */}
          <div style={{ padding:'1rem', minHeight:400 }}>
            {previewMode ? (
              /* Preview mode */
              <div style={{ maxWidth:600, margin:'0 auto' }}>
                <h2 style={{ fontFamily:'var(--font)', fontWeight:800, color:'var(--text)', marginBottom:'0.25rem' }}>{form.name||'Untitled Form'}</h2>
                {form.description && <p style={{ color:'var(--text2)', fontSize:'0.85rem', marginBottom:'1.25rem' }}>{form.description}</p>}
                <div style={{ display:'grid', gap:'0.75rem' }}>
                  {form.fields.map(field => (
                    <div key={field.id} style={{ gridColumn: field.width==='half'?'span 1':'span 2' }}>
                      {field.type === 'section_header' ? (
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--blue)', letterSpacing:'0.12em', textTransform:'uppercase', borderBottom:'1px solid var(--border)', paddingBottom:'0.4rem', marginTop:'0.5rem' }}>{field.label}</div>
                      ) : (
                        <>
                          <label style={{ ...labelS }}>{field.label}{field.required && <span style={{ color:'var(--rose)', marginLeft:3 }}>*</span>}</label>
                          {field.type==='textarea' ? (
                            <textarea style={{ ...inputS, minHeight:80, resize:'vertical', color:'#ece9ff' }} placeholder={field.placeholder} readOnly />
                          ) : field.type==='select' ? (
                            <select style={{ ...inputS, color:'#ece9ff' }}>
                              {field.options?.map(o => <option key={o} style={{ background:'#0e0d2e',color:'#ece9ff' }}>{o}</option>)}
                            </select>
                          ) : field.type==='checkbox' ? (
                            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                              <input type="checkbox" style={{ width:18, height:18 }} readOnly />
                              <span style={{ fontSize:'0.85rem', color:'var(--text)' }}>{field.placeholder||field.label}</span>
                            </div>
                          ) : field.type==='file' ? (
                            <div style={{ border:'2px dashed var(--border)', borderRadius:8, padding:'1rem', textAlign:'center', color:'var(--text2)', fontSize:'0.82rem' }}>📎 Tap to attach file / photo</div>
                          ) : field.type==='signature' ? (
                            <div style={{ border:'1px solid var(--border)', borderRadius:8, height:80, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text2)', fontSize:'0.78rem', fontFamily:'var(--font-mono)' }}>SIGNATURE AREA</div>
                          ) : (
                            <input type={field.type==='currency'?'number':field.type} style={inputS} placeholder={field.placeholder} readOnly />
                          )}
                          {field.description && <div style={{ fontSize:'0.65rem', color:'var(--text2)', marginTop:'0.2rem' }}>{field.description}</div>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {form.settings.allow_attachments && (
                  <div style={{ marginTop:'1rem', border:'2px dashed var(--border)', borderRadius:8, padding:'1rem', textAlign:'center', color:'var(--text2)', fontSize:'0.82rem' }}>📷 Attach Receipts / Photos</div>
                )}
                <button className="btn btn-primary btn-lg" style={{ marginTop:'1rem', width:'100%' }}>Submit Form</button>
              </div>
            ) : (
              /* Edit mode canvas */
              <div>
                {form.fields.length === 0 && (
                  <div style={{ border:'2px dashed rgba(79,140,255,0.2)', borderRadius:10, padding:'3rem', textAlign:'center', color:'var(--text2)' }}>
                    <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>⊕</div>
                    <div style={{ fontSize:'0.85rem' }}>Click fields on the left to add them here</div>
                  </div>
                )}
                {form.fields.map((field, idx) => (
                  <div key={field.id}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); dragOver.current = idx }}
                    onDrop={() => { if(dragIdx!==null && dragOver.current!==null && dragIdx!==dragOver.current) moveField(dragIdx, dragOver.current); setDragIdx(null) }}
                    onClick={() => setSelField(field.id === selField ? null : field.id)}
                    style={{ padding:'0.75rem', marginBottom:'0.4rem', borderRadius:9, border:`2px solid ${selField===field.id?'var(--blue)':'rgba(32,30,88,0.6)'}`, background: selField===field.id?'rgba(79,140,255,0.06)':'rgba(5,5,26,0.4)', cursor:'grab', transition:'all .13s', display:'flex', alignItems:'center', gap:'0.75rem', position:'relative' }}>
                    <span style={{ color:'var(--text2)', fontSize:'1rem', cursor:'grab' }}>⠿</span>
                    <span style={{ fontSize:'1rem' }}>{FIELD_TYPES.find(f=>f.type===field.type)?.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--text)', fontFamily:'var(--font)' }}>
                        {field.label}{field.required&&<span style={{ color:'var(--rose)', marginLeft:4 }}>*</span>}
                      </div>
                      <div style={{ fontSize:'0.65rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>{field.type} · {field.width}</div>
                    </div>
                    <button onClick={e=>{e.stopPropagation(); removeField(field.id)}}
                      style={{ background:'rgba(255,60,172,0.1)', border:'1px solid rgba(255,60,172,0.3)', borderRadius:6, color:'#ff3cac', cursor:'pointer', width:28, height:28, fontSize:'0.8rem' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Field properties */}
        {!previewMode && (
          <div style={{ background:'rgba(14,13,46,0.85)', border:'1px solid var(--border)', borderRadius:12, padding:'0.75rem' }}>
            {!selectedField ? (
              <div>
                <div className="section-label" style={{ marginBottom:'0.75rem' }}>FORM SETTINGS</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                  {[
                    ['allow_attachments',   'Allow File Attachments'],
                    ['requires_approval',   'Requires Approval'],
                    ['notify_on_submit',    'Notify on Submit'],
                  ].map(([k,l]) => (
                    <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.5rem 0', borderBottom:'1px solid rgba(32,30,88,0.4)' }}>
                      <span style={{ fontSize:'0.78rem', color:'var(--text)' }}>{l}</span>
                      <input type="checkbox"
                        checked={!!form.settings[k as keyof typeof form.settings]}
                        onChange={e=>setForm(f=>({...f,settings:{...f.settings,[k]:e.target.checked}}))}
                        style={{ width:16, height:16, accentColor:'var(--green)' }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="section-label" style={{ marginBottom:'0.75rem' }}>FIELD PROPERTIES</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                  <div>
                    <label style={labelS}>LABEL</label>
                    <input style={inputS} value={selectedField.label} onChange={e=>updateField(selectedField.id,{label:e.target.value})} />
                  </div>
                  {selectedField.type!=='section_header' && selectedField.type!=='checkbox' && (
                    <div>
                      <label style={labelS}>PLACEHOLDER</label>
                      <input style={inputS} value={selectedField.placeholder||''} onChange={e=>updateField(selectedField.id,{placeholder:e.target.value})} />
                    </div>
                  )}
                  <div>
                    <label style={labelS}>DESCRIPTION / HELP TEXT</label>
                    <input style={inputS} value={selectedField.description||''} onChange={e=>updateField(selectedField.id,{description:e.target.value})} />
                  </div>
                  <div>
                    <label style={labelS}>WIDTH</label>
                    <select style={{ ...inputS, color:'#ece9ff' }} value={selectedField.width||'full'} onChange={e=>updateField(selectedField.id,{width:e.target.value as FieldDef['width']})}>
                      {['full','half','third'].map(w => <option key={w} value={w} style={{ background:'#0e0d2e',color:'#ece9ff' }}>{w}</option>)}
                    </select>
                  </div>
                  {selectedField.type!=='section_header' && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'0.78rem', color:'var(--text)' }}>Required Field</span>
                      <input type="checkbox" checked={!!selectedField.required} onChange={e=>updateField(selectedField.id,{required:e.target.checked})} style={{ width:16, height:16, accentColor:'var(--rose)' }} />
                    </div>
                  )}
                  {selectedField.type==='select' && (
                    <div>
                      <label style={labelS}>OPTIONS (one per line)</label>
                      <textarea style={{ ...inputS, minHeight:100, resize:'vertical', color:'#ece9ff' }}
                        value={(selectedField.options||[]).join('\n')}
                        onChange={e=>updateField(selectedField.id,{options:e.target.value.split('\n').filter(Boolean)})} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
