-- Identificazione esteri: CF italiano obbligatorio solo per soggetti NON esteri.
-- SQL da applicare una sola volta al database Supabase condiviso.
BEGIN;
ALTER TABLE public.tbclienti ADD COLUMN IF NOT EXISTS soggetto_estero boolean NOT NULL DEFAULT false;
ALTER TABLE public.tbclienti ALTER COLUMN codice_fiscale DROP NOT NULL;
ALTER TABLE public.tbclienti DROP CONSTRAINT IF EXISTS tbclienti_codice_fiscale_non_vuoto_chk;
ALTER TABLE public.tbclienti DROP CONSTRAINT IF EXISTS tbclienti_codice_fiscale_estero_chk;
ALTER TABLE public.tbclienti
 ADD CONSTRAINT tbclienti_codice_fiscale_estero_chk
 CHECK (soggetto_estero OR (codice_fiscale IS NOT NULL AND length(btrim(codice_fiscale)) > 0));
COMMENT ON COLUMN public.tbclienti.soggetto_estero IS 'Soggetto estero, CF italiano non obbligatorio.';
COMMIT;
