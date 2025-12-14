-- ============================================
-- MIGRATION: Account support contact fields
-- Description: Adds optional support email/phone for portal CTAs
-- ============================================

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS support_email TEXT,
    ADD COLUMN IF NOT EXISTS support_phone TEXT;

UPDATE accounts
SET updated_at = timezone('utc', now())
WHERE updated_at IS NULL;
