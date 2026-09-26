-- Modulo Cespiti e Ammortamenti SMP
-- Fondazione dati multi-studio / multi-cliente.

create table if not exists public.tbcespiti_categorie (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  codice text not null,
  descrizione text not null,
  natura text not null check (natura in ('materiale','immateriale')),
  aliquota_civilistica numeric(7,4) not null default 0 check (aliquota_civilistica between 0 and 100),
  aliquota_fiscale numeric(7,4) not null default 0 check (aliquota_fiscale between 0 and 100),
  durata_anni integer check (durata_anni is null or durata_anni > 0),
  percentuale_deducibilita numeric(7,4) not null default 100 check (percentuale_deducibilita between 0 and 100),
  riduzione_primo_anno_percentuale numeric(7,4) not null default 50 check (riduzione_primo_anno_percentuale between 0 and 100),
  conto_costo text,
  conto_fondo text,
  conto_plusvalenza text,
  conto_minusvalenza text,
  attiva boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, codice)
);

create table if not exists public.tbcespiti (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  categoria_id uuid not null references public.tbcespiti_categorie(id) on delete restrict,
  numero_cespite text not null,
  descrizione text not null,
  matricola text,
  ubicazione text,
  centro_costo text,
  fornitore text,
  numero_documento text,
  data_documento date,
  data_acquisto date not null,
  data_entrata_funzione date not null,
  costo_originario numeric(16,2) not null default 0 check (costo_originario >= 0),
  valore_residuo_stimato numeric(16,2) not null default 0 check (valore_residuo_stimato >= 0),
  fondo_civilistico_iniziale numeric(16,2) not null default 0 check (fondo_civilistico_iniziale >= 0),
  fondo_fiscale_iniziale numeric(16,2) not null default 0 check (fondo_fiscale_iniziale >= 0),
  aliquota_civilistica_override numeric(7,4) check (aliquota_civilistica_override is null or aliquota_civilistica_override between 0 and 100),
  aliquota_fiscale_override numeric(7,4) check (aliquota_fiscale_override is null or aliquota_fiscale_override between 0 and 100),
  percentuale_deducibilita_override numeric(7,4) check (percentuale_deducibilita_override is null or percentuale_deducibilita_override between 0 and 100),
  stato text not null default 'attivo' check (stato in ('attivo','sospeso','ceduto','dismesso')),
  data_cessione date,
  corrispettivo_cessione numeric(16,2),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, cliente_id, numero_cespite)
);

create table if not exists public.tbcespiti_movimenti (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  cespite_id uuid not null references public.tbcespiti(id) on delete cascade,
  data_movimento date not null,
  tipo text not null check (tipo in ('incremento','decremento','rivalutazione','svalutazione','cessione','dismissione')),
  importo numeric(16,2) not null default 0 check (importo >= 0),
  descrizione text,
  numero_documento text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tbcespiti_ammortamenti (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  cespite_id uuid not null references public.tbcespiti(id) on delete cascade,
  esercizio integer not null check (esercizio between 1900 and 2200),
  base_civilistica numeric(16,2) not null default 0,
  aliquota_civilistica numeric(7,4) not null default 0,
  quota_civilistica numeric(16,2) not null default 0,
  fondo_civilistico_finale numeric(16,2) not null default 0,
  residuo_civilistico numeric(16,2) not null default 0,
  base_fiscale numeric(16,2) not null default 0,
  aliquota_fiscale numeric(7,4) not null default 0,
  percentuale_deducibilita numeric(7,4) not null default 100,
  quota_fiscale_teorica numeric(16,2) not null default 0,
  quota_fiscale_deducibile numeric(16,2) not null default 0,
  quota_fiscale_indeducibile numeric(16,2) not null default 0,
  fondo_fiscale_finale numeric(16,2) not null default 0,
  residuo_fiscale numeric(16,2) not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  definitivo boolean not null default false,
  calcolato_il timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (cespite_id, esercizio)
);

create table if not exists public.tbcespiti_esercizi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  esercizio integer not null check (esercizio between 1900 and 2200),
  stato text not null default 'aperto' check (stato in ('aperto','calcolato','chiuso')),
  chiuso_il timestamptz,
  chiuso_da uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, cliente_id, esercizio)
);

create or replace function public.cespiti_verifica_coerenza_studio()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.studio_id <> public.current_studio_id() then
    raise exception 'Studio non autorizzato';
  end if;
  if tg_table_name <> 'tbcespiti_categorie' and not exists (
    select 1 from public.tbclienti c where c.id=new.cliente_id and c.studio_id=new.studio_id
  ) then raise exception 'Cliente non appartenente allo studio'; end if;
  if tg_table_name = 'tbcespiti' and not exists (
    select 1 from public.tbcespiti_categorie x where x.id=new.categoria_id and x.studio_id=new.studio_id
  ) then raise exception 'Categoria non appartenente allo studio'; end if;
  if tg_table_name in ('tbcespiti_movimenti','tbcespiti_ammortamenti') and not exists (
    select 1 from public.tbcespiti x where x.id=new.cespite_id and x.studio_id=new.studio_id and x.cliente_id=new.cliente_id
  ) then raise exception 'Cespite non coerente con studio o cliente'; end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['tbcespiti_categorie','tbcespiti','tbcespiti_movimenti','tbcespiti_ammortamenti','tbcespiti_esercizi']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I','cespiti_studio_select_'||t,t);
    execute format('create policy %I on public.%I for select to authenticated using (studio_id = public.current_studio_id())','cespiti_studio_select_'||t,t);
    execute format('drop policy if exists %I on public.%I','cespiti_studio_insert_'||t,t);
    execute format('create policy %I on public.%I for insert to authenticated with check (studio_id = public.current_studio_id())','cespiti_studio_insert_'||t,t);
    execute format('drop policy if exists %I on public.%I','cespiti_studio_update_'||t,t);
    execute format('create policy %I on public.%I for update to authenticated using (studio_id = public.current_studio_id()) with check (studio_id = public.current_studio_id())','cespiti_studio_update_'||t,t);
    execute format('drop policy if exists %I on public.%I','cespiti_studio_delete_'||t,t);
    execute format('create policy %I on public.%I for delete to authenticated using (studio_id = public.current_studio_id())','cespiti_studio_delete_'||t,t);
    execute format('drop trigger if exists %I on public.%I','trg_cespiti_coerenza_'||t,t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.cespiti_verifica_coerenza_studio()','trg_cespiti_coerenza_'||t,t);
  end loop;
end $$;

create index if not exists ix_tbcespiti_cliente on public.tbcespiti(studio_id, cliente_id);
create index if not exists ix_tbcespiti_categoria on public.tbcespiti(categoria_id);
create index if not exists ix_tbcespiti_movimenti_cespite on public.tbcespiti_movimenti(cespite_id, data_movimento);
create index if not exists ix_tbcespiti_ammortamenti_esercizio on public.tbcespiti_ammortamenti(studio_id, cliente_id, esercizio);
