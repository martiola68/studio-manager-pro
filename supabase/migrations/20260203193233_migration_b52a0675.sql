-- STEP 1: Aggiungere studio_id alle tabelle mancanti (se non esiste già)
ALTER TABLE tbmessaggi ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadimu ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadfiscali ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadiva ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadestero ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadcu ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscad770 ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadbilanci ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadlipe ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadccgg ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbscadproforma ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;
ALTER TABLE tbpromemoria ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES tbstudio(id) ON DELETE CASCADE;

-- STEP 2: Popolare studio_id per tutti i record esistenti (usa lo studio reale dal risultato della query precedente)
-- Sostituirò questo UUID con quello reale dopo aver visto il risultato