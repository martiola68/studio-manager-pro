-- FASE 1D (CORRETTA): MODIFICA TABELLA tbpromemoria
DO $$ 
BEGIN
  -- 1. Rimuovi il check constraint esistente su working_progress
  ALTER TABLE tbpromemoria DROP CONSTRAINT IF EXISTS tbpromemoria_working_progress_check;
  
  -- 2. Aggiungi il nuovo constraint con i nuovi valori
  ALTER TABLE tbpromemoria 
  ADD CONSTRAINT tbpromemoria_working_progress_check 
  CHECK (working_progress IN ('Aperto', 'In lavorazione', 'Completato', 'Annullato', 'Presa visione', 'Richiesta confronto'));

  -- 3. Aggiungi le colonne mancanti (se non esistono già)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbpromemoria' AND column_name = 'destinatario_id') THEN
    ALTER TABLE tbpromemoria ADD COLUMN destinatario_id UUID REFERENCES tbutenti(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tbpromemoria' AND column_name = 'settore') THEN
    ALTER TABLE tbpromemoria ADD COLUMN settore TEXT;
  END IF;
END $$;

-- Aggiungi commenti
COMMENT ON COLUMN tbpromemoria.destinatario_id IS 'Destinatario del promemoria (FK tbutenti)';
COMMENT ON COLUMN tbpromemoria.settore IS 'Settore di competenza';