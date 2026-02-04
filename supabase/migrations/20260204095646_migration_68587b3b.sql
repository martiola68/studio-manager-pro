-- Aggiungo campo asseverazione (checkbox) con default FALSE
ALTER TABLE tbscadiva 
ADD COLUMN asseverazione BOOLEAN DEFAULT FALSE;

-- Aggiungo campo importo_credito (numerico, nullable)
ALTER TABLE tbscadiva 
ADD COLUMN importo_credito NUMERIC(12,2);

-- Commenti per documentazione
COMMENT ON COLUMN tbscadiva.asseverazione IS 'Checkbox per indicare se presente asseverazione del credito IVA';
COMMENT ON COLUMN tbscadiva.importo_credito IS 'Importo del credito IVA (attivo solo se asseverazione=true)';