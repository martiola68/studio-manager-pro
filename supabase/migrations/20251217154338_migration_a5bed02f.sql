-- Tabella Contatti
CREATE TABLE IF NOT EXISTS contatti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente UUID NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  cellulare TEXT,
  ruolo TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contatti ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view contatti
CREATE POLICY "Users can view contatti" ON contatti FOR SELECT USING (auth.uid() IS NOT NULL);
-- Policy: Users can insert contatti
CREATE POLICY "Users can insert contatti" ON contatti FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Policy: Users can update contatti
CREATE POLICY "Users can update contatti" ON contatti FOR UPDATE USING (auth.uid() IS NOT NULL);
-- Policy: Users can delete contatti
CREATE POLICY "Users can delete contatti" ON contatti FOR DELETE USING (auth.uid() IS NOT NULL);