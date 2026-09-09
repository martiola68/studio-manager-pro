alter table if exists public.tbpresenze_smart_gruppi
  add column if not exists scelta_libera boolean not null default false;

alter table if exists public.tbpresenze_smart_gruppi_utenti
  add column if not exists giorni_presenza smallint[];

alter table if exists public.tbpresenze_smart_gruppi_utenti
  drop constraint if exists tbpresenze_smart_gruppi_utenti_giorni_presenza_check;

alter table if exists public.tbpresenze_smart_gruppi_utenti
  add constraint tbpresenze_smart_gruppi_utenti_giorni_presenza_check
  check (
    giorni_presenza is null
    or (
      giorni_presenza <@ array[1,2,3,4,5]::smallint[]
      and cardinality(giorni_presenza) between 0 and 5
    )
  );
