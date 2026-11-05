-- AML PRO: VERIFICA DI SOLA LETTURA DELLE MIGRAZIONI AV7
-- Non crea, modifica o elimina alcun dato.
SELECT
  to_regclass('public."tbAMLControlliCostanti"') IS NOT NULL AS tabella_av7_presente,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = to_regclass('public."tbAMLControlliCostanti"')
      AND tgname = 'aml_av7_insert_scadenza'
      AND NOT tgisinternal
  ) AS trigger_scadenza_presente,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tbAMLControlliCostanti'
      AND policyname = 'aml_av7_tenant_select'
  ) AS policy_lettura_presente,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tbAMLControlliCostanti'
      AND policyname = 'aml_av7_tenant_insert'
  ) AS policy_scrittura_presente,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = to_regclass('public."tbAV4"')
      AND tgname = 'aml_av4_promuovi_versione_pubblica'
      AND NOT tgisinternal
  ) AS trigger_av4_versione_presente;

-- Verifica che tutti gli ID iniziali e correnti dei moduli siano valorizzati.
SELECT
  count(*) FILTER (WHERE av1_id IS NULL) AS av1_iniziale_mancante,
  count(*) FILTER (WHERE av1_corrente_id IS NULL) AS av1_corrente_mancante,
  count(*) FILTER (WHERE av4_id IS NULL) AS av4_iniziale_mancante,
  count(*) FILTER (WHERE av4_corrente_id IS NULL) AS av4_corrente_mancante
FROM public."tbPraticheAML";

-- Controllo integrità dei puntatori: nessun ID corrente deve riferirsi
-- a un'altra pratica, studio o cliente.
SELECT count(*) AS collegamenti_av1_non_coerenti
FROM public."tbPraticheAML" p
LEFT JOIN public."tbAV1" a ON a.id = p.av1_corrente_id
WHERE p.av1_corrente_id IS NOT NULL
AND (a.id IS NULL OR a.pratica_id IS DISTINCT FROM p.id
     OR a.studio_id IS DISTINCT FROM p.studio_id
     OR a.cliente_id IS DISTINCT FROM p.cliente_id);

SELECT count(*) AS collegamenti_av4_non_coerenti
FROM public."tbPraticheAML" p
LEFT JOIN public."tbAV4" a ON a.id = p.av4_corrente_id
WHERE p.av4_corrente_id IS NOT NULL
AND (a.id IS NULL OR a.pratica_id IS DISTINCT FROM p.id
     OR a.studio_id IS DISTINCT FROM p.studio_id
     OR a.cliente_id IS DISTINCT FROM p.cliente_id);
