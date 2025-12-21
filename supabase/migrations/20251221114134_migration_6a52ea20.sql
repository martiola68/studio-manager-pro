-- Aggiungo colonna tipo_redditi alla tabella tbscadfiscali
ALTER TABLE tbscadfiscali 
ADD COLUMN tipo_redditi TEXT CHECK (tipo_redditi IN ('SC', 'SP', 'ENC', 'PF', '730'));

COMMENT ON COLUMN tbscadfiscali.tipo_redditi IS 'Tipo di redditi: SC, SP, ENC, PF, 730';