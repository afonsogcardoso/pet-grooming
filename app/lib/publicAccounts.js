import { cache } from 'react'

const API_BASE = (process.env.API_BASE_URL || '').replace(/\/$/, '')

export const getPublicAccountBySlug = cache(async (slug) => {
  if (!slug) return null

  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null

  const url = `${API_BASE}/api/v1/public/accounts/${encodeURIComponent(normalized)}`
  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return null
    const body = await res.json().catch(() => null)
    return body?.account || null
  } catch (error) {
    console.error('getPublicAccountBySlug error', error)
    return null
  }
})
