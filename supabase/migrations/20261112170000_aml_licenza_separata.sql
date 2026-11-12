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
