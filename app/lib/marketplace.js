import { cache } from 'react'

const API_BASE = (process.env.API_BASE_URL || '').replace(/\/$/, '')

function buildMarketplaceUrl(path, params = {}) {
  const base = API_BASE ? `${API_BASE}/api/v1/marketplace` : '/api/v1/marketplace'
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, value.toString())
  })

  const queryString = query.toString()
  return `${base}${path}${queryString ? `?${queryString}` : ''}`
}

async function fetchMarketplace(path, params) {
  const url = buildMarketplaceUrl(path, params)
  const response = await fetch(url, { next: { revalidate: 60 } }).catch(() => null)
  if (!response || !response.ok) {
    return null
  }
  return response.json().catch(() => null)
}

export const getMarketplaceAccounts = cache(async (query, category, limit, offset) => {
  const body = await fetchMarketplace('/accounts', { q: query, category, limit, offset })
  return body?.data || []
})

export const getMarketplaceAccountBySlug = cache(async (slug) => {
  if (!slug) return null
  const normalized = slug.toString().trim().toLowerCase()
  if (!normalized) return null
  const body = await fetchMarketplace(`/accounts/${encodeURIComponent(normalized)}`)
  return body?.account || null
})

export const getMarketplaceServicesBySlug = cache(async (slug) => {
  if (!slug) return []
  const normalized = slug.toString().trim().toLowerCase()
  if (!normalized) return []
  const body = await fetchMarketplace(`/accounts/${encodeURIComponent(normalized)}/services`)
  return body?.data || []
})
