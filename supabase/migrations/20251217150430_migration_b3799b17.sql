-- Tabella Clienti
CREATE TABLE IF NOT EXISTS clienti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ragione_sociale TEXT NOT NULL,
  partita_iva TEXT NOT NULL,
  codice_fiscale TEXT NOT NULL,
  indirizzo TEXT NOT NULL,
  cap TEXT NOT NULL,
  citta TEXT NOT NULL,
  provincia TEXT NOT NULL,
  email TEXT NOT NULL,
  pec TEXT,
  telefono TEXT,
  note TEXT,
  attivo BOOLEAN NOT NULL DEFAULT true,
  tipo_cliente TEXT CHECK (tipo_cliente IN ('Interno', 'Esterno')),
  -- Flag servizi attivi
  flag_iva BOOLEAN DEFAULT false,
  flag_cu BOOLEAN DEFAULT false,
  flag_bilancio BOOLEAN DEFAULT false,
  flag_fiscali BOOLEAN DEFAULT false,
  flag_lipe BOOLEAN DEFAULT false,
  flag_770 BOOLEAN DEFAULT false,
  flag_esterometro BOOLEAN DEFAULT false,
  flag_ccgg BOOLEAN DEFAULT false,
  flag_proforma BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE clienti ENABLE ROW LEVEL SECURITY;

-- Policies per clienti
CREATE POLICY "Users can view all clienti" ON clienti FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert clienti" ON clienti FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update clienti" ON clienti FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete clienti" ON clienti FOR DELETE USING (auth.uid() IS NOT NULL);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_clienti_attivo ON clienti(attivo);
CREATE INDEX IF NOT EXISTS idx_clienti_ragione_sociale ON clienti(ragione_sociale);