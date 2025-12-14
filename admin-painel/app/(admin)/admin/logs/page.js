export default function AdminLogsPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Logs</p>
        <h1 className="text-3xl font-bold text-slate-900">Auditoria &amp; alertas</h1>
        <p className="text-slate-600 max-w-3xl">
          Assim que a tabela `admin_logs` estiver pronta, substitui este placeholder por uma listagem filtrável e
          exportável.
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Feed de ações</h2>
        <p className="text-sm text-slate-500 mt-2">
          Liga filtros por tipo de ação, actor e data. Adiciona também export CSV/JSON.
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Placeholder: mostra aqui as ações mais recentes quando a tabela estiver populada.
        </div>
      </div>

      <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Integrações planeadas</h2>
        <ul className="space-y-3 text-slate-600">
          <li>📧 Alertas de email para falhas de verificação de domínio.</li>
          <li>🔔 Mensagens para Slack quando um tenant exceder limites.</li>
          <li>☁️ Export diário para SIEM / storage externo.</li>
        </ul>
      </article>
    </section>
  )
}
