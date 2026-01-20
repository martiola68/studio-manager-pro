-- Tabella per salvare valori riutilizzabili nei riferimenti clienti
CREATE TABLE IF NOT EXISTS tbreferimenti_valori (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('matricola_inps', 'pat_inail', 'codice_ditta_ce')),
  valore TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tipo, valore)
);

-- Abilita RLS
ALTER TABLE tbreferimenti_valori ENABLE ROW LEVEL SECURITY;

-- Policy: tutti gli utenti autenticati possono leggere
CREATE POLICY "Utenti possono vedere valori riferimenti"
  ON tbreferimenti_valori FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: tutti gli utenti autenticati possono inserire
CREATE POLICY "Utenti possono inserire valori riferimenti"
  ON tbreferimenti_valori FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: tutti gli utenti autenticati possono eliminare
CREATE POLICY "Utenti possono eliminare valori riferimenti"
  ON tbreferimenti_valori FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_riferimenti_valori_tipo ON tbreferimenti_valori(tipo);
CREATE INDEX IF NOT EXISTS idx_riferimenti_valori_valore ON tbreferimenti_valori(valore);