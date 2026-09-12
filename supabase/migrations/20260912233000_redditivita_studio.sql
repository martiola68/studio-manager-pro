-- Redditivita Studio
-- Costi, operatori, attivita, servizi cliente, ripartizione carichi,
-- compensi, contratti e scadenze di incasso.
-- Versione verificata contro lo schema reale SMP.

-- Helper multi-studio: compatibile sia con tbutenti.user_id sia con tbutenti.id.
create or replace function public.current_studio_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.studio_id
  from public.tbutenti u
  where u.studio_id is not null
    and (
      u.user_id = auth.uid()
      or u.id = auth.uid()
      or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by case
    when u.user_id = auth.uid() then 0
    when u.id = auth.uid() then 1
    else 2
  end
  limit 1;
$$;

revoke all on function public.current_studio_id() from public;
grant execute on function public.current_studio_id() to authenticated, service_role;

create table if not exists public.tbcdg_studio_parametri (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  esercizio integer not null,
  costo_personale numeric(14,2) not null default 0,
  costo_affitto numeric(14,2) not null default 0,
  costo_software numeric(14,2) not null default 0,
  costo_assicurazioni numeric(14,2) not null default 0,
  costo_utenze numeric(14,2) not null default 0,
  altri_costi_generali numeric(14,2) not null default 0,
  ore_produttive_studio numeric(14,2) not null default 0,
  margine_obiettivo_percentuale numeric(7,4) not null default 30,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tbcdg_studio_parametri unique (studio_id, esercizio),
  constraint ck_tbcdg_studio_parametri_esercizio check (esercizio between 2000 and 2100),
  constraint ck_tbcdg_studio_parametri_ore check (ore_produttive_studio >= 0),
  constraint ck_tbcdg_studio_parametri_margine check (margine_obiettivo_percentuale >= 0 and margine_obiettivo_percentuale < 100)
);

create table if not exists public.tbcdg_operatori_costi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  esercizio integer not null,
  operatore_id uuid not null references public.tbutenti(id) on delete restrict,
  costo_annuo numeric(14,2) not null default 0,
  ore_teoriche numeric(14,2) not null default 0,
  ore_non_produttive numeric(14,2) not null default 0,
  ore_produttive numeric(14,2) not null default 0,
  costo_orario_diretto numeric(14,4) not null default 0,
  quota_costi_generali numeric(14,2) not null default 0,
  costo_orario_pieno numeric(14,4) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tbcdg_operatori_costi unique (studio_id, esercizio, operatore_id),
  constraint ck_tbcdg_operatori_esercizio check (esercizio between 2000 and 2100),
  constraint ck_tbcdg_operatori_costi_nonneg check (costo_annuo >= 0 and quota_costi_generali >= 0 and costo_orario_diretto >= 0 and costo_orario_pieno >= 0),
  constraint ck_tbcdg_operatori_ore check (ore_teoriche >= 0 and ore_non_produttive >= 0 and ore_produttive >= 0)
);

create table if not exists public.tbcdg_attivita_catalogo (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  codice text not null,
  area text not null,
  descrizione text not null,
  driver text not null,
  unita_misura text not null default 'n.',
  tempo_standard_minuti numeric(12,4) not null default 0,
  coefficiente_base numeric(8,4) not null default 1,
  attiva boolean not null default true,
  ordinamento integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tbcdg_attivita_catalogo unique (studio_id, codice),
  constraint ck_tbcdg_attivita_tempo check (tempo_standard_minuti >= 0),
  constraint ck_tbcdg_attivita_coeff check (coefficiente_base > 0)
);

