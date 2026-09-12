create extension if not exists pgcrypto;

create table if not exists public.tbrevisione_preincarichi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  cliente_id uuid not null references public.tbclienti(id) on delete cascade,
  data_bilancio date not null,
  stato text not null default 'bozza' check (stato in ('bozza','in_compilazione','pronto_accettazione','accettato','rifiutato','generato')),
  step_corrente integer not null default 1 check (step_corrente between 1 and 8),
  accettato boolean not null default false,
  data_accettazione date,
  responsabile text,
  note_finali text,
  snapshot_cliente jsonb not null default '{}'::jsonb,
  pratica_revisione_id uuid references public.tbrevisione_incarichi(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, cliente_id, data_bilancio)
);

create table if not exists public.tbrevisione_questionari (
  id uuid primary key default gen_random_uuid(),
  preincarico_id uuid not null references public.tbrevisione_preincarichi(id) on delete cascade,
  codice text not null,
  titolo text not null,
  completato boolean not null default false,
  conclusioni text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (preincarico_id, codice)
);

create table if not exists public.tbrevisione_risposte (
  id uuid primary key default gen_random_uuid(),
  questionario_id uuid not null references public.tbrevisione_questionari(id) on delete cascade,
  codice_domanda text not null,
  risposta text check (risposta is null or risposta in ('SI','NO','NON_APPLICABILE')),
  specifica text,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (questionario_id, codice_domanda)
);

create table if not exists public.tbrevisione_preincarico_documenti (
  id uuid primary key default gen_random_uuid(),
  preincarico_id uuid not null references public.tbrevisione_preincarichi(id) on delete cascade,
  tipo text not null,
  stato text not null default 'bozza' check (stato in ('bozza','completato','confermato','generato')),
  contenuto jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (preincarico_id, tipo)
);

create index if not exists idx_revisione_preincarichi_cliente on public.tbrevisione_preincarichi(cliente_id);
create index if not exists idx_revisione_preincarichi_studio on public.tbrevisione_preincarichi(studio_id);
create index if not exists idx_revisione_questionari_preincarico on public.tbrevisione_questionari(preincarico_id);
create index if not exists idx_revisione_risposte_questionario on public.tbrevisione_risposte(questionario_id);
create index if not exists idx_revisione_preincarico_documenti on public.tbrevisione_preincarico_documenti(preincarico_id);
