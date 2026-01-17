'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getStoredAccessToken } from '@/lib/authTokens'

const TABS = [
  { key: 'team', label: 'Team' },
  { key: 'keys', label: 'API Keys' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'branding', label: 'Branding' }
]

const DEFAULT_BRANDING = {
  brand_primary: '#4fafa9',
  brand_primary_soft: '#ebf5f4',
  brand_accent: '#f4d58d',
  brand_accent_soft: '#fdf6de',
  brand_background: '#f6f9f8',
  brand_gradient: 'linear-gradient(135deg, #4fafa9, #ebf5f4)',
  logo_url: ''
}

export default function AccountManageClient({ account }) {
  const [activeTab, setActiveTab] = useState('team')

  const header = useMemo(
    () => (
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tenant</p>
        <h1 className="text-3xl font-bold text-slate-900">{account.name}</h1>
        <p className="text-slate-600">
          Slug: <span className="font-mono text-slate-800">{account.slug}</span> • Plan:{' '}
          <span className="font-semibold text-slate-900">{account.plan}</span> • Status:{' '}
          <StatusBadge active={account.is_active} />
        </p>
        <p className="text-xs text-slate-500">
          Created: {formatDate(account.created_at)} • ID: {account.id}
        </p>
      </header>
    ),
    [account]
  )

  return (
    <div className="space-y-8">
      {header}

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'team' && <TeamPanel accountId={account.id} />}
      {activeTab === 'keys' && <ApiKeysPanel accountId={account.id} accountName={account.name} />}
      {activeTab === 'maintenance' && <MaintenancePanel accountId={account.id} accountName={account.name} />}
      {activeTab === 'branding' && <BrandingPanel account={account} />}
    </div>
  )
}

function TeamPanel({ accountId }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Team</h2>
          <p className="text-sm text-slate-500">Manage invitations, roles and profiles.</p>
        </div>
        <Link
          href={`/admin/accounts/${accountId}/members`}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
        >
          Open team manager
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        Use the team manager to invite users, change roles (owner/admin/member), resend or cancel invitations and update
        profiles.
      </p>
    </section>
  )
}

function ApiKeysPanel({ accountId, accountName }) {
  const [status, setStatus] = useState('')
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(20)
  const [newName, setNewName] = useState('')
  const [issuedKey, setIssuedKey] = useState(null)
  const [search, setSearch] = useState('')

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  useEffect(() => {
    loadKeys(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, accountId])

  const loadKeys = async (nextPage = 1) => {
    setLoading(true)
    const token = getStoredAccessToken()
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
    const params = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) })
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    const res = await fetch(`${base}/api/v1/admin/apikeys?${params.toString()}&accountId=${accountId}`, {
      cache: 'no-store',
      headers: authHeaders
    })
    const body = await res.json()
    if (!res.ok) {
      alert(body.error || 'Failed to load keys')
      setLoading(false)
      return
    }
    setKeys(body.keys || [])
    setTotal(body.total || 0)
    setPage(nextPage)
    setLoading(false)
  }

  const createKey = async () => {
    if (!newName) {
      alert('Name is required')
      return
    }
    const token = getStoredAccessToken()
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
    const res = await fetch(`${base}/api/v1/admin/apikeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ name: newName, accountId })
    })
    const body = await res.json()
    if (!res.ok) {
      alert(body.error || 'Failed to create key')
      return
    }
    setIssuedKey(body.key)
    setNewName('')
    loadKeys(page)
  }

  const revokeKey = async (id) => {
    if (!confirm('Revoke this API key?')) return
    const token = getStoredAccessToken()
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
    const res = await fetch(`${base}/api/v1/admin/apikeys`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ id, status: 'revoked' })
    })
    if (!res.ok) {
      const body = await res.json()
      alert(body.error || 'Failed to revoke')
      return
    }
    loadKeys(page)
  }

  const deleteKey = async (id) => {
    if (!confirm('Delete this revoked API key?')) return
    const token = getStoredAccessToken()
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
    const res = await fetch(`${base}/api/v1/admin/apikeys`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ id })
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(body.error || 'Failed to delete key')
      return
    }
    loadKeys(page)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">API Keys for {accountName}</h2>
          <p className="text-sm text-slate-500">Issue and revoke keys. Full key is shown only once on creation.</p>
        </div>
        <button
          onClick={() => loadKeys(1)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500">Status</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-semibold text-slate-500">Search (name/prefix)</label>
          <div className="flex gap-2">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-600"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              onClick={() => loadKeys(1)}
              className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Go
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Issue new key</h3>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-600"
            placeholder="Name / label"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Name / label"
            autoComplete="off"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button
            onClick={createKey}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
          >
            Create key
          </button>
        </div>
        {issuedKey && (
          <RevealableKey value={issuedKey} />
        )}
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <p className="text-sm font-semibold text-slate-900">Keys</p>
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} — {total} total
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadKeys(Math.max(1, page - 1))}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
              disabled={page <= 1 || loading}
            >
              Prev
            </button>
            <button
              onClick={() => loadKeys(page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {!keys.length && <div className="p-4 text-sm text-slate-500">No keys for this account.</div>}
          {keys.map((key) => (
            <div key={key.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">{key.name}</p>
                <p className="text-xs text-slate-500">Prefix: {key.key_prefix}</p>
                <p className="text-xs text-slate-500">
                  Status:{' '}
                  <span className={key.status === 'active' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
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
                    onClick={() => revokeKey(key.id)}
                    className="self-start md:self-auto rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2 text-sm font-semibold hover:bg-rose-100"
                  >
                    Revoke
                  </button>
                )}
                {key.status === 'revoked' && (
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="self-start md:self-auto rounded-lg bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-200"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function MaintenancePanel({ accountId, accountName }) {
  const [busy, setBusy] = useState(false)

  const runAction = async (action, message) => {
    if (!confirm(message)) return
    setBusy(true)
    const token = getStoredAccessToken()
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
    const res = await fetch(`${base}/api/v1/admin/accounts/${accountId}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ action })
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(body.error || 'Failed to run action')
    } else {
      alert('Action completed')
    }
    setBusy(false)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Maintenance</h2>
        <p className="text-sm text-slate-500">
          Destructive actions for tenant <span className="font-mono">{accountName}</span>. Use with caution.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() =>
            runAction('purge_appointments', 'Delete ALL appointments for this tenant? This cannot be undone.')
          }
          disabled={busy}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          Purge appointments
        </button>
        <button
          onClick={() =>
            runAction('purge_services', 'Delete ALL services for this tenant? This cannot be undone.')
          }
          disabled={busy}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          Purge services
        </button>
        <button
          onClick={() =>
            runAction('purge_customers', 'Delete ALL customers for this tenant? This cannot be undone.')
          }
          disabled={busy}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          Purge customers
        </button>
        <button
          onClick={() =>
            runAction('purge_all', 'Delete ALL appointments, services and customers for this tenant? This cannot be undone.')
          }
          disabled={busy}
          className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
        >
          Nuclear: purge all data
        </button>
      </div>
    </section>
  )
}

