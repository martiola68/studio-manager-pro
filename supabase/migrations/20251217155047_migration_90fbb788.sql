-- TABELLA TBPrestazioni
CREATE TABLE TBPrestazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descrizione TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBPrestazioni ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Anyone can view prestazioni" ON TBPrestazioni FOR SELECT USING (true);
CREATE POLICY "Admin can manage prestazioni" ON TBPrestazioni FOR ALL USING (auth.uid() IS NOT NULL);

-- Inserisci prestazioni iniziali
INSERT INTO TBPrestazioni (descrizione) VALUES 
  ('Assistenza totale'),
  ('Consulenza fiscale e tributaria'),
  ('Bilanci e dichiarazioni'),
  ('Consulenza del lavoro');