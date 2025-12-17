-- Aggiungo colonne mancanti alla tabella utenti
ALTER TABLE utenti 
ADD COLUMN IF NOT EXISTS nome text,
ADD COLUMN IF NOT EXISTS cognome text,
ADD COLUMN IF NOT EXISTS email text;

-- Correggo Header per usare il campo corretto