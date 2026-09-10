begin;

create table if not exists public.tbpresenze_report_email_config (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.tbstudio(id) on delete cascade,
  destinatari text[] not null default '{}',
  ora_invio time not null default '08:00',
  attivo boolean not null default false,
  ultimo_invio_data date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id)
);

alter table public.tbpresenze_report_email_config enable row level security;

drop policy if exists "tenant_select_tbpresenze_report_email_config" on public.tbpresenze_report_email_config;
drop policy if exists "tenant_insert_tbpresenze_report_email_config" on public.tbpresenze_report_email_config;
drop policy if exists "tenant_update_tbpresenze_report_email_config" on public.tbpresenze_report_email_config;
drop policy if exists "tenant_delete_tbpresenze_report_email_config" on public.tbpresenze_report_email_config;

create policy "tenant_select_tbpresenze_report_email_config"
on public.tbpresenze_report_email_config
for select to authenticated
using (studio_id = public.current_studio_id());

create policy "tenant_insert_tbpresenze_report_email_config"
on public.tbpresenze_report_email_config
for insert to authenticated
with check (studio_id = public.current_studio_id());

create policy "tenant_update_tbpresenze_report_email_config"
on public.tbpresenze_report_email_config
for update to authenticated
using (studio_id = public.current_studio_id())
with check (studio_id = public.current_studio_id());

create policy "tenant_delete_tbpresenze_report_email_config"
on public.tbpresenze_report_email_config
for delete to authenticated
using (studio_id = public.current_studio_id());

commit;
