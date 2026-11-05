-- AML: controllo costante append-only (AV7). Una sola anagrafica e pratica,
-- molti controlli nel tempo. Non modifica AV1/AV4 storici.
create table if not exists public."tbAMLControlliCostanti" (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete restrict,
  cliente_id uuid not null references public.tbclienti(id) on delete restrict,
  pratica_id uuid not null references public."tbPraticheAML"(id) on delete restrict,
  data_controllo date not null,
  esito text not null check (esito in (
    'nessuna_variazione', 'variazione_titolare_ppe', 'variazione_rischio',
    'variazione_entrambi', 'aggiornamento_dati', 'approfondimento'
  )),
  verifiche jsonb not null default '{}'::jsonb,
  fonti text not null default '',
  note text not null default '',
  adeguata_verifica text,
  prossima_scadenza date,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint aml_av7_scadenza check (
    (esito = 'nessuna_variazione' and prossima_scadenza is not null and prossima_scadenza > data_controllo)
    or (esito <> 'nessuna_variazione' and prossima_scadenza is null)
  )
);

create index if not exists idx_aml_av7_pratica_data
  on public."tbAMLControlliCostanti" (pratica_id, data_controllo desc, created_at desc);
create index if not exists idx_aml_av7_studio_cliente
  on public."tbAMLControlliCostanti" (studio_id, cliente_id);

alter table public."tbAMLControlliCostanti" enable row level security;
revoke all on public."tbAMLControlliCostanti" from anon, public;
grant select, insert on public."tbAMLControlliCostanti" to authenticated;

create policy "aml_av7_tenant_select" on public."tbAMLControlliCostanti"
for select to authenticated
using (
  studio_id = public.current_studio_id()
  and exists (
    select 1 from public."tbPraticheAML" p
    where p.id = pratica_id and p.studio_id = studio_id and p.cliente_id = cliente_id
  )
);

create policy "aml_av7_tenant_insert" on public."tbAMLControlliCostanti"
for insert to authenticated
with check (
  studio_id = public.current_studio_id()
  and created_by = auth.uid()
  and exists (
    select 1 from public."tbPraticheAML" p
    where p.id = pratica_id and p.studio_id = studio_id and p.cliente_id = cliente_id
  )
);

-- Non si concedono UPDATE/DELETE: rettifiche e controlli ulteriori
-- si documentano con nuove registrazioni, conservando lo storico.

-- Per un controllo concluso senza variazioni aggiorna la prossima scadenza
-- della stessa pratica; se emergono cambiamenti non la sposta.
create or replace function public.aml_av7_aggiorna_scadenza()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  -- L'inserimento retroattivo di un controllo storico non deve spostare
  -- la scadenza decisa da un controllo più recente.
  if new.esito = 'nessuna_variazione'
     and not exists (
       select 1
       from public."tbAMLControlliCostanti" c
       where c.pratica_id = new.pratica_id
         and c.studio_id = new.studio_id
         and c.id <> new.id
         and (c.data_controllo, c.created_at) > (new.data_controllo, new.created_at)
     ) then
    update public."tbPraticheAML"
    set data_prossimo_rinnovo = new.prossima_scadenza
    where id = new.pratica_id
      and studio_id = new.studio_id
      and cliente_id = new.cliente_id;
  end if;
  return new;
end;
$$;

drop trigger if exists aml_av7_insert_scadenza on public."tbAMLControlliCostanti";
create trigger aml_av7_insert_scadenza
after insert on public."tbAMLControlliCostanti"
for each row execute function public.aml_av7_aggiorna_scadenza();
