-- Rimuovo il vincolo NOT NULL dai campi che devono essere opzionali
ALTER TABLE tbclienti 
ALTER COLUMN email DROP NOT NULL,
ALTER COLUMN codice_fiscale DROP NOT NULL,
ALTER COLUMN partita_iva DROP NOT NULL;