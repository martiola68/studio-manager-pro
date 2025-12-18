-- Rimuovi colonne mensili non necessarie
ALTER TABLE tbscadiva 
  DROP COLUMN IF EXISTS gennaio, DROP COLUMN IF EXISTS gennaio_data,
  DROP COLUMN IF EXISTS febbraio, DROP COLUMN IF EXISTS febbraio_data,
  DROP COLUMN IF EXISTS marzo, DROP COLUMN IF EXISTS marzo_data,
  DROP COLUMN IF EXISTS aprile, DROP COLUMN IF EXISTS aprile_data,
  DROP COLUMN IF EXISTS maggio, DROP COLUMN IF EXISTS maggio_data,
  DROP COLUMN IF EXISTS giugno, DROP COLUMN IF EXISTS giugno_data,
  DROP COLUMN IF EXISTS luglio, DROP COLUMN IF EXISTS luglio_data,
  DROP COLUMN IF EXISTS agosto, DROP COLUMN IF EXISTS agosto_data,
  DROP COLUMN IF EXISTS settembre, DROP COLUMN IF EXISTS settembre_data,
  DROP COLUMN IF EXISTS ottobre, DROP COLUMN IF EXISTS ottobre_data,
  DROP COLUMN IF EXISTS novembre, DROP COLUMN IF EXISTS novembre_data,
  DROP COLUMN IF EXISTS dicembre, DROP COLUMN IF EXISTS dicembre_data;

-- Aggiungi nuove colonne richieste
ALTER TABLE tbscadiva 
  ADD COLUMN IF NOT EXISTS mod_predisposto boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mod_definitivo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mod_inviato boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_invio date,
  ADD COLUMN IF NOT EXISTS ricevuta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS note text;