-- ============================================
-- MIGRATION: Multi-tenant RLS policies
-- Description: Enforces row-level security by account_id for all business tables
-- Run after 008_add_account_ids.sql
-- ============================================

-- Helper functions -----------------------------------------------------------
DROP FUNCTION IF EXISTS public.account_role_weight(text);
CREATE OR REPLACE FUNCTION public.account_role_weight(role_name text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE role_name
        WHEN 'owner' THEN 3
        WHEN 'admin' THEN 2
        WHEN 'member' THEN 1
        ELSE 0
    END;
$$;

DROP FUNCTION IF EXISTS public.has_account_access(uuid, text);
CREATE OR REPLACE FUNCTION public.has_account_access(target_account uuid, min_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    min_weight int := COALESCE(account_role_weight(min_role), 0);
BEGIN
    IF target_account IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Service role bypass
    IF auth.jwt() ->> 'role' = 'service_role' THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM account_members am
        WHERE am.account_id = target_account
          AND am.user_id = auth.uid()
          AND am.status = 'accepted'
          AND account_role_weight(am.role) >= min_weight
    );
END;
$$;

-- Accounts -------------------------------------------------------------------
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to accounts (temporary)" ON accounts;

CREATE POLICY "Accounts - service role full access" ON accounts
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Accounts - members can read" ON accounts
    FOR SELECT USING (has_account_access(id));

CREATE POLICY "Accounts - admins manage" ON accounts
    FOR UPDATE USING (has_account_access(id, 'admin'))
    WITH CHECK (has_account_access(id, 'admin'));

-- Account members -----------------------------------------------------------
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to account_members (temporary)" ON account_members;

CREATE POLICY "Account members - service role full access" ON account_members
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Account members - members read" ON account_members
    FOR SELECT USING (has_account_access(account_id));

CREATE POLICY "Account members - admins manage" ON account_members
    FOR INSERT WITH CHECK (has_account_access(account_id, 'admin'));

CREATE POLICY "Account members - admins update/delete" ON account_members
    FOR UPDATE USING (has_account_access(account_id, 'admin'))
    WITH CHECK (has_account_access(account_id, 'admin'));

CREATE POLICY "Account members - admins delete" ON account_members
    FOR DELETE USING (has_account_access(account_id, 'admin'));

-- Customers ------------------------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for customers" ON customers;

CREATE POLICY "Customers - member access" ON customers
    FOR ALL USING (has_account_access(account_id))
    WITH CHECK (has_account_access(account_id));

-- Pets -----------------------------------------------------------------------
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for pets" ON pets;

CREATE POLICY "Pets - member access" ON pets
    FOR ALL USING (has_account_access(account_id))
    WITH CHECK (has_account_access(account_id));

-- Services -------------------------------------------------------------------
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all service access" ON services;

CREATE POLICY "Services - member access" ON services
    FOR ALL USING (has_account_access(account_id))
    WITH CHECK (has_account_access(account_id));

-- Appointments ----------------------------------------------------------------
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Appointments open access" ON appointments;

CREATE POLICY "Appointments - member access" ON appointments
    FOR ALL USING (has_account_access(account_id))
    WITH CHECK (has_account_access(account_id));
