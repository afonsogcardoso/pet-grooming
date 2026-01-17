'use client'

import { useEffect, useMemo, useState } from 'react'
import { getStoredAccessToken } from '@/lib/authTokens'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'revoked', label: 'Revoked' }
]

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API_BASE}${path}`
}

function authHeaders() {
  const token = getStoredAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function ApiKeysClient({ currentUserEmail }) {
  const [keys, setKeys] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [newName, setNewName] = useState('')
  const [newAccountId, setNewAccountId] = useState('')
  const [issuedKey, setIssuedKey] = useState(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  useEffect(() => {
    fetchKeys(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function fetchKeys(nextPage = 1) {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(nextPage))
    params.set('pageSize', String(pageSize))
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    if (accountId) params.set('accountId', accountId)

    const res = await fetch(apiUrl(`/api/v1/admin/apikeys?${params.toString()}`), {
      cache: 'no-store',
      headers: authHeaders()
    })
    const body = await res.json()
    if (res.status === 401 || res.status === 403) {
      window.location.assign('/login?adminError=invalid_session')
      return
    }
    if (!res.ok) {
      alert(body.error || 'Failed to load API keys')
      setLoading(false)
      return
    }
    setKeys(body.keys || [])
    setTotal(body.total || 0)
    setPage(nextPage)
    setLoading(false)
  }

  async function handleCreate() {
    if (!newAccountId || !newName) {
      alert('Account ID and name are required')
      return
    }
    const res = await fetch(apiUrl('/api/v1/admin/apikeys'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ accountId: newAccountId, name: newName })
    })
    const body = await res.json()
    if (res.status === 401 || res.status === 403) {
      window.location.assign('/login?adminError=invalid_session')
      return
    }
    if (!res.ok) {
      alert(body.error || 'Failed to create API key')
      return
    }
    setIssuedKey(body.key)
    setNewName('')
    fetchKeys(page)
  }

  async function handleRevoke(id) {
    if (!confirm('Revoke this API key?')) return
    const res = await fetch(apiUrl('/api/v1/admin/apikeys'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, status: 'revoked' })
    })
    if (!res.ok) {
      const body = await res.json()
      alert(body.error || 'Failed to revoke')
      return
    }
    fetchKeys(page)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this revoked API key?')) return
    const res = await fetch(apiUrl('/api/v1/admin/apikeys'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id })
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 401 || res.status === 403) {
      window.location.assign('/login?adminError=invalid_session')
      return
    }
    if (!res.ok) {
      alert(body.error || 'Failed to delete')
      return
    }
    fetchKeys(page)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Platform</p>
        <h1 className="text-3xl font-bold text-slate-900">API Keys</h1>
        <p className="text-slate-600 max-w-2xl">
          Issue and revoke tenant API keys. The full key is shown only once when created.
        </p>
        {currentUserEmail && (
          <p className="text-xs text-slate-500">Signed in as {currentUserEmail}</p>
        )}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="text-xs font-semibold text-slate-500">Account ID</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-600"
            placeholder="Filter by account_id"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="text-xs font-semibold text-slate-500">Status</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="text-xs font-semibold text-slate-500">Search</label>
          <div className="mt-1 flex gap-2">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-600"
              placeholder="Name or prefix"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              onClick={() => fetchKeys(1)}
              className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-semibold"
            >
              Go
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Issue new key</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-600"
            placeholder="Account ID"
            value={newAccountId}
            onChange={(e) => setNewAccountId(e.target.value)}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-600"
            placeholder="Name / label"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
        >
          Create API key
        </button>
        {issuedKey && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Copy this key now (shown only once):</p>
            <code className="mt-1 block break-all bg-white px-2 py-1 rounded border border-amber-300">
              {issuedKey}
            </code>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <p className="text-sm font-semibold text-slate-900">Keys</p>
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} — {total} total
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchKeys(Math.max(1, page - 1))}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
              disabled={page <= 1 || loading}
            >
              Prev
            </button>
            <button
              onClick={() => fetchKeys(page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {!keys.length && (
            <div className="p-4 text-sm text-slate-500">No API keys found for this filter.</div>
          )}
          {keys.map((key) => (
            <div key={key.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">{key.name}</p>
                <p className="text-xs text-slate-500">Account: {key.account_id}</p>
                <p className="text-xs text-slate-500">
                  Prefix: <span className="font-mono">{key.key_prefix}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Status:{' '}
                  <span
                    className={`font-semibold ${key.status === 'active' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                  >
                    {key.status}
                  </span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Created: {formatDate(key.created_at)} • Last used: {formatDate(key.last_used_at) || '—'}
                </p>
              </div>
              <div className="flex gap-2">
                {key.status === 'active' && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="self-start md:self-auto rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2 text-sm font-semibold hover:bg-rose-100"
                  >
                    Revoke
                  </button>
                )}
                {key.status === 'revoked' && (
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="self-start md:self-auto rounded-lg bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-200"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value))
  } catch {
    return value
  }
}
