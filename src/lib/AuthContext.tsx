// src/lib/AuthContext.tsx — Alpha Ultimate ERP v13 (Enhanced)
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface UserData {
  id: string
  username: string
  email: string
  full_name: string
  role: string
  department?: string
  permissions: Record<string, string>
  avatar_url?: string
}

interface AuthCtx {
  user:   UserData | null
  login:  (username: string, password: string) => Promise<void>
  logout: () => void
  ready:  boolean
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
  error?: string | null
}

const Ctx = createContext<AuthCtx>({ 
  user: null, 
  login: async () => {}, 
  logout: () => {}, 
  ready: false,
  isAuthenticated: false,
  refreshUser: async () => {},
})

const TOKEN_KEY = 'erp_token'
const USER_KEY = 'erp_user'
const API_BASE = (globalThis as any).__VITE_API_URL__ || 'http://localhost:3000'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize auth state from localStorage
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const saved = localStorage.getItem(USER_KEY)
    
    if (token && saved) {
      try {
        const userData = JSON.parse(saved)
        setUser(userData)
        setError(null)
      } catch (e) {
        console.error('Failed to parse user data:', e)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setError('Session corrupted. Please login again.')
      }
    }
    
    setReady(true)
  }, [])

  // Refresh user data from server
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        const userData = data.user as UserData
        setUser(userData)
        localStorage.setItem(USER_KEY, JSON.stringify(userData))
        setError(null)
      } else if (response.status === 401) {
        // Token expired, logout
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setUser(null)
        setError('Session expired. Please login again.')
      }
    } catch (err) {
      console.error('Failed to refresh user:', err)
      setError('Failed to refresh user data')
    }
  }, [])

  // Refresh user periodically (every 10 minutes)
  useEffect(() => {
    if (!user) return
    
    const interval = setInterval(() => {
      refreshUser()
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(interval)
  }, [user, refreshUser])

  async function login(username: string, password: string) {
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      let data: unknown
      try {
        data = await response.json()
      } catch {
        throw new Error('Server error — could not parse response')
      }

      if (!response.ok) {
        const errorMsg = (data as { error?: string })?.error ?? `Login failed (${response.status})`
        setError(errorMsg)
        throw new Error(errorMsg)
      }

      const { token, user: userData } = data as { token: string; user: UserData }
      
      // Validate token format
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token received from server')
      }

      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(userData))
      setUser(userData)
      setError(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
    setError(null)
  }

  // Expose token getter for API calls
  const getToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY)
  }, [])

  return (
    <Ctx.Provider 
      value={{ 
        user, 
        login, 
        logout, 
        ready,
        isAuthenticated: !!user,
        refreshUser,
        error,
      }}
    >
      {/* Expose getToken globally for API utility */}
      {(globalThis as any).__getAuthToken__ = getToken}
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() { 
  return useContext(Ctx) 
}

// Utility for API calls with auto-attached auth token
export async function apiCall(
  endpoint: string, 
  options: RequestInit = {}
) {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  } as Record<string, string>

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE}/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Auto-logout on 401
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    window.location.href = '/login'
  }

  return response
}