function RevealableKey({ value }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const masked = '•'.repeat(Math.max(8, value.length - 4)) + value.slice(-4)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
      alert('Failed to copy')
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
      <p className="font-semibold">Copy now (shown once):</p>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <code className="block flex-1 break-all bg-white px-2 py-1 rounded border border-amber-300">
          {visible ? value : masked}
        </code>
        <div className="flex gap-2">
          <button
            onClick={() => setVisible((v) => !v)}
            className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-200"
          >
            {visible ? 'Hide' : 'Reveal'}
          </button>
          <button
            onClick={copy}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BrandingPanel({ account }) {
  const [form, setForm] = useState(() => ({
    brand_primary: account.brand_primary || DEFAULT_BRANDING.brand_primary,
    brand_primary_soft: account.brand_primary_soft || DEFAULT_BRANDING.brand_primary_soft,
    brand_accent: account.brand_accent || DEFAULT_BRANDING.brand_accent,
    brand_accent_soft: account.brand_accent_soft || DEFAULT_BRANDING.brand_accent_soft,
    brand_background: account.brand_background || DEFAULT_BRANDING.brand_background,
    brand_gradient: account.brand_gradient || DEFAULT_BRANDING.brand_gradient,
    logo_url: account.logo_url || DEFAULT_BRANDING.logo_url
  }))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const resetDefaults = () => {
    setForm(DEFAULT_BRANDING)
  }

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    const token = getStoredAccessToken()
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
    const payload = {
      accountId: account.id,
      updates: {
        brand_primary: form.brand_primary || null,
        brand_primary_soft: form.brand_primary_soft || null,
        brand_accent: form.brand_accent || null,
        brand_accent_soft: form.brand_accent_soft || null,
        brand_background: form.brand_background || null,
        brand_gradient: form.brand_gradient || null,
        logo_url: form.logo_url || null
      }
    }

    try {
      const res = await fetch(`${base}/api/v1/admin/accounts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload)
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || 'Falha ao atualizar branding')
      }
      setMessage({ type: 'success', text: 'Branding atualizado para a conta.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Branding</h2>
          <p className="text-sm text-slate-500">Cores e logo aplicadas neste tenant.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
            disabled={saving}
          >
            Usar defaults
          </button>
        </div>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <ColorInput
          label="Primária"
          value={form.brand_primary}
          onChange={(v) => handleChange('brand_primary', v)}
        />
        <ColorInput
          label="Primária soft"
          value={form.brand_primary_soft}
          onChange={(v) => handleChange('brand_primary_soft', v)}
        />
        <ColorInput
          label="Acento"
          value={form.brand_accent}
          onChange={(v) => handleChange('brand_accent', v)}
        />
        <ColorInput
          label="Acento soft"
          value={form.brand_accent_soft}
          onChange={(v) => handleChange('brand_accent_soft', v)}
        />
        <ColorInput
          label="Background"
          value={form.brand_background}
          onChange={(v) => handleChange('brand_background', v)}
        />

        <label className="md:col-span-2 text-sm font-semibold text-slate-600">
          Gradiente
          <input
            type="text"
            value={form.brand_gradient}
            onChange={(e) => handleChange('brand_gradient', e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            placeholder="linear-gradient(140deg, ... )"
          />
        </label>

        <label className="md:col-span-2 text-sm font-semibold text-slate-600">
          Logo URL
          <input
            type="url"
            value={form.logo_url}
            onChange={(e) => handleChange('logo_url', e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            placeholder="https://..."
          />
        </label>

        {message && (
          <div
            className={`md:col-span-2 rounded-lg px-3 py-2 text-sm font-semibold ${message.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
          >
            {message.text}
          </div>
        )}

        <div className="md:col-span-2 flex gap-2 justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
          >
            {saving ? 'A atualizar...' : 'Guardar branding'}
          </button>
        </div>
      </form>
    </section>
  )
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="text-sm font-semibold text-slate-600">
      {label}
      <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-300 px-3 py-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-slate-200"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        />
      </div>
    </label>
  )
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}
    >
      <span className="text-base">{active ? '●' : '○'}</span> {active ? 'Active' : 'Inactive'}
    </span>
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
