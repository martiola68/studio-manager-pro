-- Redditivita Studio
-- Costi, operatori, attivita, servizi cliente, ripartizione carichi,
-- compensi, contratti e scadenze di incasso.

create table if not exists public.tbcdg_studio_parametri (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
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
  constraint ck_tbcdg_studio_parametri_margine check (margine_obiettivo_percentuale >= 0 and margine_obiettivo_percentuale < 100)
);

create table if not exists public.tbcdg_operatori_costi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  esercizio integer not null,
  operatore_id uuid not null,
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
  constraint ck_tbcdg_operatori_ore check (ore_teoriche >= 0 and ore_non_produttive >= 0 and ore_produttive >= 0)
);

create table if not exists public.tbcdg_attivita_catalogo (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
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
  studio_id uuid not null,
  esercizio integer not null,
  cliente_id uuid not null,
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
  constraint ck_tbcdg_cliente_servizi_quantita check (quantita_driver >= 0),
  constraint ck_tbcdg_cliente_servizi_complessita check (coefficiente_complessita > 0)
);

create table if not exists public.tbcdg_cliente_attivita_operatori (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  esercizio integer not null,
  cliente_id uuid not null,
  cliente_servizio_id uuid not null references public.tbcdg_cliente_servizi(id) on delete cascade,
  operatore_id uuid not null,
  percentuale_ripartizione_attivita numeric(7,4) not null default 0,
  numero_operazioni_attribuite numeric(18,4) not null default 0,
  ore_attribuite numeric(14,4) not null default 0,
  costo_attribuito numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tbcdg_cliente_attivita_operatori unique (cliente_servizio_id, operatore_id),
  constraint ck_tbcdg_ripartizione_percentuale check (percentuale_ripartizione_attivita >= 0 and percentuale_ripartizione_attivita <= 100),
  constraint ck_tbcdg_operazioni_attribuite check (numero_operazioni_attribuite >= 0),
  constraint ck_tbcdg_ore_attribuite check (ore_attribuite >= 0)
);

create table if not exists public.tbcdg_calcoli_compenso (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  esercizio integer not null,
  cliente_id uuid not null,
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
  constraint uq_tbcdg_calcoli_compenso unique (studio_id, esercizio, cliente_id, versione)
);

create table if not exists public.tbcdg_contratti_clienti (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  esercizio integer not null,
  cliente_id uuid not null,
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
  constraint ck_tbcdg_contratto_tipo check (tipo_contratto in ('forfettario','analitico','misto','ore')),
  constraint ck_tbcdg_contratto_stato check (stato in ('bozza','attivo','cessato','archiviato'))
);

create table if not exists public.tbcdg_contratti_voci (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  contratto_id uuid not null references public.tbcdg_contratti_clienti(id) on delete cascade,
  attivita_id uuid references public.tbcdg_attivita_catalogo(id) on delete set null,
  descrizione text not null,
  quantita numeric(14,4) not null default 1,
  prezzo_unitario numeric(14,2) not null default 0,
  importo_annuo numeric(14,2) not null default 0,
  incluso_nel_forfait boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tbcdg_contratti_scadenze (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  contratto_id uuid not null references public.tbcdg_contratti_clienti(id) on delete cascade,
  cliente_id uuid not null,
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
  constraint ck_tbcdg_scadenza_stato check (stato in ('previsto','fatturato','incassato','scaduto','annullato'))
);

create index if not exists idx_tbcdg_operatori_costi_studio_anno on public.tbcdg_operatori_costi(studio_id, esercizio);
create index if not exists idx_tbcdg_cliente_servizi_cliente_anno on public.tbcdg_cliente_servizi(studio_id, esercizio, cliente_id);
create index if not exists idx_tbcdg_cliente_attivita_operatori_operatore on public.tbcdg_cliente_attivita_operatori(studio_id, esercizio, operatore_id);
create index if not exists idx_tbcdg_cliente_attivita_operatori_cliente on public.tbcdg_cliente_attivita_operatori(studio_id, esercizio, cliente_id);
create index if not exists idx_tbcdg_calcoli_compenso_cliente on public.tbcdg_calcoli_compenso(studio_id, esercizio, cliente_id);
create index if not exists idx_tbcdg_contratti_cliente on public.tbcdg_contratti_clienti(studio_id, esercizio, cliente_id);
create index if not exists idx_tbcdg_scadenze_data on public.tbcdg_contratti_scadenze(studio_id, data_scadenza, stato);

-- Peso percentuale dell'operatore sul singolo cliente.
-- Distinguiamo volutamente il peso per NUMERO OPERAZIONI dal peso per ORE/CARICO:
-- un'operazione semplice e un bilancio non devono valere lo stesso sul carico di lavoro.
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
from agg a;

-- Peso percentuale dell'operatore sull'intero studio per esercizio.
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
from agg a;

-- RLS multi-studio
alter table public.tbcdg_studio_parametri enable row level security;
alter table public.tbcdg_operatori_costi enable row level security;
alter table public.tbcdg_attivita_catalogo enable row level security;
alter table public.tbcdg_cliente_servizi enable row level security;
alter table public.tbcdg_cliente_attivita_operatori enable row level security;
alter table public.tbcdg_calcoli_compenso enable row level security;
alter table public.tbcdg_contratti_clienti enable row level security;
alter table public.tbcdg_contratti_voci enable row level security;
alter table public.tbcdg_contratti_scadenze enable row level security;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
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
  LOOP
    EXECUTE format('drop policy if exists %I on public.%I', 'cdg_select_studio', tbl);
    EXECUTE format('drop policy if exists %I on public.%I', 'cdg_insert_studio', tbl);
    EXECUTE format('drop policy if exists %I on public.%I', 'cdg_update_studio', tbl);
    EXECUTE format('drop policy if exists %I on public.%I', 'cdg_delete_studio', tbl);

    EXECUTE format('create policy %I on public.%I for select to authenticated using (studio_id = current_studio_id())', 'cdg_select_studio', tbl);
    EXECUTE format('create policy %I on public.%I for insert to authenticated with check (studio_id = current_studio_id())', 'cdg_insert_studio', tbl);
    EXECUTE format('create policy %I on public.%I for update to authenticated using (studio_id = current_studio_id()) with check (studio_id = current_studio_id())', 'cdg_update_studio', tbl);
    EXECUTE format('create policy %I on public.%I for delete to authenticated using (studio_id = current_studio_id())', 'cdg_delete_studio', tbl);
  END LOOP;
END $$;

comment on view public.vw_cdg_peso_operatori_cliente is
'Peso percentuale per singolo operatore sul cliente: percentuale per numero operazioni e percentuale per ore equivalenti.';

comment on view public.vw_cdg_peso_operatori_studio is
'Peso percentuale per singolo operatore sul totale studio: percentuale per numero operazioni e percentuale per carico/ore equivalenti.';
