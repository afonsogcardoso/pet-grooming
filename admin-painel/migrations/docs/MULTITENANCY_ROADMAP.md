# Multitenancy Migration Roadmap

> Use this as a checklist. Each numbered item is a self‑contained task you can ask Codex to execute with a short prompt (examples provided). Go in order so the database and UI stay consistent.

---
## My Stuff
### My Prompts 
- Codex, ajuda-me a desenhar a tabela custom_domains no Supabase (colunas, índices, RLS) e dá-me o SQL para correr na migration.
- Codex, cria uma API route /app/api/domains/route.js que permita criar/remover domínios com validação e que escreva na tabela nova.
- Codex, preciso de instruções DNS e lógica de verificação para marcar o domínio como active. Gera-me uma função que valide o registo TXT via fetch.
- Codex, implementa app/middleware.js a fazer rewrite com base no cabeçalho Host usando a API que criámos.
- Codex, escreve testes manuais/automáticos ou um checklist para garantir que o domínio padrão e os custom domains continuam a funcionar.



## 0. Prep
1. **Backup** current Supabase DB + storage.
2. **Create feature branch** (e.g. `feature/multi-tenant`).

Prompt example:  
`"Cria um plano de backup e garante que a branch feature/multi-tenant está criada."`

### Backup plan (Supabase)
- **Escopo**: Postgres (dados) + Storage (arquivos) + variaveis sensiveis (.env, service_role, JWT secret).
- **Onde guardar**: repositorio privado `backups/` (ignorado no Git) + bucket seguro no provedor atual com ciclo de retencao de 30 dias.

1. **Preparacao**
   - Pausar deploys ou jobs que escrevem no banco.
   - Exportar variaveis: `export SUPABASE_ACCESS_TOKEN=...` e `export SUPABASE_DB_URL="postgresql://..."`.
   - Criar pasta local: `mkdir -p backups/$(date +%Y%m%d)_pre_multitenant`.

2. **Dump do banco**
   - `supabase db dump --db-url "$SUPABASE_DB_URL" --data-only=false --file backups/$(date +%Y%m%d)_pre_multitenant/db.sql`.
   - Validar integridade com `pg_restore --list backups/.../db.sql | head`.

3. **Backup do storage**
   - Listar buckets no dashboard (ex.: `public`, `avatars`, `documents`).
   - Usar service role key para sincronizar cada bucket:
     ```bash
     SUPABASE_URL="https://<project>.supabase.co"
     SUPABASE_SERVICE_KEY="ey..."
     node scripts/sync-storage.js --bucket avatars --out backups/$(date +%Y%m%d)_pre_multitenant/storage
     ```
   - O script deve usar `@supabase/storage-js` para paginar (`limit=1000`) e baixar cada objeto preservando o caminho.

4. **Validacao**
   - Restaurar localmente: `supabase db reset --db-url "$SUPABASE_DB_URL"` seguido de `psql "$SUPABASE_DB_URL" < db.sql` em um container de teste.
   - Subir storage restaurado para um bucket temporario e apontar um ambiente de staging para testar uploads/downloads.

5. **Retencao e auditoria**
   - Compactar pasta (`tar -czf pre_multitenant_<date>.tar.gz backups/...`) e enviar para o bucket de backup.
   - Registrar no README (ou runbook) a data, autor e local dos arquivos.
   - Agendar lembrete para remover backups expirados (30d) e rotacionar as chaves usadas.

---

## 1. Accounts & Membership Schema
1. Migration: new tables `accounts`, `account_members`.
2. Seed admin account (optional).

Prompt example:  
`"Adiciona uma migration para criar accounts e account_members e atualiza README com instruções."`

---

## 2. Add `account_id` to all business tables
1. Columns + FKs + indexes for `customers`, `pets`, `services`, `appointments`, etc.
2. Backfill existing data with the seed account.

Prompt example:  
`"Atualiza o esquema para incluir account_id em todas as entidades e cria migrations + seed."`

---

## 3. Row Level Security
1. Enable RLS for every table.
2. Policies: only rows where `account_id` matches the user’s `account_id`.
3. Outline how JWT includes `account_id`.

Prompt example:  
`"Ativa RLS em todas as tabelas e adiciona políticas multi-tenant com account_id."`

---

