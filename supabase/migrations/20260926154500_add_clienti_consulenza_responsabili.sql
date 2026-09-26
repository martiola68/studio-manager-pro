-- Responsabili del settore Consulenza per i clienti
ALTER TABLE public.tbclienti
  ADD COLUMN IF NOT EXISTS utente_consulenza_id UUID REFERENCES public.tbutenti(id),
  ADD COLUMN IF NOT EXISTS professionista_consulenza_id UUID REFERENCES public.tbutenti(id);

COMMENT ON COLUMN public.tbclienti.utente_consulenza_id
  IS 'Riferimento utente del settore consulenza (FK tbutenti)';
COMMENT ON COLUMN public.tbclienti.professionista_consulenza_id
  IS 'Riferimento professionista del settore consulenza (FK tbutenti)';
