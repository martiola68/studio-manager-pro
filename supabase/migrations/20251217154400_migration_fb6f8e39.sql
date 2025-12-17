-- Tabella Comunicazioni
CREATE TABLE IF NOT EXISTS comunicazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente UUID NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  oggetto TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  data_invio TIMESTAMPTZ,
  stato TEXT NOT NULL CHECK (stato IN ('Bozza', 'Inviata', 'Letta', 'Archiviata')),
  letto BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE comunicazioni ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view comunicazioni
CREATE POLICY "Users can view comunicazioni" ON comunicazioni FOR SELECT USING (auth.uid() IS NOT NULL);
-- Policy: Users can insert comunicazioni
CREATE POLICY "Users can insert comunicazioni" ON comunicazioni FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Policy: Users can update comunicazioni
CREATE POLICY "Users can update comunicazioni" ON comunicazioni FOR UPDATE USING (auth.uid() IS NOT NULL);
-- Policy: Users can delete comunicazioni
CREATE POLICY "Users can delete comunicazioni" ON comunicazioni FOR DELETE USING (auth.uid() IS NOT NULL);