## 4. Supabase client helpers
1. Create helper to fetch `account_id` from session.
2. Update every service file (`lib/*Service.js`) to inject `.eq('account_id', currentAccountId)` and include the column on inserts.
3. Add unit tests or manual checklist.

Prompt example:  
`"Atualiza os serviços Supabase para usarem account_id automaticamente e documenta o helper."`

### Entregáveis atuais
- `lib/accountHelpers.js` expõe `getCurrentAccountId`, `setActiveAccountId` e `clearStoredAccountId`, buscando o tenant via sessão Supabase, storage do browser ou env (`NEXT_PUBLIC_DEFAULT_ACCOUNT_ID`).
- `lib/appointmentService.js`, `lib/customerService.js` e `lib/serviceService.js` já aplicam `.eq('account_id', currentAccountId)` em todas as queries e adicionam o campo em inserts.
- README explica como inicializar o helper após o login e como validar o filtro multi-tenant.

Checklist manual rápido:
1. Após autenticar, chame `setActiveAccountId(accountId)` (até termos o `useAccount()`).
2. Verifique nas DevTools que `activeAccountId` está no `sessionStorage`.
3. Crie/edite/exclua dados e confirme no Supabase que o `account_id` corresponde ao tenant ativo.

---

## 5. Authentication flow
1. After login, fetch membership + account details.
2. Store in React context (e.g. `useAccount()` hook).
3. Guard routes if no account selected.

Prompt example:  
`"Implementa um contexto useAccount que carrega a conta ativa após login e protege as rotas."`

### Entregáveis atuais
- `AccountProvider` (components/AccountProvider.js) observa `supabase.auth`, busca memberships em `account_members` e mantém `account`, `membership`, `memberships`, `loading`, `error`.
- `useAccount()` expõe `selectAccount(accountId)` e `refresh()`; `AccountGate` bloqueia as rotas enquanto não houver tenant ativo.
- `AppShell` envolve cada página com `AccountGate`, garantindo que os serviços só executam depois do `account_id` estar definido.
- README descreve como consumir o hook para mostrar informação contextual ou criar fluxos alternativos (ex.: onboarding).
- `/login` permite autenticação via `supabase.auth.signInWithPassword` e sincroniza `account_id` antes de redirecionar para o dashboard (rota pública, fora do `AccountGate`).
- Usuários sem sessão que tentem abrir rotas protegidas são redirecionados automaticamente para `/login`.

--- 

## 6. Branding settings
1. Extend `accounts` with `logo_url`, color palette, business name.
2. Expose settings screen to edit branding.
3. Feed those values into CSS variables and UI copy.

Prompt example:  
`"Permite configurar branding por conta (cores + logo) e aplica às variáveis CSS."`

### Entregáveis atuais
- Migration `010_account_branding.sql` adiciona as colunas `logo_url` + `brand_*`.
- `/settings` (apenas owners/admins) permite atualizar logo, cores e gradiente — aplicados em tempo real via `AccountProvider` (CSS vars) e cabeçalho.
- Mesma página inclui gestão de membros: convida utilizadores novos usando `/api/account/members` (service role) e adiciona-os a `account_members`.
- README documenta os pré-requisitos (incluindo `SUPABASE_SERVICE_ROLE_KEY`) e o fluxo de manutenção.

---

## 7. Tenant-aware data entry
1. Ensure every create/edit form sends `account_id`.
2. Update default queries (customers, services, etc.) to filter by context.
3. Validate RLS logs (no cross-tenant data).

Prompt example:  
`"Garante que todas as mutações usam o account_id da sessão e valida RLS com testes manuais."`

### Entregáveis atuais
- Todos os serviços (`lib/*Service.js`) adicionam `.eq('account_id', currentAccountId)` e injetam o campo em inserts/updates/deletes.
- O `AccountGate` só libera o app após a seleção do tenant, garantindo que `getCurrentAccountId()` retorne um valor antes de qualquer mutação.
- `docs/rls-manual-checklist.md` descreve o procedimento de testes manuais para inspecionar payloads, verificar logs RLS e confirmar que utilizadores sem membership são bloqueados.
- `migrations/README.md` referencia esse checklist para que o time saiba quando e como executá-lo.
- Agendamentos suportam fotos “antes/depois” (`before_photo_url`/`after_photo_url`) guardadas no bucket `appointment-photos`, com compressão automática antes do upload.

---

