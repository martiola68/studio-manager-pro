-- STEP 1: Ripristino campi esterometro eliminati per errore
ALTER TABLE tbclienti
  ADD COLUMN IF NOT EXISTS gestione_esterometro boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS note_esterometro text;

-- Commenti esplicativi
COMMENT ON COLUMN tbclienti.gestione_esterometro IS 'Flag per abilitare lo scadenzario Esterometro per il cliente';
COMMENT ON COLUMN tbclienti.note_esterometro IS 'Note relative allo scadenzario Esterometro';