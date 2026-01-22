-- STEP 1: Drop tbscadantiric table (non più necessaria)
DROP TABLE IF EXISTS tbscadantiric CASCADE;

-- STEP 2: Add gestione_antiriciclaggio field to tbclienti
ALTER TABLE tbclienti 
ADD COLUMN IF NOT EXISTS gestione_antiriciclaggio boolean DEFAULT false;

-- STEP 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_tbclienti_gestione_antiriciclaggio 
ON tbclienti(gestione_antiriciclaggio) 
WHERE gestione_antiriciclaggio = true;