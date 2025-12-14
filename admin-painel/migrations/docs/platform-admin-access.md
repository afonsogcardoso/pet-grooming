# Platform Admin Access

Admin routes are now protected end-to-end. Use the checklist below to bootstrap the first `platform_admin` user and to keep the `/admin` area under control.

## 1. Environment

| Variable | Purpose |
| --- | --- |
| `ADMIN_PORTAL_ENABLED` | Kill-switch for the entire admin UI. Defaults to `true`. Set to `false` to block every `/admin` request with HTTP 503. |
| `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS` (or `PLATFORM_ADMIN_EMAILS`) | Comma separated list of emails that should be treated as admins even before the metadata flag exists. Useful for local bootstrap or break-glass access. |

Remember to expose `NEXT_PUBLIC_*` vars to the client only if you are comfortable with that data being public. For production-only bootstrap, prefer the server-side `PLATFORM_ADMIN_EMAILS`.

## 2. Flagging a user as `platform_admin`

The middleware checks the `platform_admin` flag inside `auth.users.user_metadata` or `auth.users.app_metadata`. Set it through the Supabase dashboard (Auth → Users → select the user → edit Metadata) or run a SQL snippet with the service role:

```sql
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('platform_admin', true)
where email = 'founder@example.com';
```

> ⚠️ Requires the `service_role` key or running in the Supabase SQL editor with the proper privileges.

## 3. Testing the guard

1. Ensure the target email is present in `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS` or carries the metadata flag.
2. Restart the dev server so the middleware sees the updated environment variables.
3. Access `/admin`:
   - Non admins → redirected to `/login?adminError=forbidden`.
   - Admins → gain access.
4. Toggle `ADMIN_PORTAL_ENABLED=false` to confirm that every admin request receives a 503 “Admin portal is disabled”.

With the flag + middleware in place you no longer need to touch the database manually to gate the admin experience. Keep this document close to onboard new engineers or when rotating access.
