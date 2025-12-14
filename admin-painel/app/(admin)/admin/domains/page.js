export default function AdminDomainsPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Domains</p>
        <h1 className="text-3xl font-bold text-slate-900">Visão global dos domínios customizados</h1>
        <p className="text-slate-600 max-w-3xl">
          Este placeholder marca o espaço para a tabela de domínios com filtros, ações rápidas e integração com o
          endpoint `/api/domains/verify`. Substitui-o quando a API estiver pronta.
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Tabela global</h2>
        <p className="mt-2 text-sm text-slate-500">
          Mostra todos os domínios, com colunas para status, conta, última verificação e erros recentes.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-700 mb-2">Ações rápidas (placeholder)</p>
            <ul className="space-y-2">
              <li>🔁 Re-verificar selecionados</li>
              <li>🛑 Desativar domínio</li>
              <li>🧹 Remover entradas órfãs</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-700 mb-2">Debug panel</p>
            <p>Integra aqui o output de `verifyTxtRecord`, timestamps e integrações com Vercel.</p>
          </div>
        </div>
      </div>

      <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Próximos passos</h2>
        <ul className="space-y-3 text-slate-600">
          <li>🌐 Criar route handler que lista todos os domínios (service role).</li>
          <li>📡 Ligar botão “Sync with provider”.</li>
          <li>⚠️ Mostrar alertas quando um domínio falha repetidamente.</li>
        </ul>
      </article>
    </section>
  )
}
