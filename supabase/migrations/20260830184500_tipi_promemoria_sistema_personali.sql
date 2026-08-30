-- Tipi promemoria: S = sistema, P = personale
-- ESEGUIRE MANUALMENTE SU SUPABASE prima del deploy del codice applicativo.
--
-- Regola catalogo:
--   S = SOLO i 6 tipi condivisi indicati sotto, senza studio proprietario.
--   P = tutti gli altri tipi preesistenti, appartenenti esclusivamente
--       allo studio REVISIONI COMMERCIALI.

begin;

-- Mantiene robusto il riconoscimento dell'amministratore globale del catalogo.
create or replace function public.is_system_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tbutenti u
    join public.tbstudio s on s.id = u.studio_id
    where (u.user_id = auth.uid() or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(u.attivo, true) = true
      and upper(trim(coalesce(u.tipo_utente, ''))) = 'ADMIN'
      and upper(trim(coalesce(u.nome, ''))) = 'MARIO'
      and upper(trim(coalesce(u.cognome, ''))) = 'ARTIOLA'
      and upper(trim(coalesce(s.ragione_sociale, ''))) like 'REVISIONI COMMERCIALI%'
  )
$$;

revoke all on function public.is_system_catalog_admin() from public;
grant execute on function public.is_system_catalog_admin() to authenticated;

-- 1) Aggiunge origine e studio proprietario.
alter table public.tbtipopromemoria
  add column if not exists origine char(1);

alter table public.tbtipopromemoria
  add column if not exists studio_id uuid references public.tbstudio(id) on delete cascade;

-- Individua lo studio proprietario dei tipi personali preesistenti.
-- Il blocco fallisce volutamente se REVISIONI COMMERCIALI non è presente
-- oppure se esistono più studi con lo stesso prefisso: meglio non assegnare
-- dati al tenant sbagliato.
do $$
declare
  v_studio_id uuid;
  v_count integer;
begin
  select count(*), min(id)
    into v_count, v_studio_id
  from public.tbstudio
  where upper(trim(coalesce(ragione_sociale, ''))) like 'REVISIONI COMMERCIALI%';

  if v_count <> 1 or v_studio_id is null then
    raise exception 'Impossibile individuare univocamente lo studio REVISIONI COMMERCIALI (trovati: %)', v_count;
  end if;

  -- Prima rende PERSONALI tutti i tipi preesistenti e li assegna
  -- esclusivamente allo studio REVISIONI COMMERCIALI.
  update public.tbtipopromemoria
  set origine = 'P',
      studio_id = v_studio_id;

  -- SOLO questi 6 tipi sono di SISTEMA e quindi condivisi fra tutti gli studi.
  -- Confronto case-insensitive e senza spazi iniziali/finali.
  update public.tbtipopromemoria
  set origine = 'S',
      studio_id = null
  where lower(trim(nome)) in (
    'agenzia delle entrate',
    'altri enti',
    'altro',
    'camera di commercio',
    'inail',
    'inps'
  );
end
$$;

alter table public.tbtipopromemoria
  alter column origine set default 'P';

alter table public.tbtipopromemoria
  alter column origine set not null;

alter table public.tbtipopromemoria
  drop constraint if exists tbtipopromemoria_origine_check;

alter table public.tbtipopromemoria
  add constraint tbtipopromemoria_origine_check
  check (origine in ('S', 'P'));

-- Le P devono sempre avere lo studio proprietario; le S devono essere globali.
alter table public.tbtipopromemoria
  drop constraint if exists tbtipopromemoria_personale_studio_check;

alter table public.tbtipopromemoria
  add constraint tbtipopromemoria_personale_studio_check
  check (
    (origine = 'S' and studio_id is null)
    or
    (origine = 'P' and studio_id is not null)
  );

create index if not exists idx_tbtipopromemoria_studio_id
  on public.tbtipopromemoria(studio_id);

create index if not exists idx_tbtipopromemoria_origine
  on public.tbtipopromemoria(origine);

comment on column public.tbtipopromemoria.origine is
  'S = uno dei 6 tipi promemoria di sistema condivisi; P = tipo personale dello studio proprietario';

-- 2) RLS: S visibili a tutti, P soltanto allo studio proprietario.
alter table public.tbtipopromemoria enable row level security;

drop policy if exists "tenant_barrier_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_select_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_insert_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_update_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_delete_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_guard_select_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_guard_insert_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_guard_update_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_guard_delete_tbtipopromemoria" on public.tbtipopromemoria;

create policy "catalog_select_tbtipopromemoria"
on public.tbtipopromemoria
for select to authenticated
using (
  origine = 'S'
  or (origine = 'P' and studio_id = public.current_studio_id())
);

create policy "catalog_insert_tbtipopromemoria"
on public.tbtipopromemoria
for insert to authenticated
with check (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and studio_id is null and public.is_system_catalog_admin())
);

create policy "catalog_update_tbtipopromemoria"
on public.tbtipopromemoria
for update to authenticated
using (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
)
with check (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and studio_id is null and public.is_system_catalog_admin())
);

create policy "catalog_delete_tbtipopromemoria"
on public.tbtipopromemoria
for delete to authenticated
using (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
);

-- Barriere restrictive contro eventuali vecchie policy permissive.
create policy "catalog_guard_select_tbtipopromemoria"
on public.tbtipopromemoria
as restrictive
for select to authenticated
using (
  origine = 'S'
  or (origine = 'P' and studio_id = public.current_studio_id())
);

create policy "catalog_guard_insert_tbtipopromemoria"
on public.tbtipopromemoria
as restrictive
for insert to authenticated
with check (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and studio_id is null and public.is_system_catalog_admin())
);

create policy "catalog_guard_update_tbtipopromemoria"
on public.tbtipopromemoria
as restrictive
for update to authenticated
using (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
)
with check (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and studio_id is null and public.is_system_catalog_admin())
);

create policy "catalog_guard_delete_tbtipopromemoria"
on public.tbtipopromemoria
as restrictive
for delete to authenticated
using (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
);

commit;

-- VERIFICHE:
-- 1) Devono risultare ESATTAMENTE 6 record S:
-- select nome, origine, studio_id
-- from public.tbtipopromemoria
-- where origine = 'S'
-- order by nome;
--
-- 2) I 6 S attesi sono:
--    Agenzia delle Entrate
--    Altri enti
--    Altro
--    Camera di commercio
--    Inail
--    Inps
--
-- 3) Tutti gli altri devono essere P e avere lo studio REVISIONI COMMERCIALI:
-- select tp.nome, tp.origine, tp.studio_id, s.ragione_sociale
-- from public.tbtipopromemoria tp
-- left join public.tbstudio s on s.id = tp.studio_id
-- order by tp.origine desc, tp.nome;
