alter table public.tbferie_permessi_richieste
  add column if not exists tipo_permesso text,
  add column if not exists ora_richiesta time without time zone;

alter table public.tbferie_permessi_richieste
  drop constraint if exists tbferie_permessi_richieste_tipo_permesso_check;

alter table public.tbferie_permessi_richieste
  add constraint tbferie_permessi_richieste_tipo_permesso_check
  check (
    tipo_permesso is null
    or tipo_permesso = any (array['P'::text, 'PF'::text, '104'::text, 'AL'::text])
  );

comment on column public.tbferie_permessi_richieste.tipo_permesso
  is 'Tipo permesso richiesto: P, PF, 104 o AL';

comment on column public.tbferie_permessi_richieste.ora_richiesta
  is 'Ora di inizio richiesta per il permesso';
