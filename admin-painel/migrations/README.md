This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase Database

As migrations SQL vivem em `migrations/*.sql` e devem ser aplicadas na ordem numérica. O passo inicial para o rollout multi-tenant é a criação das tabelas `accounts` e `account_members`.

### Pré-requisitos
1. Instale a CLI do Supabase (`npm install -g supabase`) e faça login: `supabase login`.
2. Configure a URL do banco (ou use o projeto vinculado com `supabase link --project-ref <ref>`).

### Executar a migration `007_accounts_members.sql`
```bash
# do diretório do projeto
supabase db execute --file migrations/007_accounts_members.sql
```
> Alternativa: copie o conteúdo do arquivo e rode no SQL Editor do dashboard Supabase.

Essa migration cria as tabelas de contas, aplica índices/RLS e define políticas temporárias abertas que serão substituídas nos passos seguintes da roadmap.

### Seed inicial (opcional)
Depois de executar a migration, crie uma conta e associe um usuário existente (UUID do `auth.users`):

```sql
-- 1) cria ou atualiza uma conta base
INSERT INTO accounts (name, slug)
VALUES ('Conta Demo', 'demo')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
RETURNING id;

-- 2) associa o usuário à conta como owner
INSERT INTO account_members (account_id, user_id, role)
VALUES ('<account_id_retornado>', '<uuid_do_usuario>', 'owner')
ON CONFLICT (account_id, user_id) DO UPDATE SET role = EXCLUDED.role;
```

Documente a conta criada e compartilhe o `account_id` com o time para que os próximos passos (colunas `account_id`, RLS, etc.) usem esse registro como seed.

### Executar a migration `008_add_account_ids.sql`
Esta migration adiciona `account_id` em `customers`, `pets`, `services` e `appointments`, cria FKs/índices e backfill automático apontando para a conta `legacy`.

```bash
supabase db execute --file migrations/008_add_account_ids.sql
```

> Pré-requisito: já ter rodado `007_accounts_members.sql` e ter ao menos uma conta (idealmente a conta real do cliente).

### Seed para vincular dados à conta real
Use `migrations/seed_assign_account.sql` para apontar todos os registros existentes para o `account_id` definitivo (por exemplo `20cf8510-2820-4c7c-935f-24fa564f8b62`):

1. Abra o arquivo e substitua o UUID placeholder (`00000000-0000-0000-0000-000000000000`) pelo ID real.
2. Rode o script:
   ```bash
   supabase db execute --file migrations/seed_assign_account.sql
   ```
3. Opcional: ajuste o `name/slug` no script para refletir o tenant.

Depois disso, todos os registros existentes ficam vinculados ao tenant correto e as novas colunas `account_id` já estão preenchidas para suportar RLS nos próximos passos.

### Executar a migration `009_rls_multitenant.sql`
Esta etapa ativa RLS em todas as tabelas de negócio e aplica políticas baseadas em `account_id`, utilizando o helper `has_account_access(account_id, min_role)`.

```bash
supabase db execute --file migrations/009_rls_multitenant.sql
```

O que muda:
- Funções auxiliares `account_role_weight` e `has_account_access` ficam disponíveis em `public`.
- As tabelas `accounts`, `account_members`, `customers`, `pets`, `services` e `appointments` passam a exigir que o usuário tenha associação ativa (`account_members.status = 'accepted'`) com o tenant da linha.
- Chaves de serviço (`auth.jwt()->>'role' = 'service_role'`) continuam com acesso total para scripts/automações.

### Checklist de verificação RLS
1. Rode as migrations 007, 008 e 009 em um ambiente de staging.
2. Via Supabase SQL, execute `select has_account_access('<account_uuid>'::uuid);` autenticado como usuário comum (ou use o painel RLS) para garantir que retorna `true` somente para membros.
3. Na aplicação, autentique com um usuário membro e confirme que as queries (services, customers, etc.) retornam apenas dados do tenant.
4. Teste usuários sem associação (ou com `status = 'pending'`) para validar que recebem erro 401/permission denied.

