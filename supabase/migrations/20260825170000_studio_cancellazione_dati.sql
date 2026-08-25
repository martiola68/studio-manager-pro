alter table public.tbstudio
  add column if not exists data_cessazione_abbonamento timestamptz null,
  add column if not exists data_richiesta_cancellazione timestamptz null,
  add column if not exists data_cancellazione_programmata timestamptz null,
  add column if not exists stato_cancellazione text null;

alter table public.tbstudio
  drop constraint if exists tbstudio_stato_cancellazione_check;

alter table public.tbstudio
  add constraint tbstudio_stato_cancellazione_check
  check (
    stato_cancellazione is null
    or stato_cancellazione = any (array['richiesta'::text, 'programmata'::text, 'annullata'::text])
  );

create table if not exists public.tbstudio_cancellazioni_log (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  auth_user_id uuid null,
  tipo_evento text not null,
  data_evento timestamptz not null default now(),
  data_cancellazione_programmata timestamptz null,
  esito text null,
  note text null,
  created_at timestamptz not null default now(),
  constraint tbstudio_cancellazioni_log_tipo_evento_check
    check (tipo_evento = any (array[
      'richiesta_cancellazione'::text,
      'annullamento_cancellazione'::text,
      'riattivazione_abbonamento'::text,
      'cancellazione_eseguita'::text,
      'cancellazione_fallita'::text
    ]))
);

create index if not exists idx_tbstudio_cancellazione_programmata
  on public.tbstudio (data_cancellazione_programmata)
  where stato_cancellazione = 'programmata';

create index if not exists idx_tbstudio_cancellazioni_log_studio
  on public.tbstudio_cancellazioni_log (studio_id, data_evento desc);

alter table public.tbstudio_cancellazioni_log enable row level security;

comment on column public.tbstudio.data_cessazione_abbonamento is
  'Data di effettiva cessazione del servizio. Non comporta cancellazione immediata dei dati.';
comment on column public.tbstudio.data_richiesta_cancellazione is
  'Data in cui l''amministratore ha richiesto la cancellazione definitiva dei dati.';
comment on column public.tbstudio.data_cancellazione_programmata is
  'Data prevista per la cancellazione definitiva, normalmente 30 giorni dopo la richiesta.';
comment on column public.tbstudio.stato_cancellazione is
  'Stato della procedura di cancellazione dati: richiesta, programmata, annullata.';
comment on table public.tbstudio_cancellazioni_log is
  'Audit minimale della procedura di cancellazione dei dati dello studio. Non contiene dati operativi del tenant.';
