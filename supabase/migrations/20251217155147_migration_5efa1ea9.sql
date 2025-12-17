-- TABELLA TBScadFiscali
CREATE TABLE TBScadFiscali (
  id UUID PRIMARY KEY REFERENCES TBClienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_operatore_id UUID REFERENCES TBUtenti(id),
  utente_professionista_id UUID REFERENCES TBUtenti(id),
  conferma_riga BOOLEAN DEFAULT FALSE,
  ricevuta_r BOOLEAN DEFAULT FALSE,
  acconto1 BOOLEAN DEFAULT FALSE,
  acconto1_data DATE,
  acconto2 BOOLEAN DEFAULT FALSE,
  acconto2_data DATE,
  saldo BOOLEAN DEFAULT FALSE,
  saldo_data DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE TBScadFiscali ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Users can view all scadenze fiscali" ON TBScadFiscali FOR SELECT USING (true);
CREATE POLICY "Users can manage scadenze fiscali" ON TBScadFiscali FOR ALL USING (auth.uid() IS NOT NULL);