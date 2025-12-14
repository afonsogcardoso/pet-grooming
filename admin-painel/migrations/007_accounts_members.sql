-- ============================================
-- MIGRATION: Accounts & Membership Tables
-- Description: Introduces accounts + account_members for multitenancy
-- Run this in your Supabase SQL Editor
-- ============================================

-- Accounts table keeps high-level tenant metadata
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- Membership table links Supabase users to accounts
CREATE TABLE IF NOT EXISTS account_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- Helpful indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_members_account_user ON account_members(account_id, user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_user ON account_members(user_id);

-- Enable RLS early so future policies can be hardened
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policies (replace with tenant-aware ones later)
DROP POLICY IF EXISTS "Allow full access to accounts (temporary)" ON accounts;
CREATE POLICY "Allow full access to accounts (temporary)" ON accounts
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to account_members (temporary)" ON account_members;
CREATE POLICY "Allow full access to account_members (temporary)" ON account_members
    FOR ALL USING (true) WITH CHECK (true);
