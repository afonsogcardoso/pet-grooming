const API_BASE_HOST = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  : null
const DEFAULT_API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || '/api/v1'

function normalizeVersion(version) {
  if (!version) return null
  let v = version.startsWith('/') ? version : `/${version}`
  if (!v.startsWith('/api/')) {
    v = v.startsWith('/api') ? `/${v.replace(/^\/+/, '')}` : `/api${v}`
  }
  return v.replace(/\/$/, '')
}

function buildUrl(path, apiVersion) {
  if (!API_BASE_HOST) return null
  const version = normalizeVersion(apiVersion || DEFAULT_API_VERSION)

  // If caller passes a fully versioned path, respect it (e.g., /api/v2/services)
  if (path.startsWith('/api/')) {
    return `${API_BASE_HOST}${path}`
  }

  return `${API_BASE_HOST}${version}${path}`
}

function buildHeaders(token, extra = {}) {
  const headers = { ...extra }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export async function apiGet(path, { token, headers = {}, apiVersion } = {}) {
  const url = buildUrl(path, apiVersion)
  if (!url) return null
  const resp = await fetch(url, {
    headers: buildHeaders(token, headers)
  })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body.error || 'Request failed')
  return body
}

export async function apiPost(path, payload, { token, headers = {}, apiVersion } = {}) {
  const url = buildUrl(path, apiVersion)
  if (!url) return null
  const resp = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(token, { 'Content-Type': 'application/json', ...headers }),
    body: JSON.stringify(payload || {})
  })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body.error || 'Request failed')
  return body
}

export async function apiPatch(path, payload, { token, headers = {}, apiVersion } = {}) {
  const url = buildUrl(path, apiVersion)
  if (!url) return null
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: buildHeaders(token, { 'Content-Type': 'application/json', ...headers }),
    body: JSON.stringify(payload || {})
  })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body.error || 'Request failed')
  return body
}

export async function apiDelete(path, { token, headers = {}, apiVersion } = {}) {
  const url = buildUrl(path, apiVersion)
  if (!url) return null
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: buildHeaders(token, headers)
  })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body.error || 'Request failed')
  return body
}

export function hasExternalApi() {
  return Boolean(API_BASE_HOST)
}
