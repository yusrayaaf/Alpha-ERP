// src/pages/WalletPage.tsx — v9 Fixed
// API returns: { wallets: WalletRow[] } where WalletRow has user_id, full_name, total_expenses, total_invoiced, balance
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

interface WalletRow {
  user_id:        string
  full_name:      string
  total_expenses: number
  total_invoiced: number
  balance:        number
}

export default function WalletPage() {
  const { user } = useAuth()
  const [wallets, setWallets]  = useState<WalletRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get<{ wallets: WalletRow[] }>('/reports/wallet')
      .then(d => setWallets(d.wallets ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const sar = (n: number) => `SAR ${Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2})}`

  // Find the current user's wallet row
  const myWallet = wallets.find(w => w.user_id === user?.id) ?? null
  const bal = Number(myWallet?.balance ?? 0)
  const isSu = user?.role === 'superuser'

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom:'1.25rem' }}>My Wallet — {user?.full_name}</h1>
      {error   && <div className="alert-error">{error}</div>}
      {loading && <div style={{ color:'var(--text2)', padding:'1rem' }}>Loading…</div>}
      {!loading && (
        <>
          {/* Personal summary */}
          <div className="stat-grid" style={{ marginBottom:'1.5rem' }}>
            {[
              { label:'Total Invoiced (Approved)', value:sar(myWallet?.total_invoiced ?? 0), accent:'var(--cyan)' },
              { label:'Total Expenses (Approved)', value:sar(myWallet?.total_expenses ?? 0), accent:'var(--warning)' },
              { label:'Net Balance',               value:sar(bal), accent: bal >= 0 ? 'var(--success)' : 'var(--error)' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ '--accent': s.accent } as React.CSSProperties}>
                <div className="glow-dot" />
                <div style={{ fontSize:'0.7rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'0.5rem' }}>{s.label}</div>
                <div className="mono" style={{ fontSize:'1.3rem', fontWeight:600, color:s.accent }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* All users table — superuser only */}
          {isSu && wallets.length > 0 && (
            <div className="glass table-wrap">
              <div style={{ padding:'1rem 1rem 0' }}><div className="section-label">All User Balances</div></div>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Invoiced</th>
                    <th>Expenses</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map(w => {
                    const b = Number(w.balance ?? 0)
                    return (
                      <tr key={w.user_id}>
                        <td style={{ fontWeight:600 }}>{w.full_name}</td>
                        <td><span className="mono" style={{ color:'var(--cyan)' }}>{sar(w.total_invoiced)}</span></td>
                        <td><span className="mono" style={{ color:'var(--amber)' }}>{sar(w.total_expenses)}</span></td>
                        <td>
                          <span className="mono" style={{ color: b >= 0 ? 'var(--green)' : 'var(--rose)', fontWeight:700 }}>
                            {b < 0 ? '-' : ''}{sar(Math.abs(b))}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Non-superuser — just show personal info */}
          {!isSu && (
            <div className="glass" style={{ padding:'1.5rem', textAlign:'center' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>👛</div>
              <div style={{ color:'var(--text2)', fontSize:'0.9rem' }}>
                Your wallet balance reflects the difference between your <strong>approved invoices</strong> and <strong>approved expenses</strong>.
              </div>
              <div style={{ marginTop:'1rem', fontFamily:'var(--font-mono)', fontSize:'1.1rem', color: bal >= 0 ? 'var(--green)' : 'var(--rose)', fontWeight:700 }}>
                Net Balance: {sar(bal)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