## 8. Onboarding workflow
1. Flow to create a new account + first user.
2. Optional: invite teammates (`account_members`).
3. Seed starter data (default services, translations?).

Prompt example:  
`"Adiciona um wizard de onboarding que cria a conta e dados iniciais."`

---

## 9. Billing (optional / later)
1. Integrate Stripe subscription linked to `account_id`.
2. Enforce plan limits (number of pets, appointments, branding features, etc.).

Prompt example:  
`"Integra Stripe com planos mensais controlados por account_id."`

---

## 10. Custom domain verification
1. Provide DNS instructions to customers (TXT token + optional CNAME/ALIAS).
2. Build a verifier that looks up the TXT record via DNS-over-HTTPS and marks the domain `active`.
3. Schedule a cron (Supabase Edge Function / Vercel Cron) to re-check pending domains and auto-disable ones that break.

Prompt example:  
`"Codex, preciso de instruções DNS e lógica de verificação para marcar o domínio como active. Gera-me uma função que valide o registo TXT via fetch."`

### DNS instructions (para clientes finais)
- **Subdomínios (recomendado)**: criar um registo `CNAME booking.acarlotadastosquias.pt → app.pet-grooming-app.com`. Para `book.dogwash-lx.com`, o alvo pode ser `edge.pet-grooming-app.com` (o domínio onde o Next.js está deployado).  
- **Domínios raiz**: usar `ALIAS`, `ANAME` ou Cloudflare com *CNAME flattening* apontando o apex (`dogwash-lx.com`) para o mesmo host do deploy.
- **Verificação TXT**: para cada domínio mostramos um token (ex.: `verify=9f23ab12`). O cliente adiciona `TXT _verify.booking.acarlotadastosquias.pt "verify=9f23ab12"`. Opcionalmente, quando o cliente prefere `dns_record_type=cname`, guardamos `verification_target` (ex.: `_verify.pet-grooming-app.com`) e validamos apontando para esse valor.
- **Mensagem pronta** (copiar/colar):  
  ```
  1. Cria um registo TXT chamado _verify.<teu_subdominio> com o valor "verify=<TOKEN>".
  2. Cria (ou atualiza) o CNAME do teu subdomínio para app.pet-grooming-app.com.
  3. Aguarda até 15 minutos e usa o botão “Verificar domínio” no dashboard.
  ```

### Fluxo de verificação
1. API `/api/domains/route.js` mantém o domínio em `status=pending` com `verification_token`.
2. Um endpoint/cron chama `verifyTxtRecord({ domain, token })` (ver helper em `lib/domainVerification.js`).
3. Se o token aparecer no TXT, atualizar `custom_domains.status='active'`, `verified_at=now()`, `last_checked_at=now()` e limpar `last_error`.
4. Se falhar, guardar `last_error` com a razão (ex.: “TXT mismatch”) e deixar `status=pending`. Depois de 3 falhas podemos definir `status='error'` para mostrar no dashboard.
5. Opcional: repetir a verificação diariamente para garantir que o token não foi removido (se removermos, volta para `pending`/`disabled`).

### Estado atual
- Endpoint `POST /api/domains/verify` (`app/api/domains/verify/route.js`) usa `verifyTxtRecord` para validar o TXT no DNS, atualiza `custom_domains.status` e devolve o resultado.
- `/settings` já mostra a secção “Custom domains” com formulário, token TXT, botões de remover/verificar e instruções rápidas.

### Próximos passos
- Adicionar cron job (Vercel Cron ou Supabase Scheduled Function) para revalidar e auto‑ativar automaticamente.
- **Runtime config**: definir `DOMAIN_ROUTER_TOKEN` (segredo compartilhado entre middleware e `/api/domains?domain=...`), `DOMAIN_ROUTER_PATH` (default `/api/domains`), `CUSTOM_DOMAIN_BASE_PATH` (default `/portal`), `CUSTOM_DOMAIN_PRIMARY_HOSTS` (domínios oficiais para não reescrever), `CUSTOM_DOMAIN_SKIP_HOSTS` (localhost, preview, etc.) e `DOMAIN_ROUTER_CACHE_SECONDS`/`DOMAIN_ROUTER_CACHE_MISS_SECONDS` para controlar caching no edge.

---

## Notes
- Keep migrations incremental; don’t modify old SQL files.
- After each milestone, update documentation (README + onboarding instructions).
- Always run Supabase `db diff` against the feature branch before merging.
