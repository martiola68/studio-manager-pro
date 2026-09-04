begin;

alter table public.tbscadbilanci
  add column if not exists tipo_bilancio text not null default 'ordinario';

alter table public.tbscadbilanci
  drop constraint if exists tbscadbilanci_tipo_bilancio_check;

alter table public.tbscadbilanci
  add constraint tbscadbilanci_tipo_bilancio_check
  check (tipo_bilancio in ('micro','abbreviato','ordinario'));

alter table public.tbscadbilanci
  alter column relazione_gest type text using (case when relazione_gest is true then 'SI' else 'NO' end),
  alter column relazione_sindaci type text using (case when relazione_sindaci is true then 'SI' else 'NO' end),
  alter column relazione_revisore type text using (case when relazione_revisore is true then 'SI' else 'NO' end);

alter table public.tbscadbilanci
  alter column relazione_gest set default 'NO',
  alter column relazione_sindaci set default 'NO',
  alter column relazione_revisore set default 'NO';

update public.tbscadbilanci
set relazione_gest = coalesce(relazione_gest, 'NO'),
    relazione_sindaci = coalesce(relazione_sindaci, 'NO'),
    relazione_revisore = coalesce(relazione_revisore, 'NO');

alter table public.tbscadbilanci
  alter column relazione_gest set not null,
  alter column relazione_sindaci set not null,
  alter column relazione_revisore set not null;

alter table public.tbscadbilanci
  drop constraint if exists tbscadbilanci_relazione_gest_check,
  drop constraint if exists tbscadbilanci_relazione_sindaci_check,
  drop constraint if exists tbscadbilanci_relazione_revisore_check;

alter table public.tbscadbilanci
  add constraint tbscadbilanci_relazione_gest_check check (relazione_gest in ('SI','NO','NP')),
  add constraint tbscadbilanci_relazione_sindaci_check check (relazione_sindaci in ('SI','NO','NP')),
  add constraint tbscadbilanci_relazione_revisore_check check (relazione_revisore in ('SI','NO','NP'));

create or replace function public.enforce_tbscadbilanci_micro_np()
returns trigger
language plpgsql
as $$
begin
  if new.tipo_bilancio = 'micro' then
    new.relazione_gest := 'NP';
    new.relazione_sindaci := 'NP';
    new.relazione_revisore := 'NP';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tbscadbilanci_micro_np on public.tbscadbilanci;
create trigger trg_tbscadbilanci_micro_np
before insert or update of tipo_bilancio, relazione_gest, relazione_sindaci, relazione_revisore
on public.tbscadbilanci
for each row execute function public.enforce_tbscadbilanci_micro_np();

update public.tbscadbilanci
set relazione_gest = 'NP',
    relazione_sindaci = 'NP',
    relazione_revisore = 'NP'
where tipo_bilancio = 'micro';

commit;
