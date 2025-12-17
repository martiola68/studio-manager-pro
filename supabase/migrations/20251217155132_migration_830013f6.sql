-- TABELLA TBScadCCGG
CREATE TABLE TBScadCCGG (
  id UUID PRIMARY KEY REFERENCES TBClienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_operatore_id UUID REFERENCES TBUtenti(id),
  utente_professionista_id UUID REFERENCES TBUtenti(id),
  conferma_riga BOOLEAN DEFAULT FALSE,
  trim1 BOOLEAN DEFAULT FALSE,
  trim1_data DATE,
  trim2 BOOLEAN DEFAULT FALSE,
  trim2_data DATE,
  trim3 BOOLEAN DEFAULT FALSE,
  trim3_data DATE,
  trim4 BOOLEAN DEFAULT FALSE,
  trim4_data DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBScadCCGG ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all scadenze ccgg" ON TBScadCCGG FOR SELECT USING (true);
CREATE POLICY "Users can manage scadenze ccgg" ON TBScadCCGG FOR ALL USING (auth.uid() IS NOT NULL);