// src/pages/SubscriptionPage.tsx — Alpha Ultimate ERP v12
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'

interface Plan {
  id: string
  name: string
  price_monthly: number
  price_yearly: number
  max_users: number
  max_storage_gb: number
  features: string[]
  is_active: boolean
  is_popular: boolean
}

interface Subscription {
  id: string
  plan_name: string
  status: string
  started_at: string
  expires_at: string | null
  billing_cycle: string
  price_paid: number
  max_users: number
  current_users: number
  max_storage_gb: number
  notes: string | null
  trial_ends_at: string | null
  contact_email: string | null
  contact_phone: string | null
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price_monthly: 49,
    price_yearly: 470,
    max_users: 5,
    max_storage_gb: 5,
    features: ['Up to 5 users', 'Finance module', 'Basic reports', 'Email support', '5 GB storage'],
    is_active: true,
    is_popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price_monthly: 129,
    price_yearly: 1238,
    max_users: 25,
    max_storage_gb: 25,
    features: ['Up to 25 users', 'All finance modules', 'HR & Payroll', 'Advanced reports', 'WhatsApp notifications', 'Priority support', '25 GB storage'],
    is_active: true,
    is_popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: 299,
    price_yearly: 2870,
    max_users: 999,
    max_storage_gb: 100,
    features: ['Unlimited users', 'All modules', 'Full API access', 'Custom form builder', 'Dedicated support', 'Audit logs', '100 GB storage', 'SLA guarantee'],
    is_active: true,
    is_popular: false,
  },
]

