-- INTERVENTO CHIRURGICO: Rimozione campi antiriciclaggio da tbclienti
-- ESATTAMENTE 14 colonne come da richiesta

ALTER TABLE tbclienti
  DROP COLUMN IF EXISTS scadenza_antiric,
  DROP COLUMN IF EXISTS data_ultima_verifica_antiric,
  DROP COLUMN IF EXISTS tipo_prestazione_a,
  DROP COLUMN IF EXISTS tipo_prestazione_b,
  DROP COLUMN IF EXISTS data_ultima_verifica_b,
  DROP COLUMN IF EXISTS scadenza_antiric_b,
  DROP COLUMN IF EXISTS rischio_ver_a,
  DROP COLUMN IF EXISTS rischio_ver_b,
  DROP COLUMN IF EXISTS gg_ver_a,
  DROP COLUMN IF EXISTS gg_ver_b,
  DROP COLUMN IF EXISTS gestione_antiriciclaggio,
  DROP COLUMN IF EXISTS note_antiriciclaggio,
  DROP COLUMN IF EXISTS giorni_scad_ver_a,
  DROP COLUMN IF EXISTS giorni_scad_ver_b;