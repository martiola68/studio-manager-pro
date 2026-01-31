-- STEP 1: Rimuovo il vecchio constraint
ALTER TABLE tbtipi_scadenze DROP CONSTRAINT IF EXISTS tbtipi_scadenze_settore_check;

-- STEP 2: Rimuovo il vecchio campo settore
ALTER TABLE tbtipi_scadenze DROP COLUMN IF EXISTS settore;

-- STEP 3: Aggiungo i 3 nuovi campi boolean (checkbox)
ALTER TABLE tbtipi_scadenze ADD COLUMN settore_fiscale boolean DEFAULT false;
ALTER TABLE tbtipi_scadenze ADD COLUMN settore_lavoro boolean DEFAULT false;
ALTER TABLE tbtipi_scadenze ADD COLUMN settore_consulenza boolean DEFAULT false;

-- STEP 4: Aggiungo commenti per documentazione
COMMENT ON COLUMN tbtipi_scadenze.settore_fiscale IS 'Checkbox: Scadenza applicabile al settore Fiscale';
COMMENT ON COLUMN tbtipi_scadenze.settore_lavoro IS 'Checkbox: Scadenza applicabile al settore Lavoro';
COMMENT ON COLUMN tbtipi_scadenze.settore_consulenza IS 'Checkbox: Scadenza applicabile al settore Consulenza';