begin;

-- Garantisce la voce di fallback di sistema "Altro".
insert into public.tbtipopromemoria (nome, descrizione, colore, origine, studio_id)
select 'Altro', null, '#3B82F6', 'S', null
where not exists (
  select 1
  from public.tbtipopromemoria
  where lower(trim(nome)) = 'altro'
    and origine = 'S'
);

-- Converte tutti i promemoria storici senza tipo in "Altro".
update public.tbpromemoria p
set tipo_promemoria_id = (
  select t.id
  from public.tbtipopromemoria t
  where lower(trim(t.nome)) = 'altro'
    and t.origine = 'S'
  order by t.id
  limit 1
)
where p.tipo_promemoria_id is null;

-- Fallback DB: qualunque INSERT/UPDATE futuro con NULL viene trasformato in "Altro".
create or replace function public.set_promemoria_tipo_altro_if_null()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.tipo_promemoria_id is null then
    select t.id
      into new.tipo_promemoria_id
    from public.tbtipopromemoria t
    where lower(trim(t.nome)) = 'altro'
      and t.origine = 'S'
    order by t.id
    limit 1;

    if new.tipo_promemoria_id is null then
      raise exception 'Tipo promemoria "Altro" non configurato';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_promemoria_tipo_altro_if_null on public.tbpromemoria;
create trigger trg_promemoria_tipo_altro_if_null
before insert or update of tipo_promemoria_id
on public.tbpromemoria
for each row
execute function public.set_promemoria_tipo_altro_if_null();

-- Il tipo diventa obbligatorio a livello schema.
alter table public.tbpromemoria
  alter column tipo_promemoria_id set not null;

commit;
