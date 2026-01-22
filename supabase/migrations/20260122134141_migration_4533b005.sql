-- Aggiungi colonne per i giorni mancanti alle scadenze
ALTER TABLE tbclienti 
ADD COLUMN IF NOT EXISTS giorni_scad_ver_a INTEGER;

ALTER TABLE tbclienti 
ADD COLUMN IF NOT EXISTS giorni_scad_ver_b INTEGER;

-- Aggiungi commenti
COMMENT ON COLUMN tbclienti.giorni_scad_ver_a IS 'Giorni mancanti alla scadenza verifica A (calcolato automaticamente)';
COMMENT ON COLUMN tbclienti.giorni_scad_ver_b IS 'Giorni mancanti alla scadenza verifica B (calcolato automaticamente)';

-- Popola i valori iniziali per i clienti esistenti
UPDATE tbclienti
SET 
  giorni_scad_ver_a = CASE 
    WHEN scadenza_antiric IS NOT NULL THEN (scadenza_antiric::date - CURRENT_DATE)
    ELSE NULL 
  END,
  giorni_scad_ver_b = CASE 
    WHEN scadenza_antiric_b IS NOT NULL THEN (scadenza_antiric_b::date - CURRENT_DATE)
    ELSE NULL 
  END
WHERE gestione_antiriciclaggio = true;