-- STEP 1: Remove DEFAULT gen_random_uuid() from tbscadimu.id
ALTER TABLE tbscadimu ALTER COLUMN id DROP DEFAULT;

-- STEP 2: Add Foreign Key constraint to tbclienti
ALTER TABLE tbscadimu
ADD CONSTRAINT tbscadimu_id_fkey 
FOREIGN KEY (id) REFERENCES tbclienti(id) ON DELETE CASCADE;