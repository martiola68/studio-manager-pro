-- FASE 1: Creazione tabella tbcassetti_fiscali corretta
CREATE TABLE IF NOT EXISTS tbcassetti_fiscali (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominativo TEXT NOT NULL,
  username TEXT,
  password1 TEXT,
  pw_attiva1 BOOLEAN DEFAULT false,
  password2 TEXT,
  pw_attiva2 BOOLEAN DEFAULT false,
  pin TEXT,
  pw_iniziale TEXT,
  note TEXT,
  studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_cassetti_fiscali_studio ON tbcassetti_fiscali(studio_id);
CREATE INDEX IF NOT EXISTS idx_cassetti_fiscali_nominativo ON tbcassetti_fiscali(nominativo);

-- RLS
ALTER TABLE tbcassetti_fiscali ENABLE ROW LEVEL SECURITY;

-- Policies (semplificate per ora, poi raffineremo)
CREATE POLICY "Gestione cassetti fiscali" ON tbcassetti_fiscali
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_cassetti_fiscali_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_cassetti_fiscali_updated_at ON tbcassetti_fiscali;
CREATE TRIGGER set_cassetti_fiscali_updated_at
  BEFORE UPDATE ON tbcassetti_fiscali
  FOR EACH ROW
  EXECUTE FUNCTION update_cassetti_fiscali_updated_at();