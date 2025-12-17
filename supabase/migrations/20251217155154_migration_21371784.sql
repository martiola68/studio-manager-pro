-- TABELLA TBScadBilanci
CREATE TABLE TBScadBilanci (
  id UUID PRIMARY KEY REFERENCES TBClienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_operatore_id UUID REFERENCES TBUtenti(id),
  utente_professionista_id UUID REFERENCES TBUtenti(id),
  conferma_riga BOOLEAN DEFAULT FALSE,
  deposito BOOLEAN DEFAULT FALSE,
  deposito_data DATE,
  approvazione BOOLEAN DEFAULT FALSE,
  approvazione_data DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBScadBilanci ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all scadenze bilanci" ON TBScadBilanci FOR SELECT USING (true);
CREATE POLICY "Users can manage scadenze bilanci" ON TBScadBilanci FOR ALL USING (auth.uid() IS NOT NULL);