create table if not exists public.tbcdg_cliente_servizi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  esercizio integer not null,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  attivita_id uuid not null references public.tbcdg_attivita_catalogo(id) on delete restrict,
  attivo boolean not null default true,
  quantita_driver numeric(18,4) not null default 0,
  coefficiente_complessita numeric(8,4) not null default 1,
  ore_equivalenti numeric(14,4) not null default 0,
  costo_stimato numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tbcdg_cliente_servizi unique (studio_id, esercizio, cliente_id, attivita_id),
  constraint ck_tbcdg_cliente_servizi_esercizio check (esercizio between 2000 and 2100),
  constraint ck_tbcdg_cliente_servizi_quantita check (quantita_driver >= 0),
  constraint ck_tbcdg_cliente_servizi_complessita check (coefficiente_complessita > 0),
  constraint ck_tbcdg_cliente_servizi_ore check (ore_equivalenti >= 0),
  constraint ck_tbcdg_cliente_servizi_costo check (costo_stimato >= 0)
);

create table if not exists public.tbcdg_cliente_attivita_operatori (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  esercizio integer not null,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  cliente_servizio_id uuid not null references public.tbcdg_cliente_servizi(id) on delete cascade,
  operatore_id uuid not null references public.tbutenti(id) on delete restrict,
  percentuale_ripartizione_attivita numeric(7,4) not null default 0,
  numero_operazioni_attribuite numeric(18,4) not null default 0,
  ore_attribuite numeric(14,4) not null default 0,
  costo_attribuito numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tbcdg_cliente_attivita_operatori unique (cliente_servizio_id, operatore_id),
  constraint ck_tbcdg_attivita_operatori_esercizio check (esercizio between 2000 and 2100),
  constraint ck_tbcdg_ripartizione_percentuale check (percentuale_ripartizione_attivita >= 0 and percentuale_ripartizione_attivita <= 100),
  constraint ck_tbcdg_operazioni_attribuite check (numero_operazioni_attribuite >= 0),
  constraint ck_tbcdg_ore_attribuite check (ore_attribuite >= 0),
  constraint ck_tbcdg_costo_attribuito check (costo_attribuito >= 0)
);

create table if not exists public.tbcdg_calcoli_compenso (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  esercizio integer not null,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  versione integer not null default 1,
  ore_equivalenti_totali numeric(14,4) not null default 0,
  costo_diretto numeric(14,2) not null default 0,
  costo_pieno numeric(14,2) not null default 0,
  margine_obiettivo_percentuale numeric(7,4) not null default 0,
  compenso_minimo numeric(14,2) not null default 0,
  compenso_obiettivo numeric(14,2) not null default 0,
  compenso_attuale numeric(14,2) not null default 0,
  scostamento_importo numeric(14,2) not null default 0,
  scostamento_percentuale numeric(9,4) not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  calcolato_il timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint uq_tbcdg_calcoli_compenso unique (studio_id, esercizio, cliente_id, versione),
  constraint ck_tbcdg_calcoli_esercizio check (esercizio between 2000 and 2100),
  constraint ck_tbcdg_calcoli_versione check (versione > 0),
  constraint ck_tbcdg_calcoli_margine check (margine_obiettivo_percentuale >= 0 and margine_obiettivo_percentuale < 100)
);

create table if not exists public.tbcdg_contratti_clienti (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  esercizio integer not null,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  calcolo_compenso_id uuid references public.tbcdg_calcoli_compenso(id) on delete set null,
  tipo_contratto text not null default 'forfettario',
  data_decorrenza date,
  data_scadenza date,
  totale_annuo numeric(14,2) not null default 0,
  periodicita text not null default 'mensile',
  giorno_scadenza integer,
  stato text not null default 'bozza',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_tbcdg_contratto_esercizio check (esercizio between 2000 and 2100),
  constraint ck_tbcdg_contratto_tipo check (tipo_contratto in ('forfettario','analitico','misto','ore')),
  constraint ck_tbcdg_contratto_periodicita check (periodicita in ('mensile','bimestrale','trimestrale','semestrale','annuale','personalizzata')),
  constraint ck_tbcdg_contratto_giorno check (giorno_scadenza is null or giorno_scadenza between 1 and 31),
  constraint ck_tbcdg_contratto_totale check (totale_annuo >= 0),
  constraint ck_tbcdg_contratto_stato check (stato in ('bozza','attivo','cessato','archiviato'))
);

