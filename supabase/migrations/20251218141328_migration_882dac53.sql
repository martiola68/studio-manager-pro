-- Crea la funzione per l'aggiornamento automatico del timestamp se non esiste
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ricostruzione completa tbscadbilanci con nuova struttura
DROP TABLE IF EXISTS tbscadbilanci CASCADE;

CREATE TABLE tbscadbilanci (
  id UUID PRIMARY KEY REFERENCES tbclienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_professionista_id UUID REFERENCES tbutenti(id),
  utente_operatore_id UUID REFERENCES tbutenti(id),
  
  -- Sezione Documenti
  bilancio_def BOOLEAN DEFAULT false,
  verbale_app BOOLEAN DEFAULT false,
  relazione_gest BOOLEAN DEFAULT false,
  relazione_sindaci BOOLEAN DEFAULT false,
  relazione_revisore BOOLEAN DEFAULT false,
  
  -- Sezione Date
  data_approvazione DATE,
  data_scad_pres DATE, -- Calcolata: data_approvazione + 30
  
  -- Sezione Invio
  bil_approvato BOOLEAN DEFAULT false,
  invio_bil BOOLEAN DEFAULT false,
  data_invio DATE,
  ricevuta BOOLEAN DEFAULT false,
  
  -- Sezione Finale
  note TEXT,
  conferma_riga BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE tbscadbilanci ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono vedere e modificare
CREATE POLICY "Tutti possono gestire bilanci" ON tbscadbilanci
  FOR ALL USING (true) WITH CHECK (true);

-- Indici per performance
CREATE INDEX idx_tbscadbilanci_nominativo ON tbscadbilanci(nominativo);
CREATE INDEX idx_tbscadbilanci_utente_prof ON tbscadbilanci(utente_professionista_id);
CREATE INDEX idx_tbscadbilanci_utente_oper ON tbscadbilanci(utente_operatore_id);

-- Trigger per calcolo automatico data_scad_pres
CREATE OR REPLACE FUNCTION calcola_data_scad_pres()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.data_approvazione IS NOT NULL THEN
    NEW.data_scad_pres := NEW.data_approvazione + INTERVAL '30 days';
  ELSE
    NEW.data_scad_pres := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calcola_data_scad_pres
  BEFORE INSERT OR UPDATE OF data_approvazione ON tbscadbilanci
  FOR EACH ROW
  EXECUTE FUNCTION calcola_data_scad_pres();

-- Trigger per updated_at
CREATE TRIGGER trigger_tbscadbilanci_updated_at
  BEFORE UPDATE ON tbscadbilanci
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();