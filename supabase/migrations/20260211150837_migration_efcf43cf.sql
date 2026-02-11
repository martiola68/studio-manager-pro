-- STEP 5: Applicare vincolo NOT NULL al campo studio_id
-- Questo impedisce futuri inserimenti/update con studio_id NULL
ALTER TABLE tbclienti 
ALTER COLUMN studio_id SET NOT NULL;