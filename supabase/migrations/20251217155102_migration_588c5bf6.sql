-- TABELLA TBUtenti
CREATE TABLE TBUtenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  tipo_utente TEXT NOT NULL CHECK (tipo_utente IN ('Admin', 'User')),
  ruolo_operatore_id UUID REFERENCES TBROperatore(id),
  attivo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBUtenti ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all utenti" ON TBUtenti FOR SELECT USING (true);
CREATE POLICY "Admin can manage utenti" ON TBUtenti FOR ALL USING (auth.uid() IS NOT NULL);