-- SECURITY HOTFIX 2026-08-29
-- Scopo: chiudere le policy permissive che consentono letture cross-tenant.
-- IMPORTANTE: Supabase combina le policy PERMISSIVE con OR. Una sola USING(true)
-- rende inefficace una policy corretta basata su studio_id.

begin;

create or replace function public.current_studio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.studio_id
  from public.tbutenti u
  where u.user_id = auth.uid()
     or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by case when u.user_id = auth.uid() then 0 else 1 end
  limit 1
$$;

revoke all on function public.current_studio_id() from public;
grant execute on function public.current_studio_id() to authenticated;

-- CLIENTI: rimuove esplicitamente le policy globali che annullavano l'isolamento.
drop policy if exists "Users can manage clienti" on public.tbclienti;
drop policy if exists "Users can view all clienti" on public.tbclienti;
drop policy if exists "Studio members can view clients" on public.tbclienti;
drop policy if exists "Studio members can insert clients" on public.tbclienti;
drop policy if exists "Studio members can update clients" on public.tbclienti;
drop policy if exists "Studio members can delete clients" on public.tbclienti;
drop policy if exists "Users can view their studio clients" on public.tbclienti;
drop policy if exists "Users can insert studio clients" on public.tbclienti;
drop policy if exists "Users can update studio clients" on public.tbclienti;
drop policy if exists "Users can delete studio clients" on public.tbclienti;

alter table public.tbclienti enable row level security;

create policy "tenant_select_tbclienti" on public.tbclienti
for select to authenticated
using (studio_id = public.current_studio_id());
create policy "tenant_insert_tbclienti" on public.tbclienti
for insert to authenticated
with check (studio_id = public.current_studio_id());
create policy "tenant_update_tbclienti" on public.tbclienti
for update to authenticated
using (studio_id = public.current_studio_id())
with check (studio_id = public.current_studio_id());
create policy "tenant_delete_tbclienti" on public.tbclienti
for delete to authenticated
using (studio_id = public.current_studio_id());

-- UTENTI: non deve essere possibile enumerare gli utenti di altri studi.
drop policy if exists "Admin can manage utenti" on public.tbutenti;
drop policy if exists "Users can view all utenti" on public.tbutenti;
alter table public.tbutenti enable row level security;
create policy "tenant_select_tbutenti" on public.tbutenti
for select to authenticated
using (studio_id = public.current_studio_id() or user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- LICENZE: la vecchia admin_vendite_read_licenze era USING(true).
drop policy if exists "admin_vendite_read_licenze" on public.tbsoftware_licenze;
alter table public.tbsoftware_licenze enable row level security;
create policy "tenant_select_tbsoftware_licenze" on public.tbsoftware_licenze
for select to authenticated
using (studio_id = public.current_studio_id());

-- AML: rimuove le policy debug/globali più pericolose.
drop policy if exists "tbPraticheAML_delete_debug_all" on public."tbPraticheAML";
drop policy if exists "tbPraticheAML_insert_debug_all" on public."tbPraticheAML";
drop policy if exists "tbPraticheAML_select_debug_all" on public."tbPraticheAML";
drop policy if exists "tbPraticheAML_update_debug_all" on public."tbPraticheAML";
drop policy if exists "insert tbPraticheAML authenticated" on public."tbPraticheAML";
drop policy if exists "insert tbPraticheAML authenticated temp" on public."tbPraticheAML";
alter table public."tbPraticheAML" enable row level security;
create policy "tenant_all_tbPraticheAML" on public."tbPraticheAML"
for all to authenticated
using (studio_id = public.current_studio_id())
with check (studio_id = public.current_studio_id());

-- CONTROLLO DI GESTIONE: la policy authenticated_all esponeva tutti i tenant.
drop policy if exists "authenticated_all" on public.tbcontrollo_gestione;
alter table public.tbcontrollo_gestione enable row level security;
create policy "tenant_all_tbcontrollo_gestione" on public.tbcontrollo_gestione
for all to authenticated
using (studio_id = public.current_studio_id())
with check (studio_id = public.current_studio_id());

-- TABELLE CORE che avevano policy globali evidenti nello schema corrente.
drop policy if exists "Users can manage comunicazioni" on public.tbcomunicazioni;
drop policy if exists "Users can view all comunicazioni" on public.tbcomunicazioni;
drop policy if exists "Users can manage contatti" on public.tbcontatti;
drop policy if exists "Users can view all contatti" on public.tbcontatti;
drop policy if exists "Authenticated users can view all credentials" on public.tbcredenziali_accesso;
drop policy if exists "Authenticated users can insert credentials" on public.tbcredenziali_accesso;
drop policy if exists "Authenticated users can update all credentials" on public.tbcredenziali_accesso;
drop policy if exists "Authenticated users can delete all credentials" on public.tbcredenziali_accesso;

-- Aggiunge un'ulteriore barriera RESTRICTIVE su tutte le tabelle public con studio_id.
-- Le policy restrictive sono combinate con AND e quindi neutralizzano eventuali
-- vecchie policy permissive USING(true) rimaste in tabelle non ancora ripulite.
do $$
declare
  r record;
  p_name text;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'studio_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'tbutenti'
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
    p_name := 'tenant_barrier_' || r.table_name;
    execute format('drop policy if exists %I on public.%I', p_name, r.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (studio_id = public.current_studio_id()) with check (studio_id = public.current_studio_id())',
      p_name, r.table_name
    );
  end loop;
end $$;

commit;
