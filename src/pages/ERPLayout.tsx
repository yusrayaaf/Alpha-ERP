// src/pages/ERPLayout.tsx — Alpha Ultimate ERP v13
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useLang } from '../lib/LangContext'
import { useTheme } from '../lib/ThemeContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import { useEffect, useState, useCallback } from 'react'
import logoUrl from '../assets/logo-alpha.jpg'

interface NavItem { to: string; icon: string; label: string; perm?: string; su?: boolean }
type NavSection = { title: string; items: NavItem[] }

const SECTIONS: NavSection[] = [
  { title: 'Finance', items: [
    { to: '/',            icon: '◈',  label: 'Dashboard'                           },
    { to: '/expenses',    icon: '💰', label: 'Expenses',    perm: 'finance'       },
    { to: '/invoices',    icon: '🧾', label: 'Invoices',    perm: 'finance'       },
    { to: '/wallet',      icon: '💳', label: 'My Wallet',   perm: 'finance'       },
    { to: '/approvals',   icon: '✅', label: 'Approvals',   su: true              },
  ]},
  { title: 'Assets', items: [
    { to: '/budget',      icon: '📊', label: 'Budget',       perm: 'budget'       },
    { to: '/assets',      icon: '🏗️', label: 'Assets',       perm: 'assets'       },
    { to: '/investments', icon: '📈', label: 'Investments',  perm: 'investments'  },
    { to: '/liabilities', icon: '🏦', label: 'Liabilities',  perm: 'liabilities'  },
  ]},
  { title: 'HR', items: [
    { to: '/workers',     icon: '👷', label: 'Workers',     perm: 'workers'      },
    { to: '/timesheet',   icon: '🕐', label: 'Timesheet',   perm: 'timesheet'    },
    { to: '/salary',      icon: '💵', label: 'Salary',      perm: 'salary'       },
  ]},
  { title: 'CRM', items: [
    { to: '/crm/customers', icon: '🏢', label: 'Customers',  perm: 'crm'         },
    { to: '/crm/leads',     icon: '🎯', label: 'Leads',      perm: 'crm'         },
  ]},
  { title: 'Projects', items: [
    { to: '/projects',    icon: '📁', label: 'Projects',    perm: 'projects'     },
    { to: '/tasks',       icon: '✔️', label: 'Tasks',       perm: 'projects'     },
  ]},
  { title: 'System', items: [
    { to: '/reports',     icon: '📋', label: 'Reports',      perm: 'reports'     },
    { to: '/users',       icon: '👥', label: 'Users',        su: true            },
    { to: '/permissions', icon: '🔐', label: 'Permissions',  su: true            },
    { to: '/form-builder',icon: '🛠️', label: 'Form Builder', su: true            },
    { to: '/subscription',icon: '💎', label: 'Subscription', su: true            },
    { to: '/creator',     icon: '👑', label: 'Creator Panel',su: true            },
    { to: '/settings',    icon: '⚙️', label: 'Settings'                          },
  ]},
]

export default function ERPLayout() {
  const { user, logout } = useAuth()
  const { lang, toggle } = useLang()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const su = isSuperUser(user)

  const [unread,  setUnread]  = useState(0)
  const [open,    setOpen]    = useState(false)
  const [menu,    setMenu]    = useState(false)

  const fetchUnread = useCallback(() => {
    api.get<{ unread: number }>('/notifications').then(d => setUnread(d.unread ?? 0)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchUnread()
    const id = setInterval(fetchUnread, 30000)
    return () => clearInterval(id)
  }, [fetchUnread])

  function canSee(item: NavItem) {
    if (item.su) return su
    if (!item.perm) return true
    const lv = user?.permissions?.[item.perm]
    return su || (!!lv && lv !== 'none')
  }

  const initials = user?.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'AU'

  return (
    <div className="erp-layout">
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:99 }} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <img src={logoUrl} alt="Alpha ERP" />
          <div>
            <div style={{ fontWeight:800, letterSpacing:'.04em', fontSize:'.9rem' }}>ALPHA ERP</div>
            <div style={{ fontSize:'.65rem', color:'var(--text2)', letterSpacing:'.1em' }}>v13 ENTERPRISE</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {SECTIONS.map(sec => {
            const visible = sec.items.filter(canSee)
            if (!visible.length) return null
            return (
              <div key={sec.title} className="nav-section">
                <div className="nav-section-title">{sec.title}</div>
                {visible.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    onClick={() => setOpen(false)}>
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize:'.7rem', color:'var(--text2)', marginBottom:'.5rem' }}>{user?.full_name}</div>
          <div style={{ fontSize:'.65rem', color:'var(--text2)', marginBottom:'.75rem', textTransform:'uppercase', letterSpacing:'.06em' }}>{user?.role} · {user?.department || 'System'}</div>
          <button className="btn btn-sm" onClick={() => { logout(); navigate('/login') }} style={{ width:'100%' }}>Sign Out</button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        {/* Top bar */}
        <header className="topbar">
          <button className="hamburger" onClick={() => setOpen(o => !o)} aria-label="Toggle menu">
            <span /><span /><span />
          </button>

          <div style={{ flex:1 }} />

          <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="icon-btn" onClick={toggle} title="Toggle language" style={{ fontFamily:'var(--font-mono)', fontSize:'.75rem' }}>
              {lang === 'en' ? 'AR' : 'EN'}
            </button>
            <NavLink to="/notifications/settings" className="icon-btn" style={{ position:'relative' }}>
              🔔
              {unread > 0 && (
                <span style={{ position:'absolute', top:-4, right:-4, background:'#ff3c3c', color:'#fff', borderRadius:99, fontSize:'.6rem', padding:'0 4px', minWidth:16, textAlign:'center' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>
            <div style={{ position:'relative' }}>
              <button className="avatar-btn" onClick={() => setMenu(m => !m)}>
                {initials}
              </button>
              {menu && (
                <div className="dropdown-menu" style={{ right:0, top:'calc(100% + 8px)' }}>
                  <NavLink to="/settings" className="dropdown-item" onClick={() => setMenu(false)}>⚙️ Settings</NavLink>
                  <button className="dropdown-item" onClick={() => { logout(); navigate('/login') }}>🚪 Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
