-- STUDIO MANAGER PRO / AML PRO
-- Riconciliazione sicura di AV1 e AV4 già presenti.
-- Precondizione: per ogni campo mancante esiste UN SOLO modulo
-- con gli stessi pratica_id, studio_id e cliente_id.
-- Non crea clienti/pratiche/moduli e NON sovrascrive ID già valorizzati.
-- Ripetibile: alla seconda esecuzione non aggiorna nulla.
--
-- RACCOMANDAZIONE: eseguire un backup Supabase prima dell'esecuzione.

BEGIN;

-- Primo aggiornamento: AV1. La cardinalità viene verificata prima di collegare.
WITH av1_unici AS (
 SELECT pratica_id, studio_id, cliente_id, min(id) AS modulo_id
 FROM public."tbAV1"
 WHERE pratica_id IS NOT NULL
 GROUP BY pratica_id, studio_id, cliente_id
 HAVING count(*) = 1
)
UPDATE public."tbPraticheAML" p
SET av1_id = coalesce(p.av1_id, a.modulo_id),
    av1_corrente_id = coalesce(p.av1_corrente_id, a.modulo_id)
FROM av1_unici a
WHERE p.id = a.pratica_id
  AND p.studio_id = a.studio_id
  AND p.cliente_id = a.cliente_id
  AND (p.av1_id IS NULL OR p.av1_corrente_id IS NULL);

-- Secondo aggiornamento: AV4.
-- È un comando distinto: PostgreSQL non deve aggiornare due volte
-- la stessa riga in una singola istruzione.
WITH av4_unici AS (
 SELECT pratica_id, studio_id, cliente_id, min(id) AS modulo_id
 FROM public."tbAV4"
 WHERE pratica_id IS NOT NULL
 GROUP BY pratica_id, studio_id, cliente_id
 HAVING count(*) = 1
)
UPDATE public."tbPraticheAML" p
SET av4_id = coalesce(p.av4_id, a.modulo_id),
    av4_corrente_id = coalesce(p.av4_corrente_id, a.modulo_id)
FROM av4_unici a
WHERE p.id = a.pratica_id
  AND p.studio_id = a.studio_id
  AND p.cliente_id = a.cliente_id
  AND (p.av4_id IS NULL OR p.av4_corrente_id IS NULL);

COMMIT;

-- Verifica dopo il salvataggio: ci aspettiamo 0 nei quattro campi,
-- salvo eventuali nuovi inserimenti avvenuti nel frattempo.
SELECT
  count(*) FILTER (WHERE av1_id IS NULL) AS av1_iniziale_mancante,
  count(*) FILTER (WHERE av1_corrente_id IS NULL) AS av1_corrente_mancante,
  count(*) FILTER (WHERE av4_id IS NULL) AS av4_iniziale_mancante,
  count(*) FILTER (WHERE av4_corrente_id IS NULL) AS av4_corrente_mancante
FROM public."tbPraticheAML";
