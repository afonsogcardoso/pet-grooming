"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { getStoredAccessToken } from "@/lib/authTokens"

const PAGE_SIZE = 20
const ROLE_FILTERS = ["all", "owner", "admin", "member"]
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")

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
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [resettingUser, setResettingUser] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (search.trim()) params.set("search", search.trim())
    if (roleFilter !== "all") params.set("role", roleFilter)

    fetch(apiUrl(`/api/v1/admin/users?${params.toString()}`), {
      signal: controller.signal,
      headers: authHeaders(),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body, status: res.status })))
      .then(({ ok, body, status }) => {
        if (!ok && (status === 401 || status === 403)) {
          window.location.assign("/login?adminError=invalid_session")
          return
        }
        if (!ok) throw new Error(body.error || "Falha ao carregar utilizadores")
        setUsers(body.users || [])
        setTotal(body.total ?? 0)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        console.error(err)
        setError(err.message)
        setUsers([])
        setTotal(0)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [page, search, roleFilter, refreshKey])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  async function handleResetPassword(userId) {
    const newPassword = window.prompt("Nova password (mínimo 8 caracteres)")
    if (!newPassword) return
    if (newPassword.length < 8) {
      alert("Password inválida.")
      return
    }
    setResettingUser(userId)
    try {
      const response = await fetch(apiUrl("/api/v1/admin/users/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ userId, newPassword }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/login?adminError=invalid_session")
        return
      }
      if (!response.ok) throw new Error(body.error || "Falha ao atualizar password.")
      alert("Password atualizada.")
    } catch (err) {
      alert(err.message || err)
    } finally {
      setResettingUser(null)
    }
  }

  async function handleCreateUser() {
    const email = window.prompt("Email do novo utilizador")
    if (!email) return
    const role = (window.prompt("Role (owner, admin, member). Deixa em branco para member)", "member") || "member");
    try {
      const response = await fetch(apiUrl("/api/v1/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/login?adminError=invalid_session")
        return
      }
      if (!response.ok) throw new Error(body.error || "Falha ao criar utilizador")
      alert("Utilizador criado/invitação enviada.")
      setRefreshKey((k) => k + 1)
      setPage(1)
    } catch (err) {
      alert(err.message || err)
    }
  }

  async function handleDeleteUser(userId) {
    if (!confirm("Remover este utilizador? Esta ação pode ser revertida dependendo das flags.")) return
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/users/${userId}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ should_soft_delete: false }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/login?adminError=invalid_session")
        return
      }
      if (!response.ok) throw new Error(body.error || "Falha ao remover utilizador")
      alert("Utilizador removido.")
      setRefreshKey((k) => k + 1)
      setPage(1)
    } catch (err) {
      alert(err.message || err)
    }
  }

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
        <div className="grid gap-3 md:grid-cols-[1fr,150px,auto] items-end">
          <label className="flex flex-col text-sm font-semibold text-slate-600">
            Busca global
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email ou nome"
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col text-sm font-semibold text-slate-600">
            Role
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
            >
              {ROLE_FILTERS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCreateUser}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white font-semibold"
            >
              Novo utilizador
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Utilizador</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Tenant principal</th>
                <th className="px-4 py-3">Tenants</th>
                <th className="px-4 py-3">Convites</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3">Criado</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{user.email}</div>
                    <div className="text-xs text-slate-500">{user.displayName || "—"}</div>
                    <div className="text-xs text-slate-400">{user.phone || ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {user.role || user.primary_role || (user.tenants && user.tenants[0]?.role) || "member"}
                      </span>
                      {user.email_verified ? (
                        <span className="text-xs text-emerald-600">verificado</span>
                      ) : (
                        <span className="text-xs text-slate-400">não verificado</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700">
                      {user.primaryAccountId
                        ? (user.tenants || []).find((t) => t.account_id === user.primaryAccountId)?.account?.name || user.primaryAccountId
                        : (user.tenants && user.tenants[0]?.account?.name) || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-600">
                      {user.tenants && user.tenants.length > 0
                        ? user.tenants.slice(0, 2).map((t) => t.account?.name || t.account_id).join(", ") + (user.tenants.length > 2 ? ` +${user.tenants.length - 2} mais` : "")
                        : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.pendingInvites > 0 ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{user.pendingInvites}</span>
                    ) : (
                      <span className="text-xs text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(user.lastSignIn)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(user.created_at || user.createdAt || user.inserted_at)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={
                          user.primaryAccountId
                            ? `/admin/accounts/${user.primaryAccountId}/members`
                            : user.tenants?.[0]?.account_id
                              ? `/admin/accounts/${user.tenants[0].account_id}/members`
                              : "#"
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
                      <button type="button" onClick={() => handleDeleteUser(user.id)} className="text-rose-600 underline-offset-2 hover:underline">
                        Remover utilizador
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
      </div>
    </section>
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
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  } catch {
    return value
  }
}
