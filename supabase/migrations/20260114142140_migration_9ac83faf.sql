-- FASE 3: Rimozione campi cassetto fiscale da tbcontatti
ALTER TABLE tbcontatti
DROP COLUMN IF EXISTS cassetto_fiscale, -- Era questo il nome booleano? Verifico dallo schema precedente o errori
DROP COLUMN IF EXISTS ha_cassetto_fiscale,
DROP COLUMN IF EXISTS username_cassetto,
DROP COLUMN IF EXISTS password_cassetto,
DROP COLUMN IF EXISTS pin_cassetto,
DROP COLUMN IF EXISTS password_iniziale;