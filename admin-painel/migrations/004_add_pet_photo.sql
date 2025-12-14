-- ============================================
-- MIGRATION: Add pet photos
-- Description: store photo URLs per pet
-- ============================================

ALTER TABLE pets
ADD COLUMN IF NOT EXISTS photo_url TEXT;