create table if not exists public.tbcdg_contratti_voci (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  contratto_id uuid not null references public.tbcdg_contratti_clienti(id) on delete cascade,
  attivita_id uuid references public.tbcdg_attivita_catalogo(id) on delete set null,
  descrizione text not null,
  quantita numeric(14,4) not null default 1,
  prezzo_unitario numeric(14,2) not null default 0,
  importo_annuo numeric(14,2) not null default 0,
  incluso_nel_forfait boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  constraint ck_tbcdg_contratti_voci_quantita check (quantita >= 0),
  constraint ck_tbcdg_contratti_voci_importi check (prezzo_unitario >= 0 and importo_annuo >= 0)
);

create table if not exists public.tbcdg_contratti_scadenze (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  contratto_id uuid not null references public.tbcdg_contratti_clienti(id) on delete cascade,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  numero_rata integer not null,
  data_scadenza date not null,
  importo numeric(14,2) not null default 0,
  stato text not null default 'previsto',
  data_fatturazione date,
  data_incasso date,
  importo_incassato numeric(14,2) not null default 0,
  riferimento_fattura text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tbcdg_contratti_scadenze unique (contratto_id, numero_rata),
  constraint ck_tbcdg_scadenza_numero check (numero_rata > 0),
  constraint ck_tbcdg_scadenza_importi check (importo >= 0 and importo_incassato >= 0),
  constraint ck_tbcdg_scadenza_stato check (stato in ('previsto','fatturato','incassato','scaduto','annullato'))
);

-- Controlli di coerenza tenant sulle relazioni principali.
create or replace function public.cdg_verifica_coerenza_studio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'tbcdg_operatori_costi' then
    if not exists (
      select 1 from public.tbutenti u
      where u.id = new.operatore_id and u.studio_id = new.studio_id
    ) then
      raise exception 'Operatore non appartenente allo studio';
    end if;

  elsif tg_table_name = 'tbcdg_cliente_servizi' then
    if not exists (
      select 1 from public.tbclienti c
      where c.id = new.cliente_id and c.studio_id = new.studio_id
    ) then
      raise exception 'Cliente non appartenente allo studio';
    end if;
    if not exists (
      select 1 from public.tbcdg_attivita_catalogo a
      where a.id = new.attivita_id and a.studio_id = new.studio_id
    ) then
      raise exception 'Attivita non appartenente allo studio';
    end if;

  elsif tg_table_name = 'tbcdg_cliente_attivita_operatori' then
    if not exists (
      select 1 from public.tbclienti c
      where c.id = new.cliente_id and c.studio_id = new.studio_id
    ) then
      raise exception 'Cliente non appartenente allo studio';
    end if;
    if not exists (
      select 1 from public.tbutenti u
      where u.id = new.operatore_id and u.studio_id = new.studio_id
    ) then
      raise exception 'Operatore non appartenente allo studio';
    end if;
    if not exists (
      select 1 from public.tbcdg_cliente_servizi s
      where s.id = new.cliente_servizio_id
        and s.studio_id = new.studio_id
        and s.cliente_id = new.cliente_id
        and s.esercizio = new.esercizio
    ) then
      raise exception 'Servizio cliente non coerente con studio, cliente o esercizio';
    end if;

  elsif tg_table_name = 'tbcdg_calcoli_compenso' then
    if not exists (
      select 1 from public.tbclienti c
      where c.id = new.cliente_id and c.studio_id = new.studio_id
    ) then
      raise exception 'Cliente non appartenente allo studio';
    end if;

  elsif tg_table_name = 'tbcdg_contratti_clienti' then
    if not exists (
      select 1 from public.tbclienti c
      where c.id = new.cliente_id and c.studio_id = new.studio_id
    ) then
      raise exception 'Cliente non appartenente allo studio';
    end if;
    if new.calcolo_compenso_id is not null and not exists (
      select 1 from public.tbcdg_calcoli_compenso x
      where x.id = new.calcolo_compenso_id
        and x.studio_id = new.studio_id
        and x.cliente_id = new.cliente_id
        and x.esercizio = new.esercizio
    ) then
      raise exception 'Calcolo compenso non coerente con contratto';
    end if;

  elsif tg_table_name = 'tbcdg_contratti_voci' then
    if not exists (
      select 1 from public.tbcdg_contratti_clienti c
      where c.id = new.contratto_id and c.studio_id = new.studio_id
    ) then
      raise exception 'Contratto non appartenente allo studio';
    end if;
    if new.attivita_id is not null and not exists (
      select 1 from public.tbcdg_attivita_catalogo a
      where a.id = new.attivita_id and a.studio_id = new.studio_id
    ) then
      raise exception 'Attivita non appartenente allo studio';
    end if;

  elsif tg_table_name = 'tbcdg_contratti_scadenze' then
    if not exists (
      select 1 from public.tbcdg_contratti_clienti c
      where c.id = new.contratto_id
        and c.studio_id = new.studio_id
        and c.cliente_id = new.cliente_id
    ) then
      raise exception 'Scadenza non coerente con contratto, cliente o studio';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger coerenza tenant.
