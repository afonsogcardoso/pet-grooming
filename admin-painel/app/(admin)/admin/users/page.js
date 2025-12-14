'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getStoredAccessToken } from '@/lib/authTokens'

const PAGE_SIZE = 20
const ROLE_FILTERS = ['all', 'owner', 'admin', 'member']
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API_BASE}${path}`
}

function authHeaders() {
  const token = getStoredAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [resettingUser, setResettingUser] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE)
    })
    if (search.trim()) {
      params.set('search', search.trim())
    }
    if (roleFilter !== 'all') {
      params.set('role', roleFilter)
    }

    fetch(apiUrl(`/api/v1/admin/users?${params.toString()}`), {
      signal: controller.signal,
      headers: authHeaders()
    })
      .then((response) => response.json().then((body) => ({ ok: response.ok, body, status: response.status })))
      .then(({ ok, body, status }) => {
        if (!ok && (status === 401 || status === 403)) {
          window.location.assign('/admin/login?adminError=invalid_session')
          return
        }
        if (!ok) throw new Error(body.error || 'Falha ao carregar utilizadores')
        setUsers(body.users || [])
        setTotal(body.total ?? 0)
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return
        console.error(fetchError)
        setError(fetchError.message)
        setUsers([])
        setTotal(0)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [page, search, roleFilter])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Users</p>
        <h1 className="text-3xl font-bold text-slate-900">Diretório global de utilizadores</h1>
        <p className="text-slate-600 max-w-3xl">
          Vê todos os utilizadores da plataforma, os tenants onde têm acesso e os convites pendentes.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr,150px,auto]">
          <label className="flex flex-col text-sm font-semibold text-slate-600">
            Busca global
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Email ou nome"
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-sm font-semibold text-slate-600">
            Role
            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value)
                setPage(1)
              }}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            >
              {ROLE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value === 'all' ? 'Todas' : value}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end justify-end text-sm text-slate-500">
            Total: <span className="font-semibold ml-1">{total}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 py-10 text-slate-500">
            A carregar utilizadores...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
            Não foram encontrados utilizadores.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Utilizador</th>
                  <th className="px-4 py-3">Tenants</th>
                  <th className="px-4 py-3">Convites pendentes</th>
                  <th className="px-4 py-3">Último acesso</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{user.email}</div>
                      <div className="text-xs text-slate-500">{user.displayName || '—'} · {user.phone || 'Sem telefone'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1 text-xs text-slate-600">
                        {(user.tenants || []).map((tenant) => (
                          <li key={`${user.id}-${tenant.account_id}`}>
                            <span className="font-semibold text-slate-500">
                              {tenant.account?.name || tenant.account_id}
                            </span>{' '}
                            · {tenant.role} ({tenant.status})
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.pendingInvites > 0 ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          {user.pendingInvites}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(user.lastSignIn)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={
                            user.primaryAccountId
                              ? `/admin/accounts/${user.primaryAccountId}/members`
                              : user.tenants?.[0]?.account_id
                                ? `/admin/accounts/${user.tenants[0].account_id}/members`
                                : '#'
                          }
                          className="text-slate-700 underline-offset-2 hover:underline"
                        >
                          Ver equipa
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(user.id)}
                          disabled={resettingUser === user.id}
                          className="text-rose-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
      </div>
    </section>
  )

  async function handleResetPassword(userId) {
    const newPassword = window.prompt('Nova password (mínimo 8 caracteres)')
    if (!newPassword) return
    if (newPassword.length < 8) {
      alert('Password inválida.')
      return
    }
    setResettingUser(userId)
    try {
      const response = await fetch(apiUrl('/api/v1/admin/users/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, newPassword })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        window.location.assign('/admin/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao atualizar password.')
      }
      alert('Password atualizada.')
    } catch (error) {
      alert(error.message)
    } finally {
      setResettingUser(null)
    }
  }
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
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={disabled || page === totalPages}
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Seguinte
        </button>
      </div>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}
