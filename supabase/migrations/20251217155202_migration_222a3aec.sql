-- TABELLA TBScad770
CREATE TABLE TBScad770 (
  id UUID PRIMARY KEY REFERENCES TBClienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_operatore_id UUID REFERENCES TBUtenti(id),
  utente_professionista_id UUID REFERENCES TBUtenti(id),
  conferma_riga BOOLEAN DEFAULT FALSE,
  invio BOOLEAN DEFAULT FALSE,
  invio_data DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBScad770 ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all scadenze 770" ON TBScad770 FOR SELECT USING (true);
CREATE POLICY "Users can manage scadenze 770" ON TBScad770 FOR ALL USING (auth.uid() IS NOT NULL);