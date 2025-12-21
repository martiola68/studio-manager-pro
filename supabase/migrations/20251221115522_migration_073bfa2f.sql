-- 1. Aggiungo campi alla tabella tbclienti
ALTER TABLE tbclienti 
ADD COLUMN tipo_redditi TEXT NULL,
ADD COLUMN data_ultima_verifica_antiric DATE NULL;

-- 2. Creo tabella scadenzario Antiriciclaggio
CREATE TABLE IF NOT EXISTS tbscadantiric (
  id UUID PRIMARY KEY REFERENCES tbclienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_operatore_id UUID REFERENCES tbutenti(id),
  data_ultima_verifica DATE,
  data_scadenza DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Abilito RLS sulla nuova tabella
ALTER TABLE tbscadantiric ENABLE ROW LEVEL SECURITY;

-- 4. Policy RLS per tbscadantiric
CREATE POLICY "Users can view all antiric records" ON tbscadantiric FOR SELECT USING (true);
CREATE POLICY "Users can insert antiric records" ON tbscadantiric FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update antiric records" ON tbscadantiric FOR UPDATE USING (true);
CREATE POLICY "Users can delete antiric records" ON tbscadantiric FOR DELETE USING (true);