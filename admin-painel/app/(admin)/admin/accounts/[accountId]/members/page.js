'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getStoredAccessToken } from '@/lib/authTokens'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' }
]

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API_BASE}${path}`
}

function authHeaders() {
  const token = getStoredAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminAccountMembersPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params?.accountId

  const [state, setState] = useState({
    loading: true,
    account: null,
    members: [],
    timeline: [],
    error: null
  })
  const [updatingMember, setUpdatingMember] = useState(null)
  const [resending, setResending] = useState(null)
  const [removingMember, setRemovingMember] = useState(null)
  const [editingProfile, setEditingProfile] = useState(null)
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', role: 'member' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState(null)

  useEffect(() => {
    if (!accountId) return
    let isMounted = true
    setState((prev) => ({ ...prev, loading: true, error: null }))

    fetch(apiUrl(`/api/v1/admin/accounts/${accountId}/members`), { headers: authHeaders() })
      .then((response) => response.json().then((body) => ({ ok: response.ok, body, status: response.status })))
      .then(({ ok, body }) => {
        if (!isMounted) return
        if (!ok && (body?.status === 401 || body?.status === 403)) {
          router.replace('/login?adminError=invalid_session')
          return
        }
        if (!ok) {
          setState({ loading: false, account: null, members: [], timeline: [], error: body.error || 'Erro' })
          return
        }
        setState({
          loading: false,
          account: body.account,
          members: body.members || [],
          timeline: body.timeline || [],
          error: null
        })
      })
      .catch((error) => {
        if (!isMounted) return
        console.error(error)
        setState({ loading: false, account: null, members: [], timeline: [], error: error.message })
      })

    return () => {
      isMounted = false
    }
  }, [accountId])

  const handleRoleChange = async (memberId, role) => {
    setUpdatingMember(memberId)
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/accounts/${accountId}/members`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ memberId, role })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        router.replace('/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao atualizar role.')
      }
      setState((prev) => ({
        ...prev,
        members: prev.members.map((member) => (member.id === memberId ? body.member : member))
      }))
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setUpdatingMember(null)
    }
  }

  const handleResendInvite = async (memberId) => {
    setResending(memberId)
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/accounts/${accountId}/members`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ memberId, action: 'resend_invite' })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        router.replace('/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao reenviar convite.')
      }
      alert('Convite reenviado.')
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setResending(null)
    }
  }

  const handleCancelInvite = async (memberId) => {
    if (!window.confirm('Cancelar este convite?')) return
    setRemovingMember(memberId)
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/accounts/${accountId}/members`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ memberId, action: 'cancel_invite' })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        router.replace('/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao cancelar convite.')
      }
      setState((prev) => ({
        ...prev,
        members: prev.members.filter((member) => member.id !== memberId)
      }))
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setRemovingMember(null)
    }
  }

  const handleAcceptInvite = async (memberId) => {
    setRemovingMember(memberId)
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/accounts/${accountId}/members`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ memberId, action: 'accept_invite' })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        router.replace('/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao aceitar convite.')
      }
      setState((prev) => ({
        ...prev,
        members: prev.members.map((member) => (member.id === memberId ? body.member : member))
      }))
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setRemovingMember(null)
    }
  }

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remover este utilizador da conta?')) return
    setRemovingMember(memberId)
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/accounts/${accountId}/members`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ memberId, action: 'remove_member' })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        router.replace('/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao remover utilizador.')
      }
      setState((prev) => ({
        ...prev,
        members: prev.members.filter((member) => member.id !== memberId)
      }))
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setRemovingMember(null)
    }
  }

  const handleEditProfile = async (member) => {
    const displayName = window.prompt('Nome a mostrar', member.displayName || '') ?? undefined
    const phone = window.prompt('Telefone', member.phone || '') ?? undefined
    if (displayName === undefined && phone === undefined) return
    setEditingProfile(member.id)
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/accounts/${accountId}/members`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          memberId: member.id,
          profile: { displayName, phone }
        })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        router.replace('/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao atualizar perfil.')
      }
      setState((prev) => ({
        ...prev,
        members: prev.members.map((entry) => (entry.id === member.id ? body.member : entry))
      }))
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setEditingProfile(null)
    }
  }

  const handleInviteSubmit = async (event) => {
    event.preventDefault()
    setInviteLoading(true)
    setInviteMessage(null)
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/accounts/${accountId}/members`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({
          email: inviteForm.email,
          password: inviteForm.password || undefined,
          role: inviteForm.role
        })
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        router.replace('/login?adminError=invalid_session')
        return
      }
      if (!response.ok) {
        throw new Error(body.error || 'Falha ao convidar membro.')
      }
      setState((prev) => ({
        ...prev,
        members: [...prev.members, body.member]
      }))
      setInviteForm({ email: '', password: '', role: 'member' })
      setInviteMessage({
        type: 'success',
        text: 'Convite pronto! Partilha o link abaixo caso o email automático não esteja configurado.',
        link: body.inviteLink
      })
    } catch (error) {
      console.error(error)
      setInviteMessage({ type: 'error', text: error.message })
    } finally {
      setInviteLoading(false)
    }
  }

  if (state.loading) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-slate-500">A carregar membros...</p>
      </section>
    )
  }

  if (state.error) {
    return (
      <section className="space-y-4">
        <button type="button" className="text-sm text-slate-500 underline" onClick={() => router.back()}>
          ← Voltar
        </button>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{state.error}</div>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/accounts" className="text-sm text-slate-500 hover:underline">
            ← Voltar às contas
          </Link>
          <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Account members</p>
          <h1 className="text-3xl font-bold text-slate-900">{state.account?.name || 'Conta'}</h1>
          <p className="text-sm text-slate-500">
            Plano {state.account?.plan?.toUpperCase() || '—'} ·{' '}
            {state.account?.is_active ? 'Ativa' : 'Arquivada'} · ID {state.account?.id}
          </p>
        </div>
      </div>

      <MembersTable
        members={state.members}
        updatingMember={updatingMember}
        resending={resending}
        removingMember={removingMember}
        editingProfile={editingProfile}
        onRoleChange={handleRoleChange}
        onResendInvite={handleResendInvite}
        onCancelInvite={handleCancelInvite}
        onAcceptInvite={handleAcceptInvite}
        onRemoveMember={handleRemoveMember}
        onEditProfile={handleEditProfile}
      />

      <InvitePanel
        form={inviteForm}
        onChange={setInviteForm}
        onSubmit={handleInviteSubmit}
        loading={inviteLoading}
        message={inviteMessage}
      />

      <Timeline timeline={state.timeline} />
    </section>
  )
}

