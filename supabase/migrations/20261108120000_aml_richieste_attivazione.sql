-- Requests only: this table does NOT create users, studios or active licenses.
-- Apply manually in Supabase SQL Editor before enabling the public form.
create table if not exists public.tbaml_richieste_attivazione (
  id uuid primary key default gen_random_uuid(),
  ragione_sociale text not null check (length(btrim(ragione_sociale)) between 2 and 200),
  partita_iva text,
  referente text not null check (length(btrim(referente)) between 3 and 160),
  email text not null check (length(email) between 5 and 254),
  telefono text,
  piano text not null check (piano in ('starter','professional','business')),
  note text,
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa','in_valutazione','approvata','rifiutata','attivata')),
  privacy_accettata_il timestamptz not null,
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);
create unique index if not exists tbaml_richieste_attivazione_email_pending_uidx
  on public.tbaml_richieste_attivazione (lower(email))
  where stato in ('in_attesa','in_valutazione');
create index if not exists tbaml_richieste_attivazione_stato_data_idx
  on public.tbaml_richieste_attivazione (stato, creata_il desc);
alter table public.tbaml_richieste_attivazione enable row level security;
-- No anonymous/authenticated SELECT/INSERT/UPDATE permissions.
-- The server endpoint alone uses service role. Existing grants are revoked on new installs.
revoke all on public.tbaml_richieste_attivazione from anon, authenticated;
comment on table public.tbaml_richieste_attivazione is
  'Richieste commerciali AML PRO. Non concede accessi o licenze attive.';
