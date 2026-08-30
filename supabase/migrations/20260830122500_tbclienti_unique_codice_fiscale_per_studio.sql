-- Studio Manager Pro - tbclienti multi-tenant uniqueness
-- Il medesimo cliente deve poter esistere in studi differenti.
-- Il codice fiscale resta univoco solo all'interno dello stesso studio.

begin;

alter table public.tbclienti
  drop constraint if exists uq_tbclienti_codice_fiscale;

drop index if exists public.uq_tbclienti_codice_fiscale;

create unique index if not exists uq_tbclienti_studio_codice_fiscale
  on public.tbclienti (studio_id, upper(trim(codice_fiscale)))
  where codice_fiscale is not null
    and trim(codice_fiscale) <> '';

commit;