export default function SubscriptionPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)

  const [sub, setSub]         = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')
  const [tab, setTab]         = useState<'overview' | 'plans' | 'manage'>('overview')
  const [cycle, setCycle]     = useState<'monthly' | 'yearly'>('monthly')

  // Manage form state
  const [form, setForm] = useState({
    plan_name: '', status: 'active', billing_cycle: 'monthly',
    price_paid: '', max_users: '', max_storage_gb: '',
    expires_at: '', notes: '', contact_email: '', contact_phone: '',
    trial_ends_at: '',
  })

  useEffect(() => {
    api.get<{ subscription: Subscription | null }>('/subscription')
      .then(d => {
        setSub(d.subscription)
        if (d.subscription) {
          setForm(f => ({
            ...f,
            plan_name: d.subscription!.plan_name,
            status: d.subscription!.status,
            billing_cycle: d.subscription!.billing_cycle,
            price_paid: String(d.subscription!.price_paid || ''),
            max_users: String(d.subscription!.max_users || ''),
            max_storage_gb: String(d.subscription!.max_storage_gb || ''),
            expires_at: d.subscription!.expires_at ? d.subscription!.expires_at.slice(0,10) : '',
            notes: d.subscription!.notes || '',
            contact_email: d.subscription!.contact_email || '',
            contact_phone: d.subscription!.contact_phone || '',
            trial_ends_at: d.subscription!.trial_ends_at ? d.subscription!.trial_ends_at.slice(0,10) : '',
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function saveSub() {
    if (!su) return
    setSaving(true); setMsg(''); setErr('')
    try {
      const r = await api.post<{ subscription: Subscription }>('/subscription', form)
      setSub(r.subscription)
      setMsg('Subscription updated successfully.')
      setTimeout(() => setMsg(''), 3000)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  function selectPlan(plan: Plan) {
    if (!su) return
    const price = cycle === 'monthly' ? plan.price_monthly : plan.price_yearly
    setForm(f => ({
      ...f,
      plan_name: plan.name,
      price_paid: String(price),
      max_users: String(plan.max_users),
      max_storage_gb: String(plan.max_storage_gb),
      billing_cycle: cycle,
      status: 'active',
    }))
    setTab('manage')
  }

  const daysLeft = sub?.expires_at
    ? Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000)
    : null

  const usagePct = sub ? Math.round((sub.current_users / sub.max_users) * 100) : 0

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'.75rem', color:'var(--text2)' }}>Loading subscription…</span>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
          <div>
            <h1 className="page-title">💎 Subscription</h1>
            <p className="page-subtitle">Manage your ERP subscription plan and billing</p>
          </div>
          {sub && (
            <span className={`badge badge-${sub.status === 'active' ? 'active' : sub.status === 'trial' ? 'trial' : sub.status === 'expired' ? 'expired' : 'inactive'}`}>
              {sub.status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {msg && <div className="alert-success">{msg}</div>}
      {err && <div className="alert-error">{err}</div>}

      <div className="tabs">
        {(['overview', 'plans', 'manage'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📊 Overview' : t === 'plans' ? '💎 Plans' : '⚙️ Manage'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          {!sub ? (
            <div className="card" style={{ textAlign:'center', padding:'3rem' }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>💎</div>
              <h2 style={{ fontFamily:'var(--font-disp)', color:'var(--text)', marginBottom:'.5rem' }}>No Active Subscription</h2>
              <p style={{ color:'var(--text2)', marginBottom:'1.5rem' }}>Choose a plan to unlock all ERP features.</p>
              <button className="btn btn-primary btn-lg" onClick={() => setTab('plans')}>View Plans</button>
            </div>
          ) : (
            <div>
              <div className="grid-stats" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))' }}>
                <div className="stat-card" style={{ '--accent': 'var(--blue)' } as React.CSSProperties}>
                  <div className="stat-label">Current Plan</div>
                  <div className="stat-value" style={{ fontSize:'1.4rem' }}>{sub.plan_name}</div>
                  <div className="stat-sub">{sub.billing_cycle} billing</div>
                  <div className="stat-icon">💎</div>
                </div>
                <div className="stat-card" style={{ '--accent': daysLeft !== null && daysLeft < 14 ? 'var(--rose)' : 'var(--green)' } as React.CSSProperties}>
                  <div className="stat-label">Days Remaining</div>
                  <div className="stat-value" style={{ color: daysLeft !== null && daysLeft < 14 ? 'var(--rose)' : undefined }}>
                    {daysLeft !== null ? daysLeft : '∞'}
                  </div>
                  <div className="stat-sub">{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'No expiry'}</div>
                  <div className="stat-icon">📅</div>
                </div>
                <div className="stat-card" style={{ '--accent': usagePct > 80 ? 'var(--amber)' : 'var(--cyan)' } as React.CSSProperties}>
                  <div className="stat-label">User Seats</div>
                  <div className="stat-value">{sub.current_users}/{sub.max_users}</div>
                  <div style={{ marginTop:'.4rem' }}>
                    <div className="progress-bar">
                      <div className={`progress-fill ${usagePct > 80 ? 'warning' : ''} ${usagePct > 95 ? 'danger' : ''}`}
                        style={{ width:`${Math.min(usagePct, 100)}%` }} />
                    </div>
                  </div>
                  <div className="stat-icon">👥</div>
                </div>
                <div className="stat-card" style={{ '--accent': 'var(--violet)' } as React.CSSProperties}>
                  <div className="stat-label">Price Paid</div>
                  <div className="stat-value">${Number(sub.price_paid).toFixed(0)}</div>
                  <div className="stat-sub">per {sub.billing_cycle}</div>
                  <div className="stat-icon">💵</div>
                </div>
              </div>

              {/* Details */}
              <div className="grid-2" style={{ gap:'1.25rem', marginTop:'.5rem' }}>
                <div className="card">
                  <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>Subscription Details</h3>
                  {[
                    ['Plan', sub.plan_name],
                    ['Status', sub.status],
                    ['Billing', sub.billing_cycle],
                    ['Started', sub.started_at ? new Date(sub.started_at).toLocaleDateString() : '—'],
                    ['Expires', sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Never'],
                    ['Trial ends', sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : '—'],
                    ['Contact', sub.contact_email || '—'],
                    ['Phone', sub.contact_phone || '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-row">
                      <span className="detail-label">{l}</span>
                      <span className="detail-value">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>Usage & Limits</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                    {[
                      { label:'Users', used: sub.current_users, max: sub.max_users },
                      { label:'Storage', used: 0, max: sub.max_storage_gb, unit:'GB' },
                    ].map(item => {
                      const pct = Math.round((item.used / item.max) * 100)
                      return (
                        <div key={item.label}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.3rem', fontSize:'.82rem', color:'var(--text2)' }}>
                            <span>{item.label}</span>
                            <span>{item.used}/{item.max}{item.unit || ''}</span>
                          </div>
                          <div className="progress-bar">
                            <div className={`progress-fill ${pct>80?'warning':''} ${pct>95?'danger':''}`} style={{ width:`${Math.min(pct,100)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {sub.notes && (
                    <div style={{ marginTop:'1rem', padding:'.75rem', background:'var(--hover-bg)', borderRadius:'var(--radius)', fontSize:'.82rem', color:'var(--text2)' }}>
                      <strong style={{ color:'var(--text)' }}>Notes:</strong> {sub.notes}
                    </div>
                  )}
                  {su && (
                    <div style={{ marginTop:'1rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => setTab('manage')}>⚙️ Manage Subscription</button>
                    </div>
                  )}
                </div>
              </div>

              {daysLeft !== null && daysLeft < 14 && (
                <div className="alert-warning" style={{ marginTop:'1rem' }}>
                  ⚠️ Your subscription expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}. Please renew to avoid service interruption.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PLANS ── */}
      {tab === 'plans' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:'.75rem' }}>
            <p style={{ color:'var(--text2)', fontSize:'.9rem' }}>Choose the plan that fits your organization</p>
            <div className="tabs" style={{ margin:0 }}>
              <button className={`tab-btn ${cycle==='monthly'?'active':''}`} onClick={() => setCycle('monthly')}>Monthly</button>
              <button className={`tab-btn ${cycle==='yearly'?'active':''}`} onClick={() => setCycle('yearly')}>
                Yearly <span style={{ color:'var(--green)', fontSize:'.72rem' }}>-20%</span>
              </button>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1.25rem' }}>
            {PLANS.map(plan => (
              <div key={plan.id} className={`plan-card ${plan.is_popular ? 'popular' : ''}`}>
                <div className="plan-name">{plan.name}</div>
                <div className="plan-price">
                  ${cycle === 'monthly' ? plan.price_monthly : plan.price_yearly}
                  <span>/{cycle === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                {cycle === 'yearly' && (
                  <div style={{ fontSize:'.78rem', color:'var(--green)', marginBottom:'.75rem' }}>
                    Save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(0)}/year
                  </div>
                )}
                <div style={{ margin:'1rem 0', borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
                  {plan.features.map(f => (
                    <div key={f} className="plan-feature">{f}</div>
                  ))}
                </div>
                {su && (
                  <button className={`btn btn-sm w-full ${plan.is_popular ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ marginTop:'.5rem' }}
                    onClick={() => selectPlan(plan)}>
                    {sub?.plan_name === plan.name ? '✓ Current Plan' : 'Select Plan'}
                  </button>
                )}
                {!su && (
                  <div style={{ textAlign:'center', fontSize:'.78rem', color:'var(--text3)', marginTop:'.5rem' }}>
                    Contact your admin to upgrade
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop:'1.5rem', textAlign:'center', padding:'2rem' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'.5rem' }}>🏢</div>
            <h3 style={{ fontFamily:'var(--font-disp)', color:'var(--text)', marginBottom:'.5rem' }}>Need a custom plan?</h3>
            <p style={{ color:'var(--text2)', fontSize:'.85rem', marginBottom:'1rem' }}>
              Contact us for enterprise pricing with custom limits, dedicated support, and special features.
            </p>
            <a href="mailto:sales@alpha-01.com" className="btn btn-secondary">📧 Contact Sales</a>
          </div>
        </div>
      )}

      {/* ── MANAGE (SU only) ── */}
      {tab === 'manage' && (
        <div>
          {!su ? (
            <div className="alert-info">Only superusers can manage subscription settings.</div>
          ) : (
            <div style={{ maxWidth:680 }}>
              <div className="card">
                <h3 style={{ fontFamily:'var(--font-disp)', fontWeight:700, color:'var(--text)', marginBottom:'1.25rem' }}>
                  ⚙️ Subscription Management
                </h3>

                <div className="grid-2" style={{ gap:'.9rem' }}>
                  <div className="form-row">
                    <label className="label">Plan Name</label>
                    <select className="input" value={form.plan_name} onChange={e => setForm(f => ({...f, plan_name:e.target.value}))}>
                      <option value="">Custom</option>
                      {PLANS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value}))}>
                      {['active','trial','suspended','expired','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="label">Billing Cycle</label>
                    <select className="input" value={form.billing_cycle} onChange={e => setForm(f => ({...f, billing_cycle:e.target.value}))}>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="label">Price Paid ($)</label>
                    <input className="input" type="number" value={form.price_paid} onChange={e => setForm(f => ({...f, price_paid:e.target.value}))} />
                  </div>
                  <div className="form-row">
                    <label className="label">Max Users</label>
                    <input className="input" type="number" value={form.max_users} onChange={e => setForm(f => ({...f, max_users:e.target.value}))} />
                  </div>
                  <div className="form-row">
                    <label className="label">Max Storage (GB)</label>
                    <input className="input" type="number" value={form.max_storage_gb} onChange={e => setForm(f => ({...f, max_storage_gb:e.target.value}))} />
                  </div>
                  <div className="form-row">
                    <label className="label">Expires At</label>
                    <input className="input" type="date" value={form.expires_at} onChange={e => setForm(f => ({...f, expires_at:e.target.value}))} />
                  </div>
                  <div className="form-row">
                    <label className="label">Trial Ends At</label>
                    <input className="input" type="date" value={form.trial_ends_at} onChange={e => setForm(f => ({...f, trial_ends_at:e.target.value}))} />
                  </div>
                  <div className="form-row">
                    <label className="label">Contact Email</label>
                    <input className="input" type="email" value={form.contact_email} onChange={e => setForm(f => ({...f, contact_email:e.target.value}))} />
                  </div>
                  <div className="form-row">
                    <label className="label">Contact Phone</label>
                    <input className="input" type="tel" value={form.contact_phone} onChange={e => setForm(f => ({...f, contact_phone:e.target.value}))} />
                  </div>
                  <div className="form-row" style={{ gridColumn:'1/-1' }}>
                    <label className="label">Notes</label>
                    <textarea className="input" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} rows={3} />
                  </div>
                </div>

                <button className="btn btn-primary" onClick={saveSub} disabled={saving}>
                  {saving ? '⟳ Saving…' : '💾 Save Subscription'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
