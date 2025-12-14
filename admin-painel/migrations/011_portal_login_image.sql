-- ============================================
-- MIGRATION: Portal login image
-- Description: Adds optional image URL for tenant login pages
-- ============================================

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS portal_image_url TEXT;

UPDATE accounts
SET updated_at = timezone('utc', now())
WHERE updated_at IS NULL;
