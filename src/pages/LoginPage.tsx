// src/pages/LoginPage.tsx — Alpha Ultimate ERP v13 (Improved)
import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useLang } from '../lib/LangContext'
import { useTheme } from '../lib/ThemeContext'
import logoUrl from '../assets/logo-alpha.jpg'

// Get credentials from environment or use defaults
const DEFAULT_USER = (globalThis as any).__VITE_USER__ || 'admin'
const DEFAULT_PASSWORD = (globalThis as any).__VITE_PASSWORD__ || 'Admin@12345'
const CREATOR_USER = (globalThis as any).__VITE_CREATOR_USER__ || 'creator'
const CREATOR_PASSWORD = (globalThis as any).__VITE_CREATOR_PASSWORD__ || 'Creator@12345'

export default function LoginPage() {
  const { login }        = useAuth()
  const navigate         = useNavigate()
  const { lang, toggle } = useLang()
  const { theme, toggleTheme } = useTheme()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)
  const [showDemo, setShowDemo] = useState(false)

  // Load saved credentials from localStorage if available (for development)
  useEffect(() => {
    const saved = localStorage.getItem('demo_user')
    if (saved && process.env.NODE_ENV !== 'production') {
      setShowDemo(true)
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) { 
      setError('Username and password are required.'); 
      return 
    }
    setError(''); 
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.'
      setError(msg)
      console.error('Login error:', err)
    } finally { 
      setLoading(false) 
    }
  }

  // Quick login buttons for development
  function quickLogin(user: string, pass: string) {
    setUsername(user)
    setPassword(pass)
    // Auto-submit
    setTimeout(() => {
      handleSubmit({ preventDefault: () => {} } as FormEvent)
    }, 50)
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--base)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', position:'relative', overflow:'hidden' }}>
      {/* Background glows */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,.07) 0%, transparent 65%)', top:-120, left:-80 }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,.05) 0%, transparent 65%)', bottom:-100, right:-60 }} />
      </div>

      {/* Controls top-right */}
      <div style={{ position:'absolute', top:'1.5rem', right:'1.5rem', zIndex:10, display:'flex', gap:'.5rem' }}>
        <button className="btn-theme" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="btn-lang" onClick={toggle}>
          {lang === 'en' ? '🇧🇩 বাংলা' : '🇬🇧 English'}
        </button>
      </div>

      <div style={{ width:'100%', maxWidth:400, position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src={logoUrl} alt="Alpha Ultimate"
            style={{ width:72, height:72, borderRadius:16, objectFit:'cover', margin:'0 auto 1rem', display:'block',
              boxShadow:'0 0 0 3px var(--blue-d), 0 16px 40px rgba(0,0,0,.3)' }} />
          <h1 style={{ fontFamily:'var(--font-disp)', fontSize:'1.8rem', fontWeight:800, color:'var(--text)', letterSpacing:'-.02em', margin:0 }}>
            Alpha Ultimate
          </h1>
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--blue)', letterSpacing:'.15em', marginTop:'.35rem', textTransform:'uppercase' }}>
            ERP Management System
          </p>
          <p style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:'.25rem', fontFamily:'var(--font-mono)' }}>
            erp.alpha-01.com · v13
          </p>
        </div>

        {/* Card */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border2)', borderRadius:'var(--radius-lg)', padding:'2rem', boxShadow:'var(--shadow-lg)' }}>
          <h2 style={{ fontFamily:'var(--font-disp)', fontSize:'.98rem', fontWeight:700, color:'var(--text)', margin:'0 0 1.4rem', letterSpacing:'-.01em' }}>
            {lang === 'en' ? 'Sign in to your account' : 'আপনার অ্যাকাউন্টে সাইন ইন করুন'}
          </h2>

          {error && (
            <div className="alert-error" style={{ marginBottom:'1rem', padding:'.75rem', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:'var(--radius)', color:'var(--red)', fontSize:'.85rem' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <label className="label">{lang === 'en' ? 'Username or Email' : 'ইউজারনেম বা ইমেইল'}</label>
              <input className="input" type="text" autoComplete="username"
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="admin" autoFocus required 
                disabled={loading}
                style={{ opacity: loading ? 0.6 : 1 }} />
            </div>

            <div className="form-row">
              <label className="label">{lang === 'en' ? 'Password' : 'পাসওয়ার্ড'}</label>
              <div style={{ position:'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  disabled={loading}
                  style={{ paddingRight:'2.5rem', opacity: loading ? 0.6 : 1 }} />
                <button type="button"
                  onClick={() => setShowPw(p => !p)}
                  disabled={loading}
                  style={{ position:'absolute', right:'.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'.85rem', lineHeight:1, opacity: loading ? 0.5 : 1 }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg" style={{ marginTop:'.5rem' }} disabled={loading}>
              {loading ? (
                <><div className="spinner" style={{ width:16, height:16, borderWidth:2 }} /> {lang === 'en' ? 'Signing in…' : 'লগইন হচ্ছে…'}</>
              ) : (
                lang === 'en' ? '→ Sign In' : '→ সাইন ইন'
              )}
            </button>
          </form>

          {/* Demo credentials info box */}
          <div style={{ marginTop:'1.5rem', padding:'1rem', background:'var(--hover-bg)', borderRadius:'var(--radius)', fontSize:'.78rem', color:'var(--text3)', textAlign:'center', fontFamily:'var(--font-mono)' }}>
            <div style={{ marginBottom: '.5rem' }}>
              Default: <strong style={{ color:'var(--text2)' }}>{DEFAULT_USER}</strong> / <strong style={{ color:'var(--text2)' }}>•••••••••••</strong>
            </div>
          </div>

          {/* Quick login buttons for development */}
          {process.env.NODE_ENV !== 'production' && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 'var(--radius)', fontSize: '.75rem' }}>
              <div style={{ marginBottom: '.5rem', color: 'var(--text3)' }}>Quick login (Dev only):</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                <button 
                  type="button"
                  onClick={() => quickLogin(DEFAULT_USER, DEFAULT_PASSWORD)}
                  disabled={loading}
                  style={{ padding: '.5rem', background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '.7rem', fontWeight: 500, opacity: loading ? 0.5 : 1 }}
                >
                  🔑 Admin
                </button>
                <button 
                  type="button"
                  onClick={() => quickLogin(CREATOR_USER, CREATOR_PASSWORD)}
                  disabled={loading}
                  style={{ padding: '.5rem', background: 'var(--purple)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '.7rem', fontWeight: 500, opacity: loading ? 0.5 : 1 }}
                >
                  👨‍💻 Creator
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign:'center', marginTop:'1.25rem', fontSize:'.72rem', color:'var(--text3)' }}>
          © {new Date().getFullYear()} Alpha Ultimate ERP · All rights reserved
        </p>
      </div>
    </div>
  )
}

  return (
    <div style={{ minHeight:'100dvh', background:'var(--base)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', position:'relative', overflow:'hidden' }}>
      {/* Background glows */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,.07) 0%, transparent 65%)', top:-120, left:-80 }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,.05) 0%, transparent 65%)', bottom:-100, right:-60 }} />
      </div>

      {/* Controls top-right */}
      <div style={{ position:'absolute', top:'1.5rem', right:'1.5rem', zIndex:10, display:'flex', gap:'.5rem' }}>
        <button className="btn-theme" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="btn-lang" onClick={toggle}>
          {lang === 'en' ? '🇧🇩 বাংলা' : '🇬🇧 English'}
        </button>
      </div>

      <div style={{ width:'100%', maxWidth:400, position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src={logoUrl} alt="Alpha Ultimate"
            style={{ width:72, height:72, borderRadius:16, objectFit:'cover', margin:'0 auto 1rem', display:'block',
              boxShadow:'0 0 0 3px var(--blue-d), 0 16px 40px rgba(0,0,0,.3)' }} />
          <h1 style={{ fontFamily:'var(--font-disp)', fontSize:'1.8rem', fontWeight:800, color:'var(--text)', letterSpacing:'-.02em', margin:0 }}>
            Alpha Ultimate
          </h1>
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--blue)', letterSpacing:'.15em', marginTop:'.35rem', textTransform:'uppercase' }}>
            ERP Management System
          </p>
          <p style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:'.25rem', fontFamily:'var(--font-mono)' }}>
            erp.alpha-01.com · v12
          </p>
        </div>

        {/* Card */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border2)', borderRadius:'var(--radius-lg)', padding:'2rem', boxShadow:'var(--shadow-lg)' }}>
          <h2 style={{ fontFamily:'var(--font-disp)', fontSize:'.98rem', fontWeight:700, color:'var(--text)', margin:'0 0 1.4rem', letterSpacing:'-.01em' }}>
            {lang === 'en' ? 'Sign in to your account' : 'আপনার অ্যাকাউন্টে সাইন ইন করুন'}
          </h2>

          {error && <div className="alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <label className="label">{lang === 'en' ? 'Username or Email' : 'ইউজারনেম বা ইমেইল'}</label>
              <input className="input" type="text" autoComplete="username"
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="admin" autoFocus required />
            </div>

            <div className="form-row">
              <label className="label">{lang === 'en' ? 'Password' : 'পাসওয়ার্ড'}</label>
              <div style={{ position:'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ paddingRight:'2.5rem' }} />
                <button type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{ position:'absolute', right:'.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'.85rem', lineHeight:1 }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg" style={{ marginTop:'.5rem' }} disabled={loading}>
              {loading ? (
                <><div className="spinner" style={{ width:16, height:16, borderWidth:2 }} /> {lang === 'en' ? 'Signing in…' : 'লগইন হচ্ছে…'}</>
              ) : (
                lang === 'en' ? '→ Sign In' : '→ সাইন ইন'
              )}
            </button>
          </form>

          <div style={{ marginTop:'1.5rem', padding:'1rem', background:'var(--hover-bg)', borderRadius:'var(--radius)', fontSize:'.78rem', color:'var(--text3)', textAlign:'center', fontFamily:'var(--font-mono)' }}>
            Default: <strong style={{ color:'var(--text2)' }}>admin</strong> / <strong style={{ color:'var(--text2)' }}>Admin@12345</strong>
          </div>
        </div>

        <p style={{ textAlign:'center', marginTop:'1.25rem', fontSize:'.72rem', color:'var(--text3)' }}>
          © {new Date().getFullYear()} Alpha Ultimate ERP · All rights reserved
        </p>
      </div>
    </div>
  )
}
