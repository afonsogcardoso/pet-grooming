-- ============================================
-- MIGRATION: Add duration field to appointments  
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add duration column (default 60 minutes)
ALTER TABLE appointments ADD COLUMN
IF NOT EXISTS duration INTEGER DEFAULT 60;

-- Add check constraint  
ALTER TABLE appointments ADD CONSTRAINT check_duration CHECK (duration IN (30, 60, 90));
