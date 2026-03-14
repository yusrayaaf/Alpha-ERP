// src/pages/Dashboard.tsx — Alpha Ultimate ERP v13
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import { useLang } from '../lib/LangContext'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DashData {
  expenses:          { total_count:number; approved_total:number; pending_count:number; approved_count:number; rejected_count:number }
  invoices:          { total_count:number; approved_total:number; pending_count:number; approved_count:number }
  pending_approvals: number
  monthly_trend:     { month:string; total:number }[]
  wallet:            { total_invoiced:number; total_expenses:number; balance:number } | null
  assets:            { total:number; total_value:number }
  workers:           { total:number }
  crm?:              { customers:number; leads:number; leads_won:number }
  projects?:         { total:number; active:number; tasks_total:number; tasks_done:number }
}

const NEON  = ['#4f8cff','#00ffb3','#ff3cac','#ffe135','#bf5fff','#00d4ff']
const TICK  = { fill:'#8b86c8', fontSize:10 }

function Counter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const dur = 1200
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.floor(ease * value))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else setDisplay(value)
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])
  return <>{prefix}{display.toLocaleString('en-SA')}</>
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const su = isSuperUser(user)
  const { lang } = useLang()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<DashData>('/reports/dashboard')
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const fmt = (n: number) => 'SAR ' + (n||0).toLocaleString('en-SA', { minimumFractionDigits:0 })

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div className="spinner" style={{ width:32,height:32 }} />
    </div>
  )
  if (error) return <div className="error-box">{error}</div>
  if (!data) return null

  const pieData = [
    { name:'Approved', value: Number(data.expenses.approved_count) },
    { name:'Pending',  value: Number(data.expenses.pending_count)  },
    { name:'Rejected', value: Number(data.expenses.rejected_count) },
  ].filter(d => d.value > 0)

  const kpis = [
    { label:'Total Expenses', value: fmt(data.expenses.approved_total), sub:`${data.expenses.total_count} records`, color:'#4f8cff', icon:'💰', path:'/expenses' },
    { label:'Total Invoiced',  value: fmt(data.invoices.approved_total), sub:`${data.invoices.total_count} invoices`, color:'#00ffb3', icon:'🧾', path:'/invoices' },
    { label:'My Balance',      value: fmt(data.wallet?.balance ?? 0), sub:`${data.wallet?.total_invoiced ? fmt(data.wallet.total_invoiced)+' invoiced' : 'No data'}`, color:'#ffe135', icon:'💳', path:'/wallet' },
    { label:'Active Workers',  value: String(data.workers?.total ?? 0), sub:'HR workforce', color:'#bf5fff', icon:'👷', path:'/workers' },
    { label:'Assets In Use',   value: String(data.assets?.total ?? 0), sub:`${fmt(data.assets?.total_value ?? 0)} value`, color:'#00d4ff', icon:'🏗️', path:'/assets' },
    ...(su ? [{ label:'Pending Approvals', value: String(data.pending_approvals), sub:'Needs review', color:'#ff3cac', icon:'✅', path:'/approvals' }] : []),
    ...(data.crm ? [
      { label:'Customers', value: String(data.crm.customers), sub:`${data.crm.leads} leads · ${data.crm.leads_won} won`, color:'#ff8800', icon:'🏢', path:'/crm/customers' },
    ] : []),
    ...(data.projects ? [
      { label:'Active Projects', value: String(data.projects.active), sub:`${data.projects.tasks_done}/${data.projects.tasks_total} tasks done`, color:'#a8ff78', icon:'📁', path:'/projects' },
    ] : []),
  ]

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Welcome back, {user?.full_name?.split(' ')[0]} 👋</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'1rem', marginBottom:'2rem' }}>
        {kpis.map((k, i) => (
          <div key={i} className="card kpi-card" onClick={() => navigate(k.path)}
            style={{ padding:'1.25rem', cursor:'pointer', borderLeft:`3px solid ${k.color}`, transition:'transform .15s' }}
            onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform='')}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.5rem' }}>
              <span style={{ fontSize:'.75rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.06em' }}>{k.label}</span>
              <span style={{ fontSize:'1.2rem' }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:'1.4rem', fontWeight:800, color:k.color, marginBottom:'.25rem', fontFamily:'var(--font-mono)' }}>
              {k.value.startsWith('SAR') ? (
                <><span style={{ fontSize:'.8rem', opacity:.7 }}>SAR </span>{k.value.replace('SAR ','')}</>
              ) : k.value}
            </div>
            <div style={{ fontSize:'.72rem', color:'var(--text2)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
        {/* Monthly trend */}
        <div className="card" style={{ padding:'1.25rem' }}>
          <h3 style={{ marginBottom:'1rem', fontSize:'.85rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.06em' }}>Monthly Expense Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.monthly_trend} margin={{ top:5,right:5,bottom:0,left:0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8cff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f8cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
              <Tooltip formatter={(v: number) => ['SAR '+v.toLocaleString('en-SA'),'Amount']} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:'.8rem' }} />
              <Area type="monotone" dataKey="total" stroke="#4f8cff" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense pie */}
        <div className="card" style={{ padding:'1.25rem' }}>
          <h3 style={{ marginBottom:'1rem', fontSize:'.85rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.06em' }}>Expense Status</h3>
          {pieData.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem 0', color:'var(--text2)', fontSize:'.85rem' }}>No expense data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={NEON[i % NEON.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:'.8rem' }} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize:'.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card" style={{ padding:'1.25rem' }}>
        <h3 style={{ marginBottom:'1rem', fontSize:'.85rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.06em' }}>Quick Actions</h3>
        <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap' }}>
          {[
            { label:'New Expense',  icon:'💰', path:'/expenses/new' },
            { label:'New Invoice',  icon:'🧾', path:'/invoices/new' },
            { label:'Add Worker',   icon:'👷', path:'/workers' },
            { label:'New Project',  icon:'📁', path:'/projects' },
            { label:'New Lead',     icon:'🎯', path:'/crm/leads' },
            { label:'View Reports', icon:'📋', path:'/reports' },
          ].map(a => (
            <button key={a.path} className="btn" onClick={() => navigate(a.path)}
              style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
              <span>{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