function MembersTable({
  members,
  updatingMember,
  resending,
  removingMember,
  editingProfile,
  onRoleChange,
  onResendInvite,
  onCancelInvite,
  onAcceptInvite,
  onRemoveMember,
  onEditProfile
}) {
  if (!members.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
        Nenhum membro encontrado para esta conta.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Utilizador</th>
              <th className="px-4 py-3">Email / Perfil</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Entrou em</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{member.user_id}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div>{member.email || '—'}</div>
                  <div className="text-xs text-slate-500">
                    {member.displayName || 'Sem nome'} · {member.phone || 'Sem telefone'}
                  </div>
                  <ButtonLink
                    label="Editar perfil"
                    onClick={() => onEditProfile(member)}
                    disabled={editingProfile === member.id}
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                    value={member.role}
                    onChange={(event) => onRoleChange(member.id, event.target.value)}
                    disabled={updatingMember === member.id}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${member.status === 'accepted'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(member.created_at)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <div className="flex flex-wrap gap-3">
                    {member.status === 'pending' ? (
                      <>
                        <ButtonLink
                          label="Reenviar convite"
                          onClick={() => onResendInvite(member.id)}
                          disabled={resending === member.id}
                        />
                        <ButtonLink
                          label="Ativar sem email"
                          onClick={() => onAcceptInvite(member.id)}
                          disabled={removingMember === member.id}
                        />
                        <ButtonLink
                          label="Cancelar convite"
                          onClick={() => onCancelInvite(member.id)}
                          disabled={removingMember === member.id}
                          tone="danger"
                        />
                      </>
                    ) : (
                      <ButtonLink
                        label="Remover membro"
                        onClick={() => onRemoveMember(member.id)}
                        disabled={removingMember === member.id}
                        tone="danger"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Timeline({ timeline }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Timeline</h2>
          <p className="text-sm text-slate-500">
            Baseado nos registos recentes de `admin_logs`. Idealmente expandir para mostrar mais detalhes.
          </p>
        </div>
      </div>
      <ol className="mt-6 space-y-4">
        {(timeline || []).length === 0 && (
          <li className="text-sm text-slate-500">Sem eventos registados para esta conta.</li>
        )}
        {timeline.map((event) => (
          <li key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {new Intl.DateTimeFormat('pt-PT', {
                dateStyle: 'medium',
                timeStyle: 'short'
              }).format(new Date(event.created_at))}
            </p>
            <p className="text-sm font-semibold text-slate-900">{event.action}</p>
            {event.payload && Object.keys(event.payload).length > 0 && (
              <pre className="mt-2 rounded bg-white/70 p-2 text-xs text-slate-600">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

function InvitePanel({ form, onChange, onSubmit, loading, message }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Adicionar membro</h2>
      <p className="text-sm text-slate-500">
        Envia um convite para novos utilizadores ou adiciona alguém que já existe em Supabase Auth.
      </p>
      <form className="mt-4 grid gap-4 sm:grid-cols-[2fr,180px,180px,auto]" onSubmit={onSubmit}>
        <label className="sm:col-span-1">
          <span className="text-sm font-semibold text-slate-600">Email</span>
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) => onChange((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="user@example.com"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label>
          <span className="text-sm font-semibold text-slate-600">Password temporária</span>
          <input
            type="text"
            value={form.password}
            onChange={(event) => onChange((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Opcional"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Deixa em branco para gerar automaticamente.
          </span>
        </label>
        <label>
          <span className="text-sm font-semibold text-slate-600">Role</span>
          <select
            value={form.role}
            onChange={(event) => onChange((prev) => ({ ...prev, role: event.target.value }))}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'A enviar...' : 'Convidar'}
          </button>
        </div>
      </form>
      {message && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
        >
          <p>{message.text}</p>
          {message.link && (
            <div className="mt-2 rounded border border-emerald-200 bg-white/80 px-3 py-2 text-xs text-emerald-700">
              <p className="font-semibold">Link de acesso:</p>
              <p className="break-words">{message.link}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ButtonLink({ label, onClick, disabled, tone = 'default' }) {
  const styles =
    tone === 'danger'
      ? 'text-rose-700 hover:text-rose-800'
      : 'text-slate-700 hover:text-slate-900'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${styles} text-sm font-semibold underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  )
}
