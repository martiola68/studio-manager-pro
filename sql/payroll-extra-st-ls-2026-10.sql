-- SMP Payroll: estensione richieste per extra ST/LS.
-- Eseguire una sola volta nel SQL Editor di Supabase.
BEGIN;
ALTER TABLE public.tbferie_permessi_richieste
  ADD COLUMN IF NOT EXISTS ora_fine_extra time without time zone;

-- Vincoli esistenti eventualmente limitati a ferie/permesso.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conrelid = 'public.tbferie_permessi_richieste'::regclass AND contype = 'c'
  LOOP
    IF r.def ILIKE '%tipo_richiesta%' AND r.def ILIKE '%ferie%' AND r.def ILIKE '%permesso%'
      AND r.def NOT ILIKE '%extra%' THEN
      EXECUTE format('ALTER TABLE public.tbferie_permessi_richieste DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;
ALTER TABLE public.tbferie_permessi_richieste
  ADD CONSTRAINT tbferie_permessi_tipo_richiesta_extra_chk
  CHECK (tipo_richiesta IN ('ferie', 'permesso', 'extra'));

-- Richieste extra con codice e orario completo, in step di 15 minuti.
ALTER TABLE public.tbferie_permessi_richieste
  ADD CONSTRAINT tbferie_permessi_extra_valid_chk CHECK (
    tipo_richiesta <> 'extra' OR (
      tipo_permesso IN ('ST', 'LS') AND ora_richiesta IS NOT NULL
      AND ora_fine_extra IS NOT NULL
      AND EXTRACT(MINUTE FROM ora_richiesta)::integer % 15 = 0
      AND EXTRACT(MINUTE FROM ora_fine_extra)::integer % 15 = 0
      AND EXTRACT(SECOND FROM ora_richiesta) = 0
      AND EXTRACT(SECOND FROM ora_fine_extra) = 0
      AND ora_richiesta <> ora_fine_extra
      AND ore > 0 AND ore < 24 AND ore * 4 = TRUNC(ore * 4)
    )
  );
CREATE INDEX IF NOT EXISTS idx_tbferie_permessi_extra_export
  ON public.tbferie_permessi_richieste (studio_id, data_inizio, utente_id, stato)
  WHERE tipo_richiesta = 'extra';
COMMIT;
