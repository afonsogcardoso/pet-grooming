'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getStoredAccessToken } from '@/lib/authTokens'

const PAGE_SIZE = 10
const FALLBACK_PLANS = ['starter', 'growth', 'enterprise']
const FALLBACK_STATUSES = ['active', 'inactive']
const BLUEPRINT_OPTIONS = [
  { value: 'grooming', label: 'Pet Grooming' },
  { value: 'vet', label: 'Clínica Vet' },
  { value: 'fitness', label: 'Fitness & PT' },
  { value: 'coaching', label: 'Coaching' }
]

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API_BASE}${path}`
}

function authHeaders() {
  const token = getStoredAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ plan: 'all', status: 'all' })
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [planOptions, setPlanOptions] = useState([])
  const [statusOptions, setStatusOptions] = useState(FALLBACK_STATUSES)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState(null)
  const [inlineUpdating, setInlineUpdating] = useState({})

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    async function loadAccounts() {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE)
      })
      if (filters.plan !== 'all') {
        params.set('plan', filters.plan)
      }
      if (filters.status !== 'all') {
        params.set('status', filters.status)
      }
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      try {
        const response = await fetch(apiUrl(`/api/v1/admin/accounts?${params.toString()}`), {
          signal: controller.signal,
          headers: authHeaders()
        })
        const body = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
          window.location.assign('/admin/login?adminError=invalid_session')
          return
        }
        if (!response.ok) {
          throw new Error(body.error || 'Não foi possível carregar as contas.')
        }
        if (!isMounted) return
        setAccounts(body.accounts || [])
        setTotal(body.total ?? 0)
        setPlanOptions(body.planOptions || [])
        setStatusOptions(body.statusOptions || FALLBACK_STATUSES)
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') return
        console.error(fetchError)
        if (!isMounted) return
        setAccounts([])
        setTotal(0)
        setError(fetchError.message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAccounts()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [filters.plan, filters.status, page, searchQuery, reloadKey])

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timeout)
  }, [toast])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const resolvedPlanOptions = useMemo(() => {
    const merged = new Set([...FALLBACK_PLANS, ...(planOptions || [])])
    return Array.from(merged)
  }, [planOptions])

  const resolvedStatusOptions = useMemo(() => {
    const values = statusOptions.length ? statusOptions : FALLBACK_STATUSES
    return values
  }, [statusOptions])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setSearchQuery(searchInput.trim())
    setPage(1)
  }

  const handleResetFilters = () => {
    setFilters({ plan: 'all', status: 'all' })
    setSearchInput('')
    setSearchQuery('')
    setPage(1)
  }

  const handleAccountCreated = () => {
    setShowCreateModal(false)
    setPage(1)
    setReloadKey((prev) => prev + 1)
    setToast('Conta criada com sucesso. Seed inicial a correr em background.')
  }

  const updateAccountInline = async (accountId, updates, successMessage) => {
    setInlineUpdating((prev) => ({ ...prev, [accountId]: true }))
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/v1/admin/accounts'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ accountId, updates })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        window.location.assign('/admin/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao atualizar.')
      }
      setToast(successMessage)
      setReloadKey((prev) => prev + 1)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setInlineUpdating((prev) => {
        const next = { ...prev }
        delete next[accountId]
        return next
      })
    }
  }

  const handlePlanChange = (accountId, value) => {
    updateAccountInline(accountId, { plan: value }, 'Plano atualizado.')
  }

  const handleStatusToggle = (account) => {
    updateAccountInline(
      account.id,
      { is_active: !account.is_active },
      account.is_active ? 'Conta arquivada.' : 'Conta restaurada.'
    )
  }

  const handleSingleDelete = async (account) => {
    if (account.is_active) {
      alert('Só podes apagar tenants depois de arquivar.')
      return
    }
    const confirmed = window.confirm(
      'Apagar este tenant vai remover todos os dados associados. Confirmas a ação?'
    )
    if (!confirmed) return
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/v1/admin/accounts'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ accountIds: [account.id], action: 'delete' })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        window.location.assign('/admin/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao apagar tenant.')
      }
      setToast('Tenant apagado definitivamente.')
      setReloadKey((prev) => prev + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="space-y-8">
      {toast && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {toast}
        </div>
      )}

      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Accounts</p>
          <h1 className="text-3xl font-bold text-slate-900">Gestão de tenants</h1>
          <p className="text-slate-600 max-w-2xl">
            Monitoriza contas, planos e estados a partir desta tabela. Ligações à criação/seed entram em fase seguinte.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
        >
          + New account
        </button>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <form className="grid gap-3 md:grid-cols-[1fr,150px,150px,auto]" onSubmit={handleSearchSubmit}>
          <label className="flex flex-col text-sm font-semibold text-slate-600">
            Search
            <input
              type="search"
              placeholder="Nome ou slug"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-sm font-semibold text-slate-600">
            Plano
            <select
              value={filters.plan}
              onChange={(event) => handleFilterChange('plan', event.target.value)}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            >
              <option value="all">Todos</option>
              {resolvedPlanOptions.map((plan) => (
                <option key={plan} value={plan}>
                  {capitalize(plan)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-semibold text-slate-600">
            Estado
            <select
              value={filters.status}
              onChange={(event) => handleFilterChange('status', event.target.value)}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold text-slate-900 focus:border-slate-500 focus:outline-none bg-white"
            >
              <option value="all">Todos</option>
              {resolvedStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Limpar
            </button>
          </div>
        </form>

        <AccountsTable
          loading={loading}
          accounts={accounts}
          error={error}
          page={page}
          totalPages={totalPages}
          inlineUpdating={inlineUpdating}
          onPlanChange={handlePlanChange}
          onStatusToggle={handleStatusToggle}
          onDelete={handleSingleDelete}
          planOptions={resolvedPlanOptions}
        />

        <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
      </div>

      <NewAccountModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleAccountCreated}
      />
    </section>
  )
}

function AccountsTable({
  loading,
  accounts,
  error,
  page,
  totalPages,
  inlineUpdating,
  onPlanChange,
  onStatusToggle,
  onDelete,
  planOptions
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 py-10 text-slate-500">
        A carregar contas...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
        <p className="font-semibold">Erro ao carregar</p>
        <p className="text-sm text-rose-600">{error}</p>
      </div>
    )
  }

  if (!accounts.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
        Nenhuma conta encontrada com os filtros atuais.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Conta</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Plano</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Criada em</th>
            <th className="px-4 py-3">Gestão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {accounts.map((account) => (
            <tr key={account.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-900">{account.name || 'Sem nome'}</div>
                <div className="text-xs text-slate-500">{account.id}</div>
              </td>
              <td className="px-4 py-3 text-slate-600">{account.slug || '—'}</td>
              <td className="px-4 py-3">
                <select
                  value={account.plan || 'starter'}
                  onChange={(event) => onPlanChange(account.id, event.target.value)}
                  disabled={Boolean(inlineUpdating[account.id])}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-800 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {planOptions.map((plan) => (
                    <option key={`${account.id}-${plan}`} value={plan}>
                      {capitalize(plan)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <StatusBadge active={account.is_active} />
                  <button
                    type="button"
                    onClick={() => onStatusToggle(account)}
                    disabled={Boolean(inlineUpdating[account.id])}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {account.is_active ? 'Arquivar' : 'Restaurar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(account)}
                    disabled={account.is_active}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:cursor-not-allowed disabled:border-rose-100 disabled:text-rose-300 disabled:bg-rose-50/50"
                  >
                    Apagar
                  </button>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDate(account.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1 text-sm">
                  <Link
                    href={`/admin/accounts/${account.id}`}
                    className="font-semibold text-slate-700 underline-offset-2 hover:underline"
                  >
                    Abrir gestão →
                  </Link>
                  <span className="text-xs text-slate-500">Equipa, chaves, manutenção, branding</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-slate-500">
        Página {page} de {totalPages}
      </p>
    </div>
  )
}

function Pagination({ page, totalPages, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
      <p>
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={disabled || page === 1}
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-70 disabled:text-slate-600"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={disabled || page === totalPages}
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-70 disabled:text-slate-600"
        >
          Seguinte
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ active }) {
  if (active === undefined || active === null) {
    return <span className="text-xs text-slate-400">Sem estado</span>
  }

  const tone = active
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : 'bg-rose-100 text-rose-800 border-rose-200'

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function NewAccountModal({ open, onClose, onCreated }) {
  const [formState, setFormState] = useState({
    name: '',
    slug: '',
    plan: 'starter',
    ownerEmail: '',
    ownerName: '',
    template: BLUEPRINT_OPTIONS[0].value
  })
  const [message, setMessage] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFormState({
        name: '',
        slug: '',
        plan: 'starter',
        ownerEmail: '',
        ownerName: '',
        template: BLUEPRINT_OPTIONS[0].value
      })
      setMessage(null)
      setErrorMessage(null)
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage(null)
    setErrorMessage(null)
    setSubmitting(true)

    const payload = {
      name: formState.name.trim(),
      slug: sanitizeSlug(formState.slug) || sanitizeSlug(formState.name),
      plan: formState.plan,
      ownerEmail: formState.ownerEmail.trim() || undefined,
      ownerName: formState.ownerName.trim() || undefined,
      template: formState.template
    }

    try {
      const response = await fetch(apiUrl('/api/v1/admin/accounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        window.location.assign('/admin/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao criar a conta.')
      }
      setMessage({
        type: 'success',
        text: 'Conta criada. Seed inicial foi disparada automaticamente.'
      })
      onCreated?.(body.account)
    } catch (submitError) {
      setErrorMessage(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">New account</h2>
            <p className="text-sm text-slate-500">
              Preenche os dados base e um owner opcional para concluir a criação.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-600">
            Nome
            <input
              type="text"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ex.: Pet Lovers Lisbon"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Slug
            <input
              type="text"
              value={formState.slug}
              onChange={(event) => setFormState((prev) => ({ ...prev, slug: event.target.value }))}
              onBlur={() =>
                setFormState((prev) => ({
                  ...prev,
                  slug: sanitizeSlug(prev.slug) || sanitizeSlug(prev.name)
                }))
              }
              placeholder="pet-lovers"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Plano
            <select
              value={formState.plan}
              onChange={(event) => setFormState((prev) => ({ ...prev, plan: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            >
              {FALLBACK_PLANS.map((plan) => (
                <option key={plan} value={plan}>
                  {capitalize(plan)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-600">
            Owner (email opcional)
            <input
              type="email"
              value={formState.ownerEmail}
              onChange={(event) => setFormState((prev) => ({ ...prev, ownerEmail: event.target.value }))}
              placeholder="owner@example.com"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-600">
            Nome do owner (opcional)
            <input
              type="text"
              value={formState.ownerName}
              onChange={(event) => setFormState((prev) => ({ ...prev, ownerName: event.target.value }))}
              placeholder="Nome da pessoa"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-600">
            Template
            <select
              value={formState.template}
              onChange={(event) => setFormState((prev) => ({ ...prev, template: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            >
              {BLUEPRINT_OPTIONS.map((blueprint) => (
                <option key={blueprint.value} value={blueprint.value}>
                  {blueprint.label}
                </option>
              ))}
            </select>
          </label>

          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}
            >
              {message.text}
            </p>
          )}

          {errorMessage && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'A criar...' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}

function formatStatus(value) {
  if (!value) return 'Sem estado'
  const normalized = value.toLowerCase()
  if (normalized === 'active') return 'Active'
  if (normalized === 'inactive') return 'Inactive'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

function capitalize(value) {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function sanitizeSlug(value) {
  if (!value) return ''
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
