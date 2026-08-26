alter table public.tbstudio
  add column if not exists stato_cancellazione text null,
  add column if not exists data_richiesta_cancellazione timestamptz null,
  add column if not exists data_cancellazione_programmata timestamptz null,
  add column if not exists data_fine_servizio timestamptz null;

create table if not exists public.tbstudio_cancellazioni_log (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  auth_user_id uuid null,
  tipo_evento text not null,
  data_cancellazione_programmata timestamptz null,
  esito text not null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tbstudio_cancellazioni_log_studio on public.tbstudio_cancellazioni_log(studio_id, created_at desc);
create index if not exists idx_tbstudio_cancellazione_programmata on public.tbstudio(data_cancellazione_programmata) where stato_cancellazione = 'programmata';

comment on column public.tbstudio.stato_cancellazione is 'Stato richiesta cancellazione dati: richiesta, programmata, annullata, completata.';
comment on column public.tbstudio.data_cancellazione_programmata is 'Data oltre la quale i dati dello studio possono essere eliminati definitivamente dopo la richiesta dell amministratore.';
