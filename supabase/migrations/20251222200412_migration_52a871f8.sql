-- Aggiungi campi Verifica B alla tabella tbscadantiric
ALTER TABLE tbscadantiric 
ADD COLUMN tipo_prestazione_a TEXT,
ADD COLUMN tipo_prestazione_b TEXT,
ADD COLUMN data_ultima_verifica_b DATE,
ADD COLUMN scadenza_antiric_b DATE;

-- Rinomina campi esistenti per chiarezza (manteniamo retrocompatibilità)
-- data_ultima_verifica rimane per Verifica A
-- data_scadenza rimane per Scadenza A

COMMENT ON COLUMN tbscadantiric.data_ultima_verifica IS 'Data ultima verifica A';
COMMENT ON COLUMN tbscadantiric.data_scadenza IS 'Scadenza antiriciclaggio A';
COMMENT ON COLUMN tbscadantiric.tipo_prestazione_a IS 'Tipo prestazione verifica A';
COMMENT ON COLUMN tbscadantiric.data_ultima_verifica_b IS 'Data ultima verifica B';
COMMENT ON COLUMN tbscadantiric.scadenza_antiric_b IS 'Scadenza antiriciclaggio B';
COMMENT ON COLUMN tbscadantiric.tipo_prestazione_b IS 'Tipo prestazione verifica B';