-- Tabella Comunicazioni
CREATE TABLE IF NOT EXISTS comunicazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente UUID NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  oggetto TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  data_invio TIMESTAMP WITH TIME ZONE,
  stato TEXT NOT NULL DEFAULT 'Bozza' CHECK (stato IN ('Bozza', 'Inviata', 'Letta', 'Archiviata')),
  letto BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE comunicazioni ENABLE ROW LEVEL SECURITY;

-- Policies per comunicazioni
CREATE POLICY "Users can view all comunicazioni" ON comunicazioni FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert comunicazioni" ON comunicazioni FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update comunicazioni" ON comunicazioni FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete comunicazioni" ON comunicazioni FOR DELETE USING (auth.uid() IS NOT NULL);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_comunicazioni_cliente ON comunicazioni(id_cliente);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_stato ON comunicazioni(stato);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_letto ON comunicazioni(letto);