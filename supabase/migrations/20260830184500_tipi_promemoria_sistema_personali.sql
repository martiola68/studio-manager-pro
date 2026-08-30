-- Tipi promemoria: S = sistema, P = personale
-- ESEGUIRE MANUALMENTE SU SUPABASE prima del deploy del codice applicativo.

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

-- Tutti i tipi già presenti diventano tipi di sistema condivisi.
update public.tbtipopromemoria
set origine = 'S'
where origine is null or origine not in ('S', 'P');

alter table public.tbtipopromemoria
  alter column origine set default 'P';

alter table public.tbtipopromemoria
  alter column origine set not null;

alter table public.tbtipopromemoria
  drop constraint if exists tbtipopromemoria_origine_check;

alter table public.tbtipopromemoria
  add constraint tbtipopromemoria_origine_check
  check (origine in ('S', 'P'));

-- Le P devono sempre avere lo studio proprietario; le S possono restare globali.
alter table public.tbtipopromemoria
  drop constraint if exists tbtipopromemoria_personale_studio_check;

alter table public.tbtipopromemoria
  add constraint tbtipopromemoria_personale_studio_check
  check (origine = 'S' or studio_id is not null);

create index if not exists idx_tbtipopromemoria_studio_id
  on public.tbtipopromemoria(studio_id);

create index if not exists idx_tbtipopromemoria_origine
  on public.tbtipopromemoria(origine);

comment on column public.tbtipopromemoria.origine is
  'S = tipo promemoria di sistema condiviso tra tutti gli studi; P = tipo personale dello studio proprietario';

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
  or (origine = 'S' and public.is_system_catalog_admin())
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
  or (origine = 'S' and public.is_system_catalog_admin())
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
  or (origine = 'S' and public.is_system_catalog_admin())
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
  or (origine = 'S' and public.is_system_catalog_admin())
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
-- select origine, count(*) from public.tbtipopromemoria group by origine order by origine;
-- Tutti i tipi preesistenti devono risultare S.
-- select id, nome, origine, studio_id from public.tbtipopromemoria order by nome;
