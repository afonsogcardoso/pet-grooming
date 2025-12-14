-- ============================================
-- MIGRATION: Custom domains per account
-- Description: Stores domain → slug mappings + verification metadata
-- ============================================

CREATE TABLE IF NOT EXISTS custom_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    slug TEXT NOT NULL,
    dns_record_type TEXT NOT NULL DEFAULT 'txt' CHECK (dns_record_type IN ('txt', 'cname')),
    verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
    verification_target TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disabled')),
    last_error TEXT,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE custom_domains
    ADD CONSTRAINT custom_domains_domain_lowercase CHECK (domain = lower(domain)),
    ADD CONSTRAINT custom_domains_slug_lowercase CHECK (slug = lower(slug));

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains (domain);
CREATE INDEX IF NOT EXISTS idx_custom_domains_account ON custom_domains (account_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_status ON custom_domains (status);

-- Generic helper to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_custom_domains_updated_at ON custom_domains;
CREATE TRIGGER set_custom_domains_updated_at
    BEFORE UPDATE ON custom_domains
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------
-- Row Level Security
-- --------------------------------------------
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_domains FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Custom domains - service role full access" ON custom_domains;
CREATE POLICY "Custom domains - service role full access" ON custom_domains
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Custom domains - members read" ON custom_domains;
CREATE POLICY "Custom domains - members read" ON custom_domains
    FOR SELECT USING (has_account_access(account_id));

DROP POLICY IF EXISTS "Custom domains - admins manage" ON custom_domains;
CREATE POLICY "Custom domains - admins manage" ON custom_domains
    FOR INSERT WITH CHECK (has_account_access(account_id, 'admin'));

DROP POLICY IF EXISTS "Custom domains - admins update" ON custom_domains;
CREATE POLICY "Custom domains - admins update" ON custom_domains
    FOR UPDATE USING (has_account_access(account_id, 'admin'))
    WITH CHECK (has_account_access(account_id, 'admin'));

DROP POLICY IF EXISTS "Custom domains - admins delete" ON custom_domains;
CREATE POLICY "Custom domains - admins delete" ON custom_domains
    FOR DELETE USING (has_account_access(account_id, 'admin'));
