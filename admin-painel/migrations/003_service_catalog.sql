-- ============================================
-- MIGRATION: Service Catalog
-- Description: Manage grooming services dynamically
-- Run this in your Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    default_duration INTEGER DEFAULT 60 CHECK (default_duration IN (15, 30, 45, 60, 75, 90, 120)),
    price NUMERIC(10,2),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all service access" ON services
    FOR ALL USING (true) WITH CHECK (true);
