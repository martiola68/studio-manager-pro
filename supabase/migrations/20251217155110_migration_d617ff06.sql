-- TABELLA TBContatti
CREATE TABLE TBContatti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT,
  cell TEXT,
  tel TEXT,
  note TEXT,
  cassetto_fiscale BOOLEAN DEFAULT FALSE,
  utente TEXT,
  password TEXT,
  pin TEXT,
  password_iniziale TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBContatti ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all contatti" ON TBContatti FOR SELECT USING (true);
CREATE POLICY "Users can manage contatti" ON TBContatti FOR ALL USING (auth.uid() IS NOT NULL);