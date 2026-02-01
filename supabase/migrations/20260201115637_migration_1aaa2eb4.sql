-- FASE 1: Aggiungi colonne time separate per ora_inizio e ora_fine
ALTER TABLE tbagenda
  ADD COLUMN ora_inizio time,
  ADD COLUMN ora_fine time;

-- FASE 2: Popola le nuove colonne con gli orari esistenti convertiti a Europe/Rome
UPDATE tbagenda
SET
  ora_inizio = (data_inizio AT TIME ZONE 'Europe/Rome')::time,
  ora_fine = (data_fine AT TIME ZONE 'Europe/Rome')::time
WHERE ora_inizio IS NULL OR ora_fine IS NULL;

-- FASE 3: Aggiungi commenti per documentare
COMMENT ON COLUMN tbagenda.ora_inizio IS 'Ora di inizio evento (formato HH:MM:SS) - separata dalla data per evitare problemi di timezone';
COMMENT ON COLUMN tbagenda.ora_fine IS 'Ora di fine evento (formato HH:MM:SS) - separata dalla data per evitare problemi di timezone';