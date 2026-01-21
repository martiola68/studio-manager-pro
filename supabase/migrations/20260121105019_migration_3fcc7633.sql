-- Aggiungi colonna allegati a tbpromemoria
ALTER TABLE tbpromemoria 
ADD COLUMN IF NOT EXISTS allegati JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN tbpromemoria.allegati IS 'Array JSON di allegati con metadati (nome, url, size, tipo, data_upload)';