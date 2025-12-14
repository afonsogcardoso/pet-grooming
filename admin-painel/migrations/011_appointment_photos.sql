-- ============================================
-- MIGRATION: Appointment before/after photos
-- Description: Adds columns to store photo URLs for appointments
-- ============================================

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS before_photo_url TEXT,
    ADD COLUMN IF NOT EXISTS after_photo_url TEXT;
