-- ============================================
-- MIGRATION: Customer Database
-- Description: Add customers and pets tables, update appointments
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create pets table
CREATE TABLE IF NOT EXISTS pets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT,
    age INTEGER,
    weight DECIMAL(5,2),
    medical_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Add new columns to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pets_customer_id ON pets(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id ON appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for now - adjust based on your auth)
CREATE POLICY "Enable all operations for customers" ON customers
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for pets" ON pets
    FOR ALL USING (true) WITH CHECK (true);

-- Create a view for customer summary
CREATE OR REPLACE VIEW customer_summary AS
SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    c.address,
    c.notes,
    c.created_at,
    COUNT(DISTINCT p.id) as pet_count,
    COUNT(DISTINCT a.id) as appointment_count,
    MAX(a.appointment_date) as last_appointment_date
FROM customers c
LEFT JOIN pets p ON c.id = p.customer_id
LEFT JOIN appointments a ON c.id = a.customer_id
GROUP BY c.id, c.name, c.phone, c.email, c.address, c.notes, c.created_at;

-- Grant permissions
GRANT SELECT ON customer_summary TO authenticated, anon;
