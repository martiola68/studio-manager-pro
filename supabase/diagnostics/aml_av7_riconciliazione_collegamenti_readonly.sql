-- AML: diagnosi SOLO LETTURA dei collegamenti iniziali/correnti.
-- Conta i moduli associati alla medesima pratica, studio e cliente.
WITH pratiche AS (
  SELECT
    p.id,
    p.studio_id,
    p.cliente_id,
    p.av1_id,
    p.av1_corrente_id,
    p.av4_id,
    p.av4_corrente_id,
    (SELECT count(*) FROM public."tbAV1" a
      WHERE a.pratica_id = p.id
        AND a.studio_id = p.studio_id
        AND a.cliente_id = p.cliente_id) AS candidati_av1,
    (SELECT count(*) FROM public."tbAV4" a
      WHERE a.pratica_id = p.id
        AND a.studio_id = p.studio_id
        AND a.cliente_id = p.cliente_id) AS candidati_av4
  FROM public."tbPraticheAML" p
),
mancanti AS (
  SELECT 'AV1 iniziale' AS collegamento, candidati_av1 AS candidati
    FROM pratiche WHERE av1_id IS NULL
  UNION ALL
  SELECT 'AV1 corrente', candidati_av1 FROM pratiche WHERE av1_corrente_id IS NULL
  UNION ALL
  SELECT 'AV4 iniziale', candidati_av4 FROM pratiche WHERE av4_id IS NULL
  UNION ALL
  SELECT 'AV4 corrente', candidati_av4 FROM pratiche WHERE av4_corrente_id IS NULL
)
SELECT
  collegamento,
  count(*) AS riferimenti_mancanti,
  count(*) FILTER (WHERE candidati = 0) AS senza_modulo_collegato,
  count(*) FILTER (WHERE candidati = 1) AS un_solo_modulo,
  count(*) FILTER (WHERE candidati > 1) AS piu_moduli_da_verificare
FROM mancanti
GROUP BY collegamento
ORDER BY collegamento;
