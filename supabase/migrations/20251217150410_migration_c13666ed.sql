-- Tabella Studio (configurazione generale dello studio)
CREATE TABLE IF NOT EXISTS studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ragione_sociale TEXT NOT NULL,
  denominazione_breve TEXT NOT NULL,
  partita_iva TEXT NOT NULL UNIQUE,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;

-- Policies per studios (tutti possono leggere, solo admin modificare)
CREATE POLICY "Anyone can view studio info" ON studios FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update studio" ON studios FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert studio" ON studios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Inserisci studio di default
INSERT INTO studios (ragione_sociale, denominazione_breve, partita_iva, codice_fiscale, indirizzo, cap, citta, provincia, telefono, email, pec)
VALUES ('Studio Manager Pro', 'SMP', '12345678901', '12345678901', 'Via Roma 1', '00100', 'Roma', 'RM', '06 1234567', 'info@studiomanagerpro.it', 'pec@studiomanagerpro.it')
ON CONFLICT (partita_iva) DO NOTHING;