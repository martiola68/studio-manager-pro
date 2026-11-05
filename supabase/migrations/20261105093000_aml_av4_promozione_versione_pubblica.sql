-- AML: pubblicazione corretta della nuova versione AV4 completata dal cliente.
-- Nessun dato storico viene eliminato; av4_id rimane il riferimento iniziale.
-- La promozione avviene nella STESSA transazione della conferma AV4 pubblica.
CREATE OR REPLACE FUNCTION public.aml_av4_promuovi_versione_pubblica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.compilato_da_cliente IS TRUE
     AND OLD.compilato_da_cliente IS DISTINCT FROM TRUE
     AND NEW.pratica_id IS NOT NULL
     AND NEW.studio_id IS NOT NULL
     AND NEW.cliente_id IS NOT NULL
  THEN
    UPDATE public."tbPraticheAML" p
    SET av4_corrente_id = NEW.id,
        stato_ciclo = 'av4_compilato'
    WHERE p.id = NEW.pratica_id
      AND p.studio_id = NEW.studio_id
      AND p.cliente_id = NEW.cliente_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'AV4 completato ma pratica AML non collegata in modo valido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.aml_av4_promuovi_versione_pubblica() FROM PUBLIC;

DROP TRIGGER IF EXISTS aml_av4_promuovi_versione_pubblica
  ON public."tbAV4";
CREATE TRIGGER aml_av4_promuovi_versione_pubblica
AFTER UPDATE OF compilato_da_cliente ON public."tbAV4"
FOR EACH ROW
EXECUTE FUNCTION public.aml_av4_promuovi_versione_pubblica();
