-- Tipi scadenza: S = sistema, P = personale
-- ESEGUIRE MANUALMENTE SU SUPABASE prima del deploy del codice applicativo.

begin;

-- Identifica l'unico amministratore autorizzato a gestire il catalogo di sistema.
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
      and upper(trim(coalesce(s.ragione_sociale, ''))) = 'REVISIONI COMMERCIALI'
  )
$$;

revoke all on function public.is_system_catalog_admin() from public;
grant execute on function public.is_system_catalog_admin() to authenticated;

-- 1) Origine del tipo scadenza.
alter table public.tbtipi_scadenze add column if not exists origine char(1);

-- Tutte le scadenze già presenti diventano scadenze di sistema.
update public.tbtipi_scadenze set origine = 'S' where origine is null or origine not in ('S', 'P');

alter table public.tbtipi_scadenze alter column origine set default 'P';
alter table public.tbtipi_scadenze alter column origine set not null;
alter table public.tbtipi_scadenze drop constraint if exists tbtipi_scadenze_origine_check;
alter table public.tbtipi_scadenze
  add constraint tbtipi_scadenze_origine_check check (origine in ('S', 'P'));

comment on column public.tbtipi_scadenze.origine is
  'S = scadenza di sistema condivisa tra tutti gli studi; P = scadenza personale dello studio proprietario';

-- 2) Stato locale delle scadenze di sistema.
-- Una S è unica e condivisa; ogni studio può attivarla/disattivarla senza modificare gli altri studi.
create table if not exists public.tbtipi_scadenze_studio (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  tipo_scadenza_id uuid not null references public.tbtipi_scadenze(id) on delete cascade,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tbtipi_scadenze_studio unique (studio_id, tipo_scadenza_id)
);

create index if not exists idx_tbtipi_scadenze_studio_studio on public.tbtipi_scadenze_studio(studio_id);
create index if not exists idx_tbtipi_scadenze_studio_tipo on public.tbtipi_scadenze_studio(tipo_scadenza_id);

-- 3) RLS catalogo.
alter table public.tbtipi_scadenze enable row level security;

drop policy if exists "tenant_barrier_tbtipi_scadenze" on public.tbtipi_scadenze;
drop policy if exists "catalog_select_tbtipi_scadenze" on public.tbtipi_scadenze;
drop policy if exists "catalog_insert_tbtipi_scadenze" on public.tbtipi_scadenze;
drop policy if exists "catalog_update_tbtipi_scadenze" on public.tbtipi_scadenze;
drop policy if exists "catalog_delete_tbtipi_scadenze" on public.tbtipi_scadenze;
drop policy if exists "catalog_guard_select_tbtipi_scadenze" on public.tbtipi_scadenze;
drop policy if exists "catalog_guard_insert_tbtipi_scadenze" on public.tbtipi_scadenze;
drop policy if exists "catalog_guard_update_tbtipi_scadenze" on public.tbtipi_scadenze;
drop policy if exists "catalog_guard_delete_tbtipi_scadenze" on public.tbtipi_scadenze;

create policy "catalog_select_tbtipi_scadenze"
on public.tbtipi_scadenze for select to authenticated
using (origine = 'S' or (origine = 'P' and studio_id = public.current_studio_id()));

create policy "catalog_insert_tbtipi_scadenze"
on public.tbtipi_scadenze for insert to authenticated
with check (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
);

create policy "catalog_update_tbtipi_scadenze"
on public.tbtipi_scadenze for update to authenticated
using (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
)
with check (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
);

create policy "catalog_delete_tbtipi_scadenze"
on public.tbtipi_scadenze for delete to authenticated
using (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
);

-- Barriere restrictive: neutralizzano eventuali vecchie policy permissive.
create policy "catalog_guard_select_tbtipi_scadenze"
on public.tbtipi_scadenze as restrictive for select to authenticated
using (origine = 'S' or (origine = 'P' and studio_id = public.current_studio_id()));

create policy "catalog_guard_insert_tbtipi_scadenze"
on public.tbtipi_scadenze as restrictive for insert to authenticated
with check (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
);

create policy "catalog_guard_update_tbtipi_scadenze"
on public.tbtipi_scadenze as restrictive for update to authenticated
using (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
)
with check (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
);

create policy "catalog_guard_delete_tbtipi_scadenze"
on public.tbtipi_scadenze as restrictive for delete to authenticated
using (
  (origine = 'P' and studio_id = public.current_studio_id())
  or (origine = 'S' and public.is_system_catalog_admin())
);

-- 4) RLS stato locale per studio.
alter table public.tbtipi_scadenze_studio enable row level security;
drop policy if exists "tenant_barrier_tbtipi_scadenze_studio" on public.tbtipi_scadenze_studio;
drop policy if exists "tenant_select_tbtipi_scadenze_studio" on public.tbtipi_scadenze_studio;
drop policy if exists "tenant_insert_tbtipi_scadenze_studio" on public.tbtipi_scadenze_studio;
drop policy if exists "tenant_update_tbtipi_scadenze_studio" on public.tbtipi_scadenze_studio;
drop policy if exists "tenant_delete_tbtipi_scadenze_studio" on public.tbtipi_scadenze_studio;

create policy "tenant_select_tbtipi_scadenze_studio"
on public.tbtipi_scadenze_studio for select to authenticated
using (studio_id = public.current_studio_id());

create policy "tenant_insert_tbtipi_scadenze_studio"
on public.tbtipi_scadenze_studio for insert to authenticated
with check (studio_id = public.current_studio_id());

create policy "tenant_update_tbtipi_scadenze_studio"
on public.tbtipi_scadenze_studio for update to authenticated
using (studio_id = public.current_studio_id())
with check (studio_id = public.current_studio_id());

create policy "tenant_delete_tbtipi_scadenze_studio"
on public.tbtipi_scadenze_studio for delete to authenticated
using (studio_id = public.current_studio_id());

commit;

-- VERIFICHE:
-- select origine, count(*) from public.tbtipi_scadenze group by origine order by origine;
-- Tutte le righe preesistenti devono risultare S.
-- select public.is_system_catalog_admin(); -- true solo per Mario Artiola / REVISIONI COMMERCIALI / Admin.
