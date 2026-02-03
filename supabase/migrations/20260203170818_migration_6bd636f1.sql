-- Step 1: Aggiungere studio_id alle tabelle mancanti

-- Tabella tbclienti (CRITICO)
ALTER TABLE tbclienti ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id) ON DELETE CASCADE;

-- Tabella tbcontatti
ALTER TABLE tbcontatti ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id) ON DELETE CASCADE;

-- Tabella tbprestazioni
ALTER TABLE tbprestazioni ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id) ON DELETE CASCADE;

-- Tabella tbroperatore
ALTER TABLE tbroperatore ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id) ON DELETE CASCADE;

-- Tabella tbtipopromemoria
ALTER TABLE tbtipopromemoria ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id) ON DELETE CASCADE;

-- Tabella tbcomunicazioni
ALTER TABLE tbcomunicazioni ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id) ON DELETE CASCADE;

-- Tabella tbcredenziali_accesso
ALTER TABLE tbcredenziali_accesso ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id) ON DELETE CASCADE;

-- Tabella tbreferimenti_valori
ALTER TABLE tbreferimenti_valori ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES tbstudio(id) ON DELETE CASCADE;