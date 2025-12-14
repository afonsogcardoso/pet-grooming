-- ============================================
-- MIGRATION: Add NIF column to customers
-- Description: Stores Portuguese tax ID (optional)
-- Run this in your Supabase SQL Editor
-- ============================================

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS nif TEXT;

-- Optional: enforce unique NIFs (uncomment if desired)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_nif ON customers(nif) WHERE nif IS NOT NULL;
