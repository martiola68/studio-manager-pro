alter table public.tbclienti
  add column if not exists flag_stampa_lista_clienti boolean not null default true;

comment on column public.tbclienti.flag_stampa_lista_clienti
  is 'Se true il cliente e incluso nelle stampe ordinarie Lista Clienti; se false e escluso salvo filtro esplicito.';

update public.tbclienti
set flag_stampa_lista_clienti = true
where flag_stampa_lista_clienti is null;

notify pgrst, 'reload schema';