drop trigger if exists trg_cdg_operatori_coerenza on public.tbcdg_operatori_costi;
create trigger trg_cdg_operatori_coerenza
before insert or update on public.tbcdg_operatori_costi
for each row execute function public.cdg_verifica_coerenza_studio();

drop trigger if exists trg_cdg_cliente_servizi_coerenza on public.tbcdg_cliente_servizi;
create trigger trg_cdg_cliente_servizi_coerenza
before insert or update on public.tbcdg_cliente_servizi
for each row execute function public.cdg_verifica_coerenza_studio();

drop trigger if exists trg_cdg_cliente_operatori_coerenza on public.tbcdg_cliente_attivita_operatori;
create trigger trg_cdg_cliente_operatori_coerenza
before insert or update on public.tbcdg_cliente_attivita_operatori
for each row execute function public.cdg_verifica_coerenza_studio();

drop trigger if exists trg_cdg_calcoli_coerenza on public.tbcdg_calcoli_compenso;
create trigger trg_cdg_calcoli_coerenza
before insert or update on public.tbcdg_calcoli_compenso
for each row execute function public.cdg_verifica_coerenza_studio();

drop trigger if exists trg_cdg_contratti_coerenza on public.tbcdg_contratti_clienti;
create trigger trg_cdg_contratti_coerenza
before insert or update on public.tbcdg_contratti_clienti
for each row execute function public.cdg_verifica_coerenza_studio();

drop trigger if exists trg_cdg_voci_coerenza on public.tbcdg_contratti_voci;
create trigger trg_cdg_voci_coerenza
before insert or update on public.tbcdg_contratti_voci
for each row execute function public.cdg_verifica_coerenza_studio();

drop trigger if exists trg_cdg_scadenze_coerenza on public.tbcdg_contratti_scadenze;
create trigger trg_cdg_scadenze_coerenza
before insert or update on public.tbcdg_contratti_scadenze
for each row execute function public.cdg_verifica_coerenza_studio();

-- updated_at standard SMP.
drop trigger if exists trg_tbcdg_studio_parametri_updated_at on public.tbcdg_studio_parametri;
create trigger trg_tbcdg_studio_parametri_updated_at before update on public.tbcdg_studio_parametri
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_tbcdg_operatori_costi_updated_at on public.tbcdg_operatori_costi;
create trigger trg_tbcdg_operatori_costi_updated_at before update on public.tbcdg_operatori_costi
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_tbcdg_attivita_catalogo_updated_at on public.tbcdg_attivita_catalogo;
create trigger trg_tbcdg_attivita_catalogo_updated_at before update on public.tbcdg_attivita_catalogo
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_tbcdg_cliente_servizi_updated_at on public.tbcdg_cliente_servizi;
create trigger trg_tbcdg_cliente_servizi_updated_at before update on public.tbcdg_cliente_servizi
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_tbcdg_cliente_operatori_updated_at on public.tbcdg_cliente_attivita_operatori;
create trigger trg_tbcdg_cliente_operatori_updated_at before update on public.tbcdg_cliente_attivita_operatori
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_tbcdg_contratti_clienti_updated_at on public.tbcdg_contratti_clienti;
create trigger trg_tbcdg_contratti_clienti_updated_at before update on public.tbcdg_contratti_clienti
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_tbcdg_contratti_scadenze_updated_at on public.tbcdg_contratti_scadenze;
create trigger trg_tbcdg_contratti_scadenze_updated_at before update on public.tbcdg_contratti_scadenze
for each row execute function public.update_updated_at_column();

