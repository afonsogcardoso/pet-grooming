import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export const dynamic = 'force-dynamic'

const QUICK_STATS = [
  {
    label: 'Active accounts',
    helper: 'Hook to Supabase RPC',
    key: 'activeAccounts'
  },
  {
    label: 'Pending domains',
    helper: 'Wire up to /admin/domains',
    key: 'pendingDomains'
  },
  {
    label: 'Open invitations',
    helper: 'account_members status',
    key: 'openInvites'
  }
]

const CHECKLIST = [
  'Ligar listagem de contas ao service role',
  'Adicionar seed blueprint predefinido',
  'Configurar alertas Slack para falhas de domínio'
]

const ACTION_LABELS = {
  'account.create': 'Nova conta criada',
  'account.update': 'Conta atualizada',
  'account.bulk_archive': 'Contas arquivadas',
  'account.bulk_restore': 'Contas restauradas',
  'account_members.create': 'Novo membro convidado',
  'account_members.resend_invite': 'Convite reenviado',
  'account_members.cancel_invite': 'Convite cancelado',
  'account_members.remove': 'Membro removido',
  'account_members.accept_invite': 'Convite ativado',
  'account_members.role_update': 'Role atualizada',
  'account_members.profile_update': 'Perfil atualizado'
}

export default async function AdminOverviewPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const quickStats = await loadQuickStats()

  const { data: logsData, error } = await supabase
    .from('admin_logs')
    .select('id, actor_id, action, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(15)

  const logs = error ? [] : logsData || []

  return (
    <section className="space-y-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Overview</p>
        <h1 className="text-3xl font-bold text-slate-900">Controla a saúde da plataforma num só lugar</h1>
        <p className="text-slate-600 max-w-2xl">
          Estes blocos ainda são placeholders. Substitui-os por queries reais (Supabase RPC ou API routes) para ver métricas
          de contas, domínios e equipas em tempo real.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK_STATS.map((stat) => (
          <article key={stat.key} className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{quickStats[stat.key]}</p>
            <p className="text-sm text-slate-500 mt-2">{stat.helper}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityFeed logs={logs} />

        <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
          <header className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Checklist de rollout</h2>
            <p className="text-sm text-slate-500">Usa esta lista para acompanhar o que falta ligar.</p>
          </header>
          <ul className="space-y-3">
            {CHECKLIST.map((task) => (
              <li key={task} className="flex items-start gap-3 text-slate-600">
                <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-bold text-slate-500">
                  •
                </span>
                <span>{task}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

async function loadQuickStats() {
  return {
    activeAccounts: '—',
    pendingDomains: '—',
    openInvites: '—'
  }
}

function ActivityFeed({ logs }) {
  if (!logs.length) {
    return (
      <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Activity feed</h2>
            <p className="text-sm text-slate-500">Ainda não há eventos registados.</p>
          </div>
        </header>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          À medida que os admins executarem ações (criar contas, reverificar domínios), os detalhes aparecerão aqui.
        </div>
      </article>
    )
  }

  return (
    <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Activity feed</h2>
          <p className="text-sm text-slate-500">Eventos recentes registados em admin_logs.</p>
        </div>
      </header>
      <ol className="mt-6 space-y-4">
        {logs.map((event) => (
          <li key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {new Intl.DateTimeFormat('pt-PT', {
                dateStyle: 'medium',
                timeStyle: 'short'
              }).format(new Date(event.created_at))}
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {ACTION_LABELS[event.action] || event.action}
            </p>
            {event.payload && (
              <pre className="mt-2 rounded bg-white/80 p-2 text-xs text-slate-600">{JSON.stringify(event.payload, null, 2)}</pre>
            )}
          </li>
        ))}
      </ol>
    </article>
  )
}
