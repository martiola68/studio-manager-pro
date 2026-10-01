-- Compilazione automatica presenze da planning settimanale.
-- Il flag è gestibile esclusivamente dall'Amministratore di sistema generale.

alter table public.tbdipendenti
  add column if not exists compilazione_automatica_presenze boolean not null default false;

comment on column public.tbdipendenti.compilazione_automatica_presenze is
  'Se true, il cron giornaliero compila Pp/Ps del giorno corrente in base alle Presenze settimanali.';

create or replace function public.proteggi_compilazione_automatica_presenze()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.compilazione_automatica_presenze
     is distinct from old.compilazione_automatica_presenze then
    if coalesce(auth.role(), '') <> 'service_role'
       and not public.is_amministratore_sistema_generale() then
      raise exception 'Solo l''Amministratore di sistema generale può modificare Comp. Aut.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteggi_compilazione_automatica_presenze
  on public.tbdipendenti;

create trigger trg_proteggi_compilazione_automatica_presenze
before update of compilazione_automatica_presenze
on public.tbdipendenti
for each row
execute function public.proteggi_compilazione_automatica_presenze();
