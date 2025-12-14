-- ============================================
-- MIGRATION: Link appointments to services
-- Description: Adds service_id column with FK + backfill
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add the service_id column if it does not exist
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;

-- Optional: create an index to speed up joins/filtering
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);

-- Backfill the service_id for existing rows by matching service names
UPDATE appointments a
SET service_id = s.id
FROM services s
WHERE a.service_id IS NULL
  AND a.service IS NOT NULL
  AND s.name = a.service;

-- (Optional) enforce NOT NULL manually once all records have a service linked:
-- ALTER TABLE appointments ALTER COLUMN service_id SET NOT NULL;

-- Remove obsolete denormalized columns now that relations provide this data
ALTER TABLE appointments
    DROP COLUMN IF EXISTS customer_name,
    DROP COLUMN IF EXISTS pet_name,
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS service;
