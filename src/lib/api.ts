// src/lib/api.ts — Alpha Ultimate ERP v13 (Enhanced)
// Calls /api/<route> directly — Express server handles routing

const BASE = '/api'
const MAX_RETRIES = 2
const RETRY_DELAY = 1000

interface ApiError extends Error {
  status?: number
  response?: unknown
}

function getToken(): string | null {
  try { 
    return localStorage.getItem('erp_token') 
  } catch { 
    return null 
  }
}

function createApiError(message: string, status?: number, response?: unknown): ApiError {
  const error = new Error(message) as ApiError
  error.status = status
  error.response = response
  return error
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function request<T>(
  method: string, 
  path: string, 
  body?: unknown,
  retryCount = 0
): Promise<T> {
  const token = getToken()
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }

  try {
    const res = await fetch(`${BASE}${path}`, opts)

    // Handle 401 - auto logout
    if (res.status === 401) {
      localStorage.removeItem('erp_token')
      localStorage.removeItem('erp_user')
      window.location.href = '/login'
      throw createApiError('Unauthorized - Please login again', 401)
    }

    let data: unknown
    const ct = res.headers.get('content-type') ?? ''
    
    if (ct.includes('application/json')) {
      data = await res.json()
    } else {
      const text = await res.text()
      data = { error: text || `HTTP ${res.status}` }
    }

    if (!res.ok) {
      const errMsg = (data as { error?: string })?.error ?? `Request failed with status ${res.status}`
      throw createApiError(errMsg, res.status, data)
    }

    return data as T
  } catch (error: unknown) {
    // Retry on network errors (but not on 4xx/5xx)
    if (retryCount < MAX_RETRIES && error instanceof TypeError) {
      await sleep(RETRY_DELAY * (retryCount + 1))
      return request<T>(method, path, body, retryCount + 1)
    }

    if (error instanceof Error) {
      throw error
    }

    throw createApiError('Unknown error occurred')
  }
}

export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)   => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown)   => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
}

// Export error type for type checking
export type { ApiError }