## Helper de `account_id` no frontend

Todas as chamadas Supabase foram atualizadas para requerer um `account_id` ativo. O helper vive em `lib/accountHelpers.js` e oferece:

- `getCurrentAccountId()` (async): lê da sessão Supabase (`user_metadata.account_id`), de `sessionStorage/localStorage` (`activeAccountId`) ou da env `NEXT_PUBLIC_DEFAULT_ACCOUNT_ID`. Dispara erro se nada for encontrado.
- `setActiveAccountId(accountId)`: persiste o `account_id` assim que o usuário escolhe uma conta (ideal para o fluxo pós-login).
- `clearStoredAccountId()`: remove o valor armazenado (ex.: logout).

### Uso típico após login
```js
import { setActiveAccountId } from '@/lib/accountHelpers'

async function bootstrapAccount() {
  const { data } = await supabase.auth.getSession()
  const accountId = data?.session?.user?.user_metadata?.account_id
  if (accountId) setActiveAccountId(accountId)
}
```

Todas as funções em `lib/*Service.js` já chamam `getCurrentAccountId()` antes de consultar ou inserir dados, garantindo que:

1. As queries incluem `.eq('account_id', currentAccountId)`.
2. Novos registros recebem `account_id` automaticamente.
3. Updates/deletes validam o tenant antes de tocar em qualquer linha.

Se você precisar chamar a API/postgrest manualmente, importe o helper e adicione os filtros conforme o padrão acima.

## Contexto `useAccount`

O layout global agora envolve a aplicação com `AccountProvider`, que expõe o hook `useAccount()` e bloqueia as rotas através do componente `AccountGate`.

### O que ele faz
1. Observa `supabase.auth` e carrega automaticamente todas as memberships (`account_members` com `account`).
2. Resolve o `account_id` ativo (storage + metadata) e sincroniza com `setActiveAccountId`.
3. Oferece `selectAccount(accountId)` e `refresh()` para que páginas possam trocar de tenant ou refazer o fetch.
4. Renderiza um guardião visual (spinner, erro, call-to-action) até que um tenant válido esteja selecionado, evitando chamadas aos serviços sem `account_id`.

### Uso em componentes
```js
import { useAccount } from '@/components/AccountProvider'

function HeaderAccountBadge() {
  const { account, membership } = useAccount()
  if (!account) return null
  return <span>{account.name} · {membership?.role}</span>
}
```

O `AccountGate` já envolve todas as rotas dentro do `AppShell`, portanto páginas protegidas só renderizam quando existe um tenant ativo. Caso precise de um fluxo especial (ex.: onboarding), basta consumir o hook e renderizar algo diferente quando `memberships.length === 0`.

## Página de login (`/login`)

- Implementada em `app/login/page.js` usando `supabase.auth.signInWithPassword`.
- Após autenticar, sincroniza o `account_id` vindo do metadata com `setActiveAccountId` e redireciona para `/`.
- Enquanto o utilizador não está autenticado, esta rota ignora o `AccountGate`, permitindo o acesso ao formulário mesmo sem memberships.
- Qualquer acesso a rotas protegidas sem sessão é redirecionado automaticamente para `/login`.

### Como testar
1. Garanta que `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão configuradas.
2. Crie um utilizador em Supabase Auth (ou use um existente).
3. Visite `http://localhost:3000/login`, preencha email + password e confirme que é redirecionado para o dashboard.
4. Verifique no Supabase que `auth.users.user_metadata.account_id` está preenchido para que o helper selecione o tenant correto; caso contrário, selecione manualmente via UI quando o `AccountGate` pedir.

## Checklist de mutações + RLS

- Consulte `docs/rls-manual-checklist.md` para validar que:
  1. Todas as mutações enviam `account_id` no payload.
  2. Os registos criados ficam com o `account_id` correto.
  3. Utilizadores sem permissão não conseguem ler/mutar dados de outras contas.
  4. Os logs de RLS confirmam que as políticas multi-tenant estão a ser aplicadas.