create index if not exists idx_tbcdg_operatori_costi_studio_anno on public.tbcdg_operatori_costi(studio_id, esercizio);
create index if not exists idx_tbcdg_cliente_servizi_cliente_anno on public.tbcdg_cliente_servizi(studio_id, esercizio, cliente_id);
create index if not exists idx_tbcdg_cliente_attivita_operatori_operatore on public.tbcdg_cliente_attivita_operatori(studio_id, esercizio, operatore_id);
create index if not exists idx_tbcdg_cliente_attivita_operatori_cliente on public.tbcdg_cliente_attivita_operatori(studio_id, esercizio, cliente_id);
create index if not exists idx_tbcdg_calcoli_compenso_cliente on public.tbcdg_calcoli_compenso(studio_id, esercizio, cliente_id);
create index if not exists idx_tbcdg_contratti_cliente on public.tbcdg_contratti_clienti(studio_id, esercizio, cliente_id);
create index if not exists idx_tbcdg_scadenze_data on public.tbcdg_contratti_scadenze(studio_id, data_scadenza, stato);

-- Peso percentuale del singolo dipendente sul cliente.
-- Manteniamo due letture distinte:
-- 1) quota % del NUMERO DI OPERAZIONI;
-- 2) quota % del CARICO PONDERATO in ore equivalenti.
create or replace view public.vw_cdg_peso_operatori_cliente as
with agg as (
  select
    studio_id,
    esercizio,
    cliente_id,
    operatore_id,
    sum(numero_operazioni_attribuite) as numero_operazioni,
    sum(ore_attribuite) as ore_equivalenti,
    sum(costo_attribuito) as costo_attribuito
  from public.tbcdg_cliente_attivita_operatori
  group by studio_id, esercizio, cliente_id, operatore_id
)
select
  a.*,
  case
    when sum(a.numero_operazioni) over (partition by a.studio_id, a.esercizio, a.cliente_id) > 0
      then round(
        100 * a.numero_operazioni /
        sum(a.numero_operazioni) over (partition by a.studio_id, a.esercizio, a.cliente_id), 4
      )
    else 0
  end as percentuale_operazioni_cliente,
  case
    when sum(a.ore_equivalenti) over (partition by a.studio_id, a.esercizio, a.cliente_id) > 0
      then round(
        100 * a.ore_equivalenti /
        sum(a.ore_equivalenti) over (partition by a.studio_id, a.esercizio, a.cliente_id), 4
      )
    else 0
  end as percentuale_carico_cliente
from agg a
where a.studio_id = public.current_studio_id();

-- Peso percentuale del singolo dipendente sull'intero studio.
create or replace view public.vw_cdg_peso_operatori_studio as
with agg as (
  select
    studio_id,
    esercizio,
    operatore_id,
    sum(numero_operazioni_attribuite) as numero_operazioni,
    sum(ore_attribuite) as ore_equivalenti,
    sum(costo_attribuito) as costo_attribuito
  from public.tbcdg_cliente_attivita_operatori
  group by studio_id, esercizio, operatore_id
)
select
  a.*,
  case
    when sum(a.numero_operazioni) over (partition by a.studio_id, a.esercizio) > 0
      then round(
        100 * a.numero_operazioni /
        sum(a.numero_operazioni) over (partition by a.studio_id, a.esercizio), 4
      )
    else 0
  end as percentuale_operazioni_studio,
  case
    when sum(a.ore_equivalenti) over (partition by a.studio_id, a.esercizio) > 0
      then round(
        100 * a.ore_equivalenti /
        sum(a.ore_equivalenti) over (partition by a.studio_id, a.esercizio), 4
      )
    else 0
  end as percentuale_carico_studio
