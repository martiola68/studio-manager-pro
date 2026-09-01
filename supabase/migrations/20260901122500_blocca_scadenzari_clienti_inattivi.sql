-- Impedisce che un cliente inattivo continui a occupare gli scadenzari
-- e chiude l'aggiramento del limite anagrafiche/licenza.

-- 1) Pulizia una tantum delle configurazioni già incoerenti.
UPDATE public.tbclienti_servizi AS s
SET
  flag_iva = false,
  flag_cu = false,
  flag_bilancio = false,
  flag_fiscali = false,
  flag_lipe = false,
  flag_770 = false,
  flag_esterometro = false,
  flag_ccgg = false,
  flag_proforma = false,
  flag_imu = false,
  updated_at = now()
FROM public.tbclienti AS c
WHERE c.id = s.cliente_id
  AND c.studio_id = s.studio_id
  AND c.attivo IS NOT TRUE
  AND (
    s.flag_iva IS TRUE OR
    s.flag_cu IS TRUE OR
    s.flag_bilancio IS TRUE OR
    s.flag_fiscali IS TRUE OR
    s.flag_lipe IS TRUE OR
    s.flag_770 IS TRUE OR
    s.flag_esterometro IS TRUE OR
    s.flag_ccgg IS TRUE OR
    s.flag_proforma IS TRUE OR
    s.flag_imu IS TRUE
  );

-- 2) Quando un cliente passa da attivo a inattivo, rimuovilo
-- automaticamente da tutti gli scadenzari.
CREATE OR REPLACE FUNCTION public.rimuovi_cliente_inattivo_da_scadenzari()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.attivo IS TRUE AND NEW.attivo IS NOT TRUE THEN
    UPDATE public.tbclienti_servizi
    SET
      flag_iva = false,
      flag_cu = false,
      flag_bilancio = false,
      flag_fiscali = false,
      flag_lipe = false,
      flag_770 = false,
      flag_esterometro = false,
      flag_ccgg = false,
      flag_proforma = false,
      flag_imu = false,
      updated_at = now()
    WHERE cliente_id = NEW.id
      AND studio_id = NEW.studio_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rimuovi_cliente_inattivo_da_scadenzari
ON public.tbclienti;

CREATE TRIGGER trg_rimuovi_cliente_inattivo_da_scadenzari
AFTER UPDATE OF attivo ON public.tbclienti
FOR EACH ROW
WHEN (OLD.attivo IS DISTINCT FROM NEW.attivo)
EXECUTE FUNCTION public.rimuovi_cliente_inattivo_da_scadenzari();

-- 3) Seconda barriera: anche tramite scritture dirette/API un cliente
-- inattivo non può essere reinserito manualmente in uno scadenzario.
CREATE OR REPLACE FUNCTION public.blocca_scadenzari_per_cliente_inattivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attivo boolean;
BEGIN
  IF NOT (
    NEW.flag_iva IS TRUE OR
    NEW.flag_cu IS TRUE OR
    NEW.flag_bilancio IS TRUE OR
    NEW.flag_fiscali IS TRUE OR
    NEW.flag_lipe IS TRUE OR
    NEW.flag_770 IS TRUE OR
    NEW.flag_esterometro IS TRUE OR
    NEW.flag_ccgg IS TRUE OR
    NEW.flag_proforma IS TRUE OR
    NEW.flag_imu IS TRUE
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.attivo
    INTO v_attivo
  FROM public.tbclienti AS c
  WHERE c.id = NEW.cliente_id
    AND c.studio_id = NEW.studio_id;

  IF v_attivo IS NOT TRUE THEN
    RAISE EXCEPTION 'Cliente inattivo: impossibile attivare scadenzari.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blocca_scadenzari_cliente_inattivo
ON public.tbclienti_servizi;

CREATE TRIGGER trg_blocca_scadenzari_cliente_inattivo
BEFORE INSERT OR UPDATE OF
  flag_iva,
  flag_cu,
  flag_bilancio,
  flag_fiscali,
  flag_lipe,
  flag_770,
  flag_esterometro,
  flag_ccgg,
  flag_proforma,
  flag_imu
ON public.tbclienti_servizi
FOR EACH ROW
EXECUTE FUNCTION public.blocca_scadenzari_per_cliente_inattivo();

REVOKE ALL ON FUNCTION public.rimuovi_cliente_inattivo_da_scadenzari() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.blocca_scadenzari_per_cliente_inattivo() FROM PUBLIC;
