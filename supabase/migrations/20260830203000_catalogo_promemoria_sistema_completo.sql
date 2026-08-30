begin;

-- Catalogo unico dei tipi promemoria: tutti i tipi sono di sistema.
-- Solo l'amministratore generale di sistema può creare/modificare/eliminare.

alter table public.tbtipopromemoria add column if not exists origine char(1);
alter table public.tbtipopromemoria add column if not exists studio_id uuid references public.tbstudio(id) on delete cascade;

-- Uniforma i tipi esistenti: sistema, globali, senza descrizione.
update public.tbtipopromemoria
set origine = 'S', studio_id = null, descrizione = null;

-- Catalogo e colori fissi per gruppo.
with catalogo(nome, colore) as (
  values
  ('Appuntamento','#3B82F6'),('Chiamata','#3B82F6'),('Email','#3B82F6'),('Riunione','#3B82F6'),('Videoconferenza','#3B82F6'),('Scadenza','#3B82F6'),('Avviso di scadenza','#3B82F6'),('Scadenza Documento','#3B82F6'),('Richiamare cliente','#3B82F6'),('Sollecito','#3B82F6'),('Follow-up','#3B82F6'),('Attività interna','#3B82F6'),('Nota operativa','#3B82F6'),('Altro','#3B82F6'),
  ('Apertura pratica','#06B6D4'),('Lavorazione pratica','#06B6D4'),('Verifica pratica','#06B6D4'),('Integrazione documenti','#06B6D4'),('Documenti mancanti','#06B6D4'),('Invio documenti','#06B6D4'),('Firma documenti','#06B6D4'),('Chiusura pratica','#06B6D4'),('Rinnovo pratica','#06B6D4'),('Aggiornamento anagrafica','#06B6D4'),
  ('Dichiarazione redditi','#8B5CF6'),('IVA','#8B5CF6'),('LIPE','#8B5CF6'),('770','#8B5CF6'),('CU','#8B5CF6'),('IMU','#8B5CF6'),('IRAP','#8B5CF6'),('F24','#8B5CF6'),('Esterometro','#8B5CF6'),('Intrastat','#8B5CF6'),('Dichiarazione IVA','#8B5CF6'),('Acconto imposte','#8B5CF6'),('Saldo imposte','#8B5CF6'),('Comunicazione fiscale','#8B5CF6'),('Adempimento fiscale','#8B5CF6'),
  ('Registrazioni contabili','#6366F1'),('Chiusura contabilità','#6366F1'),('Situazione contabile','#6366F1'),('Riconciliazione bancaria','#6366F1'),('Liquidazione IVA','#6366F1'),('Controllo contabile','#6366F1'),('Bilancio','#6366F1'),('Deposito bilancio','#6366F1'),('Inventario','#6366F1'),('Controllo documentazione contabile','#6366F1'),
  ('Agenzia delle Entrate','#0EA5E9'),('INPS','#0EA5E9'),('INAIL','#0EA5E9'),('Camera di commercio','#0EA5E9'),('Altri enti','#0EA5E9'),('Comunicazione ente','#0EA5E9'),('Risposta ente','#0EA5E9'),('Richiesta documentazione ente','#0EA5E9'),
  ('Avviso bonario','#EF4444'),('Cartella','#EF4444'),('Accertamento','#EF4444'),('CIVIS','#EF4444'),('Autotutela','#EF4444'),('Ricorso','#EF4444'),('Udienza','#EF4444'),('Rateazione','#EF4444'),('Sgravio','#EF4444'),('Risposta Agenzia Entrate','#EF4444'),('Termine contenzioso','#EF4444'),
  ('Assunzione','#F59E0B'),('Cessazione','#F59E0B'),('Trasformazione rapporto','#F59E0B'),('Proroga','#F59E0B'),('Collocamento','#F59E0B'),('Collocamento disabili','#F59E0B'),('Elaborazione paghe','#F59E0B'),('Presenze','#F59E0B'),('Ferie e permessi','#F59E0B'),('Malattia','#F59E0B'),('Infortunio','#F59E0B'),('Contestazione disciplinare','#F59E0B'),('Conciliazione','#F59E0B'),('Comunicazione obbligatoria','#F59E0B'),
  ('Assemblea','#14B8A6'),('CDA','#14B8A6'),('Verbale','#14B8A6'),('Distribuzione utili','#14B8A6'),('Nomina amministratore','#14B8A6'),('Cambio amministratore','#14B8A6'),('Nomina sindaco/revisore','#14B8A6'),('Scadenza carica','#14B8A6'),('Variazione societaria','#14B8A6'),('Messa in liquidazione','#14B8A6'),('Pratica CCIAA','#14B8A6'),('Deposito atto','#14B8A6'),
  ('Adeguata verifica','#7C3AED'),('Identificazione cliente','#7C3AED'),('Titolare effettivo','#7C3AED'),('AV1','#7C3AED'),('AV2','#7C3AED'),('AV4','#7C3AED'),('Aggiornamento AML','#7C3AED'),('Rinnovo adeguata verifica','#7C3AED'),('Documento identità in scadenza','#7C3AED'),
  ('Revisione','#10B981'),('Checklist revisione','#10B981'),('Follow-up revisione','#10B981'),('Controllo di gestione','#10B981'),('Report trimestrale','#10B981'),('Verifica documentazione','#10B981'),('Richiesta documentazione','#10B981'),
  ('Consulenza base','#84CC16'),('Consulenza Senior','#84CC16'),('Parere','#84CC16'),('Analisi','#84CC16'),('Elaborazioni','#84CC16'),('Riunione cliente','#84CC16'),('Attività professionale','#84CC16'),
  ('Documento da predisporre','#64748B'),('Documento da verificare','#64748B'),('Documento da firmare','#64748B'),('Documento da inviare','#64748B'),('Documento da ricevere','#64748B'),('Documento in scadenza','#64748B'),('Rinnovo documento','#64748B'),
  ('Emissione parcella','#F97316'),('Proforma','#F97316'),('Fattura','#F97316'),('Incasso','#F97316'),('Pagamento','#F97316'),('Sollecito pagamento','#F97316'),('Recupero credito','#F97316'),('Rinnovo contratto','#F97316')
), aggiornati as (
  update public.tbtipopromemoria t
  set colore = c.colore, origine = 'S', studio_id = null, descrizione = null
  from catalogo c
  where lower(trim(t.nome)) = lower(trim(c.nome))
  returning t.id
)
insert into public.tbtipopromemoria (nome, descrizione, colore, origine, studio_id)
select c.nome, null, c.colore, 'S', null
from catalogo c
where not exists (
  select 1 from public.tbtipopromemoria t
  where lower(trim(t.nome)) = lower(trim(c.nome))
);

