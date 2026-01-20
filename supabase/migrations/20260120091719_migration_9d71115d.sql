-- FASE 1E: MODIFICA TABELLA tbagenda - Aggiunta campi Teams
ALTER TABLE tbagenda 
ADD COLUMN IF NOT EXISTS riunione_teams BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS link_teams TEXT;

-- Aggiungi commenti per documentazione
COMMENT ON COLUMN tbagenda.riunione_teams IS 'Flag che indica se è una riunione Teams';
COMMENT ON COLUMN tbagenda.link_teams IS 'URL collegamento riunione Teams';