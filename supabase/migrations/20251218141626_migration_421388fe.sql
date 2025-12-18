-- Ricostruzione completa tbscad770 con nuova struttura
DROP TABLE IF EXISTS tbscad770 CASCADE;

CREATE TABLE tbscad770 (
  id UUID PRIMARY KEY REFERENCES tbclienti(id) ON DELETE CASCADE,
  nominativo TEXT NOT NULL,
  utente_professionista_id UUID REFERENCES tbutenti(id) ON DELETE SET NULL,
  utente_operatore_id UUID REFERENCES tbutenti(id) ON DELETE SET NULL,
  
  -- Sezione Configurazione
  tipo_invio TEXT CHECK (tipo_invio IN ('Totale', 'Invio Separato')),
  modelli_770 TEXT CHECK (modelli_770 IN ('Solo aut', 'Solo cap', 'Solo Dip', 'Aut+Dip', 'Aut+Cap', 'Aut+Dip+Cap', 'Dip+Cap')),
  
  -- Sezione Modulistica
  mod_compilato BOOLEAN DEFAULT false,
  mod_definitivo BOOLEAN DEFAULT false,
  mod_inviato BOOLEAN DEFAULT false,
  data_invio DATE,
  ricevuta BOOLEAN DEFAULT false,
  
  -- Sezione Finale
  note TEXT,
  conferma_riga BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger per aggiornamento automatico updated_at
CREATE TRIGGER update_tbscad770_updated_at
  BEFORE UPDATE ON tbscad770
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Abilita RLS
ALTER TABLE tbscad770 ENABLE ROW LEVEL SECURITY;

-- Policy: tutti gli utenti autenticati possono leggere
CREATE POLICY "Users can view 770 schedules" ON tbscad770
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy: tutti gli utenti autenticati possono inserire
CREATE POLICY "Users can insert 770 schedules" ON tbscad770
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: tutti gli utenti autenticati possono aggiornare
CREATE POLICY "Users can update 770 schedules" ON tbscad770
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Policy: tutti gli utenti autenticati possono eliminare
CREATE POLICY "Users can delete 770 schedules" ON tbscad770
  FOR DELETE USING (auth.uid() IS NOT NULL);