alter table public.tbtipopromemoria alter column origine set default 'S';
alter table public.tbtipopromemoria alter column origine set not null;

alter table public.tbtipopromemoria drop constraint if exists tbtipopromemoria_personale_studio_check;
alter table public.tbtipopromemoria add constraint tbtipopromemoria_personale_studio_check
check ((origine = 'S' and studio_id is null) or (origine = 'P' and studio_id is not null));

-- Lettura del catalogo per tutti gli autenticati; scrittura esclusivamente admin generale.
alter table public.tbtipopromemoria enable row level security;

drop policy if exists "catalog_select_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_insert_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_update_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_delete_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_guard_select_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_guard_insert_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_guard_update_tbtipopromemoria" on public.tbtipopromemoria;
drop policy if exists "catalog_guard_delete_tbtipopromemoria" on public.tbtipopromemoria;

create policy "catalog_select_tbtipopromemoria" on public.tbtipopromemoria for select to authenticated using (origine = 'S');
create policy "catalog_insert_tbtipopromemoria" on public.tbtipopromemoria for insert to authenticated with check (origine = 'S' and studio_id is null and public.is_system_catalog_admin());
create policy "catalog_update_tbtipopromemoria" on public.tbtipopromemoria for update to authenticated using (origine = 'S' and public.is_system_catalog_admin()) with check (origine = 'S' and studio_id is null and public.is_system_catalog_admin());
create policy "catalog_delete_tbtipopromemoria" on public.tbtipopromemoria for delete to authenticated using (origine = 'S' and public.is_system_catalog_admin());

create policy "catalog_guard_select_tbtipopromemoria" on public.tbtipopromemoria as restrictive for select to authenticated using (origine = 'S');
create policy "catalog_guard_insert_tbtipopromemoria" on public.tbtipopromemoria as restrictive for insert to authenticated with check (origine = 'S' and studio_id is null and public.is_system_catalog_admin());
create policy "catalog_guard_update_tbtipopromemoria" on public.tbtipopromemoria as restrictive for update to authenticated using (origine = 'S' and public.is_system_catalog_admin()) with check (origine = 'S' and studio_id is null and public.is_system_catalog_admin());
create policy "catalog_guard_delete_tbtipopromemoria" on public.tbtipopromemoria as restrictive for delete to authenticated using (origine = 'S' and public.is_system_catalog_admin());

commit;
