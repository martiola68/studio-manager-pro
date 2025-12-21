-- 2. Creo tabella scadenzario Antiriciclaggio (corretto)
CREATE TABLE IF NOT EXISTS tbscadantiric (
  id TEXT PRIMARY KEY,
  nominativo TEXT NOT NULL,
  utente_operatore_id TEXT REFERENCES tbutenti(id),
  data_ultima_verifica TEXT,
  data_scadenza TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tbscadantiric_cliente_fk FOREIGN KEY (id) REFERENCES tbclienti(id) ON DELETE CASCADE
);

-- RLS policies per tbscadantiric
ALTER TABLE tbscadantiric ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users" ON tbscadantiric
  FOR ALL USING (auth.uid() IS NOT NULL);