-- ============================================
-- MIGRATION: Add account_id to business tables
-- Description: Adds tenant scoping to customers, pets, services, appointments
-- Run this sequentially after 007_accounts_members.sql
-- ============================================

-- Ensure there is at least one fallback account to attach legacy rows
INSERT INTO accounts (name, slug, plan)
SELECT 'Legacy Account', 'legacy', 'standard'
WHERE NOT EXISTS (
    SELECT 1 FROM accounts WHERE slug = 'legacy'
);

-- Customers
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

WITH legacy AS (SELECT id FROM accounts WHERE slug = 'legacy' LIMIT 1)
UPDATE customers
SET account_id = legacy.id
FROM legacy
WHERE customers.account_id IS NULL;

ALTER TABLE customers
    ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);

-- Pets
ALTER TABLE pets
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

UPDATE pets p
SET account_id = c.account_id
FROM customers c
WHERE p.account_id IS NULL
  AND p.customer_id = c.id;

WITH legacy AS (SELECT id FROM accounts WHERE slug = 'legacy' LIMIT 1)
UPDATE pets
SET account_id = legacy.id
FROM legacy
WHERE pets.account_id IS NULL;

ALTER TABLE pets
    ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pets_account_id ON pets(account_id);

-- Services
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

WITH legacy AS (SELECT id FROM accounts WHERE slug = 'legacy' LIMIT 1)
UPDATE services
SET account_id = legacy.id
FROM legacy
WHERE services.account_id IS NULL;

ALTER TABLE services
    ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_account_id ON services(account_id);

-- Appointments
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

UPDATE appointments a
SET account_id = c.account_id
FROM customers c
WHERE a.account_id IS NULL
  AND a.customer_id = c.id;

UPDATE appointments a
SET account_id = p.account_id
FROM pets p
WHERE a.account_id IS NULL
  AND a.pet_id = p.id;

UPDATE appointments a
SET account_id = s.account_id
FROM services s
WHERE a.account_id IS NULL
  AND a.service_id = s.id;

WITH legacy AS (SELECT id FROM accounts WHERE slug = 'legacy' LIMIT 1)
UPDATE appointments
SET account_id = legacy.id
FROM legacy
WHERE appointments.account_id IS NULL;

ALTER TABLE appointments
    ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_account_id ON appointments(account_id);
