-- ============================================
-- MIGRATION: Account branding & logo fields
-- Description: Adds columns to accounts for customizable branding
-- ============================================

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS brand_primary TEXT DEFAULT '#4fafa9',
    ADD COLUMN IF NOT EXISTS brand_primary_soft TEXT DEFAULT '#e7f8f7',
    ADD COLUMN IF NOT EXISTS brand_accent TEXT DEFAULT '#f4d58d',
    ADD COLUMN IF NOT EXISTS brand_accent_soft TEXT DEFAULT '#fdf6de',
    ADD COLUMN IF NOT EXISTS brand_background TEXT DEFAULT '#fdfcf9',
    ADD COLUMN IF NOT EXISTS brand_gradient TEXT DEFAULT 'linear-gradient(140deg, rgba(79,175,169,0.95), rgba(118,98,78,0.85))';

-- Timestamp helper
ALTER TABLE accounts
    ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

UPDATE accounts
SET updated_at = timezone('utc', now())
WHERE updated_at IS NULL;
