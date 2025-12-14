-- Track when a confirmation link is opened
alter table appointments
  add column if not exists confirmation_opened_at timestamptz;

create index if not exists appointments_confirmation_opened_idx
  on appointments(confirmation_opened_at);
