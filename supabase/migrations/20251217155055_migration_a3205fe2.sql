-- TABELLA TBStudio (RECORD UNICO)
CREATE TABLE TBStudio (
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
  attivo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBStudio ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Anyone can view studio" ON TBStudio FOR SELECT USING (true);
CREATE POLICY "Admin can manage studio" ON TBStudio FOR ALL USING (auth.uid() IS NOT NULL);

-- Vincolo: solo un record attivo
CREATE UNIQUE INDEX idx_studio_attivo ON TBStudio(attivo) WHERE attivo = TRUE;

-- Inserisci studio di default
INSERT INTO TBStudio (
  ragione_sociale, 
  denominazione_breve, 
  partita_iva, 
  codice_fiscale, 
  indirizzo, 
  cap, 
  citta, 
  provincia, 
  telefono, 
  email, 
  pec
) VALUES (
  'Studio Manager Pro S.r.l.',
  'SMP',
  '12345678901',
  '12345678901',
  'Via Roma 1',
  '00100',
  'Roma',
  'RM',
  '06 1234567',
  'info@studiomanagerpro.it',
  'pec@studiomanagerpro.it'
);