from agg a
where a.studio_id = public.current_studio_id();

-- RLS multi-studio.
alter table public.tbcdg_studio_parametri enable row level security;
alter table public.tbcdg_operatori_costi enable row level security;
alter table public.tbcdg_attivita_catalogo enable row level security;
alter table public.tbcdg_cliente_servizi enable row level security;
alter table public.tbcdg_cliente_attivita_operatori enable row level security;
alter table public.tbcdg_calcoli_compenso enable row level security;
alter table public.tbcdg_contratti_clienti enable row level security;
alter table public.tbcdg_contratti_voci enable row level security;
alter table public.tbcdg_contratti_scadenze enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'tbcdg_studio_parametri',
    'tbcdg_operatori_costi',
    'tbcdg_attivita_catalogo',
    'tbcdg_cliente_servizi',
    'tbcdg_cliente_attivita_operatori',
    'tbcdg_calcoli_compenso',
    'tbcdg_contratti_clienti',
    'tbcdg_contratti_voci',
    'tbcdg_contratti_scadenze'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'cdg_select_studio', tbl);
    execute format('drop policy if exists %I on public.%I', 'cdg_insert_studio', tbl);
    execute format('drop policy if exists %I on public.%I', 'cdg_update_studio', tbl);
    execute format('drop policy if exists %I on public.%I', 'cdg_delete_studio', tbl);

    execute format(
      'create policy %I on public.%I for select to authenticated using (studio_id = public.current_studio_id())',
      'cdg_select_studio', tbl
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (studio_id = public.current_studio_id())',
      'cdg_insert_studio', tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (studio_id = public.current_studio_id()) with check (studio_id = public.current_studio_id())',
      'cdg_update_studio', tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (studio_id = public.current_studio_id())',
      'cdg_delete_studio', tbl
    );
  end loop;
end $$;

-- Privilegi: RLS resta il filtro effettivo per authenticated.
grant select, insert, update, delete on public.tbcdg_studio_parametri to authenticated;
grant select, insert, update, delete on public.tbcdg_operatori_costi to authenticated;
grant select, insert, update, delete on public.tbcdg_attivita_catalogo to authenticated;
grant select, insert, update, delete on public.tbcdg_cliente_servizi to authenticated;
grant select, insert, update, delete on public.tbcdg_cliente_attivita_operatori to authenticated;
grant select, insert, update, delete on public.tbcdg_calcoli_compenso to authenticated;
grant select, insert, update, delete on public.tbcdg_contratti_clienti to authenticated;
grant select, insert, update, delete on public.tbcdg_contratti_voci to authenticated;
grant select, insert, update, delete on public.tbcdg_contratti_scadenze to authenticated;
grant select on public.vw_cdg_peso_operatori_cliente to authenticated;
grant select on public.vw_cdg_peso_operatori_studio to authenticated;

grant all on public.tbcdg_studio_parametri to service_role;
grant all on public.tbcdg_operatori_costi to service_role;
grant all on public.tbcdg_attivita_catalogo to service_role;
grant all on public.tbcdg_cliente_servizi to service_role;
grant all on public.tbcdg_cliente_attivita_operatori to service_role;
grant all on public.tbcdg_calcoli_compenso to service_role;
grant all on public.tbcdg_contratti_clienti to service_role;
grant all on public.tbcdg_contratti_voci to service_role;
grant all on public.tbcdg_contratti_scadenze to service_role;
grant select on public.vw_cdg_peso_operatori_cliente to service_role;
grant select on public.vw_cdg_peso_operatori_studio to service_role;

comment on view public.vw_cdg_peso_operatori_cliente is
'Peso percentuale per operatore sul cliente: quota numero operazioni e quota carico in ore equivalenti.';

comment on view public.vw_cdg_peso_operatori_studio is
'Peso percentuale per operatore sull intero studio: quota numero operazioni e quota carico in ore equivalenti.';
