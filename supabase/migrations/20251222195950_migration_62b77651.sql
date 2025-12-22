-- Aggiungi nuovi campi alla tabella tbclienti per Antiriciclaggio A e B
ALTER TABLE tbclienti 
ADD COLUMN IF NOT EXISTS tipo_prestazione_a TEXT,
ADD COLUMN IF NOT EXISTS tipo_prestazione_b TEXT,
ADD COLUMN IF NOT EXISTS data_ultima_verifica_b DATE,
ADD COLUMN IF NOT EXISTS scadenza_antiric_b DATE;

-- Commenti per documentazione
COMMENT ON COLUMN tbclienti.tipo_prestazione_a IS 'Tipo prestazione antiriciclaggio A: Assistenza e consulenza societaria continuativa e generica, Consulenza del Lavoro, Altre attività';
COMMENT ON COLUMN tbclienti.tipo_prestazione_b IS 'Tipo prestazione antiriciclaggio B: Assistenza e consulenza societaria continuativa e generica, Consulenza del Lavoro, Altre attività';
COMMENT ON COLUMN tbclienti.data_ultima_verifica_b IS 'Data ultima verifica antiriciclaggio B';
COMMENT ON COLUMN tbclienti.scadenza_antiric_b IS 'Data scadenza antiriciclaggio B';