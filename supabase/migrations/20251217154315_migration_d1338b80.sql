-- Tabella Studios
CREATE TABLE IF NOT EXISTS studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ragione_sociale TEXT NOT NULL,
  denominazione_breve TEXT NOT NULL,
  partita_iva TEXT NOT NULL,
  codice_fiscale TEXT NOT NULL,
  indirizzo TEXT NOT NULL,
  cap TEXT NOT NULL,
  citta TEXT NOT NULL,
  provincia TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT NOT NULL,
  pec TEXT NOT NULL,
  sito_web TEXT,
  logo_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read
CREATE POLICY "Anyone can view studio" ON studios FOR SELECT USING (true);
-- Policy: Anyone authenticated can update
CREATE POLICY "Anyone can update studio" ON studios FOR UPDATE USING (true);
-- Policy: Anyone authenticated can insert
CREATE POLICY "Anyone can insert studio" ON studios FOR INSERT WITH CHECK (true);