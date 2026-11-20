-- Capacita SMP, solo nuovi contratti (licensing_version 2).
-- L'ampliamento da 49 €/mese aumenta INSIEME utenti (+6) e clienti attivi (+25).
-- Non modifica licenze legacy o record esistenti; il blocco vale su nuove attivazioni.
CREATE OR REPLACE FUNCTION public.smp_check_new_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $capacity$
DECLARE
  lic record;
  meta jsonb;
  is_full boolean;
  users_limit integer;
  clients_limit integer;
  quantity bigint;
  addon boolean;
BEGIN
  IF NEW.studio_id IS NULL THEN RETURN NEW; END IF;
  SELECT piano, note INTO lic FROM public.tbsoftware_licenze
    WHERE studio_id=NEW.studio_id AND stato='attivo'
    ORDER BY data_attivazione DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  BEGIN
    meta := COALESCE(NULLIF(lic.note::text,'')::jsonb,'{}'::jsonb);
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NEW; -- Old unstructured notes: never modify legacy behavior.
  END;
  IF meta->>'licensing_version' IS DISTINCT FROM '2' THEN RETURN NEW; END IF;
  is_full := lower(coalesce(lic.piano,'')) LIKE '%full%';
  IF is_full THEN RETURN NEW; END IF;
  IF lower(coalesce(lic.piano,'')) LIKE '%essential%' THEN
    users_limit := 3; clients_limit := 50;
  ELSIF lower(coalesce(lic.piano,'')) LIKE '%professional%' THEN
    users_limit := 6; clients_limit := 75;
  ELSE
    RAISE EXCEPTION 'Piano SMP sconosciuto: %', lic.piano USING ERRCODE='23514';
  END IF;
  addon := (COALESCE(meta->'addons','[]'::jsonb) @> '["capacita_6_25"]'::jsonb);
  IF addon THEN
    users_limit := users_limit + 6;
    clients_limit := clients_limit + 25;
  END IF;

  IF TG_TABLE_NAME='tbutenti' AND NEW.attivo IS TRUE THEN
    SELECT count(*) INTO quantity FROM public.tbutenti
      WHERE studio_id=NEW.studio_id AND attivo IS TRUE AND id IS DISTINCT FROM NEW.id;
    IF quantity>=users_limit THEN
      RAISE EXCEPTION 'Limite utenti del piano raggiunto (%)', users_limit USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='tbclienti' AND NEW.cliente IS TRUE AND NEW.attivo IS TRUE THEN
    SELECT count(*) INTO quantity FROM public.tbclienti
      WHERE studio_id=NEW.studio_id AND cliente IS TRUE AND attivo IS TRUE AND id IS DISTINCT FROM NEW.id;
    IF quantity>=clients_limit THEN
      RAISE EXCEPTION 'Limite clienti attivi del piano raggiunto (%)',clients_limit USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$capacity$;
DROP TRIGGER IF EXISTS smp_capacity_users ON public.tbutenti;
CREATE TRIGGER smp_capacity_users BEFORE INSERT OR UPDATE OF attivo,studio_id
ON public.tbutenti FOR EACH ROW EXECUTE FUNCTION public.smp_check_new_capacity();
DROP TRIGGER IF EXISTS smp_capacity_clients ON public.tbclienti;
CREATE TRIGGER smp_capacity_clients BEFORE INSERT OR UPDATE OF cliente,attivo,studio_id
ON public.tbclienti FOR EACH ROW EXECUTE FUNCTION public.smp_check_new_capacity();
REVOKE ALL ON FUNCTION public.smp_check_new_capacity() FROM PUBLIC;
