-- ============================================
-- MIGRATION: Account status flag
-- Description: Adds simple active/inactive flag to accounts
-- ============================================

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE accounts
SET is_active = true
WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);
