-- ============================================
-- MIGRATION: Pet breeds lookup table
-- Description: Stores common breeds globally and per account
-- ============================================

CREATE TABLE IF NOT EXISTS public.pet_breeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_normalized TEXT GENERATED ALWAYS AS (lower(trim(name))) STORED,
    account_scope UUID GENERATED ALWAYS AS (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pet_breeds_account_name_idx
    ON public.pet_breeds (account_scope, name_normalized);

ALTER TABLE public.pet_breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_breeds FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pet breeds - service role" ON public.pet_breeds;
CREATE POLICY "Pet breeds - service role" ON public.pet_breeds
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Pet breeds - members read" ON public.pet_breeds;
CREATE POLICY "Pet breeds - members read" ON public.pet_breeds
    FOR SELECT USING (
        account_id IS NULL
        OR has_account_access(account_id)
    );

DROP POLICY IF EXISTS "Pet breeds - admins write" ON public.pet_breeds;
CREATE POLICY "Pet breeds - admins write" ON public.pet_breeds
    FOR INSERT
    WITH CHECK (account_id IS NULL OR has_account_access(account_id, 'admin'));

CREATE POLICY "Pet breeds - admins update/delete" ON public.pet_breeds
    FOR UPDATE USING (account_id IS NULL OR has_account_access(account_id, 'admin'))
    WITH CHECK (account_id IS NULL OR has_account_access(account_id, 'admin'));

CREATE POLICY "Pet breeds - admins delete" ON public.pet_breeds
    FOR DELETE USING (account_id IS NULL OR has_account_access(account_id, 'admin'));

-- Seed common breeds (global rows)
INSERT INTO public.pet_breeds (account_id, name)
VALUES
    (NULL, 'Sem raça definida'),
    (NULL, 'Beagle'),
    (NULL, 'Bichon Frisé'),
    (NULL, 'Boxer'),
    (NULL, 'Bulldog Francês'),
    (NULL, 'Bulldog Inglês'),
    (NULL, 'Cavalier King Charles'),
    (NULL, 'Chihuahua'),
    (NULL, 'Cocker Spaniel'),
    (NULL, 'Dachshund'),
    (NULL, 'Golden Retriever'),
    (NULL, 'Labrador Retriever'),
    (NULL, 'Lhasa Apso'),
    (NULL, 'Maltês'),
    (NULL, 'Pastor Alemão'),
    (NULL, 'Poodle Toy'),
    (NULL, 'Pomeranian (Spitz Alemão)'),
    (NULL, 'Pug'),
    (NULL, 'Rottweiler'),
    (NULL, 'Schnauzer Miniatura'),
    (NULL, 'Shih Tzu'),
    (NULL, 'Yorkshire Terrier')
ON CONFLICT DO NOTHING;
