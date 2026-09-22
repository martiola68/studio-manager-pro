alter table public.tbferie_permessi_richieste
  add column if not exists tipo_permesso text,
  add column if not exists ora_richiesta time without time zone;

alter table public.tbferie_permessi_richieste
  drop constraint if exists tbferie_permessi_richieste_tipo_permesso_check;

alter table public.tbferie_permessi_richieste
  add constraint tbferie_permessi_richieste_tipo_permesso_check
  check (
    tipo_permesso is null
    or tipo_permesso = any (array['P'::text, 'PF'::text, '104'::text, 'AL'::text])
  );

comment on column public.tbferie_permessi_richieste.tipo_permesso
  is 'Tipo permesso richiesto: P, PF, 104 o AL';

comment on column public.tbferie_permessi_richieste.ora_richiesta
  is 'Ora di inizio richiesta per il permesso';

-- Forza PostgREST a rileggere lo schema dopo l'aggiunta delle colonne.
-- Evita PGRST204 quando l'API prova a salvare tipo_permesso/ora_richiesta.
notify pgrst, 'reload schema';


-- TEMPORARY ONE-SHOT RESTORE SIMONA ITALIA 2026-09-22
-- One-shot: trasferimento storico presenze Simona Italia da E-IUS ADVISORY
-- a Simona Italia dello studio REVISIONI COMMERCIALI.
-- Intervento volutamente nominativo e auto-bloccante in caso di ambiguita.

do $$
declare
  v_source_user_id uuid;
  v_target_user_id uuid;
  v_source_studio_id uuid;
  v_target_studio_id uuid;
  v_source_user_count integer;
  v_target_user_count integer;
  v_target_payroll_count integer;
  v_source_presenze integer;
  v_moved_presenze integer;
  v_source_smart integer;
  v_moved_smart integer;
  v_linked_requests integer;
  v_source_hire_date date;
