-- Ricostruzione completa tbscadproforma con struttura semplificata (solo invii)
DROP TABLE IF EXISTS tbscadproforma CASCADE;

CREATE TABLE tbscadproforma (
  id UUID PRIMARY KEY REFERENCES tbclienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_professionista_id UUID REFERENCES tbutenti(id) ON DELETE SET NULL,
  utente_operatore_id UUID REFERENCES tbutenti(id) ON DELETE SET NULL,
  
  -- Solo flag di invio per ogni mese (semplificato)
  gennaio BOOLEAN DEFAULT FALSE,
  febbraio BOOLEAN DEFAULT FALSE,
  marzo BOOLEAN DEFAULT FALSE,
  aprile BOOLEAN DEFAULT FALSE,
  maggio BOOLEAN DEFAULT FALSE,
  giugno BOOLEAN DEFAULT FALSE,
  luglio BOOLEAN DEFAULT FALSE,
  agosto BOOLEAN DEFAULT FALSE,
  settembre BOOLEAN DEFAULT FALSE,
  ottobre BOOLEAN DEFAULT FALSE,
  novembre BOOLEAN DEFAULT FALSE,
  dicembre BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_scadproforma_utente_prof ON tbscadproforma(utente_professionista_id);
CREATE INDEX idx_scadproforma_utente_op ON tbscadproforma(utente_operatore_id);

-- RLS Policies
ALTER TABLE tbscadproforma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti possono vedere scadenze Proforma" ON tbscadproforma FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Utenti possono inserire scadenze Proforma" ON tbscadproforma FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Utenti possono aggiornare scadenze Proforma" ON tbscadproforma FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Utenti possono eliminare scadenze Proforma" ON tbscadproforma FOR DELETE USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE tbscadproforma IS 'Scadenzario Proforma - Solo invii mensili (struttura semplificata)';