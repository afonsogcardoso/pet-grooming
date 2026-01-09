# Supabase inspect

Paste the outputs of the checks below into the matching sections.

---

## Buckets

Paste the output of `supabase.storage.listBuckets()` or a copy of the Storage UI list.

Example command (Node script):

```bash
# set env then run the inspect script I provided earlier
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
node inspect-supabase.js
```

Paste result here:

```

```

---

## appointments_columns

Run this in Supabase SQL editor and paste results:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'appointments'
ORDER BY ordinal_position;
```

Paste result here:

```
[
  {
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "appointment_date",
    "data_type": "date"
  },
  {
    "column_name": "appointment_time",
    "data_type": "time without time zone"
  },
  {
    "column_name": "status",
    "data_type": "text"
  },
  {
    "column_name": "notes",
    "data_type": "text"
  },
  {
    "column_name": "customer_id",
    "data_type": "uuid"
  },
  {
    "column_name": "duration",
    "data_type": "integer"
  },
  {
    "column_name": "account_id",
    "data_type": "uuid"
  },
  {
    "column_name": "before_photo_url",
    "data_type": "text"
  },
  {
    "column_name": "after_photo_url",
    "data_type": "text"
  },
  {
    "column_name": "payment_status",
    "data_type": "text"
  },
  {
    "column_name": "payment_method",
    "data_type": "text"
  },
  {
    "column_name": "payment_amount",
    "data_type": "numeric"
  },
  {
    "column_name": "public_token",
    "data_type": "uuid"
  },
  {
    "column_name": "confirmation_opened_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "whatsapp_sent_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "amount",
    "data_type": "numeric"
  },
  {
    "column_name": "source",
    "data_type": "text"
  },
  {
    "column_name": "reminder_offsets",
    "data_type": "jsonb"
  }
]
```

---

## appointment_services_columns

Run:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'appointment_services'
ORDER BY ordinal_position;
```

Paste result here:

```
[
  {
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "column_name": "appointment_id",
    "data_type": "uuid"
  },
  {
    "column_name": "service_id",
    "data_type": "uuid"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "price_tier_id",
    "data_type": "uuid"
  },
  {
    "column_name": "price_tier_label",
    "data_type": "text"
  },
  {
    "column_name": "price_tier_price",
    "data_type": "numeric"
  },
  {
    "column_name": "pet_id",
    "data_type": "uuid"
  }
]
```

---

## pets_columns

Run:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pets'
ORDER BY ordinal_position;
```

Paste result here:

```
[
  {
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "column_name": "customer_id",
    "data_type": "uuid"
  },
  {
    "column_name": "name",
    "data_type": "text"
  },
  {
    "column_name": "breed",
    "data_type": "text"
  },
  {
    "column_name": "age",
    "data_type": "integer"
  },
  {
    "column_name": "weight",
    "data_type": "numeric"
  },
  {
    "column_name": "medical_notes",
    "data_type": "text"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "photo_url",
    "data_type": "text"
  },
  {
    "column_name": "account_id",
    "data_type": "uuid"
  },
  {
    "column_name": "consumer_pet_id",
    "data_type": "uuid"
  },
  {
    "column_name": "species_id",
    "data_type": "uuid"
  },
  {
    "column_name": "breed_id",
    "data_type": "uuid"
  }
]
```

---

## customers_columns

Run:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
```

Paste result here:

```
[
  {
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "column_name": "phone",
    "data_type": "text"
  },
  {
    "column_name": "email",
    "data_type": "text"
  },
  {
    "column_name": "address",
    "data_type": "text"
  },
  {
    "column_name": "notes",
    "data_type": "text"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "appointment_count",
    "data_type": "integer"
  },
  {
    "column_name": "pet_count",
    "data_type": "bigint"
  },
  {
    "column_name": "nif",
    "data_type": "text"
  },
  {
    "column_name": "account_id",
    "data_type": "uuid"
  },
  {
    "column_name": "photo_url",
    "data_type": "text"
  },
  {
    "column_name": "user_id",
    "data_type": "uuid"
  },
  {
    "column_name": "phone_country_code",
    "data_type": "text"
  },
  {
    "column_name": "phone_number",
    "data_type": "text"
  },
  {
    "column_name": "first_name",
    "data_type": "text"
  },
  {
    "column_name": "last_name",
    "data_type": "text"
  },
  {
    "column_name": "address_2",
    "data_type": "text"
  }
]
```

---

## photo_columns

