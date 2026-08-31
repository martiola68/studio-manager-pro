-- Amministratore di sistema generale unico per l'intera piattaforma.

alter table public.tbutenti
  add column if not exists amministratore_sistema_generale boolean not null default false;

-- Bootstrap iniziale sull'amministratore generale già identificato nel sistema.
update public.tbutenti u
set amministratore_sistema_generale = true
from public.tbstudio s
where u.studio_id = s.id
  and upper(trim(coalesce(u.nome, ''))) = 'MARIO'
  and upper(trim(coalesce(u.cognome, ''))) = 'ARTIOLA'
  and upper(trim(coalesce(u.tipo_utente, ''))) = 'ADMIN'
  and coalesce(u.attivo, true) = true
  and upper(trim(coalesce(s.ragione_sociale, ''))) like 'REVISIONI COMMERCIALI%';

-- Garanzia globale: in tutta la tabella può esistere una sola riga con flag = true.
create unique index if not exists uq_tbutenti_amministratore_sistema_generale_unico
  on public.tbutenti ((1))
  where amministratore_sistema_generale = true;

create or replace function public.is_amministratore_sistema_generale()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tbutenti u
    where (u.user_id = auth.uid() or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(u.attivo, true) = true
      and coalesce(u.amministratore_sistema_generale, false) = true
  );
$$;

-- Le sessioni utente normali non possono spostare o attribuire il flag.
-- Le modifiche applicative autorizzate passano dalle API server con service role.
create or replace function public.proteggi_amministratore_sistema_generale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.amministratore_sistema_generale is distinct from old.amministratore_sistema_generale then
    if coalesce(auth.role(), '') <> 'service_role'
       and not public.is_amministratore_sistema_generale() then
      raise exception 'Solo l''Amministratore di sistema generale può modificare questo flag';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteggi_amministratore_sistema_generale on public.tbutenti;
create trigger trg_proteggi_amministratore_sistema_generale
before update of amministratore_sistema_generale on public.tbutenti
for each row
execute function public.proteggi_amministratore_sistema_generale();

comment on column public.tbutenti.amministratore_sistema_generale is
  'Flag globale: può essere true per un solo utente dell''intera piattaforma.';
