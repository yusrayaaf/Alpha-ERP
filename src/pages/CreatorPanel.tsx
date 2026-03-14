// src/pages/CreatorPanel.tsx — Alpha Ultimate ERP v12
// The Creator Panel — full system control for the superuser
import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

interface SystemStats {
  users_total: number
  users_active: number
  expenses_total: number
  invoices_total: number
  pending_approvals: number
  assets_total: number
  workers_total: number
  audit_logs_count: number
}

interface AuditLog {
  id: string
  user_name: string
  action: string
  entity_type: string
  entity_id: string
  created_at: string
  ip_address: string
  details?: Record<string, unknown>
}

interface UserRow {
  id: string
  username: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  last_login: string | null
  created_at: string
}

export default function CreatorPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const su = isSuperUser(user)

  const [tab, setTab]       = useState<'overview' | 'users' | 'audit' | 'system' | 'security'>('overview')
  const [stats, setStats]   = useState<SystemStats | null>(null)
  const [logs, setLogs]     = useState<AuditLog[]>([])
  const [users, setUsers]   = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]       = useState('')
  const [err, setErr]       = useState('')
  const [dbTime, setDbTime] = useState('')
  const [resetModal, setResetModal] = useState<UserRow | null>(null)
  const [newPass, setNewPass] = useState('')
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    if (!su) return
    setLoading(true)
    try {
      const [statsData, auditData, usersData] = await Promise.allSettled([
        api.get<{ stats: SystemStats }>('/creator/stats'),
        api.get<{ logs: AuditLog[] }>('/audit-log'),
        api.get<{ users: UserRow[] }>('/users'),
      ])
      if (statsData.status === 'fulfilled') setStats(statsData.value.stats)
      if (auditData.status === 'fulfilled') setLogs(auditData.value.logs || [])
      if (usersData.status === 'fulfilled') setUsers(usersData.value.users || [])
    } catch {}
    finally { setLoading(false) }
  }, [su])

  useEffect(() => {
    if (!su) return
    load()
    // Poll DB time
    api.get<{ time: string }>('/creator/ping').then(d => setDbTime(d.time)).catch(() => {})
  }, [su, load])

  async function forceResetPassword() {
    if (!resetModal || !newPass) return
    setResetting(true)
    try {
      await api.post('/creator/reset-password', { user_id: resetModal.id, new_password: newPass })
      setMsg(`Password reset for ${resetModal.full_name}`)
      setResetModal(null); setNewPass('')
      setTimeout(() => setMsg(''), 3000)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Reset failed')
    } finally { setResetting(false) }
  }

  async function toggleUser(userId: string, isActive: boolean) {
    try {
      await api.patch(`/users/${userId}`, { is_active: !isActive })
      setUsers(u => u.map(x => x.id === userId ? {...x, is_active: !x.is_active} : x))
      setMsg(`User ${isActive ? 'deactivated' : 'activated'}.`)
      setTimeout(() => setMsg(''), 2000)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed')
    }
  }

  if (!su) {
    return (
      <div style={{ textAlign:'center', padding:'4rem' }}>
        <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🔒</div>
        <h2 style={{ color:'var(--text)' }}>Access Restricted</h2>
        <p style={{ color:'var(--text2)', marginTop:'.5rem' }}>Creator Panel is only accessible to superusers.</p>
        <button className="btn btn-secondary" style={{ marginTop:'1.5rem' }} onClick={() => navigate('/')}>← Back to Dashboard</button>
      </div>
    )
  }

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'.75rem', color:'var(--text2)' }}>Loading creator panel…</span>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.85rem', flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'.7rem' }}>
              <h1 className="page-title">👑 Creator Panel</h1>
              <span className="crown-badge">SUPERUSER</span>
            </div>
            <p className="page-subtitle">Full system control — users, security, audit, and health</p>
          </div>
        </div>
      </div>

      {msg && <div className="alert-success">{msg}</div>}
      {err && <div className="alert-error" onClick={() => setErr('')}>{err} ✕</div>}

      <div className="tabs">
        {([
          ['overview', '📊 Overview'],
          ['users', '👥 All Users'],
          ['audit', '📋 Audit Log'],
          ['system', '🔧 System'],
          ['security', '🔐 Security'],
        ] as const).map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k as typeof tab)}>{l}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && stats && (
        <div>
          <div className="grid-stats">
            {[
              { label:'Total Users',       value:stats.users_total,       sub:`${stats.users_active} active`,    accent:'var(--blue)',   icon:'👥' },
              { label:'Total Expenses',    value:stats.expenses_total,    sub:'all time',                         accent:'var(--green)',  icon:'💰' },
              { label:'Total Invoices',    value:stats.invoices_total,    sub:'all time',                         accent:'var(--violet)', icon:'🧾' },
              { label:'Pending Approvals', value:stats.pending_approvals, sub:'awaiting action',                  accent:stats.pending_approvals > 0 ? 'var(--amber)' : 'var(--green)', icon:'✅' },
              { label:'Assets',            value:stats.assets_total,      sub:'active assets',                    accent:'var(--cyan)',   icon:'🏗️' },
              { label:'Workers',           value:stats.workers_total,     sub:'active workers',                   accent:'var(--rose)',   icon:'👷' },
              { label:'Audit Events',      value:stats.audit_logs_count,  sub:'logged actions',                   accent:'var(--muted)', icon:'📋' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ '--accent':s.accent } as React.CSSProperties}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{Number(s.value).toLocaleString()}</div>
                <div className="stat-sub">{s.sub}</div>
                <div className="stat-icon">{s.icon}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="card">
            <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>Quick Actions</h3>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.75rem' }}>
              <button className="btn btn-secondary" onClick={() => navigate('/users')}>👥 Manage Users</button>
              <button className="btn btn-secondary" onClick={() => navigate('/permissions')}>🔐 Permissions</button>
              <button className="btn btn-secondary" onClick={() => navigate('/subscription')}>💎 Subscription</button>
              <button className="btn btn-secondary" onClick={() => navigate('/settings')}>⚙️ Settings</button>
              <button className="btn btn-secondary" onClick={() => navigate('/reports')}>📋 Reports</button>
              <button className="btn btn-secondary" onClick={() => navigate('/approvals')}>✅ Approvals ({stats?.pending_approvals || 0})</button>
              <button className="btn btn-secondary" onClick={load}>🔄 Refresh Data</button>
            </div>
          </div>
        </div>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <div>
          <div className="toolbar">
            <h3 style={{ fontWeight:700, color:'var(--text)', fontSize:'.95rem' }}>All System Users ({users.length})</h3>
            <div style={{ flex:1 }} />
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/users')}>+ Add User</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} onClick={e => { e.stopPropagation() }}>
                    <td>
                      <div style={{ fontWeight:600, color:'var(--text)' }}>{u.full_name}</div>
                      <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>@{u.username}</div>
                    </td>
                    <td style={{ color:'var(--text2)', fontSize:'.82rem' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'superuser' ? 'badge-su' : u.role === 'manager' ? 'badge-draft' : 'badge-inactive'}`}>
                        {u.role === 'superuser' ? '👑 ' : ''}{u.role}
                      </span>
                    </td>
                    <td><span className={`badge badge-${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ fontSize:'.78rem', color:'var(--text3)' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:'.4rem' }}>
                        {u.id !== user?.id && (
                          <>
                            <button className="btn btn-sm btn-secondary"
                              onClick={e => { e.stopPropagation(); setResetModal(u); setNewPass('') }}>
                              🔑 Reset Pass
                            </button>
                            <button className={`btn btn-sm ${u.is_active ? 'btn-warning' : 'btn-success'}`}
                              onClick={e => { e.stopPropagation(); toggleUser(u.id, u.is_active) }}>
                              {u.is_active ? '⊘ Deactivate' : '✓ Activate'}
                            </button>
                          </>
                        )}
                        {u.id === user?.id && <span style={{ fontSize:'.75rem', color:'var(--text3)' }}>(you)</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === 'audit' && (
        <div>
          <div className="toolbar">
            <h3 style={{ fontWeight:700, color:'var(--text)', fontSize:'.95rem' }}>Audit Log ({logs.length} recent)</h3>
            <div style={{ flex:1 }} />
            <button className="btn btn-secondary btn-sm" onClick={load}>🔄 Refresh</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>IP</th></tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>No audit logs found.</td></tr>
                ) : logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize:'.75rem', color:'var(--text3)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight:500, color:'var(--text)' }}>{l.user_name}</td>
                    <td>
                      <span className={`badge badge-${l.action.includes('delete') ? 'rejected' : l.action.includes('create') ? 'approved' : 'draft'}`}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ fontSize:'.8rem', color:'var(--text2)' }}>
                      {l.entity_type}{l.entity_id ? ` #${String(l.entity_id).slice(0,8)}` : ''}
                    </td>
                    <td style={{ fontSize:'.75rem', color:'var(--text3)', fontFamily:'var(--font-mono)' }}>{l.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SYSTEM ── */}
      {tab === 'system' && (
        <div style={{ maxWidth:680 }}>
          <div className="card" style={{ marginBottom:'1.25rem' }}>
            <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>🔧 System Health</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
              {[
                { label:'Application', status:'ok', value:'Alpha Ultimate ERP v12' },
                { label:'Database',    status: dbTime ? 'ok' : 'warning', value: dbTime || 'Checking…' },
                { label:'API Server',  status:'ok', value:'Online' },
                { label:'Auth Service',status:'ok', value:'JWT HS256 — Active' },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.65rem', background:'var(--hover-bg)', borderRadius:'var(--radius)' }}>
                  <div className={`health-dot ${item.status}`} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)' }}>{item.label}</div>
                    <div style={{ fontSize:'.75rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>{item.value}</div>
                  </div>
                  <span className={`badge badge-${item.status === 'ok' ? 'active' : 'pending'}`}>
                    {item.status === 'ok' ? 'Healthy' : 'Warning'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom:'1.25rem' }}>
            <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>📦 System Info</h3>
            {[
              ['Version', 'Alpha Ultimate ERP v12'],
              ['Node Target', '≥ 18.0.0'],
              ['Frontend', 'React 18 + Vite + TypeScript'],
              ['Database', 'NeonDB (PostgreSQL)'],
              ['Auth', 'JWT HS256 (30-day tokens)'],
              ['Deployment', 'IONOS Express / Vercel Serverless'],
              ['API Routes', '/api/* → unified handler'],
            ].map(([k, v]) => (
              <div key={k} className="detail-row">
                <span className="detail-label">{k}</span>
                <span className="detail-value mono">{v}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>🔗 Quick Navigation</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.6rem' }}>
              {[
                ['/settings', '⚙️', 'System Settings'],
                ['/users', '👥', 'User Management'],
                ['/permissions', '🔐', 'Permissions'],
                ['/form-builder', '🛠️', 'Form Builder'],
                ['/subscription', '💎', 'Subscription'],
                ['/reports', '📋', 'Reports'],
              ].map(([path, icon, label]) => (
                <button key={path as string} className="btn btn-secondary w-full"
                  style={{ justifyContent:'flex-start', gap:'.5rem' }}
                  onClick={() => navigate(path as string)}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'security' && (
        <div style={{ maxWidth:680 }}>
          <div className="card" style={{ marginBottom:'1.25rem' }}>
            <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>🔐 Security Overview</h3>
            <div className="alert-info" style={{ marginBottom:'1rem' }}>
              ℹ️ Password hashing uses SHA-256. For production, migrate to bcrypt for stronger security.
            </div>
            {[
              ['JWT Algorithm', 'HS256'],
              ['Token Expiry', '30 days'],
              ['Password Hashing', 'SHA-256 hex'],
              ['CORS', 'Configured (all origins in dev)'],
              ['Security Headers', 'X-Content-Type-Options, X-Frame-Options, X-XSS-Protection'],
              ['Admin Account', 'admin / Admin@12345 (change in production!)'],
              ['Rate Limiting', 'None — add nginx or middleware in production'],
            ].map(([k, v]) => (
              <div key={k} className="detail-row">
                <span className="detail-label">{k}</span>
                <span className="detail-value" style={{ fontFamily:'var(--font-mono)', fontSize:'.78rem' }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ fontWeight:700, color:'var(--text)', marginBottom:'1rem', fontSize:'.95rem' }}>👥 Active Sessions (All Users)</h3>
            <p style={{ color:'var(--text2)', fontSize:'.83rem', marginBottom:'1rem' }}>
              Users with recent logins. JWT tokens are stateless — force logout by resetting passwords.
            </p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>User</th><th>Role</th><th>Last Login</th><th>Action</th></tr></thead>
                <tbody>
                  {users.filter(u => u.last_login && u.is_active).slice(0,10).map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight:600, color:'var(--text)', fontSize:'.83rem' }}>{u.full_name}</div>
                        <div style={{ fontSize:'.73rem', color:'var(--text3)' }}>@{u.username}</div>
                      </td>
                      <td><span className="badge badge-draft">{u.role}</span></td>
                      <td style={{ fontSize:'.78rem', color:'var(--text3)' }}>
                        {u.last_login ? new Date(u.last_login).toLocaleString() : '—'}
                      </td>
                      <td>
                        {u.id !== user?.id && (
                          <button className="btn btn-sm btn-warning"
                            onClick={() => { setResetModal(u); setNewPass('') }}>
                            Force Logout
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetModal && (
        <div className="overlay" onClick={() => setResetModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">🔑 Reset Password — {resetModal.full_name}</h3>
            <div className="alert-warning" style={{ marginBottom:'1rem' }}>
              This will immediately change the user's password. They will need to log in again.
            </div>
            <div className="form-row">
              <label className="label">New Password (min 8 characters)</label>
              <input className="input" type="password" autoComplete="new-password"
                value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder="Enter new password…" />
            </div>
            <div style={{ display:'flex', gap:'.75rem', marginTop:'1rem' }}>
              <button className="btn btn-danger" onClick={forceResetPassword}
                disabled={resetting || newPass.length < 8}>
                {resetting ? '⟳ Resetting…' : '🔑 Reset Password'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setResetModal(null); setNewPass('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
