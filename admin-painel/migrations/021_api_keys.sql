-- API keys table for tenant-authenticated integrations
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  status text not null default 'active', -- active | revoked
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_account_id_idx on api_keys (account_id);
create unique index if not exists api_keys_prefix_hash_idx on api_keys (key_prefix, key_hash);

-- Optional: enable RLS (service role bypasses). Policies can be added later if needed.
alter table api_keys enable row level security;
