-- Track when WhatsApp was sent for a confirmation
alter table appointments
  add column if not exists whatsapp_sent_at timestamptz;

create index if not exists appointments_whatsapp_sent_idx
  on appointments(whatsapp_sent_at);
