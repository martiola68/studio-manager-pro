-- Aggiungo le due colonne separate per tracciare email e promemoria
ALTER TABLE tbtipi_scadenze_alert 
ADD COLUMN IF NOT EXISTS email_inviata boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS promemoria_inviato boolean DEFAULT false;

-- Commento per chiarezza
COMMENT ON COLUMN tbtipi_scadenze_alert.email_inviata IS 'Indica se l''email di alert è stata inviata';
COMMENT ON COLUMN tbtipi_scadenze_alert.promemoria_inviato IS 'Indica se il promemoria è stato creato';