Execute o checklist antes de cada release importante ou sempre que mexer nas camadas de dados/mutações.

## Branding por conta + gestão de utilizadores

### Executar a migration `010_account_branding.sql`
Adiciona colunas de branding (`logo_url`, `brand_primary`, `brand_accent`, etc.) à tabela `accounts`.

```bash
supabase db execute --file migrations/010_account_branding.sql
```

### Área de configurações (`/settings`)
- Disponível apenas para owners/admins da conta.
- Secção **Branding** permite atualizar cores, gradiente e logo. Os valores são aplicados automaticamente às variáveis CSS (`--brand-*`) e ao cabeçalho do app.
- O upload de logo comprime automaticamente a imagem para ~640px (JPEG) antes de enviar para o bucket, evitando ficheiros demasiado pesados.
- Secção **Members** usa a rota `/api/account/members` para criar utilizadores com Supabase Auth (via service role) e adicioná-los a `account_members`.
- Para que a criação de utilizadores funcione, defina `SUPABASE_SERVICE_ROLE_KEY` no ambiente do servidor Next.js.
- Para upload de logos, cria o bucket **`account-branding`** no Supabase Storage (pode ser público) e adiciona a política abaixo para permitir escritas pelos utilizadores autenticados:
  ```sql
  -- no Storage policies
  create policy "Allow branding uploads"
    on storage.objects for insert
    with check (
      bucket_id = 'account-branding'
      and auth.uid() is not null
    );

  create policy "Allow branding updates"
    on storage.objects for update
    using (
      bucket_id = 'account-branding'
      and auth.uid() is not null
    )
    with check (
      bucket_id = 'account-branding'
      and auth.uid() is not null
    );
  ```
  A aplicação grava ficheiros em `logos/<account_id>/...`. Mantém o bucket como público se quiseres servir as imagens diretamente via URL.

### Executar a migration `011_appointment_photos.sql`
Adiciona as colunas `before_photo_url` e `after_photo_url` em `appointments`, permitindo anexar fotos ao agendamento.

```bash
supabase db execute --file migrations/011_appointment_photos.sql
```

- Cria também o bucket público **`appointment-photos`** para armazenar as imagens de antes/depois (`appointments/<uuid>-before.jpg`).
- Os uploads são comprimidos no cliente (~1024px, JPEG) antes de serem enviados, reduzindo o consumo de storage.
- Políticas recomendadas para o bucket:
  ```sql
  create policy "Allow appointment uploads"
    on storage.objects for insert
    with check (
      bucket_id = 'appointment-photos'
      and auth.uid() is not null
    );

  create policy "Allow appointment updates"
    on storage.objects for update
    using (
      bucket_id = 'appointment-photos'
      and auth.uid() is not null
    )
    with check (
      bucket_id = 'appointment-photos'
      and auth.uid() is not null
    );
  ```
  Mantém o bucket como público apenas para leitura (o default “Get” policy) se quiseres servir as imagens diretamente na UI; caso contrário, adiciona uma política de `select` equivalente controlada via `auth.uid()`.

### Executar a migration `014_accounts_status.sql`
Adiciona o campo booleano `is_active` à tabela `accounts`, permitindo marcar tenants como ativos/inativos e desbloqueando os filtros do painel admin.

```bash
supabase db execute --file migrations/014_accounts_status.sql
```

> Dica: após aplicar a migration, todos os registos existentes ficam `is_active = true`. Para suspender um tenant, corre `UPDATE accounts SET is_active = false WHERE slug = 'cliente-x';`.

### Executar a migration `015_admin_logs.sql`
Cria a tabela `admin_logs`, usada para auditar ações do painel (criação/edição/arquivo de contas, automações, etc.).

```bash
supabase db execute --file migrations/015_admin_logs.sql
```

Cada entrada guarda `actor_id`, `action`, `target_id`, `payload` e `created_at`. A API `/api/admin/accounts` já escreve automaticamente nessas logs para todas as operações suportadas.
