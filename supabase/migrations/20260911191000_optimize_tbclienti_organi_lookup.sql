create index if not exists idx_tbclienti_organi_cliente_id
  on public.tbclienti_organi (cliente_id);

create index if not exists idx_tbclienti_organi_soggetto_cliente_id
  on public.tbclienti_organi (soggetto_cliente_id);

create index if not exists idx_tbclienti_organi_cliente_ruolo
  on public.tbclienti_organi (cliente_id, ruolo);
