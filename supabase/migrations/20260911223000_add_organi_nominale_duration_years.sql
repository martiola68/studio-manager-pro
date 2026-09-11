alter table public.tbclienti_organi
  add column if not exists importo_quota_nominale numeric(15,2),
  add column if not exists durata_carica_anni integer;

alter table public.tbclienti_organi
  drop constraint if exists tbclienti_organi_durata_carica_anni_check;

alter table public.tbclienti_organi
  add constraint tbclienti_organi_durata_carica_anni_check
  check (durata_carica_anni is null or durata_carica_anni > 0);
