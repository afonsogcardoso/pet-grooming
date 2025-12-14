# Platform Admin Backoffice Roadmap (com prompts testáveis)

Objetivo: construir um painel interno para gerir accounts, equipas, domínios e configs globais sem mexer manualmente na BD. Cada etapa tem prompt principal, variações opcionais e um mini-checklist de testes para validar antes de avançar.

**Regra geral:** depois de cada implementação corre `pnpm lint`, `pnpm test` (ou suites específicas) e valida flujos críticos em staging/local.

---

## 0. Prep & Access Control
**Objetivos**
- Role `platform_admin` (flag em `auth.users` ou tabela `platform_admins`).
- Middleware `/admin` com sessão Supabase válida + kill-switch `ADMIN_PORTAL_ENABLED`.
- Documentar bootstrap local (`NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS`, SERVICE_ROLE, etc.).

**Prompt base**
```
"Configura a role platform_admin (flag no auth) + middleware /admin que bloqueia não-admins e respeita a env ADMIN_PORTAL_ENABLED."
```

**Prompt extra**
```
"Adiciona logs de sessão/impersonação e um endpoint que permite desligar o backoffice em caso de incidente."
```

**Testes rápidos**
- Utilizador sem role → `/admin` devolve 302/403.
- Admin reconhecido → acesso OK.
- `ADMIN_PORTAL_ENABLED=false` → painel bloqueado com aviso.

---

## 1. Admin Shell
**Objetivos**
- Layout `app/admin/layout.js` com sidebar (Overview, Accounts, Teams, Domains, Logs, Settings).
- Providers globais: Supabase admin client, feature flags, error boundary por widget, fallback offline.
- Componentes base (`Table`, `EmptyState`, `SearchInput`, `SectionCard`) reutilizáveis.

**Prompt base**
```
"Cria o layout /admin com sidebar responsiva, header com info da sessão e placeholders nas rotas Overview/Accounts/Domains/Logs."
```

**Prompt extra**
```
"Acrescenta feature flags por secção e um fallback offline/loading partilhado no layout /admin."
```

**Testes rápidos**
- Navegar entre secções sem reload inteiro.
- Simular erro num widget → error boundary mantém shell.

---

## 2. Gestão de Accounts
**Objetivos**
- `/admin/accounts`: listagem com filtros (plan, estado, data), paginação server-side e bulk actions.
- Modal “New account” (nome, slug, plano, branding, template).
- Após criação: seed default + owner opcional + log.
- Edição inline (branding/plano/estado) com soft delete/restore.

**Prompts faseados**
1. Listagem base  
   `"Implementa /admin/accounts com table paginada, filtros por plano/estado e botão 'New account'."`
2. Criação + seed  
   `"Liga o formulário 'New account' a um endpoint admin que cria a account, dispara seed e permite definir owner inicial."`
3. Edição + bulk  
   `"Adiciona edições inline e bulk actions (archive/restore) em /admin/accounts, escrevendo em admin_logs."`

**Testes rápidos**
- Criar conta → aparece na lista e seed cria serviços default.
- Editar branding/plano → persiste na tabela.
- Soft delete → desaparece da vista default; restore repõe estado.

---

## 3. Gestão de Equipa (account_members)
**Objetivos**
- Sub-painel `/admin/accounts/[accountId]/members`.
- Reenviar convites, reset estado, alteração de role com rate limiting.
- Timeline de alterações (quem convidou/alterou) + logs.

**Prompt base**
```
"Cria o subpainel /admin/accounts/[id]/members com listagem, reenviar convite, update de role e timeline de alterações."
```

**Prompt extra**
```
"Implementa rate limiting para convites e mostra indicadores de última atividade do membro."
```

**Testes rápidos**
- Reenviar convite → email/log emitido.
- Mudar role → reflecte em Supabase + timeline.

---

## 4. Domínios customizados
**Objetivos**
- `/admin/domains`: tabela global com filtros (status, conta, verificado há X).
- Ações rápidas: reverificar, desativar, remover, “Sync with provider”.
- Painel de debug: último TXT lido, erros, status Vercel/com provider.

**Prompts faseados**
1. Base  
   `"Constrói /admin/domains com tabela global, filtros por status/conta e ação para correr verifyTxtRecord em lote."`
2. Debug extra  
   `"Adiciona painel de propagação (último TXT, Vercel status) e botão 'Sync with provider' em /admin/domains."`

**Testes rápidos**
- Rodar verify em lote → logs corretos.
- Domínio com erro mostra timestamp e mensagem.

---

## 5. Seed & Templates
**Objetivos**
- Blueprints versionados (`config/blueprints/*.json` ou tabela `account_blueprints`).
- Seleção de template na criação com diff preview.
- RPC/API que aplica template (serviços, branding, demo data) + testes automáticos por blueprint.

**Prompt base**
```
"Adiciona suporte a blueprints versionados com diff preview na criação de account e RPC que aplica o template 'basic'."
```

**Prompt extra**
```
"Cria testes automatizados que validam cada blueprint antes do deploy e documenta como adicionar novos templates."
```

**Testes rápidos**
- Criar account com template → dados coerentes.
- Test suite dos blueprints passa local/CI.

---

## 6. Observabilidade
**Objetivos**
- Tabela `admin_logs` com `actor_id`, `action`, `payload`, `correlation_id`, TTL configurável.
- UI `/admin/logs` com filtros, pesquisa e export CSV.
- Alertas Slack/email quando verifyTxtRecord falha ou limites são excedidos.

**Prompts**
1. `"Cria admin_logs (com correlation_id e TTL) + API para registar ações e UI /admin/logs com filtros e export CSV."`
2. `"Configura alertas Slack/email para falhas de verificação de domínio e tenants acima do limite."`

**Testes rápidos**
- Executar ação → log aparece e export CSV traz dados filtrados.
- Forçar falha em verify → alerta emitido.

---

## 7. Planos e limites
**Objetivos**
- Estrutura `plan_limits` (tabela ou JSON) + histórico de alterações.
- Editor no admin com validações e preview do impacto.
- Hook no app principal bloqueia ações ao atingir limites com mensagens amigáveis.
- Teste de carga automatizado por limite.

**Prompt base**
```
"Implementa o editor de planos no admin com histórico de alterações e integra hooks que bloqueiam ações quando o limite é atingido."
```

**Prompt extra**
```
"Adiciona um teste automatizado que simula criação de recursos até atingir cada limite para garantir mensagens e bloqueios corretos."
```

**Testes rápidos**
- Atualizar limite → hook reage imediatamente.
- Histórico mostra quem alterou e quando.

---

## 8. Automatizações e Runbooks
**Objetivos**
- Botões: “Provisionar domínio”, “Reverificar pending”, “Enviar onboarding”.
- Guard rails: máx execuções concorrentes, fila, logs dedicados.
- Scheduler (Vercel Cron/Supabase Edge) envia resumo diário.
- Runbooks markdown com pré-checks/rollback para cada automação.

**Prompt base**
```
"Cria automações admin com guard rails de concorrência, runbooks em markdown e scheduler diário que envia resumo aos platform_admins."
```

**Testes rápidos**
- Executar automação → respeita limites de concorrência e grava log.
- Scheduler dispara e envia métricas/alertas esperados.

---

## Notas gerais
- Reutiliza helpers (`supabaseAdmin`, `verifyTxtRecord`, etc.) para evitar duplicação.
- Cada feature nova deve escrever em `admin_logs` e ter testes RLS/service-role antes do merge.
- Documenta em README interno como ativar/desativar o painel, criar contas demo e correr seeds.
