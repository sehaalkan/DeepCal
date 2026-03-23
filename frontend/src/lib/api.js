import { t } from './i18n.js'

const API_BASE_CANDIDATES = ['https://deepcal.onrender.com']
const AUTH_TOKEN_KEY = 'dc_auth_token_v1'
const API_TIMEOUT_MS = 12000

function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

function authHeaders(extraHeaders = {}) {
  const token = getAuthToken()
  if (!token) return extraHeaders
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  }
}

function isRateLimitedError(err) {
  const status = err?.status
  if (status === 429) return true
  const msg = String(err?.message || '').toLowerCase()
  if (msg.includes('429')) return true
  if (msg.includes('quota')) return true
  if (msg.includes('rate limit')) return true
  if (msg.includes('resource_exhausted')) return true
  return false
}

/**
 * Backend hatalarını kullanıcı dostu metne çevirir (yanıltıcı API anahtarı uyarılarını göstermez).
 */
export function getUserFriendlyApiError(err) {
  if (!err) return t('errors.serverBusy')
  if (isRateLimitedError(err)) return t('errors.rateLimit')
  return t('errors.serverBusy')
}

function extractFastApiDetail(payload) {
  if (!payload || typeof payload !== 'object') return null
  const detail = payload.detail
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (!first) return null
    if (typeof first === 'string') return first
    if (first && typeof first === 'object') {
      return first.msg || first.message || null
    }
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || null
  }
  return null
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    })
    return res
  } catch (err) {
    if (err?.name === 'AbortError' || err instanceof TypeError) {
      throw new Error(t('api.serverUnreachable'))
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchApi(path, options = {}) {
  let lastNetworkErr = null
  for (const base of API_BASE_CANDIDATES) {
    try {
      return await fetchWithTimeout(`${base}${path}`, options)
    } catch (err) {
      // Only continue fallback for network-level errors.
      if (err?.message === t('api.serverUnreachable')) {
        lastNetworkErr = err
        continue
      }
      throw err
    }
  }
  throw lastNetworkErr || new Error(t('api.serverUnreachable'))
}

export async function analyzeMealImage(file, { signal } = {}) {
  const body = new FormData()
  body.append('image', file)

  const res = await fetchApi('/analyze', {
    method: 'POST',
    body,
    signal,
  })

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && payload.detail) ||
      (typeof payload === 'string' && payload) ||
      t('api.operationFailed')
    const error = new Error(message)
    error.status = res.status
    error.payload = payload
    throw error
  }

  return payload
}

export async function createLogEntry(entry, { signal } = {}) {
  const headers = authHeaders({ 'content-type': 'application/json' })
  const res = await fetchApi('/log', {
    method: 'POST',
    headers,
    body: JSON.stringify(entry),
    signal,
  })

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && payload.detail) ||
      (typeof payload === 'string' && payload) ||
      t('api.logFailed')
    const error = new Error(message)
    error.status = res.status
    error.payload = payload
    throw error
  }

  return payload
}

export async function getTodayStats({ signal } = {}) {
  const headers = authHeaders({})
  const res = await fetchApi('/stats/today', { headers, signal })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (payload && payload.detail) || t('api.statsFailed')
    throw new Error(message)
  }
  return payload
}

export async function getTodayLog({ signal } = {}) {
  const headers = authHeaders({})
  const res = await fetchApi('/log/today', { headers, signal })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (payload && payload.detail) || t('api.diaryFailed')
    throw new Error(message)
  }
  return payload
}

export async function registerUser(req, { signal } = {}) {
  const res = await fetchApi('/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')

  if (!res.ok) {
    const message =
      extractFastApiDetail(payload) ||
      (typeof payload === 'string' && payload) ||
      t('api.operationFailed')
    const error = new Error(message)
    error.status = res.status
    error.payload = payload
    throw error
  }

  return payload
}

export async function loginUser(req, { signal } = {}) {
  const res = await fetchApi('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')

  if (!res.ok) {
    const message =
      extractFastApiDetail(payload) ||
      (typeof payload === 'string' && payload) ||
      t('api.operationFailed')
    const error = new Error(message)
    error.status = res.status
    error.payload = payload
    throw error
  }

  return payload
}

export async function getMe({ signal } = {}) {
  const res = await fetchApi('/me', { headers: authHeaders({}), signal })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (payload && payload.detail) || t('api.operationFailed')
    throw new Error(message)
  }
  return payload
}

export async function getLogs({ signal } = {}) {
  const res = await fetchApi('/logs', { headers: authHeaders({}), signal })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (payload && payload.detail) || t('api.operationFailed')
    throw new Error(message)
  }
  return payload
}

