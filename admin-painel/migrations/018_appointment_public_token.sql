-- Add a public token to appointments for shareable confirmations
alter table appointments
  add column if not exists public_token uuid default gen_random_uuid();

update appointments
set public_token = gen_random_uuid()
where public_token is null;

alter table appointments
  alter column public_token set not null;

create unique index if not exists appointments_public_token_key
  on appointments(public_token);
