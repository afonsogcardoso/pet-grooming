-- ============================================
-- MIGRATION: Appointment payment status
-- Description: Track whether an appointment is pago ou por pagar
-- ============================================

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON appointments(payment_status);
