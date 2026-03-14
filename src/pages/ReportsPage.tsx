// src/pages/ReportsPage.tsx — Alpha Ultimate ERP v8
// Advanced Reports with customizable branding, user photos, PDF/Excel export
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

type ReportType = 'expenses'|'invoices'|'workers'|'salary'|'assets'|'wallet'

interface Settings { report_title?:string; report_subtitle?:string; report_footer?:string; report_show_logo?:boolean; company_name?:string; company_cr?:string; company_address?:string }

export default function ReportsPage() {
  const { user } = useAuth()
  const [type, setType]         = useState<ReportType>('expenses')
  const [data, setData]         = useState<Record<string,unknown>[]>([])
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState('')
  const [settings, setSettings] = useState<Settings>({})
  const [filters, setFilters]   = useState({ from:'', to:'', status:'', year: String(new Date().getFullYear()) })

  useEffect(() => {
    api.get<{settings:Settings}>('/settings').then(d => setSettings(d.settings)).catch(() => {})
  }, [])

  async function loadData() {
    setLoading(true); setErr('')
    try {
      let d: Record<string,unknown>[] = []
      if (type === 'expenses') { const r = await api.get<{expenses:Record<string,unknown>[]}>('/expenses'); d = r.expenses }
      else if (type === 'invoices') { const r = await api.get<{invoices:Record<string,unknown>[]}>('/invoices'); d = r.invoices }
      else if (type === 'workers') { const r = await api.get<{workers:Record<string,unknown>[]}>('/reports/workers'); d = r.workers }
      else if (type === 'assets') { const r = await api.get<{assets:Record<string,unknown>[]}>('/assets'); d = r.assets }
      else if (type === 'wallet') { const r = await api.get<{wallets:Record<string,unknown>[]}>('/reports/wallet'); d = r.wallets }
      else if (type === 'salary') { const r = await api.get<{salary_records:Record<string,unknown>[]}>('/salary'); d = r.salary_records }
      // Apply client-side filters
      if (filters.status) d = d.filter(x => x.status === filters.status)
      setData(d)
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  function fmt(n: unknown) { return Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:2}) }
  function fmtDate(s: unknown) { return s ? new Date(String(s)).toLocaleDateString('en-GB') : '—' }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
    const title = String(settings.report_title || 'Alpha Ultimate Ltd')
    const subtitle = String(settings.report_subtitle || '')
    const footer = String(settings.report_footer || '')

    doc.setFont('helvetica','bold')
    doc.setFontSize(18)
    doc.setTextColor(79,140,255)
    doc.text(title, 14, 18)
    doc.setFontSize(9)
    doc.setFont('helvetica','normal')
    doc.setTextColor(100)
    if (subtitle) doc.text(subtitle, 14, 24)
    doc.text(`Report: ${type.toUpperCase()} | Generated: ${new Date().toLocaleString('en-GB')} | By: ${user?.full_name}`, 14, 30)

    const cols = getColumns()
    const rows = data.map(row => cols.map(c => String(row[c.key] ?? '—')))

    autoTable(doc, {
      head: [cols.map(c => c.label)],
      body: rows,
      startY: 36,
      styles: { fontSize:8, cellPadding:2.5 },
      headStyles: { fillColor:[79,140,255], textColor:255, fontStyle:'bold', fontSize:9 },
      alternateRowStyles: { fillColor:[245,245,255] },
    })

    if (footer) {
      const pageCount = (doc as unknown as { internal:{ getNumberOfPages:()=>number } }).internal.getNumberOfPages()
      for (let i=1; i<=pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7); doc.setTextColor(150)
        doc.text(footer, 14, doc.internal.pageSize.getHeight() - 8)
      }
    }

    doc.save(`alpha-${type}-report-${new Date().toISOString().slice(0,10)}.pdf`)
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const cols = getColumns()
    const ws_data = [cols.map(c => c.label), ...data.map(row => cols.map(c => row[c.key] ?? ''))]
    const ws = XLSX.utils.aoa_to_sheet(ws_data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, type)
    XLSX.writeFile(wb, `alpha-${type}-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  function getColumns(): {key:string;label:string}[] {
    if (type==='expenses') return [{key:'form_number',label:'Form#'},{key:'submitted_by_name',label:'Submitted By'},{key:'project_name',label:'Project'},{key:'category_name',label:'Category'},{key:'grand_total',label:'Total SAR'},{key:'status',label:'Status'},{key:'submitted_at',label:'Date'}]
    if (type==='invoices') return [{key:'invoice_number',label:'Invoice#'},{key:'submitted_by_name',label:'By'},{key:'client_name',label:'Client'},{key:'project_name',label:'Project'},{key:'grand_total',label:'Total SAR'},{key:'status',label:'Status'},{key:'submitted_at',label:'Date'}]
    if (type==='workers') return [{key:'employee_id',label:'Emp ID'},{key:'full_name',label:'Name'},{key:'nationality',label:'Nationality'},{key:'job_title',label:'Job Title'},{key:'department',label:'Dept'},{key:'basic_salary',label:'Basic SAR'},{key:'status',label:'Status'},{key:'days_present',label:'Days Present'},{key:'days_absent',label:'Days Absent'}]
    if (type==='salary') return [{key:'worker_name',label:'Worker'},{key:'period_month',label:'Month'},{key:'period_year',label:'Year'},{key:'basic_salary',label:'Basic'},{key:'gross_salary',label:'Gross'},{key:'net_salary',label:'Net'},{key:'gosi_employee',label:'GOSI Emp'},{key:'status',label:'Status'}]
    if (type==='assets') return [{key:'asset_number',label:'Asset#'},{key:'name',label:'Name'},{key:'category',label:'Category'},{key:'location',label:'Location'},{key:'purchase_cost',label:'Purchase Cost'},{key:'current_value',label:'Current Value'},{key:'status',label:'Status'}]
    if (type==='wallet') return [{key:'full_name',label:'User'},{key:'total_invoiced',label:'Total Invoiced'},{key:'total_expenses',label:'Total Expenses'},{key:'balance',label:'Balance SAR'}]
    return []
  }

  const REPORT_TYPES: {key:ReportType;label:string;icon:string}[] = [
    {key:'expenses',  label:'Expenses',    icon:'💰'},
    {key:'invoices',  label:'Invoices',    icon:'🧾'},
    {key:'workers',   label:'Workers+HR',  icon:'👷'},
    {key:'salary',    label:'Payroll',     icon:'💳'},
    {key:'assets',    label:'Assets',      icon:'🏗️'},
    {key:'wallet',    label:'Wallet',      icon:'👛'},
  ]

  const isSu = user?.role === 'superuser'

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 className="page-title">📋 Reports & Export</h1>
          <p style={{ color:'var(--text2)', fontSize:'0.85rem', margin:'0.25rem 0 0' }}>
            {String(settings.report_title||'Alpha Ultimate Ltd')} · {String(settings.report_subtitle||'')}
          </p>
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          {data.length > 0 && <>
            <button className="btn btn-success" onClick={exportExcel}>⬇ Excel</button>
            <button className="btn btn-primary" onClick={exportPDF}>⬇ PDF</button>
          </>}
        </div>
      </div>

      {err && <div className="alert-error">{err}</div>}

      {/* Type selector */}
      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1rem' }}>
        {REPORT_TYPES.map(rt => (
          <button key={rt.key}
            onClick={()=>setType(rt.key)}
            style={{ padding:'0.45rem 1rem', borderRadius:8, border:`1px solid ${type===rt.key?'var(--blue)':'var(--border)'}`, background:type===rt.key?'rgba(79,140,255,0.12)':'rgba(255,255,255,0.03)', color:type===rt.key?'var(--blue)':'var(--text2)', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:'0.85rem', transition:'all .15s' }}>
            {rt.icon} {rt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <label style={{ display:'block', fontSize:'0.58rem', color:'var(--text2)', fontFamily:'var(--font-mono)', letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:'0.2rem' }}>STATUS</label>
          <select style={{ background:'rgba(5,5,26,0.92)', border:'1px solid #201e58', color:'#ece9ff', padding:'0.45rem 0.7rem', borderRadius:8, fontSize:'0.82rem', fontFamily:'var(--font)', outline:'none' }}
            value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value}))}>
            {['','pending','approved','rejected','hold','active','paid'].map(s => <option key={s} value={s} style={{ background:'#0e0d2e',color:'#ece9ff' }}>{s||'All Statuses'}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={loadData} disabled={loading}>
          {loading ? '⟳ Loading…' : '🔍 Generate Report'}
        </button>
      </div>

      {/* Table */}
      {data.length > 0 && (
        <div className="glass">
          <div style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--blue)', letterSpacing:'0.08em' }}>{data.length} RECORDS</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{getColumns().map(c => <th key={c.key}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    {getColumns().map(c => (
                      <td key={c.key}>
                        {c.key==='status' ? (
                          <span className={`badge badge-${String(row[c.key]||'pending')}`}>{String(row[c.key]||'—')}</span>
                        ) : c.key.includes('_at') || c.key.includes('date') ? (
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'var(--text2)' }}>{fmtDate(row[c.key])}</span>
                        ) : c.key.includes('salary') || c.key.includes('total') || c.key.includes('cost') || c.key.includes('value') || c.key.includes('balance') ? (
                          <span style={{ fontFamily:'var(--font-mono)', color:'var(--green)', fontSize:'0.82rem' }}>{fmt(row[c.key])}</span>
                        ) : (
                          <span>{String(row[c.key] ?? '—')}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.length === 0 && !loading && (
        <div style={{ textAlign:'center', color:'var(--text2)', padding:'3rem', fontSize:'0.85rem', fontFamily:'var(--font-mono)' }}>
          Select a report type and click "Generate Report"
        </div>
      )}
    </div>
  )
}
