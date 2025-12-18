-- Aggiungo colonna partecipanti alla tabella agenda
ALTER TABLE tbagenda ADD COLUMN IF NOT EXISTS partecipanti JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN tbagenda.partecipanti IS 'Array di ID utenti partecipanti all''evento (riceveranno notifica email)';