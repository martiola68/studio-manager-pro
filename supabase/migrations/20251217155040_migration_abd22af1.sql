-- TABELLA TBROperatore (Ruoli Operatori)
CREATE TABLE TBROperatore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruolo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBROperatore ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Anyone can view roles" ON TBROperatore FOR SELECT USING (true);
CREATE POLICY "Admin can manage roles" ON TBROperatore FOR ALL USING (auth.uid() IS NOT NULL);

-- Inserisci ruoli iniziali
INSERT INTO TBROperatore (ruolo) VALUES 
  ('Commercialista'),
  ('Consulente del Lavoro'),
  ('Tributarista'),
  ('Contabile');