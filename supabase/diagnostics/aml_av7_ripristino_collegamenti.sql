-- STUDIO MANAGER PRO / AML PRO
-- Riconciliazione sicura di AV1 e AV4 già presenti.
-- Precondizione: per ogni campo mancante esiste UN SOLO modulo
-- con gli stessi pratica_id, studio_id e cliente_id.
-- Non crea clienti/pratiche/moduli e NON sovrascrive ID già valorizzati.
-- Ripetibile: alla seconda esecuzione non aggiorna nulla.
--
-- RACCOMANDAZIONE: eseguire un backup Supabase prima dell'esecuzione.

BEGIN;

WITH av1_unici AS (
  SELECT
    a.pratica_id,
    a.studio_id,
    a.cliente_id,
    (array_agg(a.id ORDER BY a.id))[1] AS modulo_id
  FROM public."tbAV1" AS a
  WHERE a.pratica_id IS NOT NULL
  GROUP BY a.pratica_id, a.studio_id, a.cliente_id
  HAVING count(*) = 1
),
av1_aggiornati AS (
  UPDATE public."tbPraticheAML" AS p
  SET
    av1_id = coalesce(p.av1_id, a.modulo_id),
    av1_corrente_id = coalesce(p.av1_corrente_id, a.modulo_id)
  FROM av1_unici AS a
  WHERE p.id = a.pratica_id
    AND p.studio_id = a.studio_id
    AND p.cliente_id = a.cliente_id
    AND (p.av1_id IS NULL OR p.av1_corrente_id IS NULL)
  RETURNING p.id
),
av4_unici AS (
  SELECT
    a.pratica_id,
    a.studio_id,
    a.cliente_id,
    (array_agg(a.id ORDER BY a.id))[1] AS modulo_id
  FROM public."tbAV4" AS a
  WHERE a.pratica_id IS NOT NULL
  GROUP BY a.pratica_id, a.studio_id, a.cliente_id
  HAVING count(*) = 1
),
av4_aggiornati AS (
  UPDATE public."tbPraticheAML" AS p
  SET
    av4_id = coalesce(p.av4_id, a.modulo_id),
    av4_corrente_id = coalesce(p.av4_corrente_id, a.modulo_id)
  FROM av4_unici AS a
  WHERE p.id = a.pratica_id
    AND p.studio_id = a.studio_id
    AND p.cliente_id = a.cliente_id
    AND (p.av4_id IS NULL OR p.av4_corrente_id IS NULL)
  RETURNING p.id
)
SELECT
  (SELECT count(*) FROM av1_aggiornati) AS pratiche_av1_ricollegate,
  (SELECT count(*) FROM av4_aggiornati) AS pratiche_av4_ricollegate;

COMMIT;

-- Verifica dopo il salvataggio: ci aspettiamo 0 nei quattro campi,
-- salvo eventuali nuovi inserimenti avvenuti nel frattempo.
SELECT
  count(*) FILTER (WHERE av1_id IS NULL) AS av1_iniziale_mancante,
  count(*) FILTER (WHERE av1_corrente_id IS NULL) AS av1_corrente_mancante,
  count(*) FILTER (WHERE av4_id IS NULL) AS av4_iniziale_mancante,
  count(*) FILTER (WHERE av4_corrente_id IS NULL) AS av4_corrente_mancante
FROM public."tbPraticheAML";
