-- Aggiungo il campo settore alla tabella tbtipi_scadenze
ALTER TABLE tbtipi_scadenze 
ADD COLUMN settore TEXT CHECK (settore IN ('Fiscale', 'Lavoro', 'Fiscale & Lavoro'));

-- Aggiungo un commento per documentare il campo
COMMENT ON COLUMN tbtipi_scadenze.settore IS 'Settore di appartenenza della scadenza: Fiscale, Lavoro o Fiscale & Lavoro';