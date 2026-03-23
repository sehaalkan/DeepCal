import { t } from './i18n.js'

const API_BASE = 'http://localhost:8000'

export async function analyzeMealImage(file, { signal } = {}) {
  const body = new FormData()
  body.append('image', file)

  const res = await fetch(`${API_BASE}/analyze`, {
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
  const res = await fetch(`${API_BASE}/log`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
  const res = await fetch(`${API_BASE}/stats/today`, { signal })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (payload && payload.detail) || t('api.statsFailed')
    throw new Error(message)
  }
  return payload
}

export async function getTodayLog({ signal } = {}) {
  const res = await fetch(`${API_BASE}/log/today`, { signal })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (payload && payload.detail) || t('api.diaryFailed')
    throw new Error(message)
  }
  return payload
}

