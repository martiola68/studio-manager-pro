-- 1. Aggiungo colonna evento_generico a tbagenda
ALTER TABLE tbagenda 
ADD COLUMN IF NOT EXISTS evento_generico boolean DEFAULT false;

-- 2. Aggiungo studio_id a tbutenti e tbagenda (FK verso tbstudio)
-- Questo è CRITICO per la sicurezza e il multi-tenancy
ALTER TABLE tbutenti 
ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id);

ALTER TABLE tbagenda 
ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id);

-- 3. Aggiorno la policy per tbagenda per filtrare per studio_id (sicurezza)
DROP POLICY IF EXISTS "Users can view all eventi" ON tbagenda;
CREATE POLICY "Users can view eventi in their studio" ON tbagenda
FOR SELECT USING (
  studio_id IN (
    SELECT studio_id FROM tbutenti WHERE id = auth.uid()
  )
);