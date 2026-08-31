-- Codice univoco promemoria per studio e anno.
-- Non modifica la logica funzionale esistente: aggiunge solo identificazione e backfill.

alter table public.tbpromemoria
  add column if not exists codice_promemoria text;

-- Backfill deterministico dei promemoria esistenti, separato per studio e anno.
with numerati as (
  select
    id,
    studio_id,
    extract(year from coalesce(data_inserimento::date, created_at::date, current_date))::int as anno,
    row_number() over (
      partition by studio_id, extract(year from coalesce(data_inserimento::date, created_at::date, current_date))::int
      order by coalesce(data_inserimento::date, created_at::date, current_date), created_at nulls last, id
    ) as progressivo
  from public.tbpromemoria
  where codice_promemoria is null
    and studio_id is not null
)
update public.tbpromemoria p
set codice_promemoria = 'PRM-' || n.anno::text || '-' || lpad(n.progressivo::text, 5, '0')
from numerati n
where p.id = n.id;

create unique index if not exists uq_tbpromemoria_studio_codice
  on public.tbpromemoria (studio_id, codice_promemoria)
  where codice_promemoria is not null;

create or replace function public.assegna_codice_promemoria()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_anno int;
  v_progressivo int;
begin
  if new.codice_promemoria is not null or new.studio_id is null then
    return new;
  end if;

  v_anno := extract(year from coalesce(new.data_inserimento::date, current_date))::int;

  -- Serializza solo la numerazione dello stesso studio/anno.
  perform pg_advisory_xact_lock(hashtext(new.studio_id::text || ':' || v_anno::text));

  select coalesce(max((regexp_match(codice_promemoria, '^PRM-' || v_anno::text || '-([0-9]+)$'))[1]::int), 0) + 1
    into v_progressivo
  from public.tbpromemoria
  where studio_id = new.studio_id
    and codice_promemoria ~ ('^PRM-' || v_anno::text || '-[0-9]+$');

  new.codice_promemoria := 'PRM-' || v_anno::text || '-' || lpad(v_progressivo::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists trg_assegna_codice_promemoria on public.tbpromemoria;
create trigger trg_assegna_codice_promemoria
before insert on public.tbpromemoria
for each row
execute function public.assegna_codice_promemoria();

comment on column public.tbpromemoria.codice_promemoria is
  'Codice univoco progressivo del promemoria nel formato PRM-AAAA-NNNNN, separato per studio e anno.';
