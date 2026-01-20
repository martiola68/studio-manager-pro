-- FASE 1B: MODIFICA TABELLA tbutenti - Aggiunta campi Settore e Responsabile
ALTER TABLE tbutenti 
ADD COLUMN IF NOT EXISTS settore TEXT CHECK (settore IN ('Fiscale', 'Lavoro', 'Fiscale & lavoro')),
ADD COLUMN IF NOT EXISTS responsabile BOOLEAN DEFAULT false;

-- Aggiungi commenti per documentazione
COMMENT ON COLUMN tbutenti.settore IS 'Settore di appartenenza: Fiscale, Lavoro, o Fiscale & lavoro';
COMMENT ON COLUMN tbutenti.responsabile IS 'Flag responsabile: può vedere promemoria del proprio gruppo';