-- Disattivazione clienti: non obbligare a riassegnare un operatore.
-- Conserva i responsabili esistenti e considera anche il settore consulenza.
-- Non cancella né modifica i dati delle anagrafiche.
ALTER TABLE public.tbclienti
  DROP CONSTRAINT IF EXISTS tbclienti_almeno_un_utente_responsabile_check;

ALTER TABLE public.tbclienti
  ADD CONSTRAINT tbclienti_almeno_un_utente_responsabile_check
  CHECK (
    cliente IS FALSE
    OR attivo IS NOT TRUE
    OR utente_operatore_id IS NOT NULL
    OR utente_payroll_id IS NOT NULL
    OR utente_consulenza_id IS NOT NULL
  ) NOT VALID;
