-- Ricostruzione completa tbscadestero con nuova struttura Esterometro
DROP TABLE IF EXISTS tbscadestero;

CREATE TABLE tbscadestero (
  id UUID PRIMARY KEY REFERENCES tbclienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_professionista_id UUID REFERENCES tbutenti(id) ON DELETE SET NULL,
  utente_operatore_id UUID REFERENCES tbutenti(id) ON DELETE SET NULL,
  
  -- Gennaio
  gen_previsto BOOLEAN DEFAULT false,
  gen_invio BOOLEAN DEFAULT false,
  nmese1 INTEGER DEFAULT 0,
  
  -- Febbraio
  feb_previsto BOOLEAN DEFAULT false,
  feb_invio BOOLEAN DEFAULT false,
  nmese2 INTEGER DEFAULT 0,
  
  -- Marzo
  mar_previsto BOOLEAN DEFAULT false,
  mar_invio BOOLEAN DEFAULT false,
  nmese3 INTEGER DEFAULT 0,
  
  -- Aprile
  apr_previsto BOOLEAN DEFAULT false,
  apr_invio BOOLEAN DEFAULT false,
  nmese4 INTEGER DEFAULT 0,
  
  -- Maggio
  mag_previsto BOOLEAN DEFAULT false,
  mag_invio BOOLEAN DEFAULT false,
  nmese5 INTEGER DEFAULT 0,
  
  -- Giugno
  giu_previsto BOOLEAN DEFAULT false,
  giu_invio BOOLEAN DEFAULT false,
  nmese6 INTEGER DEFAULT 0,
  
  -- Luglio
  lug_previsto BOOLEAN DEFAULT false,
  lug_invio BOOLEAN DEFAULT false,
  nmese7 INTEGER DEFAULT 0,
  
  -- Agosto
  ago_previsto BOOLEAN DEFAULT false,
  ago_invio BOOLEAN DEFAULT false,
  nmese8 INTEGER DEFAULT 0,
  
  -- Settembre
  set_previsto BOOLEAN DEFAULT false,
  set_invio BOOLEAN DEFAULT false,
  nmese9 INTEGER DEFAULT 0,
  
  -- Ottobre
  ott_previsto BOOLEAN DEFAULT false,
  ott_invio BOOLEAN DEFAULT false,
  nmese10 INTEGER DEFAULT 0,
  
  -- Novembre
  nov_previsto BOOLEAN DEFAULT false,
  nov_invio BOOLEAN DEFAULT false,
  nmese11 INTEGER DEFAULT 0,
  
  -- Dicembre
  dic_previsto BOOLEAN DEFAULT false,
  dic_invio BOOLEAN DEFAULT false,
  nmese12 INTEGER DEFAULT 0,
  
  -- Totale Documenti (calcolato automaticamente)
  tot_doc INTEGER GENERATED ALWAYS AS (
    COALESCE(nmese1, 0) + COALESCE(nmese2, 0) + COALESCE(nmese3, 0) + 
    COALESCE(nmese4, 0) + COALESCE(nmese5, 0) + COALESCE(nmese6, 0) + 
    COALESCE(nmese7, 0) + COALESCE(nmese8, 0) + COALESCE(nmese9, 0) + 
    COALESCE(nmese10, 0) + COALESCE(nmese11, 0) + COALESCE(nmese12, 0)
  ) STORED,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tbscadestero ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all tbscadestero records" ON tbscadestero FOR SELECT USING (true);
CREATE POLICY "Users can insert tbscadestero records" ON tbscadestero FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update tbscadestero records" ON tbscadestero FOR UPDATE USING (true);
CREATE POLICY "Users can delete tbscadestero records" ON tbscadestero FOR DELETE USING (true);

-- Create index
CREATE INDEX idx_tbscadestero_nominativo ON tbscadestero(nominativo);
CREATE INDEX idx_tbscadestero_professionista ON tbscadestero(utente_professionista_id);
CREATE INDEX idx_tbscadestero_operatore ON tbscadestero(utente_operatore_id);