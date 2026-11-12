-- Licenze AML PRO indipendenti dalla licenza SMP.
-- Non esegue aggiornamenti sulle licenze esistenti. Applicare prima del rilascio dell'app.
CREATE TABLE IF NOT EXISTS public.tbaml_licenze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.tbstudio(id) ON DELETE CASCADE,
  piano text NOT NULL CHECK (piano IN ('starter','professional','business')),
  pratiche_incluse integer CHECK (pratiche_incluse > 0 OR pratiche_incluse IS NULL),
  canone_annuale_eur numeric(10,2) NOT NULL CHECK (canone_annuale_eur IN (149,249,349)),
  stato text NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa','attivo','scaduto','sospeso','revocato')),
  data_attivazione date,
  data_scadenza date,
  stripe_checkout_session_id text UNIQUE,
  stripe_customer_id text,
  codice_licenza text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tbaml_licenze_piano_limiti CHECK (
    (piano = 'starter' AND pratiche_incluse = 50 AND canone_annuale_eur = 149)
    OR (piano = 'professional' AND pratiche_incluse = 250 AND canone_annuale_eur = 249)
    OR (piano = 'business' AND pratiche_incluse IS NULL AND canone_annuale_eur = 349)
  ),
  CONSTRAINT tbaml_licenze_date CHECK (data_attivazione IS NULL OR data_scadenza IS NULL OR data_scadenza > data_attivazione)
);
CREATE UNIQUE INDEX IF NOT EXISTS tbaml_licenze_studio_unique ON public.tbaml_licenze(studio_id);
CREATE INDEX IF NOT EXISTS tbaml_licenze_attive_idx ON public.tbaml_licenze(studio_id,stato,data_scadenza);
ALTER TABLE public.tbaml_licenze ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tbaml_licenze FROM anon;
DROP POLICY IF EXISTS tbaml_licenze_select_studio ON public.tbaml_licenze;
CREATE POLICY tbaml_licenze_select_studio ON public.tbaml_licenze FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.tbutenti u
 WHERE u.studio_id = tbaml_licenze.studio_id AND u.user_id = auth.uid() AND u.attivo = true
));
COMMENT ON TABLE public.tbaml_licenze IS 'Licenza AML indipendente da SMP; modifiche consentite solo ad API amministrative dopo pagamento verificato.';

-- Database-side enforcement: protected even when an API forgets its client guard.
-- Counts all recorded practices (open and closed). The row lock prevents concurrent
-- inserts from exceeding the purchased capacity.
CREATE OR REPLACE FUNCTION public.aml_enforce_practice_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $fn$
DECLARE
  licensed public.tbaml_licenze%ROWTYPE;
  used_count bigint;
BEGIN
  SELECT * INTO licensed FROM public.tbaml_licenze
    WHERE studio_id = NEW.studio_id
      AND stato = 'attivo'
      AND data_attivazione <= CURRENT_DATE
      AND data_scadenza >= CURRENT_DATE
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Licenza AML non attiva o scaduta per questo studio' USING ERRCODE = '42501';
  END IF;
  IF licensed.pratiche_incluse IS NOT NULL THEN
    SELECT COUNT(*) INTO used_count FROM public."tbPraticheAML" WHERE studio_id = NEW.studio_id;
    IF used_count >= licensed.pratiche_incluse THEN
      RAISE EXCEPTION 'Limite pratiche AML raggiunto per il piano %: %', licensed.piano, licensed.pratiche_incluse USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS enforce_practice_aml_license ON public."tbPraticheAML";
CREATE TRIGGER enforce_practice_aml_license BEFORE INSERT ON public."tbPraticheAML"
FOR EACH ROW EXECUTE FUNCTION public.aml_enforce_practice_license();
REVOKE ALL ON FUNCTION public.aml_enforce_practice_license() FROM PUBLIC;
