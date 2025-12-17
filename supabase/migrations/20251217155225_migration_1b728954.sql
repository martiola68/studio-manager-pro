-- TABELLA TBScadProforma
CREATE TABLE TBScadProforma (
  id UUID PRIMARY KEY REFERENCES TBClienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_operatore_id UUID REFERENCES TBUtenti(id),
  utente_professionista_id UUID REFERENCES TBUtenti(id),
  gennaio BOOLEAN DEFAULT FALSE,
  gennaio_data DATE,
  febbraio BOOLEAN DEFAULT FALSE,
  febbraio_data DATE,
  marzo BOOLEAN DEFAULT FALSE,
  marzo_data DATE,
  aprile BOOLEAN DEFAULT FALSE,
  aprile_data DATE,
  maggio BOOLEAN DEFAULT FALSE,
  maggio_data DATE,
  giugno BOOLEAN DEFAULT FALSE,
  giugno_data DATE,
  luglio BOOLEAN DEFAULT FALSE,
  luglio_data DATE,
  agosto BOOLEAN DEFAULT FALSE,
  agosto_data DATE,
  settembre BOOLEAN DEFAULT FALSE,
  settembre_data DATE,
  ottobre BOOLEAN DEFAULT FALSE,
  ottobre_data DATE,
  novembre BOOLEAN DEFAULT FALSE,
  novembre_data DATE,
  dicembre BOOLEAN DEFAULT FALSE,
  dicembre_data DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBScadProforma ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all scadenze proforma" ON TBScadProforma FOR SELECT USING (true);
CREATE POLICY "Users can manage scadenze proforma" ON TBScadProforma FOR ALL USING (auth.uid() IS NOT NULL);