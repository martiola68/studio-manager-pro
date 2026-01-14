-- FASE 1.3: Rimozione campi cassetto fiscale da tbcontatti
ALTER TABLE tbcontatti
DROP COLUMN IF EXISTS ha_cassetto_fiscale,
DROP COLUMN IF EXISTS username_cassetto,
DROP COLUMN IF EXISTS password_cassetto,
DROP COLUMN IF EXISTS pin_cassetto,
DROP COLUMN IF EXISTS password_iniziale;