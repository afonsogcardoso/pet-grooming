# Plano para consolidar API e reduzir serverless functions (Vercel Hobby)

Contexto: existem 18 rotas em `app/api/**` (18 serverless functions) e o plano Hobby só permite 12. A meta é centralizar no backend Express (`pet-grooming-app/api/src`) e reduzir/evitar rotas Next.

## Etapas

1) Levantamento e backups
- Mapear quais rotas `app/api/**` são usadas pelo frontend (login, set-session, profile/avatar, appointments/ics/pet-photo, admin).
- Confirmar se há integrações externas (webhooks, etc).

2) Estratégia de proxy
- Preferência: rewrites no `next.config.mjs` para `/api/:path*` apontar para o backend Express público (`/api/v1/*`), eliminando serverless functions do Next.
- Alternativa: 1–3 handlers proxy únicos no Next que despacham por pathname.

3) set-session/signout
- A web hoje usa `app/api/auth/set-session` para setar cookies Supabase. E migrar login web para usar o backend diretamente (tokens sem cookies).

4) Migrar chamadas do frontend web
- Atualizar o frontend web para consumir `/api/v1/*` (backend Express) ou deixar o rewrite fazer proxy transparente.
- Ajustar base URLs e auth headers.

5) Remover/arquivar rotas Next redundantes
- Apagar ou mover `app/api/**/route.js` que não forem mais usadas.
- Garantir que não são empacotadas.

6) Testar end-to-end
- Smoke tests: login, set-session/signout (ou equivalente), listar/criar agendamentos, upload avatar/pet-photo, ICS/confirm-open.

7) Deploy e monitorização
- Deploy no Vercel, verificar que serverless functions ≤ 12.
- Monitorar logs/erros.

## Prompts sugeridos (para ir em blocos pequenos)
- “Confirma quais rotas do `app/api/**` são usadas em produção e se há integrações externas.”
- “Pode criar rewrites no `next.config.mjs` para `/api/:path*` -> `https://pet-grooming-api.vercel.app/api/:path*` e remover/consolidar `app/api/**`?”
- “Mantemos um handler no Next para set-session/signout ou migramos login web para backend (sem cookies)?”
- “Atualiza o frontend web para consumir `/api/v1/*` via rewrite e remove dependências de `app/api/**`.”
- “Remove os ficheiros `app/api/**/route.js` (ou move para _legacy) após confirmar o uso do backend.”
- “Corre smoke tests: login, set-session/signout, agendamentos, upload avatar/pet-photo, ICS/confirm.”
- “Faz deploy e confirma que a contagem de funções no Vercel ficou ≤ 12.”

## Restrições/decisões acordadas (atual)
- Usar rewrites em `next.config.mjs` com `process.env.API_BASE_URL` (sem barra no fim) para `/api/:path*` -> `${API_BASE_URL}/api/:path*`.
- Migrar login web para usar tokens do backend (parar de usar `supabase.auth.signInWithPassword` + `/api/auth/set-session`).
- Tokens no web: pode ser `localStorage/sessionStorage` (simples); se preferir cookies HTTPOnly, exige handler mínimo.
- Remover `app/api/**` após migração; manter só proxies se não houver equivalente no backend (confirmar uploads/ICS/pet-photo/domains).
- Confirmar que `API_BASE_URL` está definida nas envs do Next (local/Vercel).

## Prompts organizados por etapa (copy/paste)

- Etapa 1 (levantamento):  
  “Confirma quais rotas do `app/api/**` são usadas em produção (login, set-session, profile/avatar, appointments/ics/pet-photo, admin) e se há integrações externas.”

- Etapa 2 (proxy/rewrites):  
  “Pode criar rewrites no `next.config.mjs` para `/api/:path*` -> `${process.env.API_BASE_URL}/api/:path*` (API_BASE_URL sem barra final) e usar env no Vercel/local?”

- Etapa 3 (login web):  
  “Migra o login web para usar `/api/v1/auth/login` (backend), gravar tokens no storage e remover `supabase.auth.signInWithPassword` + `/api/auth/set-session`/signout.”

- Etapa 4 (consumo frontend):  
  “Atualiza o frontend web para consumir `/api/v1/*` (via rewrite) e remover dependências de `app/api/**`.”

- Etapa 5 (limpeza rotas Next):  
  “Remove ou move para `_legacy` todos os ficheiros `app/api/**/route.js` que não forem mais usados.”

- Etapa 6 (smoke tests):  
  “Corre smoke tests: login web, agendamentos (listar/criar), uploads avatar/pet-photo (se aplicável), ICS/confirm-open (se aplicável).”

- Etapa 7 (deploy/monitor):  
  “Faz deploy com rewrites e confirma que o número de serverless functions no Vercel ficou ≤ 12; monitoriza logs/erros.”
