-- Update settore constraint to include "Fiscale & Lavoro"
ALTER TABLE tbclienti DROP CONSTRAINT IF EXISTS tbclienti_settore_check;
ALTER TABLE tbclienti ADD CONSTRAINT tbclienti_settore_check 
CHECK (settore IN ('Fiscale', 'Lavoro', 'Fiscale & Lavoro'));