-- Modifica struttura tbscadccgg
ALTER TABLE tbscadccgg 
  DROP COLUMN IF EXISTS trim1,
  DROP COLUMN IF EXISTS trim1_data,
  DROP COLUMN IF EXISTS trim2,
  DROP COLUMN IF EXISTS trim2_data,
  DROP COLUMN IF EXISTS trim3,
  DROP COLUMN IF EXISTS trim3_data,
  DROP COLUMN IF EXISTS trim4,
  DROP COLUMN IF EXISTS trim4_data;

-- Aggiungi nuove colonne
ALTER TABLE tbscadccgg 
  ADD COLUMN IF NOT EXISTS importo_calcolato BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS f24_generato BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS f24_comunicato BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_comunicato DATE,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Assicurati che conferma_riga esista
ALTER TABLE tbscadccgg 
  ADD COLUMN IF NOT EXISTS conferma_riga BOOLEAN DEFAULT false;