Run:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name ILIKE '%photo%'
ORDER BY table_name, column_name;
```

Paste result here:

```
[
  {
    "table_name": "appointments",
    "column_name": "after_photo_url"
  },
  {
    "table_name": "appointments",
    "column_name": "before_photo_url"
  },
  {
    "table_name": "consumer_pets",
    "column_name": "photo_url"
  },
  {
    "table_name": "customers",
    "column_name": "photo_url"
  },
  {
    "table_name": "pets",
    "column_name": "photo_url"
  }
]
```

---

## rls_policies (optional)

If you can, run:

```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

Paste result here:

```
[
  {
    "schemaname": "public",
    "tablename": "appointments",
    "policyname": "Allow all operations",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "accounts",
    "policyname": "Accounts - service role full access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "accounts",
    "policyname": "Accounts - members can read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "has_account_access(id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "accounts",
    "policyname": "Accounts - admins manage",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "has_account_access(id, 'admin'::text)",
    "with_check": "has_account_access(id, 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "account_members",
    "policyname": "Account members - service role full access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "account_members",
    "policyname": "Account members - members read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "has_account_access(account_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "account_members",
    "policyname": "Account members - admins manage",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "has_account_access(account_id, 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "account_members",
    "policyname": "Account members - admins update/delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "has_account_access(account_id, 'admin'::text)",
    "with_check": "has_account_access(account_id, 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "account_members",
    "policyname": "Account members - admins delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "has_account_access(account_id, 'admin'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "customers",
    "policyname": "Customers - member access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "has_account_access(account_id)",
    "with_check": "has_account_access(account_id)"
  },
  {
    "schemaname": "public",
    "tablename": "pets",
    "policyname": "Pets - member access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "has_account_access(account_id)",
    "with_check": "has_account_access(account_id)"
  },
  {
    "schemaname": "public",
    "tablename": "services",
    "policyname": "Services - member access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "has_account_access(account_id)",
    "with_check": "has_account_access(account_id)"
  },
  {
    "schemaname": "public",
    "tablename": "appointments",
    "policyname": "Appointments - member access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "has_account_access(account_id)",
    "with_check": "has_account_access(account_id)"
  },
  {
    "schemaname": "public",
    "tablename": "pet_breeds",
    "policyname": "Pet breeds - service role",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "pet_breeds",
    "policyname": "Pet breeds - members read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((account_id IS NULL) OR has_account_access(account_id))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "pet_breeds",
    "policyname": "Pet breeds - admins write",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((account_id IS NULL) OR has_account_access(account_id, 'admin'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "pet_breeds",
    "policyname": "Pet breeds - admins update/delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "((account_id IS NULL) OR has_account_access(account_id, 'admin'::text))",
    "with_check": "((account_id IS NULL) OR has_account_access(account_id, 'admin'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "pet_breeds",
    "policyname": "Pet breeds - admins delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "((account_id IS NULL) OR has_account_access(account_id, 'admin'::text))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "pet_species",
    "policyname": "Pet species - admins write",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((account_id IS NULL) OR has_account_access(account_id, 'admin'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "custom_domains",
    "policyname": "Custom domains - service role full access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "custom_domains",
    "policyname": "Custom domains - members read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "has_account_access(account_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "custom_domains",
    "policyname": "Custom domains - admins manage",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "has_account_access(account_id, 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "custom_domains",
    "policyname": "Custom domains - admins update",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "has_account_access(account_id, 'admin'::text)",
    "with_check": "has_account_access(account_id, 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "custom_domains",
    "policyname": "Custom domains - admins delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "has_account_access(account_id, 'admin'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "admin_logs",
    "policyname": "admin_logs_admins_select",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((auth.jwt() ->> 'is_admin'::text) = 'true'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "admin_logs",
    "policyname": "admin_logs_admins_modify",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'is_admin'::text) = 'true'::text)",
    "with_check": "((auth.jwt() ->> 'is_admin'::text) = 'true'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "appointments",
    "policyname": "app_appointments_select",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(account_id IN ( SELECT account_members.account_id\n   FROM account_members\n  WHERE ((account_members.user_id = auth.uid()) AND (account_members.status = 'accepted'::text))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "appointments",
    "policyname": "app_appointments_insert",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(account_id IN ( SELECT account_members.account_id\n   FROM account_members\n  WHERE ((account_members.user_id = auth.uid()) AND (account_members.status = 'accepted'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "appointments",
    "policyname": "app_appointments_update",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(account_id IN ( SELECT account_members.account_id\n   FROM account_members\n  WHERE ((account_members.user_id = auth.uid()) AND (account_members.status = 'accepted'::text))))",
    "with_check": "(account_id IN ( SELECT account_members.account_id\n   FROM account_members\n  WHERE ((account_members.user_id = auth.uid()) AND (account_members.status = 'accepted'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "appointments",
    "policyname": "app_appointments_delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "(account_id IN ( SELECT account_members.account_id\n   FROM account_members\n  WHERE ((account_members.user_id = auth.uid()) AND (account_members.status = 'accepted'::text))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "appointment_services",
    "policyname": "Users can view appointment services for their account",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM appointments a\n  WHERE ((a.id = appointment_services.appointment_id) AND (a.account_id = (current_setting('app.current_account_id'::text, true))::uuid))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "appointment_services",
    "policyname": "Users can insert appointment services for their account",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(EXISTS ( SELECT 1\n   FROM appointments a\n  WHERE ((a.id = appointment_services.appointment_id) AND (a.account_id = (current_setting('app.current_account_id'::text, true))::uuid))))"
  },
  {
    "schemaname": "public",
    "tablename": "appointment_services",
    "policyname": "Users can delete appointment services for their account",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "(EXISTS ( SELECT 1\n   FROM appointments a\n  WHERE ((a.id = appointment_services.appointment_id) AND (a.account_id = (current_setting('app.current_account_id'::text, true))::uuid))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "service_price_tiers",
    "policyname": "Service price tiers - member access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM services s\n  WHERE ((s.id = service_price_tiers.service_id) AND has_account_access(s.account_id))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM services s\n  WHERE ((s.id = service_price_tiers.service_id) AND has_account_access(s.account_id))))"
  },
  {
    "schemaname": "public",
    "tablename": "service_addons",
    "policyname": "Service addons - member access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM services s\n  WHERE ((s.id = service_addons.service_id) AND has_account_access(s.account_id))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM services s\n  WHERE ((s.id = service_addons.service_id) AND has_account_access(s.account_id))))"
  },
  {
    "schemaname": "public",
    "tablename": "appointment_service_addons",
    "policyname": "Appointment service addons - member access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM (appointment_services aps\n     JOIN appointments a ON ((a.id = aps.appointment_id)))\n  WHERE ((aps.id = appointment_service_addons.appointment_service_id) AND has_account_access(a.account_id))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM (appointment_services aps\n     JOIN appointments a ON ((a.id = aps.appointment_id)))\n  WHERE ((aps.id = appointment_service_addons.appointment_service_id) AND has_account_access(a.account_id))))"
  },
  {
    "schemaname": "public",
    "tablename": "consumer_pets",
    "policyname": "Consumer pets - service role full access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "consumer_pets",
    "policyname": "Consumer pets - owner read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "consumer_pets",
    "policyname": "Consumer pets - owner insert",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "consumer_pets",
    "policyname": "Consumer pets - owner update",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(user_id = auth.uid())",
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "consumer_pets",
    "policyname": "Consumer pets - owner delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notification_preferences",
    "policyname": "Notification preferences - service role full access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "notification_preferences",
    "policyname": "Notification preferences - user read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notification_preferences",
    "policyname": "Notification preferences - user write",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "notification_preferences",
    "policyname": "Notification preferences - user update",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(auth.uid() = user_id)",
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "notification_devices",
    "policyname": "Notification devices - service role full access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "notification_devices",
    "policyname": "Notification devices - user read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notification_devices",
    "policyname": "Notification devices - user write",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "notification_devices",
    "policyname": "Notification devices - user update",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(auth.uid() = user_id)",
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "notification_devices",
    "policyname": "Notification devices - user delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Notifications - service role full access",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Notifications - user read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "pet_species",
    "policyname": "Pet species - service role",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "ALL",
    "qual": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)",
    "with_check": "((auth.jwt() ->> 'role'::text) = 'service_role'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "pet_species",
    "policyname": "Pet species - members read",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((account_id IS NULL) OR has_account_access(account_id))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "pet_species",
    "policyname": "Pet species - admins update",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "((account_id IS NULL) OR has_account_access(account_id, 'admin'::text))",
    "with_check": "((account_id IS NULL) OR has_account_access(account_id, 'admin'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "pet_species",
    "policyname": "Pet species - admins delete",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "DELETE",
    "qual": "((account_id IS NULL) OR has_account_access(account_id, 'admin'::text))",
    "with_check": null
  }
]
```

---

## Notes