begin
  select count(*)
    into v_source_user_count
  from public.tbutenti u
  join public.tbstudio s on s.id = u.studio_id
  where lower(trim(coalesce(u.email, ''))) = 'simona.italia@eius-advisory.it'
    and upper(trim(coalesce(s.ragione_sociale, ''))) like '%E-IUS%ADVISORY%';

  if v_source_user_count <> 1 then
    raise exception 'Ripristino Simona bloccato: utenti sorgente trovati %, atteso 1', v_source_user_count;
  end if;

  select u.id, u.studio_id
    into v_source_user_id, v_source_studio_id
  from public.tbutenti u
  join public.tbstudio s on s.id = u.studio_id
  where lower(trim(coalesce(u.email, ''))) = 'simona.italia@eius-advisory.it'
    and upper(trim(coalesce(s.ragione_sociale, ''))) like '%E-IUS%ADVISORY%'
  limit 1;

  select count(*)
    into v_target_user_count
  from public.tbutenti u
  join public.tbstudio s on s.id = u.studio_id
  where upper(trim(coalesce(s.ragione_sociale, ''))) like 'REVISIONI COMMERCIALI%'
    and (
      (
        upper(trim(coalesce(u.nome, ''))) = 'SIMONA'
        and upper(trim(coalesce(u.cognome, ''))) = 'ITALIA'
      )
      or
      (
        upper(trim(coalesce(u.nome, ''))) = 'ITALIA'
        and upper(trim(coalesce(u.cognome, ''))) = 'SIMONA'
      )
    )
    and coalesce(u.attivo, true) = true;

  if v_target_user_count <> 1 then
    raise exception 'Ripristino Simona bloccato: utenti destinazione attivi trovati %, atteso 1', v_target_user_count;
  end if;

  select u.id, u.studio_id
    into v_target_user_id, v_target_studio_id
  from public.tbutenti u
  join public.tbstudio s on s.id = u.studio_id
  where upper(trim(coalesce(s.ragione_sociale, ''))) like 'REVISIONI COMMERCIALI%'
    and (
      (
        upper(trim(coalesce(u.nome, ''))) = 'SIMONA'
        and upper(trim(coalesce(u.cognome, ''))) = 'ITALIA'
      )
      or
      (
        upper(trim(coalesce(u.nome, ''))) = 'ITALIA'
        and upper(trim(coalesce(u.cognome, ''))) = 'SIMONA'
      )
    )
    and coalesce(u.attivo, true) = true
  limit 1;

  if v_source_user_id = v_target_user_id then
    raise exception 'Ripristino Simona bloccato: sorgente e destinazione coincidono';
  end if;

  select count(*)
    into v_target_payroll_count
  from public.tbdipendenti d
  where d.studio_id = v_target_studio_id
    and d.utente_id = v_target_user_id;

  if v_target_payroll_count <> 1 then
    raise exception 'Ripristino Simona bloccato: record Payroll destinazione trovati %, atteso 1', v_target_payroll_count;
  end if;

  select min(d.data_assunzione)
    into v_source_hire_date
  from public.tbdipendenti d
  where d.utente_id = v_source_user_id
     or lower(trim(coalesce(d.email, ''))) = 'simona.italia@eius-advisory.it';

  select count(*)
    into v_source_presenze
  from public.tbpresenze_dipendenti p
  where p.utente_id = v_source_user_id
    and p.data_presenza <= current_date;

  if v_source_presenze = 0 then
    raise exception 'Ripristino Simona bloccato: nessuna presenza sorgente trovata fino a oggi';
  end if;

  -- Mantiene coerenti le richieste che hanno generato presenze storiche spostate.
  update public.tbferie_permessi_richieste r
     set studio_id = v_target_studio_id,
         utente_id = v_target_user_id
   where r.id in (
     select distinct p.richiesta_ferie_permessi_id
     from public.tbpresenze_dipendenti p
     where p.utente_id = v_source_user_id
       and p.data_presenza <= current_date
       and p.richiesta_ferie_permessi_id is not null
   );
  get diagnostics v_linked_requests = row_count;

  -- Se sulla nuova utenza esistono gia righe per le stesse date, lo storico E-IUS
  -- e' considerato autorevole per il ripristino richiesto.
  delete from public.tbpresenze_dipendenti target
  using public.tbpresenze_dipendenti source
  where source.utente_id = v_source_user_id
    and source.data_presenza <= current_date
    and target.utente_id = v_target_user_id
    and target.data_presenza = source.data_presenza;

  update public.tbpresenze_dipendenti
     set studio_id = v_target_studio_id,
         utente_id = v_target_user_id
   where utente_id = v_source_user_id
     and data_presenza <= current_date;
  get diagnostics v_moved_presenze = row_count;

  if v_moved_presenze <> v_source_presenze then
    raise exception 'Ripristino Simona non coerente: presenze previste %, spostate %',
      v_source_presenze, v_moved_presenze;
  end if;

  -- Trasferisce anche lo storico Smart Working fino a oggi, se presente.
  select count(*)
    into v_source_smart
  from public.tbpresenze_smart_calendario c
  where c.utente_id = v_source_user_id
    and c.data <= current_date;

  if v_source_smart > 0 then
    delete from public.tbpresenze_smart_calendario target
    using public.tbpresenze_smart_calendario source
    where source.utente_id = v_source_user_id
      and source.data <= current_date
      and target.utente_id = v_target_user_id
      and target.data = source.data;

    update public.tbpresenze_smart_calendario
       set studio_id = v_target_studio_id,
           utente_id = v_target_user_id
     where utente_id = v_source_user_id
       and data <= current_date;
    get diagnostics v_moved_smart = row_count;

    if v_moved_smart <> v_source_smart then
      raise exception 'Ripristino Smart Simona non coerente: righe previste %, spostate %',
        v_source_smart, v_moved_smart;
    end if;
  else
    v_moved_smart := 0;
  end if;

  -- Il nuovo record Payroll deve poter visualizzare anche i mesi storici.
  update public.tbdipendenti d
     set attivo = true,
         data_cessazione = null,
         data_assunzione = case
           when v_source_hire_date is null then d.data_assunzione
           when d.data_assunzione is null then v_source_hire_date
           else least(d.data_assunzione, v_source_hire_date)
         end
   where d.studio_id = v_target_studio_id
     and d.utente_id = v_target_user_id;

  if exists (
    select 1
    from public.tbpresenze_dipendenti p
    where p.utente_id = v_source_user_id
      and p.data_presenza <= current_date
  ) then
    raise exception 'Ripristino Simona incompleto: restano presenze storiche sulla vecchia utenza';
  end if;

  raise notice 'Ripristino Simona completato: presenze %, smart %, richieste collegate %',
    v_moved_presenze, v_moved_smart, v_linked_requests;
end
$$;

