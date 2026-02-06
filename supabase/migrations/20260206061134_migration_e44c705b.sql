-- Aggiungi colonne encryption a tbstudio
ALTER TABLE tbstudio 
ADD COLUMN IF NOT EXISTS encryption_salt TEXT,
ADD COLUMN IF NOT EXISTS encryption_enabled BOOLEAN DEFAULT false;

-- Aggiungi commento per documentazione
COMMENT ON COLUMN tbstudio.encryption_salt IS 'Salt per derivare chiave encryption password cassetti fiscali (master password)';
COMMENT ON COLUMN tbstudio.encryption_enabled IS 'Flag che indica se encryption cassetti fiscali è attiva';