-- FASE 2: Aggiornamento tbclienti
ALTER TABLE tbclienti
ADD COLUMN IF NOT EXISTS cassetto_fiscale_id UUID REFERENCES tbcassetti_fiscali(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS percorso_bilanci TEXT,
ADD COLUMN IF NOT EXISTS percorso_fiscali TEXT,
ADD COLUMN IF NOT EXISTS percorso_generale TEXT;

CREATE INDEX IF NOT EXISTS idx_clienti_cassetto_fiscale ON tbclienti(cassetto_fiscale_id);