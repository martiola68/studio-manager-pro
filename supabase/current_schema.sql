


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."aggiorna_giorni_residui_contenzioso"() RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update public.tbcontenzioso_scadenze_generate
  set giorni_residui = data_scadenza - current_date
  where stato = 'Aperta';
$$;


ALTER FUNCTION "public"."aggiorna_giorni_residui_contenzioso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_set_studio_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Se studio_id è NULL, recupera dallo studio dell'utente loggato
  IF NEW.studio_id IS NULL THEN
    SELECT studio_id INTO NEW.studio_id
    FROM tbutenti
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Se ancora NULL dopo il recupero, BLOCCA l'operazione
    IF NEW.studio_id IS NULL THEN
      RAISE EXCEPTION 'Cannot insert/update cliente without studio_id. User has no studio assigned.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_set_studio_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcola_data_scad_pres"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.data_approvazione IS NOT NULL THEN
    NEW.data_scad_pres := NEW.data_approvazione + INTERVAL '30 days';
  ELSE
    NEW.data_scad_pres := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calcola_data_scad_pres"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcola_giorni_restanti_contenzioso"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.data_scadenza is not null then
    new.giorni_restanti := greatest(
      0,
      new.data_scadenza - current_date
    );
  end if;

  new.updated_at := now();

  return new;
end;
$$;


ALTER FUNCTION "public"."calcola_giorni_restanti_contenzioso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcola_scadenza_cartella"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  giorni integer;
begin
  select giorni_scadenza
  into giorni
  from public.tbcontenzioso_tipi_atto
  where id = new.tipo_atto_id;

  if new.data_ricezione is not null and giorni is not null then
    new.data_scadenza := new.data_ricezione + giorni;
  end if;

  if new.genera_ricorso = true and new.data_apertura_ricorso is null then
    new.data_apertura_ricorso := current_date;
  end if;

  new.updated_at := now();

  return new;
end;
$$;


ALTER FUNCTION "public"."calcola_scadenza_cartella"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcola_scadenza_con_sospensione"("data_base" "date", "giorni" integer, "direzione" "text" DEFAULT '+'::"text") RETURNS "date"
    LANGUAGE "plpgsql"
    AS $$
declare
  data_corrente date := data_base;
  contatore integer := 0;
  step integer := case when direzione = '-' then -1 else 1 end;
begin
  while contatore < giorni loop
    data_corrente := data_corrente + step;

    -- salta agosto
    if not (
      extract(month from data_corrente) = 8
    ) then
      contatore := contatore + 1;
    end if;
  end loop;

  return data_corrente;
end;
$$;


ALTER FUNCTION "public"."calcola_scadenza_con_sospensione"("data_base" "date", "giorni" integer, "direzione" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcola_scadenza_con_sospensione"("p_data_base" "date", "p_giorni" integer, "p_direzione" "text", "p_applica_sospensione" boolean) RETURNS "date"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_data date := p_data_base;
  v_count integer := 0;
  v_in_sospensione boolean;
begin
  if p_data_base is null then
    return null;
  end if;

  while v_count < p_giorni loop
    if p_direzione = '+' then
      v_data := v_data + 1;
    else
      v_data := v_data - 1;
    end if;

    v_in_sospensione := false;

    if p_applica_sospensione then
      select exists (
        select 1
        from public.tbcontenzioso_sospensioni s
        where s.attivo = true
          and v_data between s.data_inizio and s.data_fine
      )
      into v_in_sospensione;
    end if;

    if not v_in_sospensione then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_data;
end;
$$;


ALTER FUNCTION "public"."calcola_scadenza_con_sospensione"("p_data_base" "date", "p_giorni" integer, "p_direzione" "text", "p_applica_sospensione" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcola_scadenza_contenzioso"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  giorni integer;
begin
  if new.data_ricezione is not null then

    select giorni_scadenza
    into giorni
    from public.tbcontenzioso_tipi_atto
    where id = new.tipo_atto_id;

    if giorni is not null then
      new.data_scadenza := new.data_ricezione + (giorni || ' days')::interval;
    end if;

  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."calcola_scadenza_contenzioso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcola_scadenze_tbpratiche_variazioni"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.data_atto is not null then
    new.data_scadenza_cciaa :=
      new.data_atto + (coalesce(new.giorni_scadenza_cciaa, 30) || ' days')::interval;
  end if;

  if new.obbligo_ade = true and new.data_evasione_cciaa is not null then
    new.data_scadenza_ade :=
      new.data_evasione_cciaa + (coalesce(new.giorni_scadenza_ade, 30) || ' days')::interval;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."calcola_scadenze_tbpratiche_variazioni"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_limite_societa_responsabili"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  max_societa integer;
  societa_esistenti integer;
  tenant2_attivo boolean;
begin
  select
    coalesce(nullif(trim(ragione_sociale_tenant2), ''), '') <> ''
  into tenant2_attivo
  from public.tbstudio
  where id = new.studio_id;

  max_societa := case
    when tenant2_attivo then 2
    else 1
  end;

  select count(*)
  into societa_esistenti
  from public."tbRespAVSocieta"
  where studio_id = new.studio_id;

  if societa_esistenti >= max_societa then
    raise exception 'Limite società responsabili raggiunto per i tenant attivi';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."check_limite_societa_responsabili"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."completa_dati_scadenza_contenzioso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_processo record;
begin
  select
    p.studio_id,
    p.cliente_id,
    p.professionista_incaricato_id,
    p.referente_id,
    c.utente_operatore_id
  into v_processo
  from public.tbcontenzioso_processo p
  left join public.tbclienti c
    on c.id = p.cliente_id
  where p.id = new.processo_id;

  if not found then
    raise exception
      'Processo contenzioso non trovato: %',
      new.processo_id;
  end if;

  new.studio_id :=
    v_processo.studio_id;

  new.cliente_id :=
    v_processo.cliente_id;

  new.operatore_responsabile_id :=
    coalesce(
      v_processo.professionista_incaricato_id,
      v_processo.referente_id,
      v_processo.utente_operatore_id
    );

  new.giorni_residui :=
    new.data_scadenza - current_date;

  new.updated_at := now();

  return new;
end;
$$;


ALTER FUNCTION "public"."completa_dati_scadenza_contenzioso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."genera_alert_contenzioso_base"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN

  -- AVVISI BONARI
  INSERT INTO public.tbcontenzioso_alert_email (
    archivio,
    pratica_id,
    giorni_preavviso,
    data_scadenza,
    operatore_responsabile_id,
    email_destinatario,
    oggetto,
    corpo
  )
  SELECT
    'avvisi',
    a.id,
    (a.data_scadenza - current_date)::integer,
    a.data_scadenza,
    a.operatore_responsabile_id,
    u.email,
    CASE
      WHEN (a.data_scadenza - current_date)::integer = 0
      THEN 'Scadenza oggi avviso bonario - ' || COALESCE(c.ragione_sociale, 'Cliente')
      ELSE 'Scadenza avviso bonario - ' || COALESCE(c.ragione_sociale, 'Cliente')
    END,
    CASE
      WHEN (a.data_scadenza - current_date)::integer = 0
      THEN
        'Avviso bonario in scadenza oggi. Cliente: ' || COALESCE(c.ragione_sociale, '-') ||
        ' - Atto n. ' || COALESCE(a.numero_atto, '-') ||
        ' - Scadenza: ' || TO_CHAR(a.data_scadenza, 'DD/MM/YYYY')
      ELSE
        'Avviso bonario in scadenza tra ' ||
        (a.data_scadenza - current_date)::integer ||
        ' giorni. Cliente: ' || COALESCE(c.ragione_sociale, '-') ||
        ' - Atto n. ' || COALESCE(a.numero_atto, '-') ||
        ' - Scadenza: ' || TO_CHAR(a.data_scadenza, 'DD/MM/YYYY')
    END
  FROM public.tbcontenzioso_avvisi_bonari a
  LEFT JOIN public.tbclienti c ON c.id = a.cliente_id
  LEFT JOIN public.tbutenti u ON u.id = a.operatore_responsabile_id
  WHERE COALESCE(a.pratica_chiusa, false) = false
    AND a.data_scadenza IS NOT NULL
    AND a.operatore_responsabile_id IS NOT NULL
    AND u.email IS NOT NULL
    AND (a.data_scadenza - current_date)::integer IN (15, 10, 5, 1, 0)
  ON CONFLICT (archivio, pratica_id, giorni_preavviso, data_scadenza)
  DO NOTHING;

  -- CARTELLE ESATTORIALI
  INSERT INTO public.tbcontenzioso_alert_email (
    archivio,
    pratica_id,
    giorni_preavviso,
    data_scadenza,
    operatore_responsabile_id,
    email_destinatario,
    oggetto,
    corpo
  )
  SELECT
    'cartelle',
    cte.id,
    (cte.data_scadenza - current_date)::integer,
    cte.data_scadenza,
    cte.operatore_responsabile_id,
    u.email,
    CASE
      WHEN (cte.data_scadenza - current_date)::integer = 0
      THEN 'Scadenza oggi cartella esattoriale - ' || COALESCE(cli.ragione_sociale, 'Cliente')
      ELSE 'Scadenza cartella esattoriale - ' || COALESCE(cli.ragione_sociale, 'Cliente')
    END,
    CASE
      WHEN (cte.data_scadenza - current_date)::integer = 0
      THEN
        'Cartella esattoriale in scadenza oggi. Cliente: ' || COALESCE(cli.ragione_sociale, '-') ||
        ' - Cartella n. ' || COALESCE(cte.numero_cartella, '-') ||
        ' - Scadenza: ' || TO_CHAR(cte.data_scadenza, 'DD/MM/YYYY')
      ELSE
        'Cartella esattoriale in scadenza tra ' ||
        (cte.data_scadenza - current_date)::integer ||
        ' giorni. Cliente: ' || COALESCE(cli.ragione_sociale, '-') ||
        ' - Cartella n. ' || COALESCE(cte.numero_cartella, '-') ||
        ' - Scadenza: ' || TO_CHAR(cte.data_scadenza, 'DD/MM/YYYY')
    END
  FROM public.tbcontenzioso_cartelle cte
  LEFT JOIN public.tbclienti cli ON cli.id = cte.cliente_id
  LEFT JOIN public.tbutenti u ON u.id = cte.operatore_responsabile_id
  WHERE COALESCE(cte.pratica_chiusa, false) = false
    AND cte.data_scadenza IS NOT NULL
    AND cte.operatore_responsabile_id IS NOT NULL
    AND u.email IS NOT NULL
    AND (cte.data_scadenza - current_date)::integer IN (15, 10, 5, 1, 0)
  ON CONFLICT (archivio, pratica_id, giorni_preavviso, data_scadenza)
  DO NOTHING;

END;
$$;


ALTER FUNCTION "public"."genera_alert_contenzioso_base"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."genera_rate_iniziali_software"("p_licenza_id" "uuid", "p_studio_id" "uuid", "p_data_attivazione" "date", "p_modalita" "text", "p_importo_totale" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  delete from public.tbsoftware_pagamenti
  where licenza_id = p_licenza_id
    and tipo_pagamento = 'iniziale';

  if p_modalita = 'unica_soluzione' then
    insert into public.tbsoftware_pagamenti (
      licenza_id,
      studio_id,
      tipo_pagamento,
      descrizione,
      numero_rata,
      totale_rate,
      data_scadenza,
      importo,
      stato_pagamento
    )
    values (
      p_licenza_id,
      p_studio_id,
      'iniziale',
      'Pagamento iniziale in unica soluzione',
      1,
      1,
      p_data_attivazione,
      p_importo_totale,
      'da_pagare'
    );

  elsif p_modalita = 'trimestrale_4_rate' then
    insert into public.tbsoftware_pagamenti (
      licenza_id,
      studio_id,
      tipo_pagamento,
      descrizione,
      numero_rata,
      totale_rate,
      data_scadenza,
      importo,
      stato_pagamento
    )
    values
      (p_licenza_id, p_studio_id, 'iniziale', 'Rata iniziale 1/4', 1, 4, p_data_attivazione, 1625, 'da_pagare'),
      (p_licenza_id, p_studio_id, 'iniziale', 'Rata iniziale 2/4', 2, 4, (p_data_attivazione + interval '3 month')::date, 1625, 'da_pagare'),
      (p_licenza_id, p_studio_id, 'iniziale', 'Rata iniziale 3/4', 3, 4, (p_data_attivazione + interval '6 month')::date, 1625, 'da_pagare'),
      (p_licenza_id, p_studio_id, 'iniziale', 'Rata iniziale 4/4', 4, 4, (p_data_attivazione + interval '9 month')::date, 1625, 'da_pagare');
  end if;
end;
$$;


ALTER FUNCTION "public"."genera_rate_iniziali_software"("p_licenza_id" "uuid", "p_studio_id" "uuid", "p_data_attivazione" "date", "p_modalita" "text", "p_importo_totale" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."genera_scadenze_modulo_contenzioso"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  r record;
  v_modulo text := tg_argv[0];
  v_data_base date;
  v_scadenza date;
  v_json jsonb;
begin
  v_json := to_jsonb(new);

  for r in
    select *
    from public.tbcontenzioso_regole_scadenze
    where attivo = true
      and modulo = v_modulo
    order by ordine
  loop
    v_data_base := null;

    if v_json ? r.campo_data_base then
      v_data_base := nullif(v_json ->> r.campo_data_base, '')::date;
    end if;

    if v_data_base is not null then
      v_scadenza := public.calcola_scadenza_con_sospensione(
        v_data_base,
        r.giorni,
        r.direzione,
        r.applica_sospensione_feriale
      );

      perform public.upsert_scadenza_contenzioso(
        new.processo_id,
        new.id,
        r.modulo,
        r.codice,
        r.descrizione,
        v_scadenza
      );
    end if;
  end loop;

  return new;
end;
$$;


ALTER FUNCTION "public"."genera_scadenze_modulo_contenzioso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."genera_scadenze_processo"("p_processo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
declare
  r record;
  v_data_base date;
  v_scadenza date;
  v_processo record;
begin
  -- recupero processo
  select * into v_processo
  from tbcontenzioso_processo
  where id = p_processo_id;

  if not found then
    return;
  end if;

  -- ciclo regole attive
  for r in
    select *
    from tbcontenzioso_regole_scadenze
    where attivo = true
    order by ordine
  loop

    -- prende dinamicamente il campo data base
    execute format(
      'select ($1).%I::date',
      r.campo_data_base
    )
    into v_data_base
    using v_processo;

    -- calcolo scadenza
    v_scadenza := public.calcola_scadenza_con_sospensione(
      v_data_base,
      r.giorni,
      r.direzione,
      r.applica_sospensione_feriale
    );

    -- salvataggio
    perform public.upsert_scadenza_contenzioso(
      p_processo_id,
      r.modulo,
      r.codice,
      r.descrizione,
      v_scadenza
    );

  end loop;
end;
$_$;


ALTER FUNCTION "public"."genera_scadenze_processo"("p_processo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_cod_cliente"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.cod_cliente := 'CLI' || LPAD(NEXTVAL('cod_cliente_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_cod_cliente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_promemoria_badge_count"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select count(*)::int
  from public.tbpromemoria
  where working_progress = 'Aperto'
    and destinatario_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_promemoria_badge_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tbutenti
    WHERE lower(email) = lower(new.email)
  ) THEN
    UPDATE public.tbutenti
    SET
      user_id = new.id,
      updated_at = now()
    WHERE lower(email) = lower(new.email);
  ELSE
    INSERT INTO public.tbutenti (
      id,
      user_id,
      email,
      nome,
      cognome,
      tipo_utente,
      attivo
    )
    VALUES (
      new.id,
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'nome', ''),
      COALESCE(new.raw_user_meta_data->>'cognome', ''),
      COALESCE(new.raw_user_meta_data->>'tipo_utente', 'User'),
      true
    );
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Automatically creates a tbutenti profile when a new auth user is created, using the same UUID. Uses ON CONFLICT to avoid duplicate key errors.';



CREATE OR REPLACE FUNCTION "public"."is_chat_participant"("_conversazione_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tbconversazioni_utenti
    WHERE conversazione_id = _conversazione_id
    AND utente_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_chat_participant"("_conversazione_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rigenera_scadenze_contenzioso_base"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- AVVISI BONARI
  update public.tbcontenzioso_avvisi_bonari a
  set
    data_scadenza = public.calcola_scadenza_con_sospensione(
      a.data_ricezione,
      coalesce(t.giorni_scadenza, 0),
      '+',
      true
    ),
    giorni_residui = (
      public.calcola_scadenza_con_sospensione(
        a.data_ricezione,
        coalesce(t.giorni_scadenza, 0),
        '+',
        true
      ) - current_date
    )
  from public.tbcontenzioso_tipi_atto t
  where a.tipo_atto_id = t.id
    and a.data_ricezione is not null
    and coalesce(a.pratica_chiusa, false) = false;

  -- CARTELLE
  update public.tbcontenzioso_cartelle c
  set
    data_scadenza = public.calcola_scadenza_con_sospensione(
      c.data_ricezione,
      coalesce(t.giorni_scadenza, 0),
      '+',
      true
    ),
    giorni_residui = (
      public.calcola_scadenza_con_sospensione(
        c.data_ricezione,
        coalesce(t.giorni_scadenza, 0),
        '+',
        true
      ) - current_date
    )
  from public.tbcontenzioso_tipi_atto t
  where c.tipo_atto_id = t.id
    and c.data_ricezione is not null
    and coalesce(c.pratica_chiusa, false) = false;
end;
$$;


ALTER FUNCTION "public"."rigenera_scadenze_contenzioso_base"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_old public.tbcontrollo_gestione%rowtype;
  v_new_id uuid;
begin
  select *
  into v_old
  from public.tbcontrollo_gestione
  where id = p_controllo_id
  for update;

  if not found then
    raise exception 'Controllo non trovato';
  end if;

  update public.tbcontrollo_gestione
  set archiviato = true,
      data_archiviazione = now(),
      data_storico = v_old.data_esecuzione,
      updated_at = now()
  where id = p_controllo_id;

  insert into public.tbcontrollo_gestione (
    studio_id,
    cliente_id,
    cadenza_controllo,
    data_esecuzione,
    data_storico,
    note,
    link,
    archiviato,
    controllo_precedente_id
  )
  values (
    v_old.studio_id,
    v_old.cliente_id,
    v_old.cadenza_controllo,
    current_date,
    null,
    null,
    v_old.link,
    false,
    v_old.id
  )
  returning id into v_new_id;

  insert into public.tbcontrollo_gestione_utenti (
    controllo_id,
    utente_id
  )
  select
    v_new_id,
    utente_id
  from public.tbcontrollo_gestione_utenti
  where controllo_id = p_controllo_id;

  return v_new_id;
end;
$$;


ALTER FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_old public.tbcontrollo_gestione%rowtype;
  v_new_id uuid;
begin
  select *
  into v_old
  from public.tbcontrollo_gestione
  where id = p_controllo_id
  for update;

  if not found then
    raise exception 'Controllo non trovato';
  end if;

  update public.tbcontrollo_gestione
  set archiviato = true,
      data_archiviazione = now(),
      data_storico = v_old.data_esecuzione,
      updated_at = now()
  where id = p_controllo_id;

  insert into public.tbcontrollo_gestione (
    studio_id,
    cliente_id,
    cadenza_controllo,
    data_esecuzione,
    data_storico,
    note,
    link,
    archiviato,
    controllo_precedente_id
  )
  values (
    v_old.studio_id,
    v_old.cliente_id,
    v_old.cadenza_controllo,
    p_data_esecuzione,
    null,
    null,
    v_old.link,
    false,
    v_old.id
  )
  returning id into v_new_id;

  insert into public.tbcontrollo_gestione_utenti (
    controllo_id,
    utente_id
  )
  select
    v_new_id,
    utente_id
  from public.tbcontrollo_gestione_utenti
  where controllo_id = p_controllo_id;

  return v_new_id;
end;
$$;


ALTER FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_old public.tbcontrollo_gestione%rowtype;
  v_new_id uuid;
begin
  select *
  into v_old
  from public.tbcontrollo_gestione
  where id = p_controllo_id;

  if not found then
    raise exception 'Controllo non trovato';
  end if;

  update public.tbcontrollo_gestione
  set
    archiviato = true,
    data_storico = v_old.data_esecuzione
  where id = p_controllo_id;

  insert into public.tbcontrollo_gestione (
    studio_id,
    cliente_id,
    cadenza_controllo,
    data_esecuzione,
    data_storico,
    note,
    link,
    archiviato,
    controllo_precedente_id
  )
  values (
    v_old.studio_id,
    v_old.cliente_id,
    v_old.cadenza_controllo,
    p_data_esecuzione,
    null,
    p_note,
    v_old.link,
    false,
    p_controllo_id
  )
  returning id into v_new_id;

  insert into public.tbcontrollo_gestione_utenti (
    controllo_id,
    utente_id
  )
  select
    v_new_id,
    utente_id
  from public.tbcontrollo_gestione_utenti
  where controllo_id = p_controllo_id;

  return v_new_id;
end;
$$;


ALTER FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_tbavfascicolidocumenti"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_tbavfascicolidocumenti"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_destinatari_scadenza_centrale"("p_scadenza_id" "uuid", "p_studio_id" "uuid", "p_operatore_responsabile_id" "uuid" DEFAULT NULL::"uuid", "p_settore_fiscale" boolean DEFAULT false, "p_settore_lavoro" boolean DEFAULT false, "p_settore_consulenza" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  /*
   * Eliminiamo soltanto le assegnazioni
   * automatiche della scadenza.
   *
   * Le eventuali assegnazioni manuali
   * devono rimanere intatte.
   */
  delete from public.tbscadenze_centrale_destinatari
  where scadenza_id = p_scadenza_id
    and origine_assegnazione <> 'manuale';

  /*
   * Operatore responsabile specifico.
   */
  if p_operatore_responsabile_id is not null then
    insert into public.tbscadenze_centrale_destinatari (
      studio_id,
      scadenza_id,
      utente_id,
      origine_assegnazione
    )
    select
      p_studio_id,
      p_scadenza_id,
      u.id,
      'operatore_responsabile'
    from public.tbutenti u
    where u.id = p_operatore_responsabile_id
      and u.studio_id = p_studio_id
      and u.attivo = true
    on conflict (scadenza_id, utente_id)
    do nothing;
  end if;

  /*
   * Tutti gli operatori attivi
   * del settore Fiscale.
   */
  if p_settore_fiscale then
    insert into public.tbscadenze_centrale_destinatari (
      studio_id,
      scadenza_id,
      utente_id,
      origine_assegnazione
    )
    select
      p_studio_id,
      p_scadenza_id,
      u.id,
      'settore_fiscale'
    from public.tbutenti u
    where u.studio_id = p_studio_id
      and u.attivo = true
      and u.settore = 'Fiscale'
    on conflict (scadenza_id, utente_id)
    do nothing;
  end if;

  /*
   * Tutti gli operatori attivi
   * del settore Lavoro.
   */
  if p_settore_lavoro then
    insert into public.tbscadenze_centrale_destinatari (
      studio_id,
      scadenza_id,
      utente_id,
      origine_assegnazione
    )
    select
      p_studio_id,
      p_scadenza_id,
      u.id,
      'settore_lavoro'
    from public.tbutenti u
    where u.studio_id = p_studio_id
      and u.attivo = true
      and u.settore = 'Lavoro'
    on conflict (scadenza_id, utente_id)
    do nothing;
  end if;

  /*
   * Tutti gli operatori attivi
   * del settore Consulenza.
   */
  if p_settore_consulenza then
    insert into public.tbscadenze_centrale_destinatari (
      studio_id,
      scadenza_id,
      utente_id,
      origine_assegnazione
    )
    select
      p_studio_id,
      p_scadenza_id,
      u.id,
      'settore_consulenza'
    from public.tbutenti u
    where u.studio_id = p_studio_id
      and u.attivo = true
      and u.settore = 'Consulenza'
    on conflict (scadenza_id, utente_id)
    do nothing;
  end if;
end;
$$;


ALTER FUNCTION "public"."sync_destinatari_scadenza_centrale"("p_scadenza_id" "uuid", "p_studio_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_settore_fiscale" boolean, "p_settore_lavoro" boolean, "p_settore_consulenza" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenza_affitto_centrale"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_record public.tbscadaffitti%rowtype;

  v_scadenza_id uuid;
  v_locatore text;
  v_titolo text;
  v_descrizione text;
  v_link_dettaglio text;
begin
  if tg_op = 'DELETE' then
    v_record := old;
  else
    v_record := new;
  end if;

  /*
   * Contratto eliminato, concluso, disattivato
   * oppure privo della prossima scadenza:
   * eliminiamo la scadenza centrale.
   */
  if
    tg_op = 'DELETE'
    or coalesce(v_record.attivo, false) = false
    or coalesce(
      v_record.contratto_concluso,
      false
    ) = true
    or v_record.data_prossima_scadenza is null
  then
    delete from public.tbscadenze_centrale
    where studio_id = v_record.studio_id
      and origine_tabella = 'tbscadaffitti'
      and origine_record_id = v_record.id;

    return coalesce(new, old);
  end if;

  /*
   * Recupero del locatore.
   */
  select
    c.ragione_sociale
  into v_locatore
  from public.tbclienti c
  where c.id = v_record.cliente_id
    and c.studio_id = v_record.studio_id;

  v_locatore :=
    coalesce(
      nullif(btrim(v_locatore), ''),
      'Locatore'
    );

  v_titolo :=
    'Rinnovo annualità contratto di affitto';

  v_descrizione :=
    v_titolo ||
    ' – ' ||
    v_locatore ||
    case
      when nullif(
        btrim(v_record.conduttore),
        ''
      ) is not null
      then
        ' / Conduttore: ' ||
        btrim(v_record.conduttore)
      else
        ''
    end ||
    ' – Annualità ' ||
    coalesce(
      v_record.contatore_anni,
      1
    )::text ||
    '/' ||
    coalesce(
      v_record.durata_contratto_anni,
      1
    )::text;

  v_link_dettaglio :=
    '/scadenze/affitti?id=' ||
    v_record.id::text;

  /*
   * Creazione o aggiornamento della scadenza.
   */
  perform public.upsert_scadenza_centrale(
    p_studio_id :=
      v_record.studio_id,

    p_cliente_id :=
      v_record.cliente_id,

    p_operatore_responsabile_id :=
      v_record.utente_operatore_id,

    p_origine_modulo :=
      'Affitti',

    p_origine_tabella :=
      'tbscadaffitti',

    p_origine_record_id :=
      v_record.id,

    p_tipo_scadenza :=
      'rinnovo_annualita_affitto',

    p_titolo :=
      v_titolo,

    p_descrizione :=
      v_descrizione,

    p_data_scadenza :=
      v_record.data_prossima_scadenza,

    p_link_dettaglio :=
      v_link_dettaglio,

    p_metadati :=
      jsonb_build_object(
        'locatore',
          v_locatore,

        'conduttore',
          v_record.conduttore,

        'descrizione_immobile_locato',
          v_record.descrizione_immobile_locato,

        'data_registrazione_atto',
          v_record.data_registrazione_atto,

        'data_rinnovo_atto',
          v_record.data_rinnovo_atto,

        'durata_contratto_anni',
          v_record.durata_contratto_anni,

        'contatore_anni',
          v_record.contatore_anni,

        'codice_identificativo_registrazione',
          v_record.codice_identificativo_registrazione,

        'importo_registrazione',
          v_record.importo_registrazione,

        'tipo_tributo',
          v_record.tipo_tributo,

        'codice_tributo',
          v_record.codice_tributo,

        'emailperalert',
          v_record.emailperalert,

        'rinnovo',
          v_record.rinnovo
      ),

    p_giorni_preavviso_1 :=
      30,

    p_giorni_preavviso_2 :=
      15,

    p_giorni_preavviso_3 :=
      0
  );

  /*
   * Recupero della scadenza centrale.
   */
  select s.id
  into v_scadenza_id
  from public.tbscadenze_centrale s
  where s.studio_id =
      v_record.studio_id
    and s.origine_tabella =
      'tbscadaffitti'
    and s.origine_record_id =
      v_record.id
    and s.tipo_scadenza =
      'rinnovo_annualita_affitto'
  order by s.updated_at desc
  limit 1;

  if v_scadenza_id is null then
    raise exception
      'Scadenza centrale affitto non trovata per contratto %',
      v_record.id;
  end if;

  /*
   * Eliminiamo esclusivamente i destinatari
   * automatici precedenti dell’affitto.
   */
  delete from public.tbscadenze_centrale_destinatari
  where scadenza_id = v_scadenza_id
    and origine_assegnazione in (
      'affitto_operatore',
      'affitto_email_esterna'
    );

  /*
   * Destinatario interno:
   * operatore assegnato al contratto.
   */
  if v_record.utente_operatore_id is not null then
    insert into public.tbscadenze_centrale_destinatari (
      studio_id,
      scadenza_id,
      utente_id,
      destinatario_email,
      tipo_destinatario,
      origine_assegnazione,
      attivo
    )
    select
      v_record.studio_id,
      v_scadenza_id,
      u.id,
      null,
      'interno',
      'affitto_operatore',
      true
    from public.tbutenti u
    where u.id =
        v_record.utente_operatore_id
      and u.studio_id =
        v_record.studio_id
      and u.attivo = true
    on conflict do nothing;
  end if;

  /*
   * Destinatario esterno:
   * email specificata nel contratto.
   *
   * Non viene duplicata se coincide con
   * l’email dell’operatore interno.
   */
  if nullif(
    btrim(v_record.emailperalert),
    ''
  ) is not null then
    insert into public.tbscadenze_centrale_destinatari (
      studio_id,
      scadenza_id,
      utente_id,
      destinatario_email,
      tipo_destinatario,
      origine_assegnazione,
      attivo
    )
    select
      v_record.studio_id,
      v_scadenza_id,
      null,
      lower(
        btrim(v_record.emailperalert)
      ),
      'esterno',
      'affitto_email_esterna',
      true
    where not exists (
      select 1
      from public.tbutenti u
      where u.id =
          v_record.utente_operatore_id
        and lower(
          btrim(u.email)
        ) =
          lower(
            btrim(
              v_record.emailperalert
            )
          )
    )
    on conflict do nothing;
  end if;

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_scadenza_affitto_centrale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenza_avviso_bonario"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_record public.tbcontenzioso_avvisi_bonari%rowtype;
  v_cliente record;
  v_data_scadenza date;
  v_titolo text;
begin
  if tg_op = 'DELETE' then
    v_record := old;
  else
    v_record := new;
  end if;

  select
    c.id,
    c.ragione_sociale,
    c.studio_id,
    c.utente_operatore_id
  into v_cliente
  from public.tbclienti c
  where c.id = v_record.cliente_id;

  if not found then
    raise warning
      'Cliente non trovato per avviso bonario %',
      v_record.id;

    return coalesce(new, old);
  end if;

  if
    v_record.studio_id is distinct from
    v_cliente.studio_id
  then
    raise exception
      'Studio non coerente per avviso bonario %. Avviso: %, cliente: %',
      v_record.id,
      v_record.studio_id,
      v_cliente.studio_id;
  end if;

  v_titolo :=
    case
      when nullif(trim(v_record.numero_atto), '') is not null
      then
        'Scadenza avviso bonario n. ' ||
        v_record.numero_atto
      else
        'Scadenza avviso bonario'
    end;

  /*
   * La scadenza viene annullata quando:
   * - il record viene eliminato;
   * - pratica_chiusa = true;
   * - stato = Chiuso;
   * - manca la data di scadenza.
   */
  if
    tg_op = 'DELETE'
    or coalesce(v_record.pratica_chiusa, false) = true
    or v_record.stato = 'Chiuso'
    or v_record.data_scadenza is null
  then
    v_data_scadenza := null;
  else
    v_data_scadenza :=
      v_record.data_scadenza;
  end if;

  perform public.upsert_scadenza_centrale(
    p_studio_id :=
      v_record.studio_id,

    p_cliente_id :=
      v_record.cliente_id,

    p_operatore_responsabile_id :=
      coalesce(
        v_record.operatore_responsabile_id,
        v_cliente.utente_operatore_id
      ),

    p_origine_modulo :=
      'Contenzioso - Avvisi bonari',

    p_origine_tabella :=
      'tbcontenzioso_avvisi_bonari',

    p_origine_record_id :=
      v_record.id,

    p_tipo_scadenza :=
      'scadenza_avviso_bonario',

    p_titolo :=
      v_titolo,

    p_descrizione :=
      v_titolo ||
      ' – ' ||
      coalesce(
        v_cliente.ragione_sociale,
        'Cliente non disponibile'
      ),

    p_data_scadenza :=
      v_data_scadenza,

    p_link_dettaglio :=
      '/contenzioso/avvisi-bonari?id=' ||
      v_record.id::text,

    p_metadati :=
      jsonb_build_object(
        'numero_atto',
        v_record.numero_atto,

        'tipo_atto',
        v_record.tipo_atto,

        'anno_riferimento',
        v_record.anno_riferimento,

        'data_emissione',
        v_record.data_emissione,

        'data_ricezione',
        v_record.data_ricezione,

        'contestazione',
        v_record.contestazione,

        'tipo_contestazione',
        v_record.tipo_contestazione,

        'responso',
        v_record.responso,

        'stato_pratica',
        v_record.stato,

        'importo_dovuto',
        v_record.importo_dovuto,

        'importo_sgravato',
        v_record.importo_sgravato,

        'importo_residuo',
        v_record.importo_residuo,

        'fare_ricorso',
        v_record.fare_ricorso,

        'pratica_chiusa',
        v_record.pratica_chiusa
      ),

    p_giorni_preavviso_1 :=
      15,

    p_giorni_preavviso_2 :=
      7,

    p_giorni_preavviso_3 :=
      0
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_scadenza_avviso_bonario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenza_cartella"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_record public.tbcontenzioso_cartelle%rowtype;
  v_cliente record;
  v_data_scadenza date;
  v_titolo text;
begin
  if tg_op = 'DELETE' then
    v_record := old;
  else
    v_record := new;
  end if;

  select
    c.id,
    c.ragione_sociale,
    c.studio_id,
    c.utente_operatore_id
  into v_cliente
  from public.tbclienti c
  where c.id = v_record.cliente_id;

  if not found then
    raise warning
      'Cliente non trovato per cartella %',
      v_record.id;

    return coalesce(new, old);
  end if;

  if
    v_record.studio_id is distinct from
    v_cliente.studio_id
  then
    raise exception
      'Studio non coerente per cartella %. Cartella: %, cliente: %',
      v_record.id,
      v_record.studio_id,
      v_cliente.studio_id;
  end if;

  v_titolo :=
    case
      when nullif(trim(v_record.numero_cartella), '') is not null
      then
        'Scadenza cartella n. ' ||
        v_record.numero_cartella
      else
        'Scadenza cartella'
    end;

  if
    tg_op = 'DELETE'
    or coalesce(v_record.pratica_chiusa, false) = true
    or v_record.data_scadenza is null
  then
    v_data_scadenza := null;
  else
    v_data_scadenza :=
      v_record.data_scadenza;
  end if;

  perform public.upsert_scadenza_centrale(
    p_studio_id :=
      v_record.studio_id,

    p_cliente_id :=
      v_record.cliente_id,

    p_operatore_responsabile_id :=
      coalesce(
        v_record.operatore_responsabile_id,
        v_cliente.utente_operatore_id
      ),

    p_origine_modulo :=
      'Contenzioso - Cartelle',

    p_origine_tabella :=
      'tbcontenzioso_cartelle',

    p_origine_record_id :=
      v_record.id,

    p_tipo_scadenza :=
      'scadenza_cartella',

    p_titolo :=
      v_titolo,

    p_descrizione :=
      v_titolo ||
      ' – ' ||
      coalesce(
        v_cliente.ragione_sociale,
        'Cliente non disponibile'
      ),

    p_data_scadenza :=
      v_data_scadenza,

    p_link_dettaglio :=
      '/contenzioso/cartelle?id=' ||
      v_record.id::text,

    p_metadati :=
      jsonb_build_object(
        'numero_cartella',
        v_record.numero_cartella,

        'anno_riferimento',
        v_record.anno_riferimento,

        'data_ruolo',
        v_record.data_ruolo,

        'data_ricezione',
        v_record.data_ricezione,

        'contestabile',
        v_record.contestabile,

        'modalita_contestazione',
        v_record.modalita_contestazione,

        'esito_contestazione',
        v_record.esito_contestazione,

        'genera_ricorso',
        v_record.genera_ricorso,

        'data_apertura_ricorso',
        v_record.data_apertura_ricorso,

        'importo_dovuto',
        v_record.importo_dovuto,

        'importo_sgravato',
        v_record.importo_sgravato,

        'importo_residuo',
        v_record.importo_residuo,

        'pratica_chiusa',
        v_record.pratica_chiusa
      ),

    p_giorni_preavviso_1 :=
      15,

    p_giorni_preavviso_2 :=
      7,

    p_giorni_preavviso_3 :=
      0
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_scadenza_cartella"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenza_contenzioso_centrale"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_record public.tbcontenzioso_scadenze_generate%rowtype;

  v_cliente_nome text;
  v_origine_tabella text;
  v_origine_modulo text;
  v_link_dettaglio text;

  v_data_scadenza date;
begin
  if tg_op = 'DELETE' then
    v_record := old;
  else
    v_record := new;
  end if;

  select c.ragione_sociale
  into v_cliente_nome
  from public.tbclienti c
  where c.id = v_record.cliente_id;

  v_origine_tabella :=
    case upper(coalesce(v_record.modulo, ''))
      when 'ADESIONE'
        then 'tbcontenzioso_adesione'

      when 'CASSAZIONE'
        then 'tbcontenzioso_cassazione'

      when 'INTERPELLO'
        then 'tbcontenzioso_interpello'

      when 'PVC'
        then 'tbcontenzioso_pvc'

      when 'PRIMO_GRADO'
        then 'tbcontenzioso_ricorso_primo_grado'

      when 'RICORSO_PRIMO_GRADO'
        then 'tbcontenzioso_ricorso_primo_grado'

      when 'SECONDO_GRADO'
        then 'tbcontenzioso_ricorso_secondo_grado'

      when 'RICORSO_SECONDO_GRADO'
        then 'tbcontenzioso_ricorso_secondo_grado'

      when 'SCHEMA_ATTO'
        then 'tbcontenzioso_schema_atto'

      else
        'tbcontenzioso_scadenze_generate'
    end;

  v_origine_modulo :=
    case upper(coalesce(v_record.modulo, ''))
      when 'ADESIONE'
        then 'Contenzioso - Accertamento con adesione'

      when 'CASSAZIONE'
        then 'Contenzioso - Cassazione'

      when 'INTERPELLO'
        then 'Contenzioso - Interpello'

      when 'PVC'
        then 'Contenzioso - PVC'

      when 'PRIMO_GRADO'
        then 'Contenzioso - Ricorso primo grado'

      when 'RICORSO_PRIMO_GRADO'
        then 'Contenzioso - Ricorso primo grado'

      when 'SECONDO_GRADO'
        then 'Contenzioso - Ricorso secondo grado'

      when 'RICORSO_SECONDO_GRADO'
        then 'Contenzioso - Ricorso secondo grado'

      when 'SCHEMA_ATTO'
        then 'Contenzioso - Schema d’atto'

      else
        'Contenzioso'
    end;

  v_link_dettaglio :=
    '/contenzioso/processi/' ||
    v_record.processo_id::text;

  if
    tg_op = 'DELETE'
    or lower(coalesce(v_record.stato, '')) in (
      'completata',
      'completato',
      'chiusa',
      'chiuso',
      'annullata',
      'annullato'
    )
  then
    v_data_scadenza := null;
  else
    v_data_scadenza :=
      v_record.data_scadenza;
  end if;

  perform public.upsert_scadenza_centrale(
    p_studio_id :=
      v_record.studio_id,

    p_cliente_id :=
      v_record.cliente_id,

    p_operatore_responsabile_id :=
      v_record.operatore_responsabile_id,

    p_origine_modulo :=
      v_origine_modulo,

    p_origine_tabella :=
      v_origine_tabella,

    p_origine_record_id :=
      v_record.modulo_record_id,

    p_tipo_scadenza :=
      coalesce(
        nullif(v_record.tipo_scadenza, ''),
        nullif(v_record.codice, ''),
        'scadenza_contenzioso'
      ),

    p_titolo :=
      v_record.descrizione,

    p_descrizione :=
      v_record.descrizione ||
      ' – ' ||
      coalesce(
        v_cliente_nome,
        'Cliente non disponibile'
      ),

    p_data_scadenza :=
      v_data_scadenza,

    p_link_dettaglio :=
      v_link_dettaglio,

    p_metadati :=
      jsonb_build_object(
        'processo_id',
        v_record.processo_id,

        'modulo',
        v_record.modulo,

        'modulo_record_id',
        v_record.modulo_record_id,

        'codice',
        v_record.codice,

        'stato_scadenza',
        v_record.stato,

        'giorni_residui',
        v_record.giorni_residui,

        'data_completamento',
        v_record.data_completamento,

        'note',
        v_record.note
      ),

    p_giorni_preavviso_1 := 15,
    p_giorni_preavviso_2 := 7,
    p_giorni_preavviso_3 := 0
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_scadenza_contenzioso_centrale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenza_tbclienti_organi"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_record public.tbclienti_organi%rowtype;

  v_cliente record;

  v_tipo_scadenza text;
  v_titolo text;
  v_descrizione text;

  v_data_scadenza date;
  v_link_dettaglio text;

  v_giorni_preavviso_1 integer;
  v_giorni_preavviso_2 integer;
  v_giorni_preavviso_3 integer;
begin
  /*
   * In DELETE utilizziamo il record precedente.
   * In INSERT e UPDATE utilizziamo il nuovo record.
   */
  if tg_op = 'DELETE' then
    v_record := old;
  else
    v_record := new;
  end if;

  /*
   * Recuperiamo società, studio e operatore fiscale.
   */
  select
    c.id,
    c.ragione_sociale,
    c.studio_id,
    c.utente_operatore_id
  into v_cliente
  from public.tbclienti c
  where c.id = v_record.cliente_id;

  if not found then
    raise warning
      'Cliente non trovato durante la sincronizzazione della scadenza organo: %',
      v_record.cliente_id;

    return coalesce(new, old);
  end if;

  /*
   * Per sicurezza deve esserci coerenza tra
   * studio della partecipazione e studio del cliente.
   */
  if
    v_record.studio_id is distinct from
    v_cliente.studio_id
  then
    raise exception
      'Studio non coerente per tbclienti_organi %. Record: %, cliente: %',
      v_record.id,
      v_record.studio_id,
      v_cliente.studio_id;
  end if;

  /*
   * Identificazione del tipo di scadenza.
   */
  v_tipo_scadenza :=
    case v_record.ruolo
      when 'socio'
        then 'fine_possesso_partecipazione'

      when 'amministratore'
        then 'scadenza_carica_amministratore'

      when 'amministratore_unico'
        then 'scadenza_carica_amministratore_unico'

      when 'amministratore_delegato'
        then 'scadenza_carica_amministratore_delegato'

      when 'consigliere_delegato'
        then 'scadenza_carica_consigliere_delegato'

      when 'presidente_cda'
        then 'scadenza_carica_presidente_cda'

      when 'consigliere'
        then 'scadenza_carica_consigliere'

      when 'liquidatore'
        then 'scadenza_carica_liquidatore'

      when 'sindaco_effettivo'
        then 'scadenza_carica_sindaco_effettivo'

      when 'presidente_collegio_sindacale'
        then 'scadenza_carica_presidente_collegio_sindacale'

      when 'sindaco_unico'
        then 'scadenza_carica_sindaco_unico'

      when 'sindaco_supplente'
        then 'scadenza_carica_sindaco_supplente'

      when 'revisore'
        then 'scadenza_carica_revisore'

      when 'rappresentante_legale'
        then 'scadenza_carica_rappresentante_legale'

      else
        'scadenza_organo_' ||
        lower(
          regexp_replace(
            coalesce(v_record.ruolo, 'altro'),
            '[^a-zA-Z0-9]+',
            '_',
            'g'
          )
        )
    end;

  /*
   * Titolo leggibile nella pagina riepilogativa.
   */
  v_titolo :=
    case v_record.ruolo
      when 'socio'
        then 'Fine possesso partecipazione'

      when 'amministratore'
        then 'Scadenza carica amministratore'

      when 'amministratore_unico'
        then 'Scadenza carica amministratore unico'

      when 'amministratore_delegato'
        then 'Scadenza carica amministratore delegato'

      when 'consigliere_delegato'
        then 'Scadenza carica consigliere delegato'

      when 'presidente_cda'
        then 'Scadenza carica presidente del CDA'

      when 'consigliere'
        then 'Scadenza carica consigliere'

      when 'liquidatore'
        then 'Scadenza carica liquidatore'

      when 'sindaco_effettivo'
        then 'Scadenza carica sindaco effettivo'

      when 'presidente_collegio_sindacale'
        then 'Scadenza carica presidente collegio sindacale'

      when 'sindaco_unico'
        then 'Scadenza carica sindaco unico'

      when 'sindaco_supplente'
        then 'Scadenza carica sindaco supplente'

      when 'revisore'
        then 'Scadenza carica revisore'

      when 'rappresentante_legale'
        then 'Scadenza carica rappresentante legale'

      else
        'Scadenza organo sociale'
    end;

  v_descrizione :=
    v_titolo ||
    ' – ' ||
    coalesce(
      v_cliente.ragione_sociale,
      'Società non disponibile'
    );

  v_link_dettaglio :=
    '/clienti/organi-sociali?cliente_id=' ||
    v_record.cliente_id::text;

  /*
   * Preavvisi:
   * - cariche: 30, 15 e 7 giorni;
   * - partecipazioni: 15, 7 e giorno stesso.
   */
  if v_record.ruolo = 'socio' then
    v_giorni_preavviso_1 := 15;
    v_giorni_preavviso_2 := 7;
    v_giorni_preavviso_3 := 0;
  else
    v_giorni_preavviso_1 := 30;
    v_giorni_preavviso_2 := 15;
    v_giorni_preavviso_3 := 7;
  end if;

  /*
   * Una scadenza deve restare attiva soltanto se:
   * - non stiamo eliminando il record;
   * - l’organo è attivo;
   * - esiste data_scadenza.
   *
   * Passando NULL, upsert_scadenza_centrale
   * annulla l’eventuale scadenza già esistente.
   */
  if
    tg_op = 'DELETE'
    or coalesce(v_record.attivo, false) = false
    or v_record.data_scadenza is null
  then
    v_data_scadenza := null;
  else
    v_data_scadenza :=
      v_record.data_scadenza;
  end if;

  perform public.upsert_scadenza_centrale(
    p_studio_id :=
      v_record.studio_id,

    p_cliente_id :=
      v_record.cliente_id,

    p_operatore_responsabile_id :=
      v_cliente.utente_operatore_id,

    p_origine_modulo :=
      'Soci e organi sociali',

    p_origine_tabella :=
      'tbclienti_organi',

    p_origine_record_id :=
      v_record.id,

    p_tipo_scadenza :=
      v_tipo_scadenza,

    p_titolo :=
      v_titolo,

    p_descrizione :=
      v_descrizione,

    p_data_scadenza :=
      v_data_scadenza,

    p_link_dettaglio :=
      v_link_dettaglio,

    p_metadati :=
      jsonb_build_object(
        'ruolo',
        v_record.ruolo,

        'carica',
        v_record.carica,

        'soggetto_cliente_id',
        v_record.soggetto_cliente_id,

        'principale',
        v_record.principale,

        'durata_carica',
        v_record.durata_carica,

        'data_nomina',
        v_record.data_nomina,

        'data_cessazione',
        v_record.data_cessazione,

        'titolo_possesso',
        v_record.titolo_possesso,

        'percentuale_partecipazione',
        v_record.percentuale_partecipazione
      ),

    p_giorni_preavviso_1 :=
      v_giorni_preavviso_1,

    p_giorni_preavviso_2 :=
      v_giorni_preavviso_2,

    p_giorni_preavviso_3 :=
      v_giorni_preavviso_3
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_scadenza_tbclienti_organi"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenza_tbpraticheaml"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_record public."tbPraticheAML"%rowtype;

  v_cliente record;

  v_data_scadenza date;
  v_titolo text;
  v_descrizione text;
begin
  if tg_op = 'DELETE' then
    v_record := old;
  else
    v_record := new;
  end if;

  select
    c.id,
    c.ragione_sociale,
    c.studio_id,
    c.utente_operatore_id
  into v_cliente
  from public.tbclienti c
  where c.id = v_record.cliente_id;

  if not found then
    raise warning
      'Cliente non trovato per pratica AML %',
      v_record.id;

    return coalesce(new, old);
  end if;

  if
    v_record.studio_id is distinct from
    v_cliente.studio_id
  then
    raise exception
      'Studio non coerente per pratica AML %. Pratica: %, cliente: %',
      v_record.id,
      v_record.studio_id,
      v_cliente.studio_id;
  end if;

  v_titolo :=
    'Rinnovo adeguata verifica AML';

  v_descrizione :=
    v_titolo ||
    ' – ' ||
    coalesce(
      v_cliente.ragione_sociale,
      'Cliente non disponibile'
    );

  if
    tg_op = 'DELETE'
    or v_record.stato in (
      'chiusa',
      'archiviata'
    )
    or v_record.data_prossimo_rinnovo is null
  then
    v_data_scadenza := null;
  else
    v_data_scadenza :=
      v_record.data_prossimo_rinnovo;
  end if;

  perform public.upsert_scadenza_centrale(
    p_studio_id :=
      v_record.studio_id,

    p_cliente_id :=
      v_record.cliente_id,

    p_operatore_responsabile_id :=
      coalesce(
        v_record.operatore_responsabile_id,
        v_cliente.utente_operatore_id
      ),

    p_origine_modulo :=
      'Antiriciclaggio',

    p_origine_tabella :=
      'tbPraticheAML',

    p_origine_record_id :=
      v_record.id,

    p_tipo_scadenza :=
      'rinnovo_adeguata_verifica_aml',

    p_titolo :=
      v_titolo,

    p_descrizione :=
      v_descrizione,

    p_data_scadenza :=
      v_data_scadenza,

    p_link_dettaglio :=
      '/antiriciclaggio/pratiche/' ||
      v_record.id::text,

    p_metadati :=
      jsonb_build_object(
        'numero_pratica',
        v_record.numero_pratica,

        'stato_pratica',
        v_record.stato,

        'tipo_prestazione',
        v_record.tipo_prestazione,

        'ciclo_corrente',
        v_record.ciclo_corrente,

        'stato_ciclo',
        v_record.stato_ciclo,

        'data_apertura',
        v_record.data_apertura,

        'av1_corrente_id',
        v_record.av1_corrente_id,

        'av2_corrente_id',
        v_record.av2_corrente_id,

        'av4_corrente_id',
        v_record.av4_corrente_id
      ),

    p_giorni_preavviso_1 :=
      30,

    p_giorni_preavviso_2 :=
      15,

    p_giorni_preavviso_3 :=
      7
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_scadenza_tbpraticheaml"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenze_adesione"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'ADESIONE',
    new.id,
    'RICORSO_ORDINARIO',
    'Scadenza ricorso ordinario',
    new.data_scadenza_ricorso_ordinaria
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'ADESIONE',
    new.id,
    'SOSPENSIONE_ADESIONE',
    'Scadenza sospensione adesione',
    new.data_scadenza_sospensione_adesione
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'ADESIONE',
    new.id,
    'RICORSO_CON_ADESIONE',
    'Scadenza ricorso con adesione',
    new.data_scadenza_ricorso_con_adesione
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'ADESIONE',
    new.id,
    'PAGAMENTO_ADESIONE',
    'Scadenza pagamento adesione',
    new.data_scadenza_pagamento_adesione
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_scadenze_adesione"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenze_cassazione"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'CASSAZIONE',
    new.id,
    'RICORSO_BREVE',
    'Scadenza ricorso Cassazione termine breve',
    new.data_scadenza_ricorso_breve
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'CASSAZIONE',
    new.id,
    'RICORSO_LUNGO',
    'Scadenza ricorso Cassazione termine lungo',
    new.data_scadenza_ricorso_lungo
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'CASSAZIONE',
    new.id,
    'MEMORIA_CASSAZIONE',
    'Scadenza memoria Cassazione',
    new.data_memoria_cassazione
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_scadenze_cassazione"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenze_interpello"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'INTERPELLO',
    new.id,
    'RISPOSTA_INTERPELLO',
    'Scadenza risposta interpello',
    new.data_scadenza_risposta
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'INTERPELLO',
    new.id,
    'RISPOSTA_POST_INTEGRAZIONE',
    'Scadenza risposta post integrazione',
    new.data_scadenza_risposta_post_integrazione
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_scadenze_interpello"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenze_primo_grado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'PRIMO_GRADO',
    new.id,
    'RICORSO',
    'Scadenza ricorso primo grado',
    new.data_scadenza_ricorso
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'PRIMO_GRADO',
    new.id,
    'COSTITUZIONE_RICORRENTE',
    'Scadenza costituzione ricorrente',
    new.data_scadenza_costituzione_ricorrente
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'PRIMO_GRADO',
    new.id,
    'DOCUMENTI',
    'Scadenza deposito documenti',
    new.data_scadenza_documenti
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'PRIMO_GRADO',
    new.id,
    'MEMORIE',
    'Scadenza deposito memorie',
    new.data_scadenza_memorie
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'PRIMO_GRADO',
    new.id,
    'REPLICHE',
    'Scadenza deposito repliche',
    new.data_scadenza_repliche
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_scadenze_primo_grado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenze_pvc"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'PVC',
    new.id,
    'ADESIONE_PVC',
    'Scadenza adesione PVC',
    new.data_scadenza_adesione
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'PVC',
    new.id,
    'OSSERVAZIONI_PVC',
    'Scadenza osservazioni PVC',
    new.data_scadenza_osservazioni
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_scadenze_pvc"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenze_schema_atto"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'SCHEMA_ATTO',
    new.id,
    'OSSERVAZIONI_SCHEMA_ATTO',
    'Scadenza osservazioni schema d’atto',
    new.data_scadenza_osservazioni
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_scadenze_schema_atto"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_scadenze_secondo_grado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'SECONDO_GRADO',
    new.id,
    'APPELLO_BREVE',
    'Scadenza appello termine breve',
    new.data_scadenza_appello_breve
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'SECONDO_GRADO',
    new.id,
    'APPELLO_LUNGO',
    'Scadenza appello termine lungo',
    new.data_scadenza_appello_lungo
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'SECONDO_GRADO',
    new.id,
    'COSTITUZIONE_APPELLANTE',
    'Scadenza costituzione appellante',
    new.data_scadenza_costituzione_appellante
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'SECONDO_GRADO',
    new.id,
    'DOCUMENTI',
    'Scadenza deposito documenti appello',
    new.data_scadenza_documenti
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'SECONDO_GRADO',
    new.id,
    'MEMORIE',
    'Scadenza deposito memorie appello',
    new.data_scadenza_memorie
  );

  perform public.upsert_contenzioso_scadenza(
    new.processo_id,
    'SECONDO_GRADO',
    new.id,
    'REPLICHE',
    'Scadenza deposito repliche appello',
    new.data_scadenza_repliche
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_scadenze_secondo_grado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_tbdipendenti_from_utenti"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN

  -- Solo dipendenti
  IF NEW.tipo_rapporto = 'Dipendente' THEN

    INSERT INTO public.tbdipendenti (
      studio_id,
      utente_id,
      nome,
      cognome,
      email,
      attivo,
      orario_giornaliero
    )
    VALUES (
      NEW.studio_id,
      NEW.id,
      NEW.nome,
      NEW.cognome,
      NEW.email,
      COALESCE(NEW.attivo, true),
      8
    )

    ON CONFLICT (utente_id)
    DO UPDATE SET
      studio_id = EXCLUDED.studio_id,
      nome = EXCLUDED.nome,
      cognome = EXCLUDED.cognome,
      email = EXCLUDED.email,
      attivo = EXCLUDED.attivo,
      updated_at = now();

  END IF;

  RETURN NEW;

END;
$$;


ALTER FUNCTION "public"."sync_tbdipendenti_from_utenti"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_tipo_scadenza_centrale"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_record public.tbtipi_scadenze%rowtype;
  v_scadenza_id uuid;
  v_link_dettaglio text;
begin
  if tg_op = 'DELETE' then
    v_record := old;
  else
    v_record := new;
  end if;

  /*
   * Se la scadenza viene eliminata, disattivata
   * oppure non possiede più una data valida,
   * eliminiamo la corrispondente scadenza centrale.
   *
   * I destinatari vengono eliminati automaticamente
   * tramite ON DELETE CASCADE.
   */
  if tg_op = 'DELETE'
     or coalesce(v_record.attivo, false) = false
     or v_record.data_scadenza is null
     or v_record.studio_id is null
  then
    delete from public.tbscadenze_centrale
    where studio_id = v_record.studio_id
      and origine_tabella = 'tbtipi_scadenze'
      and origine_record_id = v_record.id;

    return coalesce(new, old);
  end if;

  /*
   * Determinazione della pagina operativa
   * da aprire dal riepilogo o dall'email.
   */
  v_link_dettaglio :=
    case lower(trim(coalesce(v_record.tipo_scadenza, '')))
      when 'iva'
        then '/scadenze/iva'

      when 'ccgg'
        then '/scadenze/ccgg'

      when 'cu'
        then '/scadenze/cu'

      when 'imu'
        then '/scadenze/imu'

      when 'fiscale'
        then '/scadenze/fiscali'

      when 'bilancio'
        then '/scadenze/bilanci'

      when '770'
        then '/scadenze/modello-770'

      when 'lipe'
        then '/scadenze/lipe'

      when 'esterometro'
        then '/scadenze/esterometro'

      when 'proforma'
        then '/scadenze/proforma'

      else '/scadenze'
    end;

  /*
   * Creazione o aggiornamento della scadenza centrale.
   *
   * cliente_id e operatore_responsabile_id sono NULL
   * perché queste sono scadenze generali dello studio.
   * I destinatari vengono gestiti nella tabella dedicata.
   */
  perform public.upsert_scadenza_centrale(
    p_studio_id :=
      v_record.studio_id,

    p_cliente_id :=
      null,

    p_operatore_responsabile_id :=
      null,

    p_origine_modulo :=
      'Scadenzario',

    p_origine_tabella :=
      'tbtipi_scadenze',

    p_origine_record_id :=
      v_record.id,

    p_tipo_scadenza :=
      v_record.tipo_scadenza,

    p_titolo :=
      v_record.nome,

    p_descrizione :=
      coalesce(
        v_record.descrizione,
        v_record.nome
      ),

    p_data_scadenza :=
      v_record.data_scadenza,

    p_link_dettaglio :=
      v_link_dettaglio,

    p_metadati :=
      jsonb_build_object(
        'tipo_scadenza_id',
          v_record.id,

        'ricorrente',
          v_record.ricorrente,

        'settore_fiscale',
          v_record.settore_fiscale,

        'settore_lavoro',
          v_record.settore_lavoro,

        'settore_consulenza',
          v_record.settore_consulenza,

        'ha_scadenzario',
          v_record.ha_scadenzario,

        'scadenzario',
          v_record.scadenzario,

        'nome_tabella',
          v_record.nome_tabella,

        'campo_completamento',
          v_record.campo_completamento,

        'campo_nominativo',
          v_record.campo_nominativo
      ),

    p_giorni_preavviso_1 :=
      coalesce(
        v_record.giorni_preavviso_1,
        15
      ),

    p_giorni_preavviso_2 :=
      coalesce(
        v_record.giorni_preavviso_2,
        7
      ),

    p_giorni_preavviso_3 :=
      0
  );

  /*
   * Recuperiamo la scadenza centrale appena
   * creata o aggiornata.
   */
  select s.id
  into v_scadenza_id
  from public.tbscadenze_centrale s
  where s.studio_id = v_record.studio_id
    and s.origine_tabella = 'tbtipi_scadenze'
    and s.origine_record_id = v_record.id
    and s.tipo_scadenza = v_record.tipo_scadenza
  order by s.updated_at desc
  limit 1;

  if v_scadenza_id is null then
    raise exception
      'Scadenza centrale non trovata dopo la sincronizzazione di tbtipi_scadenze %',
      v_record.id;
  end if;

  /*
   * Creazione automatica dei destinatari
   * appartenenti ai settori selezionati.
   */
  perform public.sync_destinatari_scadenza_centrale(
    p_scadenza_id :=
      v_scadenza_id,

    p_studio_id :=
      v_record.studio_id,

    p_operatore_responsabile_id :=
      null,

    p_settore_fiscale :=
      coalesce(
        v_record.settore_fiscale,
        false
      ),

    p_settore_lavoro :=
      coalesce(
        v_record.settore_lavoro,
        false
      ),

    p_settore_consulenza :=
      coalesce(
        v_record.settore_consulenza,
        false
      )
  );

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_tipo_scadenza_centrale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_cassetti_force_studio"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_studio uuid;
begin
  -- Se è indicato l'utente, ricavo lo studio dall'utente
  if new.utente_id is not null then
    select studio_id into v_studio
    from tbutenti
    where id = new.utente_id;

    if v_studio is null then
      raise exception 'utente_id non valido o utente senza studio_id';
    end if;

    -- Imposto sempre lo studio corretto
    new.studio_id := v_studio;
  end if;

  -- Se dopo tutto studio_id è ancora NULL → errore
  if new.studio_id is null then
    raise exception 'studio_id mancante: serve utente_id oppure studio_id';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_cassetti_force_studio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_cassetti_fiscali_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_cassetti_fiscali_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_contenzioso_scadenza"("p_processo_id" "uuid", "p_modulo" "text", "p_modulo_record_id" "uuid", "p_tipo_scadenza" "text", "p_descrizione" "text", "p_data_scadenza" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  if p_data_scadenza is null then
    return;
  end if;

  insert into public.tbcontenzioso_scadenze_generate (
    processo_id,
    modulo,
    modulo_record_id,
    tipo_scadenza,
    descrizione,
    data_scadenza,
    giorni_residui
  )
  values (
    p_processo_id,
    p_modulo,
    p_modulo_record_id,
    p_tipo_scadenza,
    p_descrizione,
    p_data_scadenza,
    p_data_scadenza - current_date
  )
  on conflict (
    processo_id,
    modulo,
    modulo_record_id,
    tipo_scadenza
  )
  do update set
    descrizione = excluded.descrizione,
    data_scadenza = excluded.data_scadenza,
    giorni_residui = excluded.data_scadenza - current_date;
end;
$$;


ALTER FUNCTION "public"."upsert_contenzioso_scadenza"("p_processo_id" "uuid", "p_modulo" "text", "p_modulo_record_id" "uuid", "p_tipo_scadenza" "text", "p_descrizione" "text", "p_data_scadenza" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_scadenza_centrale"("p_studio_id" "uuid", "p_cliente_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_origine_modulo" "text", "p_origine_tabella" "text", "p_origine_record_id" "uuid", "p_tipo_scadenza" "text", "p_titolo" "text", "p_descrizione" "text", "p_data_scadenza" "date", "p_link_dettaglio" "text" DEFAULT NULL::"text", "p_metadati" "jsonb" DEFAULT '{}'::"jsonb", "p_giorni_preavviso_1" integer DEFAULT 15, "p_giorni_preavviso_2" integer DEFAULT 7, "p_giorni_preavviso_3" integer DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
  v_prossimo_alert timestamp with time zone;
  v_preavviso_massimo integer;
begin
  if p_studio_id is null then
    raise exception
      'studio_id obbligatorio per la scadenza';
  end if;

  if p_origine_record_id is null then
    raise exception
      'origine_record_id obbligatorio per la scadenza';
  end if;

  if nullif(trim(p_origine_tabella), '') is null then
    raise exception
      'origine_tabella obbligatoria per la scadenza';
  end if;

  if nullif(trim(p_tipo_scadenza), '') is null then
    raise exception
      'tipo_scadenza obbligatorio per la scadenza';
  end if;

  /*
   * Se la data è stata eliminata dal modulo
   * originale, annulliamo la scadenza.
   */
  if p_data_scadenza is null then
    update public.tbscadenze_centrale
    set
      stato = 'annullata',
      annullata_at = now(),
      completata_at = null,
      prossimo_alert_at = null,
      updated_at = now()
    where studio_id = p_studio_id
      and origine_tabella = p_origine_tabella
      and origine_record_id = p_origine_record_id
      and tipo_scadenza = p_tipo_scadenza
    returning id into v_id;

    return v_id;
  end if;

  v_preavviso_massimo :=
    greatest(
      coalesce(p_giorni_preavviso_1, 0),
      coalesce(p_giorni_preavviso_2, 0),
      coalesce(p_giorni_preavviso_3, 0)
    );

  /*
   * Nessun alert retroattivo per scadenze
   * già trascorse.
   */
  if p_data_scadenza < current_date then
    v_prossimo_alert := null;
  else
    v_prossimo_alert :=
      (
        p_data_scadenza -
        v_preavviso_massimo
      )::timestamp with time zone;

    /*
     * Se il primo preavviso è già trascorso
     * ma la scadenza è ancora futura,
     * il record viene processato da oggi.
     */
    if v_prossimo_alert < current_date then
      v_prossimo_alert :=
        current_date::timestamp with time zone;
    end if;
  end if;

  insert into public.tbscadenze_centrale (
    studio_id,
    cliente_id,
    operatore_responsabile_id,

    origine_modulo,
    origine_tabella,
    origine_record_id,

    tipo_scadenza,
    titolo,
    descrizione,

    data_scadenza,
    stato,

    giorni_preavviso_1,
    giorni_preavviso_2,
    giorni_preavviso_3,

    prossimo_alert_at,
    link_dettaglio,
    metadati
  )
  values (
    p_studio_id,
    p_cliente_id,
    p_operatore_responsabile_id,

    p_origine_modulo,
    p_origine_tabella,
    p_origine_record_id,

    p_tipo_scadenza,
    p_titolo,
    p_descrizione,

    p_data_scadenza,
    'attiva',

    p_giorni_preavviso_1,
    p_giorni_preavviso_2,
    p_giorni_preavviso_3,

    v_prossimo_alert,
    p_link_dettaglio,
    coalesce(p_metadati, '{}'::jsonb)
  )
  on conflict (
    studio_id,
    origine_tabella,
    origine_record_id,
    tipo_scadenza
  )
  do update set
    cliente_id =
      excluded.cliente_id,

    operatore_responsabile_id =
      excluded.operatore_responsabile_id,

    origine_modulo =
      excluded.origine_modulo,

    titolo =
      excluded.titolo,

    descrizione =
      excluded.descrizione,

    data_scadenza =
      excluded.data_scadenza,

    stato =
      case
        when public.tbscadenze_centrale.stato
          in ('completata', 'annullata')
        then 'attiva'
        else public.tbscadenze_centrale.stato
      end,

    giorni_preavviso_1 =
      excluded.giorni_preavviso_1,

    giorni_preavviso_2 =
      excluded.giorni_preavviso_2,

    giorni_preavviso_3 =
      excluded.giorni_preavviso_3,

    prossimo_alert_at =
      case
        when
          public.tbscadenze_centrale.data_scadenza
          is distinct from excluded.data_scadenza
        then excluded.prossimo_alert_at

        when
          public.tbscadenze_centrale.prossimo_alert_at
          is not null
        then public.tbscadenze_centrale.prossimo_alert_at

        else excluded.prossimo_alert_at
      end,

    link_dettaglio =
      excluded.link_dettaglio,

    metadati =
      excluded.metadati,

    completata_at =
      null,

    annullata_at =
      null,

    updated_at =
      now()

  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."upsert_scadenza_centrale"("p_studio_id" "uuid", "p_cliente_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_origine_modulo" "text", "p_origine_tabella" "text", "p_origine_record_id" "uuid", "p_tipo_scadenza" "text", "p_titolo" "text", "p_descrizione" "text", "p_data_scadenza" "date", "p_link_dettaglio" "text", "p_metadati" "jsonb", "p_giorni_preavviso_1" integer, "p_giorni_preavviso_2" integer, "p_giorni_preavviso_3" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  if p_data_scadenza is null then
    return;
  end if;

  insert into public.tbcontenzioso_scadenze_generate (
    processo_id,
    modulo,
    codice,
    descrizione,
    data_scadenza,
    stato
  )
  values (
    p_processo_id,
    p_modulo,
    p_codice,
    p_descrizione,
    p_data_scadenza,
    'Aperta'
  )
  on conflict (processo_id, codice)
  do update set
    modulo = excluded.modulo,
    descrizione = excluded.descrizione,
    data_scadenza = excluded.data_scadenza,
    stato = 'Aperta';
end;
$$;


ALTER FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo_record_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  if p_data_scadenza is null then
    return;
  end if;

  delete from public.tbcontenzioso_scadenze_generate
  where processo_id = p_processo_id
    and modulo = p_modulo
    and (
      codice = p_codice
      or descrizione = p_descrizione
    );

  insert into public.tbcontenzioso_scadenze_generate (
    processo_id,
    modulo_record_id,
    modulo,
    codice,
    tipo_scadenza,
    descrizione,
    data_scadenza,
    giorni_residui,
    stato
  )
  values (
    p_processo_id,
    p_modulo_record_id,
    p_modulo,
    p_codice,
    p_codice,
    p_descrizione,
    p_data_scadenza,
    p_data_scadenza - current_date,
    'Aperta'
  );
end;
$$;


ALTER FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo_record_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verifica_destinatario_scadenza_centrale"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_studio_scadenza uuid;
  v_studio_utente uuid;
begin
  select studio_id
  into v_studio_scadenza
  from public.tbscadenze_centrale
  where id = new.scadenza_id;

  if not found then
    raise exception
      'Scadenza centrale non trovata: %',
      new.scadenza_id;
  end if;

  if new.studio_id is distinct from v_studio_scadenza then
    raise exception
      'Studio destinatario non coerente con la scadenza. Destinatario: %, scadenza: %',
      new.studio_id,
      v_studio_scadenza;
  end if;

  if new.tipo_destinatario = 'interno' then
    if new.utente_id is null then
      raise exception
        'utente_id obbligatorio per destinatario interno';
    end if;

    select studio_id
    into v_studio_utente
    from public.tbutenti
    where id = new.utente_id;

    if not found then
      raise exception
        'Utente non trovato: %',
        new.utente_id;
    end if;

    if new.studio_id is distinct from v_studio_utente then
      raise exception
        'Studio destinatario non coerente con l’utente. Destinatario: %, utente: %',
        new.studio_id,
        v_studio_utente;
    end if;

    new.destinatario_email := null;
  else
    new.utente_id := null;
    new.destinatario_email :=
      lower(btrim(new.destinatario_email));
  end if;

  new.updated_at := now();

  return new;
end;
$$;


ALTER FUNCTION "public"."verifica_destinatario_scadenza_centrale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verifica_tbclienti_servizi_studio"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_studio_cliente uuid;
begin
  select studio_id
  into v_studio_cliente
  from public.tbclienti
  where id = new.cliente_id;

  if not found then
    raise exception
      'Cliente non trovato: %',
      new.cliente_id;
  end if;

  if new.studio_id is distinct from v_studio_cliente then
    raise exception
      'studio_id non coerente con il cliente';
  end if;

  new.updated_at := now();

  return new;
end;
$$;


ALTER FUNCTION "public"."verifica_tbclienti_servizi_studio"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."backup_tbpromemoria_alert_20260603" (
    "id" "uuid",
    "promemoria_id" "uuid",
    "data_scadenza_riferimento" "date",
    "tipo_alert" "text",
    "data_invio" timestamp with time zone
);


ALTER TABLE "public"."backup_tbpromemoria_alert_20260603" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backup_zz_tbpratiche_nominativi_old_20260603" (
    "id" "uuid",
    "nome_cognome" "text",
    "codice_fiscale" "text",
    "created_at" timestamp with time zone,
    "indirizzo" "text",
    "citta" "text",
    "provincia" "text",
    "cap" "text"
);


ALTER TABLE "public"."backup_zz_tbpratiche_nominativi_old_20260603" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cod_cliente_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cod_cliente_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_confirmations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "evento_id" "uuid" NOT NULL,
    "user_email" "text" NOT NULL,
    "user_name" "text",
    "confirmed" boolean DEFAULT false,
    "confirmed_at" timestamp with time zone,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_confirmations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_reminders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "evento_id" "uuid" NOT NULL,
    "sent_to" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."microsoft365_calendar_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "microsoft_connection_id" "uuid" NOT NULL,
    "subscription_id" "text" NOT NULL,
    "client_state" "text" NOT NULL,
    "expiration_datetime" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."microsoft365_calendar_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."microsoft365_config" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "client_id" "text",
    "tenant_id" "text",
    "client_secret" "text",
    "enabled" boolean DEFAULT false,
    "features" "jsonb" DEFAULT '{"email": false, "teams": false, "calendar": false, "contacts": false}'::"jsonb",
    "connected_email" "text",
    "last_sync" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "teams_default_team_id" "text",
    "teams_default_channel_id" "text",
    "teams_scadenze_channel_id" "text",
    "teams_alert_channel_id" "text",
    "organizer_email" "text"
);


ALTER TABLE "public"."microsoft365_config" OWNER TO "postgres";


COMMENT ON COLUMN "public"."microsoft365_config"."teams_default_team_id" IS 'ID del team Microsoft Teams predefinito per le notifiche';



COMMENT ON COLUMN "public"."microsoft365_config"."teams_default_channel_id" IS 'ID del canale Teams predefinito per notifiche generali';



COMMENT ON COLUMN "public"."microsoft365_config"."teams_scadenze_channel_id" IS 'ID del canale Teams per notifiche scadenze';



COMMENT ON COLUMN "public"."microsoft365_config"."teams_alert_channel_id" IS 'ID del canale Teams per alert critici';



CREATE TABLE IF NOT EXISTS "public"."microsoft365_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "nome_connessione" "text" NOT NULL,
    "tenant_id" "text",
    "client_id" "text",
    "client_secret" "text",
    "enabled" boolean DEFAULT false NOT NULL,
    "connected_email" "text",
    "organizer_email" "text",
    "features" "jsonb" DEFAULT '{"email": false, "teams": false, "calendar": false, "contacts": false}'::"jsonb",
    "is_default" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."microsoft365_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "email" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rapp_legali_backup_20260809" (
    "id" "uuid",
    "studio_id" "uuid",
    "nome_cognome" "text",
    "codice_fiscale" character varying(16),
    "luogo_nascita" "text",
    "data_nascita" "date",
    "citta_residenza" "text",
    "indirizzo_residenza" "text",
    "nazionalita" "text",
    "tipo_doc" "text",
    "scadenza_doc" "date",
    "allegato_doc" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "num_doc" "text",
    "CAP" "text",
    "email" "text",
    "public_doc_token" "text",
    "public_doc_enabled" boolean,
    "public_doc_sent_at" timestamp without time zone,
    "public_doc_opened_at" timestamp without time zone,
    "public_doc_submitted_at" timestamp without time zone,
    "microsoft_connection_id" "uuid",
    "rappresentante_legale" boolean,
    "doc_richiesto_il" timestamp without time zone,
    "indirizzo" "text",
    "citta" "text",
    "provincia" "text",
    "cap" "text",
    "amministratore_principale" boolean,
    "cliente_id" "uuid"
);


ALTER TABLE "public"."rapp_legali_backup_20260809" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rapp_legali_backup_20260811" (
    "id" "uuid",
    "studio_id" "uuid",
    "nome_cognome" "text",
    "codice_fiscale" character varying(16),
    "luogo_nascita" "text",
    "data_nascita" "date",
    "citta_residenza" "text",
    "indirizzo_residenza" "text",
    "nazionalita" "text",
    "tipo_doc" "text",
    "scadenza_doc" "date",
    "allegato_doc" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "num_doc" "text",
    "CAP" "text",
    "email" "text",
    "public_doc_token" "text",
    "public_doc_enabled" boolean,
    "public_doc_sent_at" timestamp without time zone,
    "public_doc_opened_at" timestamp without time zone,
    "public_doc_submitted_at" timestamp without time zone,
    "microsoft_connection_id" "uuid",
    "rappresentante_legale" boolean,
    "doc_richiesto_il" timestamp without time zone,
    "indirizzo" "text",
    "citta" "text",
    "provincia" "text",
    "cap" "text",
    "amministratore_principale" boolean,
    "cliente_id" "uuid"
);


ALTER TABLE "public"."rapp_legali_backup_20260811" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbAMLComunicazioni" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "tipo_comunicazione" "text" NOT NULL,
    "cliente_id" "uuid",
    "soggetto_cliente_id" "uuid",
    "av4_id" "uuid",
    "destinatario_email" "text",
    "oggetto" "text",
    "body_preview" "text",
    "stato_invio" "text" DEFAULT 'inviata'::"text" NOT NULL,
    "data_invio" timestamp with time zone DEFAULT "now"() NOT NULL,
    "utente_id" "uuid",
    "public_token" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pratica_id" "uuid",
    "societa_id" "uuid",
    CONSTRAINT "tbamlcomunicazioni_stato_chk" CHECK (("stato_invio" = ANY (ARRAY['inviata'::"text", 'errore'::"text"]))),
    CONSTRAINT "tbamlcomunicazioni_tipo_chk" CHECK (("tipo_comunicazione" = ANY (ARRAY['richiesta_documento'::"text", 'invio_av4'::"text"])))
);


ALTER TABLE "public"."tbAMLComunicazioni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbAMLComunicazioni_backup_rapp_legale_20260811" (
    "id" "uuid",
    "studio_id" "uuid",
    "tipo_comunicazione" "text",
    "cliente_id" "uuid",
    "rapp_legale_id" "uuid",
    "av4_id" "uuid",
    "destinatario_email" "text",
    "oggetto" "text",
    "body_preview" "text",
    "stato_invio" "text",
    "data_invio" timestamp with time zone,
    "utente_id" "uuid",
    "public_token" "text",
    "note" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "pratica_id" "uuid",
    "societa_id" "uuid"
);


ALTER TABLE "public"."tbAMLComunicazioni_backup_rapp_legale_20260811" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbAV1" (
    "id" bigint NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "Prestazione" "text",
    "ValRischioIner" "text",
    "DataVerifica" "date",
    "ScadenzaVerifica" "date",
    "A1" numeric,
    "a1a" boolean DEFAULT false,
    "a1b" boolean DEFAULT false,
    "a1c" boolean DEFAULT false,
    "a1d" boolean DEFAULT false,
    "a1e" boolean DEFAULT false,
    "a1f" boolean DEFAULT false,
    "A2" numeric,
    "a2a" boolean DEFAULT false,
    "a2b" boolean DEFAULT false,
    "a2c" boolean DEFAULT false,
    "a2d" boolean DEFAULT false,
    "A3" numeric,
    "a3a" boolean DEFAULT false,
    "a3b" boolean DEFAULT false,
    "a3c" boolean DEFAULT false,
    "a3d" boolean DEFAULT false,
    "a3e" boolean DEFAULT false,
    "A4" numeric,
    "a4a" boolean DEFAULT false,
    "a4b" boolean DEFAULT false,
    "a4c" boolean DEFAULT false,
    "TotA" numeric,
    "B1" numeric,
    "b1a" boolean DEFAULT false,
    "b1b" boolean DEFAULT false,
    "b1c" boolean DEFAULT false,
    "b1d" boolean DEFAULT false,
    "B2" numeric,
    "b2a" boolean DEFAULT false,
    "b2b" boolean DEFAULT false,
    "b2c" boolean DEFAULT false,
    "b2d" boolean DEFAULT false,
    "b2e" boolean DEFAULT false,
    "B3" numeric,
    "b3a" boolean DEFAULT false,
    "b3b" boolean DEFAULT false,
    "b3c" boolean DEFAULT false,
    "B4" numeric,
    "b4a" boolean DEFAULT false,
    "b4b" boolean DEFAULT false,
    "b4c" boolean DEFAULT false,
    "B5" numeric,
    "b5a" boolean DEFAULT false,
    "b5b" boolean DEFAULT false,
    "b5c" boolean DEFAULT false,
    "b5d" boolean DEFAULT false,
    "B6" numeric,
    "b6a" boolean DEFAULT false,
    "b6b" boolean DEFAULT false,
    "b6c" boolean DEFAULT false,
    "b6d" boolean DEFAULT false,
    "TotB" numeric,
    "MediaPunteggio" numeric,
    "LivelloRischio" "text",
    "RisInerentePonderato" numeric,
    "RisSpecificoPonderato" numeric,
    "RischioEffettivo" numeric,
    "AdeguataVerifica" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "AV4Generato" boolean DEFAULT false NOT NULL,
    "AV1Conferma" boolean DEFAULT false NOT NULL,
    "AV2Generato" boolean DEFAULT false,
    "allegato_av1_firmato" "text",
    "incaricato_adeguata_verifica_id" "uuid",
    "pratica_id" "uuid",
    "societa_id" "uuid"
);


ALTER TABLE "public"."tbAV1" OWNER TO "postgres";


ALTER TABLE "public"."tbAV1" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tbAV1_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tbAV2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "spunta1" boolean DEFAULT false NOT NULL,
    "spunta2" boolean DEFAULT false NOT NULL,
    "spunta3" boolean DEFAULT false NOT NULL,
    "spunta4" boolean DEFAULT false NOT NULL,
    "spunta5" boolean DEFAULT false NOT NULL,
    "spunta6" boolean DEFAULT false NOT NULL,
    "spunta7" boolean DEFAULT false NOT NULL,
    "spunta8" boolean DEFAULT false NOT NULL,
    "spunta9" boolean DEFAULT false NOT NULL,
    "spunta10" boolean DEFAULT false NOT NULL,
    "spunta11" boolean DEFAULT false NOT NULL,
    "spunta12" boolean DEFAULT false NOT NULL,
    "spunta13" boolean DEFAULT false NOT NULL,
    "spunta14" boolean DEFAULT false NOT NULL,
    "spunta15" boolean DEFAULT false NOT NULL,
    "spunta16" boolean DEFAULT false NOT NULL,
    "spunta17" boolean DEFAULT false NOT NULL,
    "spunta18" boolean DEFAULT false NOT NULL,
    "spunta19" boolean DEFAULT false NOT NULL,
    "spunta20" boolean DEFAULT false NOT NULL,
    "spunta21" boolean DEFAULT false NOT NULL,
    "spunta22" boolean DEFAULT false NOT NULL,
    "spunta23" boolean DEFAULT false NOT NULL,
    "annotazioni1" "text",
    "annotazioni2" "text",
    "annotazioni3" "text",
    "annotazioni4" "text",
    "annotazioni5" "text",
    "annotazioni6" "text",
    "annotazioni7" "text",
    "annotazioni8" "text",
    "annotazioni9" "text",
    "annotazioni10" "text",
    "annotazioni11" "text",
    "annotazioni12" "text",
    "annotazioni13" "text",
    "annotazioni14" "text",
    "annotazioni15" "text",
    "annotazioni16" "text",
    "annotazioni17" "text",
    "annotazioni18" "text",
    "annotazioni19" "text",
    "annotazioni20" "text",
    "annotazioni21" "text",
    "annotazioni22" "text",
    "annotazioni23" "text",
    "data_check" "date",
    "firma_check" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "av1_id" bigint,
    "pratica_id" "uuid",
    "societa_id" "uuid",
    "allegato_av2_firmato" "text",
    "confermato" boolean DEFAULT false NOT NULL,
    "confermato_at" timestamp with time zone
);


ALTER TABLE "public"."tbAV2" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbAV4" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "av1_id" bigint,
    "dichiarante_nome_cognome" "text",
    "dichiarante_codice_fiscale" "text",
    "dichiarante_luogo_nascita" "text",
    "dichiarante_data_nascita" "date",
    "dichiarante_indirizzo_residenza" "text",
    "dichiarante_citta_residenza" "text",
    "dichiarante_cap_residenza" "text",
    "dichiarante_nazionalita" "text",
    "domanda1" boolean DEFAULT false,
    "domanda2" boolean DEFAULT false,
    "natura_prestazione" "text",
    "domanda3" boolean DEFAULT false,
    "domanda4" boolean DEFAULT false,
    "domanda5" boolean DEFAULT false,
    "spec_domanda5" "text",
    "domanda6" boolean DEFAULT false,
    "domanda7" boolean DEFAULT false,
    "domanda8" boolean DEFAULT false,
    "domanda9" boolean DEFAULT false,
    "nome_soc" "text",
    "sede_legale" "text",
    "indirizzo_sede" "text",
    "reg_imprese" "text",
    "num_reg_imprese" "text",
    "cod_fiscale_soc" "text",
    "nome_soc_bis" "text",
    "sede_legale_bis" "text",
    "indirizzo_sede_bis" "text",
    "reg_imprese_bis" "text",
    "num_reg_imprese_bis" "text",
    "cod_fiscale_soc_bis" "text",
    "nome_soc_ter" "text",
    "domanda10" boolean DEFAULT false,
    "domanda11" boolean DEFAULT false,
    "specifica12" "text",
    "specifica10b" "text",
    "specifica10c" "text",
    "specifica11c" "text",
    "specifica10d" "text",
    "specifica10e" "text",
    "specifica10f" "text",
    "luogo_firma" "text",
    "data_firma" "date",
    "luogo_firma_bis" "text",
    "data_firma_bis" "date",
    "stato" "text" DEFAULT 'bozza'::"text",
    "versione" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public_token" "text",
    "public_enabled" boolean DEFAULT false,
    "public_sent_at" timestamp without time zone,
    "public_opened_at" timestamp without time zone,
    "public_submitted_at" timestamp without time zone,
    "compilato_da_cliente" boolean DEFAULT false,
    "pdf_firmato_cliente" "text",
    "note_invio_pubblico" "text",
    "Av4InviatoCL" boolean DEFAULT false NOT NULL,
    "allegato_pdf_cliente" "text",
    "pratica_id" "uuid",
    "societa_id" "uuid",
    "invia_altra_email" boolean DEFAULT false NOT NULL,
    "email_destinatario_alternativa" "text",
    "amm_no_associato" boolean DEFAULT false NOT NULL,
    "av4_caricato_manualmente" boolean DEFAULT false,
    "soggetto_cliente_id" "uuid",
    CONSTRAINT "chk_tbav4_stato" CHECK (("stato" = ANY (ARRAY['bozza'::"text", 'completato'::"text", 'archiviato'::"text"])))
);


ALTER TABLE "public"."tbAV4" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbAV4_titolari" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "av4_id" "uuid" NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "sezione" "text" NOT NULL,
    "soggetto_cliente_id" "uuid",
    "nome_cognome" "text" NOT NULL,
    "codice_fiscale" "text",
    "luogo_nascita" "text",
    "data_nascita" "date",
    "indirizzo_residenza" "text",
    "citta_residenza" "text",
    "cap_residenza" "text",
    "nazionalita" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pratica_id" "uuid",
    "societa_id" "uuid",
    CONSTRAINT "chk_tbav4_titolari_sezione" CHECK (("sezione" = ANY (ARRAY['domanda7'::"text", 'domanda8'::"text", 'domanda9'::"text"])))
);


ALTER TABLE "public"."tbAV4_titolari" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbAV4_titolari_backup_20260810" (
    "id" "uuid",
    "av4_id" "uuid",
    "studio_id" "uuid",
    "cliente_id" "uuid",
    "sezione" "text",
    "rapp_legale_id" "uuid",
    "nome_cognome" "text",
    "codice_fiscale" "text",
    "luogo_nascita" "text",
    "data_nascita" "date",
    "indirizzo_residenza" "text",
    "citta_residenza" "text",
    "cap_residenza" "text",
    "nazionalita" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "pratica_id" "uuid",
    "societa_id" "uuid"
);


ALTER TABLE "public"."tbAV4_titolari_backup_20260810" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbAVFascicoliAlert" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "pratica_id" "uuid",
    "av1_id" bigint,
    "cliente_id" "uuid",
    "societa_id" "uuid",
    "documenti_mancanti" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "documenti_opzionali_mancanti" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "completo" boolean DEFAULT false NOT NULL,
    "ultimo_alert_at" timestamp with time zone,
    "prossimo_alert_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbAVFascicoliAlert" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbAVFascicoliDocumenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "av1_id" bigint,
    "cliente_id" "uuid",
    "av2_id" bigint,
    "tipo_documento" "text",
    "nome_file" "text",
    "storage_path" "text",
    "mime_type" "text",
    "dimensione" bigint,
    "origine" "text",
    "note" "text",
    "caricato_da" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bucket_name" "text",
    "pratica_id" "uuid",
    "av4_id" "uuid",
    "societa_documento_id" "uuid"
);


ALTER TABLE "public"."tbAVFascicoliDocumenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbElencoPrestAR" (
    "id" bigint NOT NULL,
    "TipoPrestazioneAR" "text" NOT NULL,
    "RischioTipoPrestAR" "text" NOT NULL,
    "PunteggioPrestAR" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "TipoTB" "text",
    CONSTRAINT "tbElencoPrestAR_TipoTB_check" CHECK (("TipoTB" = ANY (ARRAY['TB1'::"text", 'TB2'::"text"]))),
    CONSTRAINT "tb_elenco_prest_ar_punteggio_check" CHECK ((("PunteggioPrestAR" >= 1) AND ("PunteggioPrestAR" <= 4))),
    CONSTRAINT "tb_elenco_prest_ar_rischio_check" CHECK (("RischioTipoPrestAR" = ANY (ARRAY['Non significativo'::"text", 'Poco significativo'::"text", 'Abbastanza significativo'::"text", 'Molto significativo'::"text"])))
);


ALTER TABLE "public"."tbElencoPrestAR" OWNER TO "postgres";


ALTER TABLE "public"."tbElencoPrestAR" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tbElencoPrestAR_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tbPraticheAML" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "societa_id" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "numero_pratica" bigint NOT NULL,
    "data_apertura" "date" DEFAULT CURRENT_DATE NOT NULL,
    "stato" "text" DEFAULT 'aperta'::"text" NOT NULL,
    "av4_id" "uuid",
    "av2_id" "uuid",
    "av1_id" bigint,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_prestazione" "text",
    "av1_corrente_id" bigint,
    "ciclo_corrente" integer DEFAULT 1 NOT NULL,
    "stato_ciclo" "text",
    "data_prossimo_rinnovo" "date",
    "av4_corrente_id" "uuid",
    "av2_corrente_id" "uuid",
    "operatore_responsabile_id" "uuid",
    CONSTRAINT "tbpraticheaml_stato_chk" CHECK (("stato" = ANY (ARRAY['aperta'::"text", 'av4_inviato'::"text", 'av4_ricevuto'::"text", 'av2_compilato'::"text", 'av1_compilato'::"text", 'chiusa'::"text", 'archiviata'::"text"])))
);


ALTER TABLE "public"."tbPraticheAML" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbPraticheAML_numero_pratica_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbPraticheAML_numero_pratica_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbPraticheAML_numero_pratica_seq" OWNED BY "public"."tbPraticheAML"."numero_pratica";



CREATE TABLE IF NOT EXISTS "public"."tbRespAV" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cognome_nome" "text" NOT NULL,
    "codice_fiscale" character varying(16) NOT NULL,
    "TipoSoggetto" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "societa" "text",
    "societa_id" "uuid",
    CONSTRAINT "tbrespav_codice_fiscale_len_chk" CHECK (("char_length"("btrim"(("codice_fiscale")::"text")) = 16)),
    CONSTRAINT "tbrespav_tiposoggetto_chk" CHECK (("TipoSoggetto" = ANY (ARRAY['Professionista'::"text", 'Intermediario bancario e finanziario'::"text", 'Altri operatori finanziari'::"text", 'Altri operatori non finanziari'::"text"])))
);


ALTER TABLE "public"."tbRespAV" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbRespAVSocieta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "Denominazione" "text" NOT NULL,
    "codice_fiscale" character varying(16) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "antiriciclaggio_enabled" boolean DEFAULT false NOT NULL,
    "antiriciclaggio_password_hash" "text",
    "antiriciclaggio_password_updated_at" timestamp with time zone
);


ALTER TABLE "public"."tbRespAVSocieta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tb_comuni_catastali" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codice_catastale" character varying(4) NOT NULL,
    "comune" character varying(150) NOT NULL,
    "sigla_provincia" character varying(2),
    "data_inizio_validita" "date",
    "data_fine_validita" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tb_comuni_catastali" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbagenda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titolo" "text" NOT NULL,
    "descrizione" "text",
    "data_inizio" timestamp with time zone NOT NULL,
    "data_fine" timestamp with time zone NOT NULL,
    "tutto_giorno" boolean DEFAULT false,
    "utente_id" "uuid",
    "cliente_id" "uuid",
    "in_sede" boolean DEFAULT true,
    "sala" "text",
    "colore" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "luogo" "text",
    "partecipanti" "jsonb" DEFAULT '[]'::"jsonb",
    "riunione_teams" boolean DEFAULT false,
    "link_teams" "text",
    "evento_generico" boolean DEFAULT false,
    "studio_id" "uuid",
    "ora_inizio" time without time zone,
    "ora_fine" time without time zone,
    "ricorrente" boolean DEFAULT false,
    "frequenza_giorni" integer,
    "durata_giorni" integer,
    "microsoft_event_id" "text",
    "outlook_synced" boolean DEFAULT false,
    "external_id" "text",
    "provider" "text",
    "email_partecipanti_esterni" "jsonb" DEFAULT '[]'::"jsonb",
    "gruppo_evento" "uuid",
    "microsoft_connection_id" "uuid",
    "reminder_sent_at" timestamp without time zone,
    CONSTRAINT "tbagenda_microsoft_requires_owner" CHECK ((("provider" IS NULL) OR ("provider" !~~ 'microsoft%'::"text") OR (("studio_id" IS NOT NULL) AND ("utente_id" IS NOT NULL))))
);


ALTER TABLE "public"."tbagenda" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbagenda"."partecipanti" IS 'Array di ID utenti partecipanti all''evento (riceveranno notifica email)';



COMMENT ON COLUMN "public"."tbagenda"."riunione_teams" IS 'Flag che indica se è una riunione Teams';



COMMENT ON COLUMN "public"."tbagenda"."link_teams" IS 'URL collegamento riunione Teams';



COMMENT ON COLUMN "public"."tbagenda"."ora_inizio" IS 'Ora di inizio evento (formato HH:MM:SS) - separata dalla data per evitare problemi di timezone';



COMMENT ON COLUMN "public"."tbagenda"."ora_fine" IS 'Ora di fine evento (formato HH:MM:SS) - separata dalla data per evitare problemi di timezone';



COMMENT ON COLUMN "public"."tbagenda"."ricorrente" IS 'Indica se l''evento è ricorrente';



COMMENT ON COLUMN "public"."tbagenda"."frequenza_giorni" IS 'Numero di giorni tra un evento e il successivo (es. 7 = settimanale)';



COMMENT ON COLUMN "public"."tbagenda"."durata_giorni" IS 'Durata complessiva della ricorrenza in giorni dalla data inizio';



COMMENT ON COLUMN "public"."tbagenda"."outlook_synced" IS 'Flag che indica se l''evento è sincronizzato con Outlook Calendar';



CREATE TABLE IF NOT EXISTS "public"."tbalert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid",
    "modulo" "text" NOT NULL,
    "riferimento_tabella" "text",
    "riferimento_id" "uuid",
    "tipo_alert" "text" NOT NULL,
    "data_scadenza" "date",
    "giorni_preavviso" integer,
    "destinatario_utente_id" "uuid",
    "destinatario_email" "text",
    "messaggio_interno_creato" boolean DEFAULT false,
    "email_inviata" boolean DEFAULT false,
    "marker_univoco" "text",
    "errore" "text",
    "inviato_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbalert_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbassunzioni_allegati" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "richiesta_id" "uuid" NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "tipo_documento" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'assunzioni-allegati'::"text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbassunzioni_allegati" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbassunzioni_richieste" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "stato" "text" DEFAULT 'inviata'::"text" NOT NULL,
    "azienda" "text",
    "cognome_nome" "text" NOT NULL,
    "luogo_nascita" "text" NOT NULL,
    "data_nascita" "date" NOT NULL,
    "cittadinanza" "text" NOT NULL,
    "extra_ue" boolean DEFAULT false NOT NULL,
    "codice_fiscale" "text" NOT NULL,
    "indirizzo_residenza" "text" NOT NULL,
    "indirizzo_domicilio" "text",
    "telefono" "text" NOT NULL,
    "email" "text" NOT NULL,
    "stato_civile" "text" NOT NULL,
    "iban" "text",
    "percettore_naspi" boolean DEFAULT false NOT NULL,
    "data_iscrizione_naspi" "date",
    "decorrenza_assunzione" "date" NOT NULL,
    "sede_lavoro" "text" NOT NULL,
    "tipologia_contratto" "text" NOT NULL,
    "durata" "text",
    "mansione" "text" NOT NULL,
    "livello" "text" NOT NULL,
    "orario_lavoro" "text" NOT NULL,
    "distribuzione_oraria" "text",
    "retribuzione" "text",
    "centro_costo" "text",
    "note_cliente" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "numero_richiesta" "text",
    "doc_fronte_confermato" boolean DEFAULT false,
    "doc_retro_confermato" boolean DEFAULT false,
    "doc_codice_fiscale_confermato" boolean DEFAULT false,
    "doc_permesso_soggiorno_confermato" boolean DEFAULT false,
    "doc_curriculum_confermato" boolean DEFAULT false,
    "documenti_confermati_at" timestamp with time zone,
    "documenti_confermati_da" "uuid"
);


ALTER TABLE "public"."tbassunzioni_richieste" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcassetti_fiscali" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nominativo" "text" NOT NULL,
    "username" "text",
    "password1" "text",
    "pw_attiva1" boolean DEFAULT false,
    "password2" "text",
    "pw_attiva2" boolean DEFAULT false,
    "pin" "text",
    "pw_iniziale" "text",
    "note" "text",
    "studio_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "utente_id" "uuid"
);


ALTER TABLE "public"."tbcassetti_fiscali" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cod_cliente" "text",
    "ragione_sociale" "text" NOT NULL,
    "codice_fiscale" "text" NOT NULL,
    "partita_iva" "text",
    "indirizzo" "text",
    "cap" "text",
    "citta" "text",
    "provincia" "text",
    "email" "text",
    "note" "text",
    "attivo" boolean DEFAULT true,
    "utente_operatore_id" "uuid",
    "utente_professionista_id" "uuid",
    "contatto1_id" "uuid",
    "contatto2_id" "uuid",
    "tipo_prestazione_id" "uuid",
    "tipo_cliente" "text" NOT NULL,
    "flag_mail_attivo" boolean DEFAULT true,
    "flag_mail_scadenze" boolean DEFAULT true,
    "flag_mail_newsletter" boolean DEFAULT true,
    "data_creazione" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_redditi" "text",
    "cassetto_fiscale_id" "uuid",
    "tipologia_cliente" "text" NOT NULL,
    "utente_payroll_id" "uuid",
    "professionista_payroll_id" "uuid",
    "matricola_inps" "text",
    "pat_inail" "text",
    "codice_ditta_ce" "text",
    "studio_id" "uuid" NOT NULL,
    "referente_esterno" "text",
    "settore_fiscale" boolean DEFAULT false,
    "settore_lavoro" boolean DEFAULT false,
    "settore_consulenza" boolean DEFAULT false,
    "gestione_esterometro" boolean DEFAULT false,
    "note_esterometro" "text",
    "professionista_incaricato" boolean DEFAULT false NOT NULL,
    "numero_rea" "text",
    "soggetto_isa" boolean DEFAULT false NOT NULL,
    "telefono" "text",
    "pec" "text",
    "memo" "text",
    "cognome" "text",
    "nome" "text",
    "cliente" boolean DEFAULT true NOT NULL,
    "data_nascita" "date",
    "luogo_nascita" "text",
    "nazionalita" "text",
    CONSTRAINT "tbclienti_almeno_un_utente_responsabile_check" CHECK ((("cliente" = false) OR ("utente_operatore_id" IS NOT NULL) OR ("utente_payroll_id" IS NOT NULL))),
    CONSTRAINT "tbclienti_codice_fiscale_non_vuoto_chk" CHECK ((TRIM(BOTH FROM "codice_fiscale") <> ''::"text")),
    CONSTRAINT "tbclienti_tipo_cliente_check" CHECK (("tipo_cliente" = ANY (ARRAY['Persona fisica'::"text", 'Altro'::"text"]))),
    CONSTRAINT "tbclienti_tipo_redditi_check" CHECK ((("tipo_redditi" IS NULL) OR ("tipo_redditi" = ANY (ARRAY['USC'::"text", 'USP'::"text", 'ENC'::"text", 'UPF FORF.'::"text", 'UPF ORD.'::"text", 'UPF BASE'::"text", '730'::"text"])))),
    CONSTRAINT "tbclienti_tipologia_cliente_check" CHECK ((("cliente" = false) OR ("tipologia_cliente" = ANY (ARRAY['Interno'::"text", 'Esterno'::"text"]))))
);


ALTER TABLE "public"."tbclienti" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbclienti"."tipologia_cliente" IS 'Tipologia cliente: CL interno o CL esterno';



COMMENT ON COLUMN "public"."tbclienti"."utente_payroll_id" IS 'Riferimento utente payroll (FK tbutenti)';



COMMENT ON COLUMN "public"."tbclienti"."professionista_payroll_id" IS 'Riferimento professionista payroll (FK tbutenti)';



COMMENT ON COLUMN "public"."tbclienti"."matricola_inps" IS 'Matricola INPS del cliente';



COMMENT ON COLUMN "public"."tbclienti"."pat_inail" IS 'PAT INAIL del cliente';



COMMENT ON COLUMN "public"."tbclienti"."codice_ditta_ce" IS 'Codice Ditta CE del cliente';



COMMENT ON COLUMN "public"."tbclienti"."settore_fiscale" IS 'Cliente appartiene al settore fiscale (mostra campi utente_fiscale, professionista_fiscale)';



COMMENT ON COLUMN "public"."tbclienti"."settore_lavoro" IS 'Cliente appartiene al settore lavoro/payroll (mostra campi utente_payroll, professionista_payroll)';



COMMENT ON COLUMN "public"."tbclienti"."settore_consulenza" IS 'Cliente appartiene al settore consulenza';



COMMENT ON COLUMN "public"."tbclienti"."gestione_esterometro" IS 'Flag per abilitare lo scadenzario Esterometro per il cliente';



COMMENT ON COLUMN "public"."tbclienti"."note_esterometro" IS 'Note relative allo scadenzario Esterometro';



CREATE TABLE IF NOT EXISTS "public"."tbclienti_accessi_pubblici" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "email_accesso" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "data_attivazione" timestamp with time zone DEFAULT "now"(),
    "ultimo_accesso" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "password_criptata" "text"
);


ALTER TABLE "public"."tbclienti_accessi_pubblici" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti_backup_rapp_legale_20260809" (
    "id" "uuid",
    "cod_cliente" "text",
    "ragione_sociale" "text",
    "codice_fiscale" "text",
    "partita_iva" "text",
    "indirizzo" "text",
    "cap" "text",
    "citta" "text",
    "provincia" "text",
    "email" "text",
    "note" "text",
    "attivo" boolean,
    "utente_operatore_id" "uuid",
    "utente_professionista_id" "uuid",
    "contatto1_id" "uuid",
    "contatto2_id" "uuid",
    "tipo_prestazione_id" "uuid",
    "tipo_cliente" "text",
    "flag_iva" boolean,
    "flag_cu" boolean,
    "flag_bilancio" boolean,
    "flag_fiscali" boolean,
    "flag_lipe" boolean,
    "flag_770" boolean,
    "flag_esterometro" boolean,
    "flag_ccgg" boolean,
    "flag_proforma" boolean,
    "flag_mail_attivo" boolean,
    "flag_mail_scadenze" boolean,
    "flag_mail_newsletter" boolean,
    "data_creazione" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "tipo_redditi" "text",
    "flag_imu" boolean,
    "cassetto_fiscale_id" "uuid",
    "tipologia_cliente" "text",
    "utente_payroll_id" "uuid",
    "professionista_payroll_id" "uuid",
    "matricola_inps" "text",
    "pat_inail" "text",
    "codice_ditta_ce" "text",
    "studio_id" "uuid",
    "referente_esterno" "text",
    "settore_fiscale" boolean,
    "settore_lavoro" boolean,
    "settore_consulenza" boolean,
    "gestione_esterometro" boolean,
    "note_esterometro" "text",
    "rapp_legale_id" "uuid",
    "professionista_incaricato" boolean,
    "numero_rea" "text",
    "soggetto_isa" boolean,
    "telefono" "text",
    "pec" "text",
    "memo" "text",
    "cognome" "text",
    "nome" "text",
    "cliente" boolean,
    "data_nascita" "date",
    "luogo_nascita" "text",
    "nazionalita" "text"
);


ALTER TABLE "public"."tbclienti_backup_rapp_legale_20260809" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti_documenti_aml" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "soggetto_cliente_id" "uuid" NOT NULL,
    "tipo_documento" "text",
    "numero_documento" "text",
    "scadenza_documento" "date",
    "allegato_documento" "text",
    "public_doc_token" "text",
    "public_doc_enabled" boolean DEFAULT false NOT NULL,
    "public_doc_sent_at" timestamp without time zone,
    "public_doc_opened_at" timestamp without time zone,
    "public_doc_submitted_at" timestamp without time zone,
    "documento_richiesto_il" timestamp without time zone,
    "microsoft_connection_id" "uuid",
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbclienti_documenti_aml_tipo_documento_check" CHECK ((("tipo_documento" IS NULL) OR ("tipo_documento" = ANY (ARRAY['Carta di identità'::"text", 'Passaporto'::"text", 'Patente'::"text"]))))
);


ALTER TABLE "public"."tbclienti_documenti_aml" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti_documenti_aml_backup_20260809" (
    "id" "uuid",
    "studio_id" "uuid",
    "soggetto_cliente_id" "uuid",
    "tipo_documento" "text",
    "numero_documento" "text",
    "scadenza_documento" "date",
    "allegato_documento" "text",
    "public_doc_token" "text",
    "public_doc_enabled" boolean,
    "public_doc_sent_at" timestamp without time zone,
    "public_doc_opened_at" timestamp without time zone,
    "public_doc_submitted_at" timestamp without time zone,
    "documento_richiesto_il" timestamp without time zone,
    "microsoft_connection_id" "uuid",
    "attivo" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "legacy_rapp_legale_id" "uuid"
);


ALTER TABLE "public"."tbclienti_documenti_aml_backup_20260809" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti_flag_scadenzari_backup_20260810" (
    "id" "uuid",
    "studio_id" "uuid",
    "flag_iva" boolean,
    "flag_lipe" boolean,
    "flag_cu" boolean,
    "flag_770" boolean,
    "flag_imu" boolean,
    "flag_bilancio" boolean,
    "flag_fiscali" boolean,
    "flag_esterometro" boolean,
    "flag_ccgg" boolean,
    "flag_proforma" boolean
);


ALTER TABLE "public"."tbclienti_flag_scadenzari_backup_20260810" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti_organi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "ruolo" "text" NOT NULL,
    "percentuale_partecipazione" numeric,
    "presenza" "text",
    "carica" "text",
    "principale" boolean DEFAULT false,
    "attivo" boolean DEFAULT true,
    "data_nomina" "date",
    "data_cessazione" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "durata_carica" "text",
    "data_scadenza" "date",
    "soggetto_cliente_id" "uuid",
    "tipo_soggetto" "text" DEFAULT 'rapp_legale'::"text",
    "rappresentante_legale" boolean DEFAULT false,
    "tipo_ruolo" "text",
    "tipo_scadenza" "text",
    "titolo_possesso" "text" DEFAULT 'piena_proprieta'::"text" NOT NULL,
    "percentuale_diritti_voto" numeric(7,4),
    "percentuale_diritti_utili" numeric(7,4),
    "note_titolo_possesso" "text",
    "studio_id" "uuid" NOT NULL,
    CONSTRAINT "tbclienti_organi_tipo_ruolo_check" CHECK (("tipo_ruolo" = ANY (ARRAY['R'::"text", 'S'::"text", 'C'::"text"]))),
    CONSTRAINT "tbclienti_organi_tipo_soggetto_check" CHECK (("tipo_soggetto" = ANY (ARRAY['rapp_legale'::"text", 'persona_fisica'::"text", 'societa'::"text"]))),
    CONSTRAINT "tbclienti_organi_titolo_possesso_check" CHECK (("titolo_possesso" = ANY (ARRAY['piena_proprieta'::"text", 'nuda_proprieta'::"text", 'usufrutto'::"text", 'pegno'::"text", 'sequestro'::"text", 'intestazione_fiduciaria'::"text", 'altro'::"text"])))
);


ALTER TABLE "public"."tbclienti_organi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti_organi_diritti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organo_id" "uuid" NOT NULL,
    "soggetto_cliente_id" "uuid" NOT NULL,
    "tipo_diritto" "text" NOT NULL,
    "percentuale_quota" numeric(7,4) NOT NULL,
    "percentuale_diritti_voto" numeric(7,4),
    "percentuale_diritti_utili" numeric(7,4),
    "diritto_voto" boolean DEFAULT false NOT NULL,
    "diritto_utili" boolean DEFAULT false NOT NULL,
    "data_inizio" "date",
    "data_fine" "date",
    "attivo" boolean DEFAULT true NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbclienti_organi_diritti_quota_check" CHECK ((("percentuale_quota" > (0)::numeric) AND ("percentuale_quota" <= (100)::numeric))),
    CONSTRAINT "tbclienti_organi_diritti_tipo_check" CHECK (("tipo_diritto" = ANY (ARRAY['nuda_proprieta'::"text", 'usufrutto'::"text", 'pegno'::"text", 'sequestro'::"text", 'intestazione_fiduciaria'::"text", 'altro'::"text"])))
);


ALTER TABLE "public"."tbclienti_organi_diritti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti_rapp_legale_backup_20260811" (
    "cliente_id" "uuid",
    "studio_id" "uuid",
    "ragione_sociale" "text",
    "codice_fiscale" "text",
    "rapp_legale_id" "uuid"
);


ALTER TABLE "public"."tbclienti_rapp_legale_backup_20260811" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbclienti_servizi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "contabilita" boolean DEFAULT false NOT NULL,
    "consulenza" boolean DEFAULT false NOT NULL,
    "paghe" boolean DEFAULT false NOT NULL,
    "consulenza_lavoro" boolean DEFAULT false NOT NULL,
    "flag_iva" boolean DEFAULT false NOT NULL,
    "flag_cu" boolean DEFAULT false NOT NULL,
    "flag_bilancio" boolean DEFAULT false NOT NULL,
    "flag_lipe" boolean DEFAULT false NOT NULL,
    "flag_770" boolean DEFAULT false NOT NULL,
    "flag_esterometro" boolean DEFAULT false NOT NULL,
    "flag_ccgg" boolean DEFAULT false NOT NULL,
    "flag_proforma" boolean DEFAULT false NOT NULL,
    "flag_mail_scadenze" boolean DEFAULT false NOT NULL,
    "flag_imu" boolean DEFAULT false NOT NULL,
    "gestione_esterometro" boolean DEFAULT false NOT NULL,
    "note_esterometro" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "flag_fiscali" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."tbclienti_servizi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcomunicazioni" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "oggetto" "text" NOT NULL,
    "messaggio" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "data_invio" timestamp with time zone,
    "stato" "text" DEFAULT 'Bozza'::"text",
    "allegati" "jsonb",
    "destinatari_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid",
    CONSTRAINT "tbcomunicazioni_stato_check" CHECK (("stato" = ANY (ARRAY['Bozza'::"text", 'Inviata'::"text", 'Programmata'::"text"]))),
    CONSTRAINT "tbcomunicazioni_tipo_check" CHECK (("tipo" = ANY (ARRAY['newsletter'::"text", 'scadenze'::"text", 'singola'::"text", 'interna'::"text"])))
);


ALTER TABLE "public"."tbcomunicazioni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontatti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "cognome" "text" NOT NULL,
    "email" "text",
    "cell" "text",
    "tel" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "altro_telefono" "text",
    "contatto_principale" "text",
    "pec" "text",
    "email_secondaria" "text",
    "email_altro" "text",
    "studio_id" "uuid" NOT NULL,
    "ragione_sociale" "text",
    "ruolo" "text",
    "qualifica" "text",
    "via" "text",
    "cap" "text",
    "citta" "text",
    "provincia" "text",
    "nazione" "text" DEFAULT 'Italia'::"text",
    "riceve_comunicazioni" boolean DEFAULT true,
    "riceve_scadenze" boolean DEFAULT true,
    "riceve_newsletter" boolean DEFAULT false,
    "referente_fiscale" boolean DEFAULT false,
    "referente_payroll" boolean DEFAULT false,
    "referente_consulenza" boolean DEFAULT false,
    "referente_amministrativo" boolean DEFAULT false,
    "attivo" boolean DEFAULT true,
    "tipo_contatto" "text" DEFAULT 'persona'::"text",
    "cliente_id" "uuid",
    "memo" "text"
);


ALTER TABLE "public"."tbcontatti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontatti_clienti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid",
    "contatto_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "ruolo" "text",
    "principale" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "note" "text",
    "riceve_comunicazioni" boolean DEFAULT true,
    "riceve_scadenze" boolean DEFAULT true,
    "referente_fiscale" boolean DEFAULT false,
    "referente_payroll" boolean DEFAULT false,
    "referente_consulenza" boolean DEFAULT false,
    "referente_amministrativo" boolean DEFAULT false,
    "email_societa" "text",
    "email_secondaria_societa" "text",
    "pec_societa" "text",
    "telefono_societa" "text",
    "cellulare_societa" "text",
    "note_collegamento" "text"
);


ALTER TABLE "public"."tbcontatti_clienti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontatti_relazioni" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid",
    "contatto_id" "uuid" NOT NULL,
    "contatto_collegato_id" "uuid" NOT NULL,
    "tipo_relazione" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontatti_relazioni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_adesione" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "data_notifica_atto" "date",
    "data_presentazione_istanza" "date",
    "data_scadenza_ricorso_ordinaria" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_atto" IS NOT NULL) THEN ("data_notifica_atto" + 60)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_sospensione_adesione" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_presentazione_istanza" IS NOT NULL) THEN ("data_presentazione_istanza" + 90)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_ricorso_con_adesione" "date" GENERATED ALWAYS AS (
CASE
    WHEN (("data_notifica_atto" IS NOT NULL) AND ("data_presentazione_istanza" IS NOT NULL)) THEN (("data_notifica_atto" + 60) + 90)
    WHEN ("data_notifica_atto" IS NOT NULL) THEN ("data_notifica_atto" + 60)
    ELSE NULL::"date"
END) STORED,
    "data_invito_ufficio" "date",
    "data_incontro" "date",
    "data_sottoscrizione_adesione" "date",
    "data_scadenza_pagamento_adesione" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_sottoscrizione_adesione" IS NOT NULL) THEN ("data_sottoscrizione_adesione" + 20)
    ELSE NULL::"date"
END) STORED,
    "esito" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_adesione" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_avvisi_bonari" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "numero_atto" "text",
    "tipo_atto" "text" NOT NULL,
    "anno_riferimento" integer,
    "data_emissione" "date",
    "data_ricezione" "date" NOT NULL,
    "data_scadenza" "date" GENERATED ALWAYS AS (("data_ricezione" + 60)) STORED,
    "motivazione" "text",
    "contestazione" "text" DEFAULT 'No'::"text" NOT NULL,
    "tipo_contestazione" "text",
    "data_invio_contestazione" "date",
    "responso" "text",
    "comunicato_al_cliente" boolean DEFAULT false NOT NULL,
    "data_comunicazione" "date",
    "fare_ricorso" boolean DEFAULT false NOT NULL,
    "motivazione_ricorso" "text",
    "stato" "text" DEFAULT 'Aperto'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "allegato_atto" "text",
    "allegato_civis" "text",
    "allegato_responso" "text",
    "tipo_atto_id" "uuid",
    "importo_dovuto" numeric(12,2),
    "importo_sgravato" numeric(12,2),
    "importo_residuo" numeric(12,2),
    "giorni_restanti" integer,
    "tributo_constatazione_id" "uuid",
    "operatore_responsabile_id" "uuid",
    "pratica_chiusa" boolean DEFAULT false,
    CONSTRAINT "tbcontenzioso_avvisi_bonari_contestazione_check" CHECK (("contestazione" = ANY (ARRAY['No'::"text", 'Si'::"text", 'Parziale'::"text"]))),
    CONSTRAINT "tbcontenzioso_avvisi_bonari_responso_check" CHECK ((("responso" IS NULL) OR ("responso" = ANY (ARRAY['Sgravio totale'::"text", 'Sgravio parziale'::"text", 'Respinto'::"text"])))),
    CONSTRAINT "tbcontenzioso_avvisi_bonari_stato_check" CHECK (("stato" = ANY (ARRAY['Aperto'::"text", 'Contestato'::"text", 'Chiuso'::"text", 'Ricorso'::"text"]))),
    CONSTRAINT "tbcontenzioso_avvisi_bonari_tipo_contestazione_check" CHECK ((("tipo_contestazione" IS NULL) OR ("tipo_contestazione" = ANY (ARRAY['CIVIS'::"text", 'Autotutela PEC'::"text", 'Autotutela ufficio'::"text"]))))
);


ALTER TABLE "public"."tbcontenzioso_avvisi_bonari" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_cartelle" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "numero_cartella" "text",
    "avviso_bonario_id" "uuid",
    "tipo_atto_id" "uuid",
    "anno_riferimento" integer,
    "data_ruolo" "date",
    "data_ricezione" "date" NOT NULL,
    "data_scadenza" "date",
    "importo_dovuto" numeric(12,2),
    "contestabile" "text" DEFAULT 'No'::"text" NOT NULL,
    "modalita_contestazione" "text",
    "data_invio" "date",
    "esito_contestazione" "text",
    "genera_ricorso" boolean DEFAULT false NOT NULL,
    "data_apertura_ricorso" "date",
    "note_motivazione_ricorso" "text",
    "allegato_cartella" "text",
    "allegato_autotutela" "text",
    "allegato_esito" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "importo_sgravato" numeric(12,2),
    "importo_residuo" numeric(12,2),
    "giorni_restanti" integer,
    "tributo_constatazione_id" "uuid",
    "operatore_responsabile_id" "uuid",
    "pratica_chiusa" boolean DEFAULT false,
    CONSTRAINT "tbcontenzioso_cartelle_contestabile_check" CHECK (("contestabile" = ANY (ARRAY['Si'::"text", 'No'::"text", 'Parzialmente'::"text"]))),
    CONSTRAINT "tbcontenzioso_cartelle_esito_contestazione_check" CHECK ((("esito_contestazione" IS NULL) OR ("esito_contestazione" = ANY (ARRAY['Sgravio totale'::"text", 'Sgravio parziale'::"text", 'Respinto'::"text"])))),
    CONSTRAINT "tbcontenzioso_cartelle_modalita_contestazione_check" CHECK ((("modalita_contestazione" IS NULL) OR ("modalita_contestazione" = ANY (ARRAY['CIVIS'::"text", 'Autotutela PEC'::"text", 'Autotutela ufficio'::"text"]))))
);


ALTER TABLE "public"."tbcontenzioso_cartelle" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_cassazione" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "data_notifica_sentenza_secondo_grado" "date",
    "data_deposito_sentenza_secondo_grado" "date",
    "data_scadenza_ricorso_breve" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_sentenza_secondo_grado" IS NOT NULL) THEN ("data_notifica_sentenza_secondo_grado" + 60)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_ricorso_lungo" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_deposito_sentenza_secondo_grado" IS NOT NULL) THEN ("data_deposito_sentenza_secondo_grado" + '6 mons'::interval)
    ELSE NULL::timestamp without time zone
END) STORED,
    "data_notifica_ricorso_cassazione" "date",
    "data_deposito_ricorso_cassazione" "date",
    "data_notifica_controricorso" "date",
    "data_udienza_o_adunanza" "date",
    "data_memoria_cassazione" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza_o_adunanza" IS NOT NULL) THEN ("data_udienza_o_adunanza" - 10)
    ELSE NULL::"date"
END) STORED,
    "data_sentenza_ordinanza" "date",
    "esito" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_cassazione" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_codici_tributo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tributo" "text" NOT NULL,
    "descrizione" "text" NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_codici_tributo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_esattoriale_tributi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "esattoriale_id" "uuid" NOT NULL,
    "anno" integer,
    "codice_tributo_id" "uuid",
    "importo" numeric(12,2),
    "imposta" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_esattoriale_tributi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_interpello" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "tipo_interpello" "text" DEFAULT 'ordinario'::"text" NOT NULL,
    "data_incarico" "date",
    "data_presentazione" "date",
    "giorni_risposta" integer GENERATED ALWAYS AS (
CASE
    WHEN ("tipo_interpello" = ANY (ARRAY['ordinario'::"text", 'qualificatorio'::"text"])) THEN 90
    ELSE 120
END) STORED,
    "data_scadenza_risposta" "date" GENERATED ALWAYS AS (
CASE
    WHEN (("data_presentazione" IS NOT NULL) AND ("tipo_interpello" = ANY (ARRAY['ordinario'::"text", 'qualificatorio'::"text"]))) THEN ("data_presentazione" + 90)
    WHEN ("data_presentazione" IS NOT NULL) THEN ("data_presentazione" + 120)
    ELSE NULL::"date"
END) STORED,
    "data_richiesta_integrazione" "date",
    "data_invio_integrazione" "date",
    "data_scadenza_risposta_post_integrazione" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_invio_integrazione" IS NOT NULL) THEN ("data_invio_integrazione" + 60)
    ELSE NULL::"date"
END) STORED,
    "data_risposta" "date",
    "esito" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tbcontenzioso_interpello_tipo_interpello_check" CHECK (("tipo_interpello" = ANY (ARRAY['ordinario'::"text", 'qualificatorio'::"text", 'probatorio'::"text", 'antiabuso'::"text", 'disapplicativo'::"text", 'nuovi_investimenti'::"text"])))
);


ALTER TABLE "public"."tbcontenzioso_interpello" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_memorie" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "grado" "text" NOT NULL,
    "data_udienza" "date",
    "data_scadenza_documenti" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 20)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_memorie" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 10)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_repliche" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 5)
    ELSE NULL::"date"
END) STORED,
    "data_deposito_documenti" "date",
    "data_deposito_memorie" "date",
    "data_deposito_repliche" "date",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tbcontenzioso_memorie_grado_check" CHECK (("grado" = ANY (ARRAY['1_grado'::"text", '2_grado'::"text", 'cassazione'::"text"])))
);


ALTER TABLE "public"."tbcontenzioso_memorie" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_processo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "tipo_atto_id" "uuid" NOT NULL,
    "numero_atto" "text",
    "anno_riferimento" integer,
    "data_emissione" "date",
    "data_ricezione" "date" NOT NULL,
    "data_scadenza" "date" NOT NULL,
    "motivazione" "text",
    "contestazione" "text" DEFAULT 'No'::"text" NOT NULL,
    "tipo_contestazione" "text",
    "data_invio_contestazione" "date",
    "responso" "text",
    "comunicato_al_cliente" boolean DEFAULT false NOT NULL,
    "data_comunicazione" "date",
    "fare_ricorso" boolean DEFAULT false NOT NULL,
    "motivazione_ricorso" "text",
    "genera_scadenza_ricorso" boolean DEFAULT false NOT NULL,
    "allegato_atto" "text",
    "allegato_civis" "text",
    "allegato_responso" "text",
    "stato" "text" DEFAULT 'Aperto'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avviso_bonario_id" "uuid",
    "professionista_incaricato_id" "uuid",
    "referente_id" "uuid",
    "descrizione" "text",
    "valore_pratica" numeric(12,2),
    "note" "text",
    "esito" "text" DEFAULT 'Pratica aperta'::"text" NOT NULL,
    "errore_studio" boolean DEFAULT false NOT NULL,
    "comunicato" boolean DEFAULT false NOT NULL,
    "pratica_chiusa" boolean DEFAULT false NOT NULL,
    "tributo_constatazione_id" "uuid",
    CONSTRAINT "tbcontenzioso_esattoriale_esito_check" CHECK (("esito" = ANY (ARRAY['Pratica aperta'::"text", 'Dovuta'::"text", 'Parzialmente dovuta'::"text", 'Non dovuta'::"text"]))),
    CONSTRAINT "tbcontenzioso_scadenze_contestazione_check" CHECK (("contestazione" = ANY (ARRAY['No'::"text", 'Si'::"text", 'Parziale'::"text"]))),
    CONSTRAINT "tbcontenzioso_scadenze_responso_check" CHECK ((("responso" IS NULL) OR ("responso" = ANY (ARRAY['Accolta'::"text", 'Respinta'::"text", 'Accolta parzialmente'::"text"])))),
    CONSTRAINT "tbcontenzioso_scadenze_stato_check" CHECK (("stato" = ANY (ARRAY['Aperto'::"text", 'Contestato'::"text", 'Chiuso'::"text", 'Ricorso'::"text"]))),
    CONSTRAINT "tbcontenzioso_scadenze_tipo_contestazione_check" CHECK ((("tipo_contestazione" IS NULL) OR ("tipo_contestazione" = ANY (ARRAY['Civis'::"text", 'Autotutela ufficio'::"text", 'PEC'::"text", 'Altro'::"text"]))))
);


ALTER TABLE "public"."tbcontenzioso_processo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_pvc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "data_notifica_pvc" "date",
    "data_scadenza_adesione" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_pvc" IS NOT NULL) THEN ("data_notifica_pvc" + '30 days'::interval)
    ELSE NULL::timestamp without time zone
END) STORED,
    "data_scadenza_osservazioni" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_pvc" IS NOT NULL) THEN ("data_notifica_pvc" + '60 days'::interval)
    ELSE NULL::timestamp without time zone
END) STORED,
    "data_effettiva_osservazioni" "date",
    "data_incarico_parere" "date",
    "data_parere" "date",
    "data_incarico_interpello" "date",
    "data_interpello" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_pvc" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_regole_scadenze" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modulo" "text" NOT NULL,
    "codice" "text" NOT NULL,
    "descrizione" "text" NOT NULL,
    "campo_data_base" "text" NOT NULL,
    "direzione" "text" DEFAULT '+'::"text" NOT NULL,
    "giorni" integer NOT NULL,
    "applica_sospensione_feriale" boolean DEFAULT true NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "ordine" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_regole_direzione" CHECK (("direzione" = ANY (ARRAY['+'::"text", '-'::"text"])))
);


ALTER TABLE "public"."tbcontenzioso_regole_scadenze" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_ricorso_primo_grado" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "data_notifica_atto" "date",
    "data_scadenza_ricorso" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_atto" IS NOT NULL) THEN ("data_notifica_atto" + 60)
    ELSE NULL::"date"
END) STORED,
    "data_notifica_ricorso" "date",
    "data_scadenza_costituzione_ricorrente" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_ricorso" IS NOT NULL) THEN ("data_notifica_ricorso" + 30)
    ELSE NULL::"date"
END) STORED,
    "data_costituzione_ricorrente" "date",
    "data_costituzione_resistente" "date",
    "data_udienza" "date",
    "data_scadenza_documenti" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 20)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_memorie" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 10)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_repliche" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 5)
    ELSE NULL::"date"
END) STORED,
    "data_deposito_documenti" "date",
    "data_deposito_memorie" "date",
    "data_deposito_repliche" "date",
    "data_sentenza" "date",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_ricorso_primo_grado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_ricorso_secondo_grado" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "data_notifica_sentenza_primo_grado" "date",
    "data_deposito_sentenza_primo_grado" "date",
    "data_scadenza_appello_breve" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_sentenza_primo_grado" IS NOT NULL) THEN ("data_notifica_sentenza_primo_grado" + 60)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_appello_lungo" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_deposito_sentenza_primo_grado" IS NOT NULL) THEN ("data_deposito_sentenza_primo_grado" + '6 mons'::interval)
    ELSE NULL::timestamp without time zone
END) STORED,
    "data_notifica_appello" "date",
    "data_scadenza_costituzione_appellante" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_appello" IS NOT NULL) THEN ("data_notifica_appello" + 30)
    ELSE NULL::"date"
END) STORED,
    "data_costituzione_appellante" "date",
    "data_costituzione_appellato" "date",
    "data_udienza" "date",
    "data_scadenza_documenti" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 20)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_memorie" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 10)
    ELSE NULL::"date"
END) STORED,
    "data_scadenza_repliche" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_udienza" IS NOT NULL) THEN ("data_udienza" - 5)
    ELSE NULL::"date"
END) STORED,
    "data_sentenza_secondo_grado" "date",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_ricorso_secondo_grado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_scadenze_generate" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "modulo" "text" NOT NULL,
    "modulo_record_id" "uuid" NOT NULL,
    "tipo_scadenza" "text" NOT NULL,
    "descrizione" "text" NOT NULL,
    "data_scadenza" "date" NOT NULL,
    "giorni_residui" integer,
    "stato" "text" DEFAULT 'Aperta'::"text" NOT NULL,
    "data_completamento" "date",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "codice" "text",
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "operatore_responsabile_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbcontenzioso_scadenze_generate_stato_check" CHECK (("stato" = ANY (ARRAY['Aperta'::"text", 'Completata'::"text", 'Annullata'::"text"])))
);


ALTER TABLE "public"."tbcontenzioso_scadenze_generate" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_schema_atto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "processo_id" "uuid" NOT NULL,
    "data_notifica_schema" "date",
    "data_scadenza_osservazioni" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("data_notifica_schema" IS NOT NULL) THEN ("data_notifica_schema" + 60)
    ELSE NULL::"date"
END) STORED,
    "data_effettiva_osservazioni" "date",
    "data_emissione_atto_definitivo" "date",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_schema_atto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_sospensioni" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "descrizione" "text",
    "data_inizio" "date" NOT NULL,
    "data_fine" "date" NOT NULL,
    "attivo" boolean DEFAULT true,
    "ordine" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."tbcontenzioso_sospensioni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_tipi_atto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "descrizione" "text" NOT NULL,
    "giorni_scadenza" integer NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontenzioso_tipi_atto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontenzioso_tributi_constatazione" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "descrizione" "text" NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "ordine" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbcontenzioso_tributi_constatazione" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontrollo_gestione" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "cadenza_controllo" "text",
    "data_esecuzione" "date" DEFAULT CURRENT_DATE,
    "data_storico" "date",
    "note" "text",
    "link" "text",
    "archiviato" boolean DEFAULT false,
    "data_archiviazione" timestamp with time zone,
    "controllo_precedente_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "step_1_completato" boolean DEFAULT false,
    "step_1_note" "text",
    "step_2_completato" boolean DEFAULT false,
    "step_2_note" "text",
    "step_3_completato" boolean DEFAULT false,
    "step_3_note" "text",
    "step_4_completato" boolean DEFAULT false,
    "step_4_note" "text",
    CONSTRAINT "tbcontrollo_gestione_cadenza_controllo_check" CHECK (("cadenza_controllo" = ANY (ARRAY['mensile'::"text", 'trimestrale'::"text", 'quadrimestrale'::"text", 'semestrale'::"text"])))
);


ALTER TABLE "public"."tbcontrollo_gestione" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontrollo_gestione_allegati" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "controllo_id" "uuid" NOT NULL,
    "nome_file" "text",
    "file_path" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontrollo_gestione_allegati" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontrollo_gestione_indici" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "controllo_gestione_id" "uuid",
    "anno" integer,
    "societa" "text",
    "codice_fiscale" "text",
    "ricavi" numeric,
    "costi_operativi" numeric,
    "ammortamenti" numeric,
    "accantonamenti" numeric,
    "oneri_finanziari" numeric,
    "imposte" numeric,
    "utile_netto" numeric,
    "totale_attivo" numeric,
    "capitale_investito" numeric,
    "patrimonio_netto" numeric,
    "debiti_totali" numeric,
    "attivo_corrente" numeric,
    "passivo_corrente" numeric,
    "cash_flow_operativo" numeric,
    "rate_finanziarie_annue" numeric,
    "ebitda" numeric,
    "ebit" numeric,
    "ebt" numeric,
    "roi" numeric,
    "roe" numeric,
    "ros" numeric,
    "roa" numeric,
    "indebitamento" numeric,
    "liquidita" numeric,
    "dscr" numeric,
    "origine" "text" DEFAULT 'xbrl'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbcontrollo_gestione_indici" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcontrollo_gestione_utenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "controllo_id" "uuid" NOT NULL,
    "utente_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcontrollo_gestione_utenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbconversazioni" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "titolo" "text",
    "tipo" "text" DEFAULT 'diretta'::"text" NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "creato_da" "uuid",
    CONSTRAINT "tbconversazioni_tipo_check" CHECK (("tipo" = ANY (ARRAY['diretta'::"text", 'gruppo'::"text"])))
);


ALTER TABLE "public"."tbconversazioni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbconversazioni_utenti" (
    "conversazione_id" "uuid" NOT NULL,
    "utente_id" "uuid" NOT NULL,
    "ultimo_letto_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbconversazioni_utenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbcredenziali_accesso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portale" "text" NOT NULL,
    "indirizzo_url" "text",
    "login_utente" "text",
    "login_pw" "text",
    "login_pin" "text",
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tbcredenziali_accesso" OWNER TO "postgres";


COMMENT ON TABLE "public"."tbcredenziali_accesso" IS 'Credenziali di accesso ai portali esterni - condivise da tutti gli utenti';



CREATE TABLE IF NOT EXISTS "public"."tbcron_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_cron" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "metodo" "text" DEFAULT 'GET'::"text",
    "ok" boolean DEFAULT false,
    "status" integer,
    "body" "jsonb",
    "errore" "text",
    "durata_ms" integer,
    "executed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbcron_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbdipendenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "utente_id" "uuid" NOT NULL,
    "codice_dipendente" "text",
    "nome" "text",
    "cognome" "text",
    "email" "text",
    "orario_giornaliero" numeric(4,2) DEFAULT 8,
    "data_assunzione" "date",
    "data_cessazione" "date",
    "attivo" boolean DEFAULT true,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "codice_ditta" "text",
    "codice_soggetto_paghe" character varying(8),
    "numero_rapporto_paghe" character varying(3)
);


ALTER TABLE "public"."tbdipendenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbemail_template" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codice" "text" NOT NULL,
    "titolo" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "oggetto" "text" NOT NULL,
    "corpo" "text" NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbemail_template" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbferie_permessi_richieste" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "utente_id" "uuid" NOT NULL,
    "tipo_richiesta" "text" NOT NULL,
    "data_inizio" "date" NOT NULL,
    "data_fine" "date",
    "giorni" numeric(5,2),
    "ore" numeric(5,2),
    "motivazione" "text",
    "stato" "text" DEFAULT 'inviata'::"text" NOT NULL,
    "email_responsabile" "text",
    "email_richiedente" "text",
    "note_responsabile" "text",
    "approvato_da" "uuid",
    "approvato_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ferie_permessi_coerenza" CHECK (((("tipo_richiesta" = 'ferie'::"text") AND ("giorni" IS NOT NULL) AND ("ore" IS NULL)) OR (("tipo_richiesta" = 'permesso'::"text") AND ("ore" IS NOT NULL) AND ("giorni" IS NULL)))),
    CONSTRAINT "tbferie_permessi_richieste_stato_check" CHECK (("stato" = ANY (ARRAY['inviata'::"text", 'approvata'::"text", 'rifiutata'::"text", 'revocata'::"text"]))),
    CONSTRAINT "tbferie_permessi_richieste_tipo_richiesta_check" CHECK (("tipo_richiesta" = ANY (ARRAY['ferie'::"text", 'permesso'::"text"])))
);


ALTER TABLE "public"."tbferie_permessi_richieste" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbfestivita" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_festivita" "date" NOT NULL,
    "descrizione" "text" NOT NULL,
    "tipo" "text" DEFAULT 'nazionale'::"text" NOT NULL,
    "comune" "text",
    "provincia" "text",
    "codice_catastale" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbfestivita_tipo_check" CHECK (("tipo" = ANY (ARRAY['nazionale'::"text", 'locale'::"text", 'aziendale'::"text"])))
);


ALTER TABLE "public"."tbfestivita" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbmessaggi" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversazione_id" "uuid" NOT NULL,
    "mittente_id" "uuid" NOT NULL,
    "testo" "text" NOT NULL,
    "cliente_id" "uuid",
    "evento_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "studio_id" "uuid"
);


ALTER TABLE "public"."tbmessaggi" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbmessaggi"."deleted_at" IS 'Timestamp di eliminazione del messaggio (soft delete)';



CREATE TABLE IF NOT EXISTS "public"."tbmessaggi_allegati" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "messaggio_id" "uuid" NOT NULL,
    "nome_file" "text" NOT NULL,
    "tipo_file" "text" NOT NULL,
    "dimensione" integer NOT NULL,
    "storage_path" "text" NOT NULL,
    "url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbmessaggi_allegati" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbmicrosoft365_user_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_cache_encrypted" "text" NOT NULL,
    "scopes" "text",
    "connected_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "revoked_at" timestamp with time zone,
    "microsoft_connection_id" "uuid"
);


ALTER TABLE "public"."tbmicrosoft365_user_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbmicrosoft_calendar_mappings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "evento_id" "uuid" NOT NULL,
    "outlook_event_id" "text" NOT NULL,
    "last_synced" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbmicrosoft_calendar_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."tbmicrosoft_calendar_mappings" IS 'Mapping tra eventi locali (tbagenda) e eventi Microsoft Outlook Calendar';



CREATE TABLE IF NOT EXISTS "public"."tbmicrosoft_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sync_calendar" boolean DEFAULT true,
    "auto_create_teams_meeting" boolean DEFAULT true,
    "send_email_notifications" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "m365_oauth_state" "text",
    "m365_code_verifier" "text",
    "microsoft_connection_id" "uuid"
);


ALTER TABLE "public"."tbmicrosoft_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbmicrosoft_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "microsoft_connection_id" "uuid"
);


ALTER TABLE "public"."tbmicrosoft_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpayroll_qualifiche" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "codice" "text" NOT NULL,
    "descrizione" "text" NOT NULL,
    "attivo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbpayroll_qualifiche" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "tipo_pratica_id" integer NOT NULL,
    "numero_pratica" "text" NOT NULL,
    "titolo" "text" NOT NULL,
    "stato" "text" DEFAULT 'aperta'::"text" NOT NULL,
    "priorita" "text" DEFAULT 'normale'::"text" NOT NULL,
    "data_apertura" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_chiusura" "date",
    "assegnato_a" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "soci_presenti" "jsonb" DEFAULT '[]'::"jsonb",
    "distribuzione_utili" "jsonb" DEFAULT '[]'::"jsonb",
    "pratica_collegata_id" "uuid",
    "chiusa_da" "uuid",
    "pratica_padre_id" "uuid",
    "pratica_origine_id" "uuid",
    "variazione_id" "uuid",
    "codice_workflow" "text",
    "codice_step" "text",
    "ordine_step" integer,
    "stato_step" "text" DEFAULT 'da_fare'::"text",
    "nome_step" "text"
);


ALTER TABLE "public"."tbpratiche" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_assegnazioni" (
    "id" bigint NOT NULL,
    "studio_id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "pratica_id" bigint NOT NULL,
    "utente_id" bigint NOT NULL,
    "assegnato_da" bigint,
    "data_assegnazione" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "attiva" boolean DEFAULT true,
    "note" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbpratiche_assegnazioni" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_assegnazioni_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_assegnazioni_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_assegnazioni_id_seq" OWNED BY "public"."tbpratiche_assegnazioni"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_checklist" (
    "id" bigint NOT NULL,
    "pratica_id" bigint NOT NULL,
    "checklist_template_id" bigint,
    "titolo" character varying(255) NOT NULL,
    "descrizione" "text",
    "obbligatorio" boolean DEFAULT true,
    "completato" boolean DEFAULT false,
    "data_completamento" timestamp without time zone,
    "note" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbpratiche_checklist" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_checklist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_checklist_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_checklist_id_seq" OWNED BY "public"."tbpratiche_checklist"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_checklist_template" (
    "id" bigint NOT NULL,
    "tipo_pratica_id" bigint NOT NULL,
    "titolo" character varying(255) NOT NULL,
    "descrizione" "text",
    "ordine" integer DEFAULT 0 NOT NULL,
    "obbligatorio" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbpratiche_checklist_template" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_checklist_template_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_checklist_template_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_checklist_template_id_seq" OWNED BY "public"."tbpratiche_checklist_template"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_dati_documenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pratica_id" "uuid" NOT NULL,
    "societa_denominazione" "text",
    "societa_sede" "text",
    "societa_codice_fiscale" "text",
    "societa_partita_iva" "text",
    "societa_rea" "text",
    "data_atto" "date",
    "ora_inizio" time without time zone,
    "luogo_assemblea" "text",
    "presidente" "text",
    "segretario" "text",
    "motivo_liquidazione" "text",
    "ora_chiusura" time without time zone,
    "professionista_nome" "text",
    "dicitura_presentazione" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rappresentante_legale_nome" "text",
    "rappresentante_legale_codice_fiscale" "text",
    "liquidatore_nome" "text",
    "liquidatore_codice_fiscale" "text",
    "percentuale_soci_presenti" numeric DEFAULT 100,
    "importo_dividendo_totale" numeric,
    "motivo_liquidazione_testo" "text",
    "data_convocazione" "date",
    "ora_convocazione" time without time zone,
    "luogo_convocazione" "text",
    "liquidatore_residenza" "text",
    "percentuale_capitale" "text",
    "liquidatore_indirizzo" "text",
    "liquidatore_citta" "text",
    "liquidatore_provincia" "text",
    "liquidatore_cap" "text",
    "rappresentante_legale_indirizzo" "text",
    "rappresentante_legale_citta" "text",
    "rappresentante_legale_provincia" "text",
    "rappresentante_legale_cap" "text",
    "liquidatore_tipo_scadenza" "text",
    "liquidatore_data_scadenza" "date",
    "motivo_liquidazione_altro" "text",
    "verbale_definitivo" boolean DEFAULT false
);


ALTER TABLE "public"."tbpratiche_dati_documenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_dicitura_documenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codice" "text" NOT NULL,
    "titolo" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "testo" "text" NOT NULL,
    "attiva" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbpratiche_dicitura_documenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_distribuzione_utili" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pratica_id" "uuid" NOT NULL,
    "nome_cognome" "text" NOT NULL,
    "codice_fiscale" "text",
    "importo_utile" numeric DEFAULT 0,
    "importo_ritenuta" numeric DEFAULT 0,
    "importo_netto" numeric DEFAULT 0,
    "tipo_pagamento" "text",
    "note" "text",
    "ordine" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "percentuale_partecipazione" numeric DEFAULT 0,
    "percentuale_ritenuta" numeric DEFAULT 26,
    "importo_dividendo_totale" numeric(15,2) DEFAULT 0
);


ALTER TABLE "public"."tbpratiche_distribuzione_utili" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_documenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pratica_id" "uuid" NOT NULL,
    "tipo_documento" "text" NOT NULL,
    "nome_file" "text" NOT NULL,
    "file_path" "text",
    "stato" "text" DEFAULT 'caricato'::"text",
    "origine" "text" DEFAULT 'manuale'::"text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbpratiche_documenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_log" (
    "id" bigint NOT NULL,
    "studio_id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "pratica_id" bigint NOT NULL,
    "step_id" bigint,
    "tipo_evento" character varying(50) NOT NULL,
    "descrizione" "text" NOT NULL,
    "utente_id" bigint,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbpratiche_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_log_id_seq" OWNED BY "public"."tbpratiche_log"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_modelli" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codice" "text" NOT NULL,
    "titolo" "text" NOT NULL,
    "tipo_pratica" "text",
    "attivo" boolean DEFAULT true NOT NULL,
    "file_name" "text",
    "file_path" "text",
    "storage_bucket" "text" DEFAULT 'pratiche-modelli'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "testo_modello" "text",
    "descrizione" "text"
);


ALTER TABLE "public"."tbpratiche_modelli" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_modelli_documenti" (
    "id" bigint NOT NULL,
    "studio_id" bigint,
    "tipo_pratica_id" bigint NOT NULL,
    "step_template_id" bigint,
    "nome" character varying(255) NOT NULL,
    "descrizione" "text",
    "tipo_documento" character varying(100),
    "nome_file" character varying(255) NOT NULL,
    "path_file" character varying(500) NOT NULL,
    "formato" character varying(20) DEFAULT 'docx'::character varying,
    "obbligatorio" boolean DEFAULT false,
    "attivo" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbpratiche_modelli_documenti" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_modelli_documenti_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_modelli_documenti_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_modelli_documenti_id_seq" OWNED BY "public"."tbpratiche_modelli_documenti"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_modelli_utilita" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "codice" "text" NOT NULL,
    "categoria" "text" DEFAULT 'verbale'::"text" NOT NULL,
    "tipo_pratica_id" integer,
    "file_path" "text" NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbpratiche_modelli_utilita" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_motivi_liquidazione" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codice" "text" NOT NULL,
    "titolo" "text" NOT NULL,
    "riferimento_normativo" "text",
    "testo_verbale" "text" NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "ordine" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "numero_art_2484" "text"
);


ALTER TABLE "public"."tbpratiche_motivi_liquidazione" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_note" (
    "id" bigint NOT NULL,
    "studio_id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "pratica_id" bigint NOT NULL,
    "step_id" bigint,
    "nota" "text" NOT NULL,
    "created_by" bigint,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbpratiche_note" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_note_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_note_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_note_id_seq" OWNED BY "public"."tbpratiche_note"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_priorita" (
    "id" bigint NOT NULL,
    "codice" character varying(50) NOT NULL,
    "nome" character varying(100) NOT NULL,
    "colore" character varying(20),
    "ordinamento" integer DEFAULT 0,
    "attiva" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbpratiche_priorita" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_priorita_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_priorita_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_priorita_id_seq" OWNED BY "public"."tbpratiche_priorita"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_scadenze" (
    "id" bigint NOT NULL,
    "studio_id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "pratica_id" bigint NOT NULL,
    "step_id" bigint,
    "titolo" character varying(255) NOT NULL,
    "descrizione" "text",
    "data_scadenza" "date" NOT NULL,
    "stato" character varying(30) DEFAULT 'da_fare'::character varying NOT NULL,
    "priorita" character varying(20) DEFAULT 'normale'::character varying NOT NULL,
    "completata" boolean DEFAULT false,
    "data_completamento" timestamp without time zone,
    "assegnato_a" bigint,
    "alert_7gg_inviato" boolean DEFAULT false,
    "alert_oggi_inviato" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chk_scadenza_priorita" CHECK ((("priorita")::"text" = ANY (ARRAY[('bassa'::character varying)::"text", ('normale'::character varying)::"text", ('alta'::character varying)::"text", ('urgente'::character varying)::"text"]))),
    CONSTRAINT "chk_scadenza_stato" CHECK ((("stato")::"text" = ANY (ARRAY[('da_fare'::character varying)::"text", ('in_lavorazione'::character varying)::"text", ('completata'::character varying)::"text", ('annullata'::character varying)::"text"])))
);


ALTER TABLE "public"."tbpratiche_scadenze" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_scadenze_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_scadenze_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_scadenze_id_seq" OWNED BY "public"."tbpratiche_scadenze"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_soggetti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pratica_id" "uuid" NOT NULL,
    "tipo_soggetto" "text" NOT NULL,
    "nome_cognome" "text" NOT NULL,
    "codice_fiscale" "text",
    "carica" "text",
    "note" "text",
    "ordine" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "indirizzo" "text",
    "citta" "text",
    "nominativo_id" "uuid"
);


ALTER TABLE "public"."tbpratiche_soggetti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_stati" (
    "id" bigint NOT NULL,
    "codice" character varying(50) NOT NULL,
    "nome" character varying(100) NOT NULL,
    "colore" character varying(20),
    "ordinamento" integer DEFAULT 0,
    "attivo" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tbpratiche_stati" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_stati_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_stati_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_stati_id_seq" OWNED BY "public"."tbpratiche_stati"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_step" (
    "id" bigint NOT NULL,
    "pratica_id" bigint,
    "template_step_id" bigint,
    "ordine" integer NOT NULL,
    "ente" character varying(50),
    "titolo" character varying(255) NOT NULL,
    "descrizione" "text",
    "stato" character varying(30) DEFAULT 'da_fare'::character varying NOT NULL,
    "obbligatorio" boolean DEFAULT true,
    "data_scadenza" "date",
    "completato" boolean DEFAULT false,
    "data_completamento" timestamp without time zone,
    "responsabile_id" bigint,
    "note" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "dipende_da_step_id" bigint,
    "blocca_step_successivi" boolean DEFAULT true,
    "genera_importo_da_fatturare" boolean DEFAULT false,
    "importo_anticipato" numeric(12,2) DEFAULT 0,
    "variazione_id" "uuid",
    "pratica_uuid" "uuid",
    "documento_id" "uuid",
    "codice_step" "text",
    "data_evasione" "date",
    "richiede_scia" boolean DEFAULT false,
    CONSTRAINT "chk_step_stato" CHECK ((("stato")::"text" = ANY (ARRAY[('da_fare'::character varying)::"text", ('in_lavorazione'::character varying)::"text", ('completato'::character varying)::"text", ('saltato'::character varying)::"text"])))
);


ALTER TABLE "public"."tbpratiche_step" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_step_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_step_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_step_id_seq" OWNED BY "public"."tbpratiche_step"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_step_template" (
    "id" bigint NOT NULL,
    "tipo_pratica_id" bigint NOT NULL,
    "ordine" integer NOT NULL,
    "ente" character varying(50),
    "titolo" character varying(255) NOT NULL,
    "descrizione" "text",
    "giorni_scadenza" integer,
    "obbligatorio" boolean DEFAULT true,
    "richiede_documenti" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "dipende_da_ordine" integer,
    "blocca_step_successivi" boolean DEFAULT true,
    "genera_importo_da_fatturare" boolean DEFAULT false
);


ALTER TABLE "public"."tbpratiche_step_template" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_step_template_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_step_template_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_step_template_id_seq" OWNED BY "public"."tbpratiche_step_template"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_tipi" (
    "id" bigint NOT NULL,
    "studio_id" bigint,
    "ente" character varying(50) NOT NULL,
    "codice" character varying(100) NOT NULL,
    "nome" character varying(255) NOT NULL,
    "descrizione" "text",
    "attiva" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "classe_form" "text"
);


ALTER TABLE "public"."tbpratiche_tipi" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tbpratiche_tipi_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tbpratiche_tipi_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tbpratiche_tipi_id_seq" OWNED BY "public"."tbpratiche_tipi"."id";



CREATE TABLE IF NOT EXISTS "public"."tbpratiche_variazioni" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "pratica_id" "uuid",
    "titolo" "text" NOT NULL,
    "descrizione" "text",
    "tipo_variazione" "text" NOT NULL,
    "priorita" "text" DEFAULT 'normale'::"text" NOT NULL,
    "assegnato_a" "uuid",
    "data_atto" "date",
    "giorni_scadenza_cciaa" integer DEFAULT 30 NOT NULL,
    "data_scadenza_cciaa" "date",
    "ente_principale" "text" DEFAULT 'CCIAA'::"text" NOT NULL,
    "data_presentazione_cciaa" "date",
    "protocollo_cciaa" "text",
    "data_evasione_cciaa" "date",
    "esito_cciaa" "text",
    "ricevuta_cciaa" "text",
    "pratica_cciaa_chiusa" boolean DEFAULT false NOT NULL,
    "obbligo_ade" boolean DEFAULT false NOT NULL,
    "giorni_scadenza_ade" integer DEFAULT 30 NOT NULL,
    "data_scadenza_ade" "date",
    "data_comunicazione_ade" "date",
    "protocollo_ade" "text",
    "ricevuta_telematica_ade" "text",
    "esito_ade" "text",
    "pratica_ade_chiusa" boolean DEFAULT false NOT NULL,
    "conferma_record" boolean DEFAULT false NOT NULL,
    "pratica_chiusa" boolean DEFAULT false NOT NULL,
    "stato" "text" DEFAULT 'memo'::"text" NOT NULL,
    "genera_verbale" boolean DEFAULT false NOT NULL,
    "richiede_pratica" boolean DEFAULT false NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "utente_id" "uuid",
    "promemoria_cciaa_id" "uuid",
    "promemoria_ade_id" "uuid",
    "pratica_origine_id" "uuid",
    "pratica_determina_id" "uuid",
    "pratica_liquidazione_id" "uuid",
    "step_determina_stato" "text" DEFAULT 'da_fare'::"text",
    "step_liquidazione_stato" "text" DEFAULT 'da_fare'::"text",
    "step_accettazione_carica_stato" "text" DEFAULT 'da_fare'::"text",
    "step_cciaa_stato" "text" DEFAULT 'da_fare'::"text",
    "step_ade_stato" "text" DEFAULT 'da_fare'::"text",
    "data_evasione_determina" "date",
    "data_evasione_liquidazione" "date",
    "data_evasione_accettazione_carica" "date",
    "data_evasione_ade" "date",
    "data_evasione_amministratore" "date",
    "data_evasione_apertura_unita_locale" "date",
    "data_evasione_chiusura_unita_locale" "date",
    "richiede_scia" boolean DEFAULT false,
    "data_evasione_scia" "date",
    "step_verbale_stato" "text" DEFAULT 'da_fare'::"text",
    CONSTRAINT "tbpratiche_variazioni_ente_principale_check" CHECK (("ente_principale" = ANY (ARRAY['CCIAA'::"text", 'AGENZIA_ENTRATE'::"text"]))),
    CONSTRAINT "tbpratiche_variazioni_esito_ade_check" CHECK ((("esito_ade" IS NULL) OR ("esito_ade" = ANY (ARRAY['Accettata'::"text", 'Respinta'::"text", 'Protocollata'::"text", 'Evasa'::"text"])))),
    CONSTRAINT "tbpratiche_variazioni_esito_cciaa_check" CHECK ((("esito_cciaa" IS NULL) OR ("esito_cciaa" = ANY (ARRAY['Accettata'::"text", 'Respinta'::"text", 'Protocollata'::"text", 'Evasa'::"text"])))),
    CONSTRAINT "tbpratiche_variazioni_priorita_check" CHECK (("priorita" = ANY (ARRAY['bassa'::"text", 'normale'::"text", 'alta'::"text", 'urgente'::"text"]))),
    CONSTRAINT "tbpratiche_variazioni_stato_check" CHECK (("stato" = ANY (ARRAY['aperta'::"text", 'in_lavorazione'::"text", 'completata'::"text"])))
);


ALTER TABLE "public"."tbpratiche_variazioni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpratiche_variazioni_tipi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "descrizione_variazione" "text" NOT NULL,
    "ente_principale" "text" DEFAULT 'CCIAA'::"text" NOT NULL,
    "tipo_pratica_id" bigint,
    "genera_pratica" boolean DEFAULT true NOT NULL,
    "genera_verbale" boolean DEFAULT false NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "ordine" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tbpratiche_variazioni_tipi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpresenze_codici" (
    "codice" "text" NOT NULL,
    "descrizione" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "ordine" integer DEFAULT 0 NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbpresenze_codici_tipo_check" CHECK (("tipo" = ANY (ARRAY['presenza'::"text", 'assenza'::"text", 'permesso'::"text", 'festivo'::"text"])))
);


ALTER TABLE "public"."tbpresenze_codici" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpresenze_dipendenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "utente_id" "uuid" NOT NULL,
    "data_presenza" "date" NOT NULL,
    "codice_presenza" "text" NOT NULL,
    "note" "text",
    "inserito_da" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generata_da_richiesta_ferie_permessi" boolean DEFAULT false,
    "richiesta_ferie_permessi_id" "uuid"
);


ALTER TABLE "public"."tbpresenze_dipendenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpresenze_smart_calendario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gruppo_id" "uuid" NOT NULL,
    "utente_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "anno" integer NOT NULL,
    "mese" integer NOT NULL,
    "giorno_settimana" integer NOT NULL,
    "presenza" boolean DEFAULT false NOT NULL,
    "festivo" boolean DEFAULT false NOT NULL,
    "nota" "text",
    "generato_auto" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tbpresenze_smart_calendario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpresenze_smart_cambi_turno" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gruppo_id" "uuid" NOT NULL,
    "richiedente_id" "uuid" NOT NULL,
    "data_richiedente" "date" NOT NULL,
    "sostituto_id" "uuid",
    "data_sostituto" "date",
    "stato" "text" DEFAULT 'aperta'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accettata_il" timestamp with time zone,
    "studio_id" "uuid" NOT NULL,
    CONSTRAINT "tbpresenze_smart_cambi_turno_stato_check" CHECK (("stato" = ANY (ARRAY['aperta'::"text", 'accettata'::"text", 'annullata'::"text"])))
);


ALTER TABLE "public"."tbpresenze_smart_cambi_turno" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpresenze_smart_gruppi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settore" "text" NOT NULL,
    "tipo_rapporto" "text",
    "nome_gruppo" "text" NOT NULL,
    "giorno_fisso" integer DEFAULT 2 NOT NULL,
    "presenze_settimanali" integer DEFAULT 2 NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tbpresenze_smart_gruppi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpresenze_smart_gruppi_utenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gruppo_id" "uuid" NOT NULL,
    "utente_id" "uuid" NOT NULL,
    "ordine" integer DEFAULT 0 NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tbpresenze_smart_gruppi_utenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpresenze_solleciti_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "text" NOT NULL,
    "utente_id" "text" NOT NULL,
    "data_sollecito" "date" DEFAULT CURRENT_DATE NOT NULL,
    "periodo_da" "date" NOT NULL,
    "periodo_a" "date" NOT NULL,
    "giorni_mancanti" "jsonb" NOT NULL,
    "email_destinatario" "text" NOT NULL,
    "esito" "text" DEFAULT 'inviato'::"text" NOT NULL,
    "errore" "text",
    "inviato_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbpresenze_solleciti_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbprestazioni" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "descrizione" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid"
);


ALTER TABLE "public"."tbprestazioni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbpromemoria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operatore_id" "uuid" NOT NULL,
    "tipo_promemoria_id" "uuid",
    "data_inserimento" "date" DEFAULT CURRENT_DATE NOT NULL,
    "giorni_scadenza" integer DEFAULT 30 NOT NULL,
    "data_scadenza" "date" NOT NULL,
    "working_progress" "text" DEFAULT 'In lavorazione'::"text" NOT NULL,
    "da_fatturare" boolean DEFAULT false NOT NULL,
    "fatturato" boolean DEFAULT false NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "destinatario_id" "uuid",
    "settore" "text",
    "titolo" "text",
    "descrizione" "text",
    "priorita" "text" DEFAULT 'Media'::"text",
    "allegati" "jsonb" DEFAULT '[]'::"jsonb",
    "studio_id" "uuid",
    "alert_7gg_inviato" boolean DEFAULT false,
    "alert_oggi_inviato" boolean DEFAULT false,
    "alert_7gg_inviato_at" timestamp with time zone,
    "alert_oggi_inviato_at" timestamp with time zone,
    "eliminato" boolean DEFAULT false,
    "eliminato_at" timestamp with time zone,
    "eliminato_da" "uuid",
    "gruppo_promemoria_id" "uuid",
    "stato_aggiornato_da" "uuid",
    "stato_aggiornato_at" timestamp with time zone,
    "alert_3gg_inviato" boolean DEFAULT false,
    "alert_3gg_inviato_at" timestamp with time zone,
    "tipo" "text" DEFAULT 'PROMEMORIA'::"text" NOT NULL,
    "colore" "text",
    "origine" "text",
    "origine_id" "uuid",
    "data_completamento" "date",
    CONSTRAINT "tbpromemoria_working_progress_check" CHECK (("working_progress" = ANY (ARRAY['Aperto'::"text", 'In lavorazione'::"text", 'Completato'::"text", 'Presa visione'::"text", 'Richiesta confronto'::"text", 'Annullata'::"text"])))
);


ALTER TABLE "public"."tbpromemoria" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbpromemoria"."destinatario_id" IS 'Destinatario del promemoria (FK tbutenti)';



COMMENT ON COLUMN "public"."tbpromemoria"."settore" IS 'Settore di competenza';



COMMENT ON COLUMN "public"."tbpromemoria"."allegati" IS 'Array JSON di allegati con metadati (nome, url, size, tipo, data_upload)';



CREATE TABLE IF NOT EXISTS "public"."tbreferimenti_valori" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "valore" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid",
    CONSTRAINT "tbreferimenti_valori_tipo_check" CHECK (("tipo" = ANY (ARRAY['matricola_inps'::"text", 'pat_inail'::"text", 'codice_ditta_ce'::"text"])))
);


ALTER TABLE "public"."tbreferimenti_valori" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbrevisione_checklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "controllo_id" "uuid" NOT NULL,
    "area" "text" NOT NULL,
    "domanda" "text" NOT NULL,
    "risposta" "text",
    "note" "text",
    "ordine" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "esito" "text",
    "gravita" "text",
    "follow_up" boolean DEFAULT false,
    "data_follow_up" "date",
    "raccomandazione" "text",
    CONSTRAINT "chk_rev_esito" CHECK ((("esito" IS NULL) OR ("esito" = ANY (ARRAY['REGOLARE'::"text", 'DA_MONITORARE'::"text", 'IRREGOLARE'::"text"])))),
    CONSTRAINT "chk_rev_gravita" CHECK ((("gravita" IS NULL) OR ("gravita" = ANY (ARRAY['BASSA'::"text", 'MEDIA'::"text", 'ALTA'::"text"])))),
    CONSTRAINT "tbrevisione_checklist_risposta_check" CHECK (("risposta" = ANY (ARRAY['SI'::"text", 'NO'::"text", 'N_A'::"text"])))
);


ALTER TABLE "public"."tbrevisione_checklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbrevisione_controlli" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incarico_id" "uuid" NOT NULL,
    "anno" integer NOT NULL,
    "trimestre" integer NOT NULL,
    "data_scadenza" "date" NOT NULL,
    "data_controllo" "date",
    "stato" "text" DEFAULT 'DA_FARE'::"text" NOT NULL,
    "esito" "text",
    "note" "text",
    "alert_15gg_inviato" boolean DEFAULT false NOT NULL,
    "alert_7gg_inviato" boolean DEFAULT false NOT NULL,
    "alert_oggi_inviato" boolean DEFAULT false NOT NULL,
    "completato_da" "uuid",
    "completato_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "alert_scaduto_inviato" boolean DEFAULT false NOT NULL,
    "studio_id" "uuid" NOT NULL,
    CONSTRAINT "tbrevisione_controlli_stato_check" CHECK (("stato" = ANY (ARRAY['DA_FARE'::"text", 'IN_LAVORAZIONE'::"text", 'COMPLETATO'::"text", 'SCADUTO'::"text"]))),
    CONSTRAINT "tbrevisione_controlli_trimestre_check" CHECK ((("trimestre" >= 1) AND ("trimestre" <= 4)))
);


ALTER TABLE "public"."tbrevisione_controlli" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbrevisione_documenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "controllo_id" "uuid" NOT NULL,
    "relazione_id" "uuid",
    "nome_file" "text" NOT NULL,
    "path_file" "text",
    "tipo_file" "text" NOT NULL,
    "testo_documento" "text",
    "generato_da" "uuid",
    "generato_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbrevisione_documenti_tipo_file_check" CHECK (("tipo_file" = ANY (ARRAY['DOCX'::"text", 'PDF'::"text", 'TXT'::"text"])))
);


ALTER TABLE "public"."tbrevisione_documenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbrevisione_followup" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "controllo_id" "uuid" NOT NULL,
    "checklist_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "descrizione" "text" NOT NULL,
    "gravita" "text",
    "data_scadenza" "date",
    "completato" boolean DEFAULT false,
    "completato_da" "uuid",
    "completato_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "alert_15gg_inviato" boolean DEFAULT false NOT NULL,
    "alert_7gg_inviato" boolean DEFAULT false NOT NULL,
    "alert_oggi_inviato" boolean DEFAULT false NOT NULL,
    "alert_scaduto_inviato" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."tbrevisione_followup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbrevisione_incarichi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "tipo_incarico" "text" NOT NULL,
    "data_nomina" "date",
    "data_inizio" "date" NOT NULL,
    "data_fine" "date",
    "periodicita" "text" DEFAULT 'TRIMESTRALE'::"text" NOT NULL,
    "responsabile_id" "uuid",
    "attivo" boolean DEFAULT true NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbrevisione_incarichi_tipo_incarico_check" CHECK (("tipo_incarico" = ANY (ARRAY['REVISIONE_LEGALE'::"text", 'SOCIETA_REVISIONE'::"text", 'SINDACO_UNICO'::"text", 'COLLEGIO_SINDACALE'::"text", 'ORGANO_UNICO_DOPPIA_FUNZIONE'::"text", 'SINDACO_COLLEGIO_PIU_REVISORE'::"text"])))
);


ALTER TABLE "public"."tbrevisione_incarichi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbrevisione_modelli" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "codice" "text" NOT NULL,
    "titolo" "text" NOT NULL,
    "tipo_incarico" "text",
    "categoria" "text" DEFAULT 'revisione_controllo'::"text" NOT NULL,
    "testo" "text" NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbrevisione_modelli" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbrevisione_relazioni" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "controllo_id" "uuid" NOT NULL,
    "modello_id" "uuid",
    "titolo" "text" NOT NULL,
    "testo_generato" "text",
    "generata_da" "uuid",
    "generata_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tbrevisione_relazioni" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbrevisione_soggetti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incarico_id" "uuid" NOT NULL,
    "nominativo_id" "uuid",
    "nome" "text" NOT NULL,
    "codice_fiscale" "text",
    "email" "text",
    "ruolo" "text" NOT NULL,
    "principale" boolean DEFAULT false NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbrevisione_soggetti_ruolo_check" CHECK (("ruolo" = ANY (ARRAY['REVISORE'::"text", 'SOCIETA_REVISIONE'::"text", 'SINDACO_UNICO'::"text", 'PRESIDENTE_COLLEGIO'::"text", 'SINDACO_EFFETTIVO'::"text", 'SINDACO_SUPPLENTE'::"text"])))
);


ALTER TABLE "public"."tbrevisione_soggetti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbroperatore" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ruolo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid"
);


ALTER TABLE "public"."tbroperatore" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscad770" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_operatore_id" "uuid",
    "tipo_invio" "text",
    "modelli_770" "text",
    "mod_compilato" boolean DEFAULT false,
    "mod_definitivo" boolean DEFAULT false,
    "mod_inviato" boolean DEFAULT false,
    "data_invio" "date",
    "ricevuta" boolean DEFAULT false,
    "note" "text",
    "conferma_riga" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_scadenza_id" "uuid",
    "utente_payroll_id" "uuid",
    "professionista_payroll_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "data_scadenza_adempimento" "date",
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "utente_professionista_id" "uuid",
    CONSTRAINT "tbscad770_modelli_770_check" CHECK (("modelli_770" = ANY (ARRAY['Solo aut'::"text", 'Solo cap'::"text", 'Solo Dip'::"text", 'Aut+Dip'::"text", 'Aut+Cap'::"text", 'Aut+Dip+Cap'::"text", 'Dip+Cap'::"text"]))),
    CONSTRAINT "tbscad770_tipo_invio_check" CHECK (("tipo_invio" = ANY (ARRAY['Totale'::"text", 'Invio Separato'::"text"])))
);


ALTER TABLE "public"."tbscad770" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbscad770"."utente_payroll_id" IS 'Riferimento utente payroll (FK tbutenti)';



CREATE TABLE IF NOT EXISTS "public"."tbscadaffitti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "utente_operatore_id" "uuid",
    "nominativo" "text",
    "descrizione_immobile_locato" "text",
    "data_registrazione_atto" "date" NOT NULL,
    "durata_contratto_anni" integer NOT NULL,
    "codice_identificativo_registrazione" "text",
    "importo_registrazione" numeric(12,2),
    "contatore_anni" integer DEFAULT 1 NOT NULL,
    "data_prossima_scadenza" "date" NOT NULL,
    "alert1_inviato" boolean DEFAULT false NOT NULL,
    "alert1_inviato_at" timestamp with time zone,
    "alert2_inviato" boolean DEFAULT false NOT NULL,
    "alert2_inviato_at" timestamp with time zone,
    "alert3_inviato" boolean DEFAULT false NOT NULL,
    "alert3_inviato_at" timestamp with time zone,
    "attivo" boolean DEFAULT true NOT NULL,
    "contratto_concluso" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "emailperalert" "text",
    "conduttore" "text",
    "data_rinnovo_atto" "date",
    "rinnovo" boolean DEFAULT false NOT NULL,
    "tipo_tributo" "text" DEFAULT 'F'::"text" NOT NULL,
    "codice_tributo" "text" DEFAULT '1501'::"text" NOT NULL,
    "canone_iniziale" numeric(12,2),
    "perc_imposta" numeric(5,2),
    "canone_attuale" numeric(12,2),
    "forza_imposta" boolean DEFAULT false NOT NULL,
    "data_invio_f24" timestamp with time zone,
    CONSTRAINT "tbscadaffitti_canone_attuale_check" CHECK ((("canone_attuale" IS NULL) OR ("canone_attuale" >= (0)::numeric))),
    CONSTRAINT "tbscadaffitti_canone_iniziale_check" CHECK ((("canone_iniziale" IS NULL) OR ("canone_iniziale" >= (0)::numeric))),
    CONSTRAINT "tbscadaffitti_codice_tributo_check" CHECK (("char_length"("codice_tributo") <= 10)),
    CONSTRAINT "tbscadaffitti_contatore_anni_check" CHECK (("contatore_anni" >= 1)),
    CONSTRAINT "tbscadaffitti_durata_contratto_anni_check" CHECK (("durata_contratto_anni" >= 1)),
    CONSTRAINT "tbscadaffitti_perc_imposta_check" CHECK ((("perc_imposta" IS NULL) OR ("perc_imposta" >= (0)::numeric))),
    CONSTRAINT "tbscadaffitti_tipo_tributo_check" CHECK (("char_length"("tipo_tributo") <= 1))
);


ALTER TABLE "public"."tbscadaffitti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadbilanci" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_operatore_id" "uuid",
    "bilancio_def" boolean DEFAULT false,
    "verbale_app" boolean DEFAULT false,
    "relazione_gest" boolean DEFAULT false,
    "relazione_sindaci" boolean DEFAULT false,
    "relazione_revisore" boolean DEFAULT false,
    "data_approvazione" "date",
    "data_scad_pres" "date",
    "bil_approvato" boolean DEFAULT false,
    "invio_bil" boolean DEFAULT false,
    "data_invio" "date",
    "ricevuta" boolean DEFAULT false,
    "note" "text",
    "conferma_riga" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_scadenza_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "consorzio" boolean DEFAULT false NOT NULL,
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "data_scadenza_adempimento" "date",
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "utente_professionista_id" "uuid"
);


ALTER TABLE "public"."tbscadbilanci" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadccgg" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_operatore_id" "uuid",
    "conferma_riga" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "importo_calcolato" boolean DEFAULT false,
    "f24_generato" boolean DEFAULT false,
    "f24_comunicato" boolean DEFAULT false,
    "data_comunicato" "date",
    "note" "text",
    "tipo_scadenza_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "data_scadenza_adempimento" "date",
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "utente_professionista_id" "uuid"
);


ALTER TABLE "public"."tbscadccgg" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadcu" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_operatore_id" "uuid",
    "conferma_riga" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cu_autonomi" boolean DEFAULT false,
    "inserite" boolean DEFAULT false,
    "generate" boolean DEFAULT false,
    "inviate" boolean DEFAULT false,
    "data_invio" "date",
    "num_cu" "text",
    "note" "text",
    "tipo_scadenza_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "data_scadenza_adempimento" "date",
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "utente_professionista_id" "uuid"
);


ALTER TABLE "public"."tbscadcu" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadenze_alert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_scadenza_id" "uuid" NOT NULL,
    "utente_id" "uuid" NOT NULL,
    "alert_numero" integer NOT NULL,
    "anno_riferimento" integer NOT NULL,
    "data_invio" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_alert" "text"
);


ALTER TABLE "public"."tbscadenze_alert_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadenze_centrale" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "operatore_responsabile_id" "uuid",
    "origine_modulo" "text" NOT NULL,
    "origine_tabella" "text" NOT NULL,
    "origine_record_id" "uuid" NOT NULL,
    "tipo_scadenza" "text" NOT NULL,
    "titolo" "text" NOT NULL,
    "descrizione" "text",
    "data_scadenza" "date" NOT NULL,
    "stato" "text" DEFAULT 'attiva'::"text" NOT NULL,
    "priorita" "text" DEFAULT 'normale'::"text" NOT NULL,
    "giorni_preavviso_1" integer,
    "giorni_preavviso_2" integer,
    "giorni_preavviso_3" integer,
    "prossimo_alert_at" timestamp with time zone,
    "ultimo_alert_inviato_at" timestamp with time zone,
    "numero_alert_inviati" integer DEFAULT 0 NOT NULL,
    "link_dettaglio" "text",
    "metadati" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "completata_at" timestamp with time zone,
    "annullata_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "intervalli_alert" integer[] DEFAULT ARRAY[30, 20, 10, 5, 2, 1, 0] NOT NULL,
    CONSTRAINT "tbscadenze_centrale_preavviso_1_check" CHECK ((("giorni_preavviso_1" IS NULL) OR ("giorni_preavviso_1" >= 0))),
    CONSTRAINT "tbscadenze_centrale_preavviso_2_check" CHECK ((("giorni_preavviso_2" IS NULL) OR ("giorni_preavviso_2" >= 0))),
    CONSTRAINT "tbscadenze_centrale_preavviso_3_check" CHECK ((("giorni_preavviso_3" IS NULL) OR ("giorni_preavviso_3" >= 0))),
    CONSTRAINT "tbscadenze_centrale_priorita_check" CHECK (("priorita" = ANY (ARRAY['bassa'::"text", 'normale'::"text", 'alta'::"text", 'urgente'::"text"]))),
    CONSTRAINT "tbscadenze_centrale_stato_check" CHECK (("stato" = ANY (ARRAY['attiva'::"text", 'completata'::"text", 'annullata'::"text", 'sospesa'::"text"])))
);


ALTER TABLE "public"."tbscadenze_centrale" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadenze_centrale_alert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "scadenza_id" "uuid" NOT NULL,
    "operatore_responsabile_id" "uuid",
    "alert_numero" integer NOT NULL,
    "giorni_preavviso" integer NOT NULL,
    "data_programmata" timestamp with time zone NOT NULL,
    "inviato_at" timestamp with time zone,
    "canale" "text" DEFAULT 'email'::"text" NOT NULL,
    "destinatario_email" "text",
    "esito" "text" DEFAULT 'da_inviare'::"text" NOT NULL,
    "errore" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_alert" "text" NOT NULL,
    "chiave_invio" "text" NOT NULL,
    "destinatario_utente_id" "uuid",
    CONSTRAINT "tbscadenze_centrale_alert_canale_check" CHECK (("canale" = ANY (ARRAY['email'::"text", 'promemoria'::"text", 'notifica'::"text"]))),
    CONSTRAINT "tbscadenze_centrale_alert_esito_check" CHECK (("esito" = ANY (ARRAY['da_inviare'::"text", 'in_lavorazione'::"text", 'inviato'::"text", 'errore'::"text", 'annullato'::"text"])))
);


ALTER TABLE "public"."tbscadenze_centrale_alert_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadenze_centrale_destinatari" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "scadenza_id" "uuid" NOT NULL,
    "utente_id" "uuid",
    "origine_assegnazione" "text" DEFAULT 'manuale'::"text" NOT NULL,
    "attivo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "destinatario_email" "text",
    "tipo_destinatario" "text" DEFAULT 'interno'::"text" NOT NULL,
    CONSTRAINT "tbscadenze_centrale_destinatari_coerenza_check" CHECK (((("tipo_destinatario" = 'interno'::"text") AND ("utente_id" IS NOT NULL)) OR (("tipo_destinatario" = 'esterno'::"text") AND ("destinatario_email" IS NOT NULL) AND ("btrim"("destinatario_email") <> ''::"text")))),
    CONSTRAINT "tbscadenze_centrale_destinatari_origine_check" CHECK (("origine_assegnazione" = ANY (ARRAY['manuale'::"text", 'operatore_responsabile'::"text", 'settore_fiscale'::"text", 'settore_lavoro'::"text", 'settore_consulenza'::"text", 'affitto_operatore'::"text", 'affitto_email_esterna'::"text"]))),
    CONSTRAINT "tbscadenze_centrale_destinatari_tipo_check" CHECK (("tipo_destinatario" = ANY (ARRAY['interno'::"text", 'esterno'::"text"])))
);


ALTER TABLE "public"."tbscadenze_centrale_destinatari" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadestero" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_professionista_id" "uuid",
    "utente_operatore_id" "uuid",
    "gen_previsto" boolean DEFAULT false,
    "gen_invio" boolean DEFAULT false,
    "nmese1" integer DEFAULT 0,
    "feb_previsto" boolean DEFAULT false,
    "feb_invio" boolean DEFAULT false,
    "nmese2" integer DEFAULT 0,
    "mar_previsto" boolean DEFAULT false,
    "mar_invio" boolean DEFAULT false,
    "nmese3" integer DEFAULT 0,
    "apr_previsto" boolean DEFAULT false,
    "apr_invio" boolean DEFAULT false,
    "nmese4" integer DEFAULT 0,
    "mag_previsto" boolean DEFAULT false,
    "mag_invio" boolean DEFAULT false,
    "nmese5" integer DEFAULT 0,
    "giu_previsto" boolean DEFAULT false,
    "giu_invio" boolean DEFAULT false,
    "nmese6" integer DEFAULT 0,
    "lug_previsto" boolean DEFAULT false,
    "lug_invio" boolean DEFAULT false,
    "nmese7" integer DEFAULT 0,
    "ago_previsto" boolean DEFAULT false,
    "ago_invio" boolean DEFAULT false,
    "nmese8" integer DEFAULT 0,
    "set_previsto" boolean DEFAULT false,
    "set_invio" boolean DEFAULT false,
    "nmese9" integer DEFAULT 0,
    "ott_previsto" boolean DEFAULT false,
    "ott_invio" boolean DEFAULT false,
    "nmese10" integer DEFAULT 0,
    "nov_previsto" boolean DEFAULT false,
    "nov_invio" boolean DEFAULT false,
    "nmese11" integer DEFAULT 0,
    "dic_previsto" boolean DEFAULT false,
    "dic_invio" boolean DEFAULT false,
    "nmese12" integer DEFAULT 0,
    "tot_doc" integer GENERATED ALWAYS AS ((((((((((((COALESCE("nmese1", 0) + COALESCE("nmese2", 0)) + COALESCE("nmese3", 0)) + COALESCE("nmese4", 0)) + COALESCE("nmese5", 0)) + COALESCE("nmese6", 0)) + COALESCE("nmese7", 0)) + COALESCE("nmese8", 0)) + COALESCE("nmese9", 0)) + COALESCE("nmese10", 0)) + COALESCE("nmese11", 0)) + COALESCE("nmese12", 0))) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_scadenza_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tbscadestero" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadfiscali" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_operatore_id" "uuid",
    "conferma_riga" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mod_r_compilato" boolean DEFAULT false,
    "mod_r_definitivo" boolean DEFAULT false,
    "mod_r_inviato" boolean DEFAULT false,
    "data_r_invio" "date",
    "ricevuta_r" boolean DEFAULT false,
    "con_irap" boolean DEFAULT false,
    "mod_i_compilato" boolean DEFAULT false,
    "mod_i_definitivo" boolean DEFAULT false,
    "mod_i_inviato" boolean DEFAULT false,
    "data_i_invio" "date",
    "note" "text",
    "saldo_acc_cciaa" boolean DEFAULT false,
    "data_com1" "date",
    "acc2" boolean DEFAULT false,
    "data_com2" "date",
    "tipo_redditi" "text",
    "tipo_scadenza_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "data_scadenza_adempimento" "date",
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "utente_professionista_id" "uuid",
    "conferma_ires_saldo_acconto" boolean DEFAULT false NOT NULL,
    "conferma_cciaa" boolean DEFAULT false NOT NULL,
    "conferma_ires_secondo_acconto" boolean DEFAULT false NOT NULL,
    "conferma_invio_dichiarazione" boolean DEFAULT false NOT NULL,
    "conferma_irap_saldo_acconto" boolean DEFAULT false NOT NULL,
    "conferma_irap_secondo_acconto" boolean DEFAULT false NOT NULL,
    "conferma_irap_invio_dichiarazione" boolean DEFAULT false NOT NULL,
    "saldi_primo_acconti_cciaa_dovuti" boolean DEFAULT false,
    "secondo_acconti_dovuti" boolean DEFAULT false,
    "soggetto_isa" boolean DEFAULT false NOT NULL,
    CONSTRAINT "tbscadfiscali_tipo_redditi_check" CHECK ((("tipo_redditi" IS NULL) OR ("tipo_redditi" = ANY (ARRAY['USC'::"text", 'USP'::"text", 'ENC'::"text", 'UPF FORF.'::"text", 'UPF ORD.'::"text", 'UPF BASE'::"text", '730'::"text"]))))
);


ALTER TABLE "public"."tbscadfiscali" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbscadfiscali"."tipo_redditi" IS 'Tipo di redditi: SC, SP, ENC, PF, 730';



CREATE TABLE IF NOT EXISTS "public"."tbscadimu" (
    "id" "uuid" NOT NULL,
    "nominativo" "text",
    "acconto_imu" boolean DEFAULT false,
    "acconto_dovuto" boolean DEFAULT false,
    "acconto_comunicato" boolean DEFAULT false,
    "data_com_acconto" "date",
    "saldo_imu" boolean DEFAULT false,
    "saldo_dovuto" boolean DEFAULT false,
    "saldo_comunicato" boolean DEFAULT false,
    "data_com_saldo" "date",
    "dichiarazione_imu" boolean DEFAULT false,
    "data_scad_dichiarazione" "date",
    "dichiarazione_presentata" boolean DEFAULT false,
    "data_presentazione" "date",
    "note" "text",
    "conferma_riga" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid" NOT NULL,
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "utente_operatore_id" "uuid",
    "conferma_acconto_imu" boolean DEFAULT false NOT NULL,
    "conferma_saldo_imu" boolean DEFAULT false NOT NULL,
    "conferma_dichiarazione_imu" boolean DEFAULT false NOT NULL,
    "utente_professionista_id" "uuid"
);


ALTER TABLE "public"."tbscadimu" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadiva" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_operatore_id" "uuid",
    "conferma_riga" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mod_predisposto" boolean DEFAULT false,
    "mod_definitivo" boolean DEFAULT false,
    "mod_inviato" boolean DEFAULT false,
    "data_invio" "date",
    "ricevuta" boolean DEFAULT false,
    "note" "text",
    "tipo_scadenza_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "asseverazione" boolean DEFAULT false,
    "importo_credito" numeric(12,2),
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "data_scadenza_adempimento" "date",
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "utente_professionista_id" "uuid"
);


ALTER TABLE "public"."tbscadiva" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbscadiva"."asseverazione" IS 'Checkbox per indicare se presente asseverazione del credito IVA';



COMMENT ON COLUMN "public"."tbscadiva"."importo_credito" IS 'Importo del credito IVA (attivo solo se asseverazione=true)';



CREATE TABLE IF NOT EXISTS "public"."tbscadlipe" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_professionista_id" "uuid",
    "utente_operatore_id" "uuid",
    "gen" boolean DEFAULT false,
    "feb" boolean DEFAULT false,
    "mar" boolean DEFAULT false,
    "lipe1t" boolean DEFAULT false,
    "lipe1t_invio" "date",
    "apr" boolean DEFAULT false,
    "mag" boolean DEFAULT false,
    "giu" boolean DEFAULT false,
    "lipe2t" boolean DEFAULT false,
    "lipe2t_invio" "date",
    "lug" boolean DEFAULT false,
    "ago" boolean DEFAULT false,
    "set" boolean DEFAULT false,
    "lipe3t" boolean DEFAULT false,
    "lipe3t_invio" "date",
    "ott" boolean DEFAULT false,
    "nov" boolean DEFAULT false,
    "acconto" "text",
    "acconto_com" boolean DEFAULT false,
    "dic" boolean DEFAULT false,
    "lipe4t" boolean DEFAULT false,
    "lipe4t_invio" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_scadenza_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "TipoLiq" "text",
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "conferma_1_trimestre" boolean DEFAULT false NOT NULL,
    "conferma_2_trimestre" boolean DEFAULT false NOT NULL,
    "conferma_3_trimestre" boolean DEFAULT false NOT NULL,
    "conferma_4_trimestre" boolean DEFAULT false NOT NULL,
    "conferma_acconto_iva" boolean DEFAULT false NOT NULL,
    CONSTRAINT "tbscadlipe_acconto_check" CHECK (("acconto" = ANY (ARRAY['Dovuto'::"text", 'Non dovuto'::"text"])))
);


ALTER TABLE "public"."tbscadlipe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbscadproforma" (
    "id" "uuid" NOT NULL,
    "nominativo" "text" NOT NULL,
    "utente_professionista_id" "uuid",
    "utente_operatore_id" "uuid",
    "gennaio" boolean DEFAULT false,
    "febbraio" boolean DEFAULT false,
    "marzo" boolean DEFAULT false,
    "aprile" boolean DEFAULT false,
    "maggio" boolean DEFAULT false,
    "giugno" boolean DEFAULT false,
    "luglio" boolean DEFAULT false,
    "agosto" boolean DEFAULT false,
    "settembre" boolean DEFAULT false,
    "ottobre" boolean DEFAULT false,
    "novembre" boolean DEFAULT false,
    "dicembre" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_scadenza_id" "uuid",
    "studio_id" "uuid" NOT NULL,
    "anno_riferimento" integer NOT NULL,
    "archiviato" boolean DEFAULT false NOT NULL,
    "data_archiviazione" timestamp with time zone,
    "archiviato_da" "uuid",
    "cliente_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tbscadproforma" OWNER TO "postgres";


COMMENT ON TABLE "public"."tbscadproforma" IS 'Scadenzario Proforma - Solo invii mensili (struttura semplificata)';



CREATE TABLE IF NOT EXISTS "public"."tbsoftware_licenze" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "ragione_sociale" "text" NOT NULL,
    "email" "text",
    "partita_iva" character varying(20),
    "codice_fiscale" character varying(20),
    "software_nome" "text" NOT NULL,
    "piano" "text",
    "numero_licenze" integer DEFAULT 1 NOT NULL,
    "data_attivazione" "date" NOT NULL,
    "data_scadenza" "date" NOT NULL,
    "importo_annuale" numeric(12,2) DEFAULT 0,
    "stato" "text" DEFAULT 'attivo'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prezzo_base" numeric(12,2) DEFAULT 0,
    "prezzo_aml" numeric(12,2) DEFAULT 0,
    "totale_vendita" numeric(12,2) DEFAULT 0,
    "canone_mensile" numeric(12,2) DEFAULT 0,
    "utenti_inclusi" integer DEFAULT 5,
    "costo_utente_extra" numeric(12,2) DEFAULT 10,
    "modalita_pagamento_iniziale" "text" DEFAULT 'unica_soluzione'::"text",
    "importo_contratto_iniziale" numeric(12,2) DEFAULT 0,
    "numero_rate_iniziali" integer DEFAULT 1,
    "importo_rata_iniziale" numeric(12,2) DEFAULT 0,
    "rinnovo_automatico" boolean DEFAULT true NOT NULL,
    "giorni_preavviso_disdetta" integer DEFAULT 30 NOT NULL,
    "stato_pagamento_iniziale" "text" DEFAULT 'da_pagare'::"text",
    "data_ultimo_pagamento" "date",
    "data_prossimo_pagamento" "date",
    "numero_licenza" "text",
    "indirizzo" "text",
    "citta" "text",
    "provincia" character varying(5),
    "cap" character varying(10),
    "codice_sdi" character varying(10),
    "contratto_firmato_path" "text",
    "accetta_condizioni" boolean DEFAULT false NOT NULL,
    "accetta_privacy" boolean DEFAULT false NOT NULL,
    "accetta_sottoscrizione" boolean DEFAULT false NOT NULL,
    "admin_email" character varying(255),
    CONSTRAINT "tbsoftware_licenze_modalita_pagamento_iniziale_check" CHECK (("modalita_pagamento_iniziale" = ANY (ARRAY['mensile'::"text", 'annuale_anticipato'::"text"]))),
    CONSTRAINT "tbsoftware_licenze_stato_check" CHECK (("stato" = ANY (ARRAY['attivo'::"text", 'in_scadenza'::"text", 'scaduto'::"text", 'sospeso'::"text"]))),
    CONSTRAINT "tbsoftware_licenze_stato_pagamento_iniziale_check" CHECK (("stato_pagamento_iniziale" = ANY (ARRAY['da_pagare'::"text", 'parziale'::"text", 'pagato'::"text", 'scaduto'::"text", 'sospeso'::"text"])))
);


ALTER TABLE "public"."tbsoftware_licenze" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbsoftware_pagamenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "licenza_id" "uuid" NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "tipo_pagamento" "text" DEFAULT 'iniziale'::"text" NOT NULL,
    "descrizione" "text",
    "numero_rata" integer,
    "totale_rate" integer,
    "data_scadenza" "date" NOT NULL,
    "importo" numeric(12,2) DEFAULT 0 NOT NULL,
    "stato_pagamento" "text" DEFAULT 'da_pagare'::"text" NOT NULL,
    "data_pagamento" "date",
    "metodo_pagamento" "text",
    "riferimento_pagamento" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbsoftware_pagamenti_stato_check" CHECK (("stato_pagamento" = ANY (ARRAY['da_pagare'::"text", 'pagato'::"text", 'scaduto'::"text", 'annullato'::"text", 'sospeso'::"text"]))),
    CONSTRAINT "tbsoftware_pagamenti_tipo_check" CHECK (("tipo_pagamento" = ANY (ARRAY['iniziale'::"text", 'canone'::"text", 'rinnovo'::"text"])))
);


ALTER TABLE "public"."tbsoftware_pagamenti" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbsoftware_rinnovi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "licenza_id" "uuid" NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "data_scadenza_precedente" "date",
    "data_rinnovo" "date",
    "importo" numeric(12,2) DEFAULT 0,
    "stato_rinnovo" "text" DEFAULT 'da_contattare'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbsoftware_rinnovi_stato_check" CHECK (("stato_rinnovo" = ANY (ARRAY['da_contattare'::"text", 'preventivo_inviato'::"text", 'pagato'::"text", 'rinnovato'::"text", 'non_rinnovato'::"text"])))
);


ALTER TABLE "public"."tbsoftware_rinnovi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbstudio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ragione_sociale" "text" NOT NULL,
    "denominazione_breve" "text" NOT NULL,
    "partita_iva" "text" NOT NULL,
    "codice_fiscale" "text" NOT NULL,
    "indirizzo" "text" NOT NULL,
    "cap" "text" NOT NULL,
    "citta" "text" NOT NULL,
    "provincia" "text" NOT NULL,
    "telefono" "text" NOT NULL,
    "email" "text" NOT NULL,
    "pec" "text" NOT NULL,
    "sito_web" "text",
    "logo_url" "text",
    "note" "text",
    "attivo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "encryption_salt" "text",
    "encryption_enabled" boolean DEFAULT false,
    "master_password_hash" "text",
    "protezione_attiva" boolean DEFAULT false,
    "microsoft_connection_id" "uuid",
    "email_tenant2" "text",
    "microsoft_connection_id_tenant2" "uuid",
    "ragione_sociale_tenant2" "text",
    "software_attivo" boolean DEFAULT false,
    "stato_abbonamento_corrente" "text",
    "data_scadenza_abbonamento_corrente" "date",
    "numero_licenze_corrente" integer DEFAULT 0,
    "software_nome_corrente" "text",
    "piano_corrente" "text",
    "importo_annuale_corrente" numeric(12,2) DEFAULT 0,
    "licenze_bypass" boolean DEFAULT false,
    "mail_alert_fiscale" "text",
    "mail_alert_consulenza" "text",
    "mail_alert_paghe" "text",
    "mail_alert_ferie_permessi" "text",
    CONSTRAINT "tbstudio_stato_abbonamento_corrente_check" CHECK ((("stato_abbonamento_corrente" IS NULL) OR ("stato_abbonamento_corrente" = ANY (ARRAY['attivo'::"text", 'in_scadenza'::"text", 'scaduto'::"text", 'sospeso'::"text"]))))
);


ALTER TABLE "public"."tbstudio" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbstudio"."encryption_salt" IS 'Salt per derivare chiave encryption password cassetti fiscali (master password)';



COMMENT ON COLUMN "public"."tbstudio"."encryption_enabled" IS 'Flag che indica se encryption cassetti fiscali è attiva';



COMMENT ON COLUMN "public"."tbstudio"."mail_alert_fiscale" IS 'Mittente email utilizzato per alert fiscali e tributari';



COMMENT ON COLUMN "public"."tbstudio"."mail_alert_consulenza" IS 'Mittente email utilizzato per AML, consulenza e comunicazioni cliente';



COMMENT ON COLUMN "public"."tbstudio"."mail_alert_paghe" IS 'Mittente email utilizzato per payroll, presenze e cedolini';



COMMENT ON COLUMN "public"."tbstudio"."mail_alert_ferie_permessi" IS 'Mittente email utilizzato per alert ferie e permessi';



CREATE TABLE IF NOT EXISTS "public"."tbtipi_scadenze" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nome" "text" NOT NULL,
    "descrizione" "text",
    "data_scadenza" "date" NOT NULL,
    "tipo_scadenza" "text" NOT NULL,
    "ricorrente" boolean DEFAULT false,
    "giorni_preavviso_1" integer DEFAULT 15,
    "giorni_preavviso_2" integer DEFAULT 7,
    "attivo" boolean DEFAULT true,
    "studio_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "settore_fiscale" boolean DEFAULT false,
    "settore_lavoro" boolean DEFAULT false,
    "settore_consulenza" boolean DEFAULT false,
    "is_generica" boolean DEFAULT false NOT NULL,
    "data_avviso_1" "date",
    "data_avviso_2" "date",
    "alert_1_inviato" boolean DEFAULT false NOT NULL,
    "alert_2_inviato" boolean DEFAULT false NOT NULL,
    "data_invio_alert_1" timestamp with time zone,
    "data_invio_alert_2" timestamp with time zone,
    "nome_tabella" "text",
    "campo_completamento" "text",
    "campo_nominativo" "text" DEFAULT 'nominativo'::"text",
    "ha_scadenzario" boolean DEFAULT false NOT NULL,
    "scadenzario" "text",
    CONSTRAINT "tbtipi_scadenze_tipo_scadenza_check" CHECK (("tipo_scadenza" = ANY (ARRAY['iva'::"text", 'fiscale'::"text", 'bilancio'::"text", '770'::"text", 'lipe'::"text", 'esterometro'::"text", 'ccgg'::"text", 'cu'::"text", 'proforma'::"text", 'antiriciclaggio'::"text", 'imu'::"text", 'lavoro'::"text"])))
);


ALTER TABLE "public"."tbtipi_scadenze" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbtipi_scadenze"."settore_fiscale" IS 'Checkbox: Scadenza applicabile al settore Fiscale';



COMMENT ON COLUMN "public"."tbtipi_scadenze"."settore_lavoro" IS 'Checkbox: Scadenza applicabile al settore Lavoro';



COMMENT ON COLUMN "public"."tbtipi_scadenze"."settore_consulenza" IS 'Checkbox: Scadenza applicabile al settore Consulenza';



CREATE TABLE IF NOT EXISTS "public"."tbtipi_scadenze_alert" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tipo_scadenza_id" "uuid" NOT NULL,
    "anno_invio" integer NOT NULL,
    "data_invio" timestamp with time zone DEFAULT "now"(),
    "utente_invio_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email_inviata" boolean DEFAULT false,
    "promemoria_inviato" boolean DEFAULT false,
    "tipo_alert" "text",
    "studio_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tbtipi_scadenze_alert" OWNER TO "postgres";


COMMENT ON TABLE "public"."tbtipi_scadenze_alert" IS 'Traccia gli invii delle email di alert per i tipi di scadenza';



COMMENT ON COLUMN "public"."tbtipi_scadenze_alert"."anno_invio" IS 'Anno in cui è stata inviata la alert (per reset annuale)';



COMMENT ON COLUMN "public"."tbtipi_scadenze_alert"."email_inviata" IS 'Indica se l''email di alert è stata inviata';



COMMENT ON COLUMN "public"."tbtipi_scadenze_alert"."promemoria_inviato" IS 'Indica se il promemoria è stato creato';



CREATE TABLE IF NOT EXISTS "public"."tbtipopromemoria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "descrizione" "text",
    "colore" "text" DEFAULT '#3B82F6'::"text",
    "attivo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "studio_id" "uuid"
);


ALTER TABLE "public"."tbtipopromemoria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbutenti" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "cognome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "tipo_utente" "text" NOT NULL,
    "ruolo_operatore_id" "uuid",
    "attivo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "settore" "text",
    "responsabile" boolean DEFAULT false,
    "studio_id" "uuid",
    "user_id" "uuid",
    "microsoft_connection_id" "uuid",
    "last_seen" timestamp with time zone,
    "tipo_rapporto" "text",
    "responsabile_paghe" boolean DEFAULT false NOT NULL,
    "responsabile_ferie_permessi" boolean DEFAULT false,
    "utente_comunicazioni" boolean DEFAULT false NOT NULL,
    CONSTRAINT "tbutenti_settore_check" CHECK (("settore" = ANY (ARRAY['Fiscale'::"text", 'Lavoro'::"text", 'Consulenza'::"text"]))),
    CONSTRAINT "tbutenti_tipo_rapporto_check" CHECK (("tipo_rapporto" = ANY (ARRAY['Dipendente'::"text", 'Collaboratore'::"text", 'Praticante'::"text", 'Socio'::"text"]))),
    CONSTRAINT "tbutenti_tipo_utente_check" CHECK (("tipo_utente" = ANY (ARRAY['Admin'::"text", 'User'::"text"])))
);


ALTER TABLE "public"."tbutenti" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tbutenti"."settore" IS 'Settore di appartenenza: Fiscale, Lavoro, o Fiscale & lavoro';



COMMENT ON COLUMN "public"."tbutenti"."responsabile" IS 'Flag responsabile: può vedere promemoria del proprio gruppo';



CREATE TABLE IF NOT EXISTS "public"."tbverifiche_titolare_effettivo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "data_riferimento" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_verifica" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stato" "text" DEFAULT 'bozza'::"text" NOT NULL,
    "esito_confronto" "text" DEFAULT 'non_verificato'::"text" NOT NULL,
    "variazione_rilevata" boolean DEFAULT false NOT NULL,
    "data_variazione" "date",
    "operatore_id" "uuid",
    "pratica_id" "uuid",
    "note" "text",
    "snapshot_soci" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "snapshot_aml" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbverifiche_titolare_effettivo_esito_confronto_check" CHECK (("esito_confronto" = ANY (ARRAY['non_verificato'::"text", 'ok'::"text", 'solo_soci'::"text", 'solo_aml'::"text", 'contrastante'::"text"]))),
    CONSTRAINT "tbverifiche_titolare_effettivo_stato_check" CHECK (("stato" = ANY (ARRAY['bozza'::"text", 'da_confermare'::"text", 'confermata'::"text", 'aml_aggiornato'::"text", 'pratica_aperta'::"text", 'chiusa'::"text"])))
);


ALTER TABLE "public"."tbverifiche_titolare_effettivo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tbverifiche_titolare_effettivo_righe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "verifica_id" "uuid" NOT NULL,
    "chiave_soggetto" "text" NOT NULL,
    "persona_id" "uuid",
    "persona_nome" "text" NOT NULL,
    "codice_fiscale" "text",
    "criterio_titolarita" "text",
    "tipo_titolarita" "text",
    "quota_diretta" numeric(10,4) DEFAULT 0 NOT NULL,
    "quota_indiretta" numeric(10,4) DEFAULT 0 NOT NULL,
    "quota_complessiva" numeric(10,4) DEFAULT 0 NOT NULL,
    "valido_dal" "date",
    "valido_al" "date",
    "presente_soci" boolean DEFAULT false NOT NULL,
    "presente_aml" boolean DEFAULT false NOT NULL,
    "esito_confronto" "text" DEFAULT 'non_verificato'::"text" NOT NULL,
    "percorsi" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tbverifiche_titolare_effettivo_righe_esito_confronto_check" CHECK (("esito_confronto" = ANY (ARRAY['non_verificato'::"text", 'ok'::"text", 'solo_soci'::"text", 'solo_aml'::"text", 'contrastante'::"text"]))),
    CONSTRAINT "tbverifiche_titolare_effettivo_righe_tipo_titolarita_check" CHECK ((("tipo_titolarita" IS NULL) OR ("tipo_titolarita" = ANY (ARRAY['diretta'::"text", 'indiretta'::"text", 'mista'::"text", 'residuale'::"text"]))))
);


ALTER TABLE "public"."tbverifiche_titolare_effettivo_righe" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cassetti_fiscali" WITH ("security_invoker"='true') AS
 SELECT "id",
    "nominativo",
    "username",
    "password1",
    "pw_attiva1",
    "password2",
    "pw_attiva2",
    "pin",
    "pw_iniziale",
    "note",
    "studio_id",
    "created_at",
    "updated_at",
    "utente_id",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tbclienti" "c"
          WHERE ("c"."cassetto_fiscale_id" = "cf"."id")) AS "clienti_collegati"
   FROM "public"."tbcassetti_fiscali" "cf";


ALTER VIEW "public"."v_cassetti_fiscali" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_clienti_con_cassetto" AS
 SELECT "c"."id",
    "c"."ragione_sociale" AS "nominativo",
    "cf"."username",
    "cf"."password1",
    "cf"."password2",
    "cf"."pin",
    "cf"."pw_attiva1",
    "cf"."pw_attiva2",
    "c"."codice_fiscale" AS "pw_iniziale",
    "cf"."id" AS "cassetto_fiscale_id"
   FROM ("public"."tbclienti" "c"
     JOIN "public"."tbcassetti_fiscali" "cf" ON (("cf"."id" = "c"."cassetto_fiscale_id")));


ALTER VIEW "public"."v_clienti_con_cassetto" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_controllo_gestione_corrente" WITH ("security_invoker"='true') AS
 SELECT DISTINCT ON ("cliente_id") "id",
    "studio_id",
    "cliente_id",
    "cadenza_controllo",
    "data_esecuzione",
    "data_storico" AS "prossima_scadenza",
    "note",
    "link",
    "archiviato",
    "data_archiviazione",
    "controllo_precedente_id",
    "created_at",
    "updated_at"
   FROM "public"."tbcontrollo_gestione" "cg"
  WHERE ("archiviato" = false)
  ORDER BY "cliente_id", "data_esecuzione" DESC, "created_at" DESC;


ALTER VIEW "public"."vw_controllo_gestione_corrente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_rappresentanti_aml" AS
 SELECT "d"."soggetto_cliente_id" AS "id",
    "d"."studio_id",
    "c"."ragione_sociale" AS "nome_cognome",
    "c"."codice_fiscale",
    "c"."email",
    "d"."tipo_documento" AS "tipo_doc",
    "d"."scadenza_documento" AS "scadenza_doc",
    "d"."allegato_documento" AS "allegato_doc",
    true AS "rappresentante_legale",
    "d"."documento_richiesto_il" AS "doc_richiesto_il",
    "d"."microsoft_connection_id",
    "d"."created_at",
    "d"."id" AS "documento_aml_id",
    "d"."soggetto_cliente_id"
   FROM ("public"."tbclienti_documenti_aml" "d"
     JOIN "public"."tbclienti" "c" ON ((("c"."id" = "d"."soggetto_cliente_id") AND ("c"."studio_id" = "d"."studio_id"))))
  WHERE ("d"."attivo" = true);


ALTER VIEW "public"."vw_rappresentanti_aml" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_revisione_controlli" AS
 SELECT "co"."id",
    "co"."incarico_id",
    "i"."studio_id",
    "i"."cliente_id",
    "c"."ragione_sociale",
    "i"."tipo_incarico",
    "co"."anno",
    "co"."trimestre",
    "co"."data_scadenza",
    "co"."data_controllo",
    "co"."stato",
    "co"."esito",
    "co"."note",
    "co"."alert_15gg_inviato",
    "co"."alert_7gg_inviato",
    "co"."alert_oggi_inviato",
    "co"."alert_scaduto_inviato",
    "co"."completato_da",
    "co"."completato_at",
    "co"."created_at",
    "co"."updated_at"
   FROM (("public"."tbrevisione_controlli" "co"
     JOIN "public"."tbrevisione_incarichi" "i" ON (("i"."id" = "co"."incarico_id")))
     JOIN "public"."tbclienti" "c" ON (("c"."id" = "i"."cliente_id")));


ALTER VIEW "public"."vw_revisione_controlli" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_revisione_incarichi" AS
 SELECT "i"."id",
    "i"."studio_id",
    "i"."cliente_id",
    "c"."ragione_sociale",
    "i"."tipo_incarico",
    "i"."data_nomina",
    "i"."data_inizio",
    "i"."data_fine",
    "i"."periodicita",
    "i"."responsabile_id",
    "u"."nome" AS "responsabile_nome",
    "u"."cognome" AS "responsabile_cognome",
    "i"."attivo",
    "i"."note",
    "i"."created_at",
    "i"."updated_at"
   FROM (("public"."tbrevisione_incarichi" "i"
     JOIN "public"."tbclienti" "c" ON (("c"."id" = "i"."cliente_id")))
     LEFT JOIN "public"."tbutenti" "u" ON (("u"."id" = "i"."responsabile_id")));


ALTER VIEW "public"."vw_revisione_incarichi" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_scadenzario_unificato" WITH ("security_invoker"='true') AS
 SELECT "i"."cliente_id",
    "i"."studio_id",
    "i"."nominativo",
    "i"."utente_operatore_id",
    'IVA'::"text" AS "area",
        CASE
            WHEN (COALESCE("i"."mod_inviato", false) = true) THEN 'INVIATO'::"text"
            WHEN (COALESCE("i"."mod_definitivo", false) = true) THEN 'DEFINITIVO'::"text"
            WHEN (COALESCE("i"."mod_predisposto", false) = true) THEN 'PREDISPOSTO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    "i"."data_invio" AS "data_riferimento",
    COALESCE("i"."conferma_riga", false) AS "confermata",
    COALESCE("i"."ricevuta", false) AS "ricevuta",
    "i"."note",
    "i"."tipo_scadenza_id",
    "i"."created_at",
    "i"."updated_at"
   FROM "public"."tbscadiva" "i"
UNION ALL
 SELECT "f"."cliente_id",
    "f"."studio_id",
    "f"."nominativo",
    "f"."utente_operatore_id",
    'FISCALI'::"text" AS "area",
        CASE
            WHEN ((COALESCE("f"."conferma_riga", false) = true) OR (COALESCE("f"."mod_r_inviato", false) = true) OR (COALESCE("f"."mod_i_inviato", false) = true)) THEN 'INVIATO'::"text"
            WHEN ((COALESCE("f"."mod_r_definitivo", false) = true) OR (COALESCE("f"."mod_i_definitivo", false) = true)) THEN 'DEFINITIVO'::"text"
            WHEN ((COALESCE("f"."mod_r_compilato", false) = true) OR (COALESCE("f"."mod_i_compilato", false) = true)) THEN 'PREDISPOSTO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    COALESCE("f"."data_r_invio", "f"."data_i_invio", "f"."data_com1", "f"."data_com2") AS "data_riferimento",
    COALESCE("f"."conferma_riga", false) AS "confermata",
    false AS "ricevuta",
    "f"."note",
    "f"."tipo_scadenza_id",
    "f"."created_at",
    "f"."updated_at"
   FROM "public"."tbscadfiscali" "f"
UNION ALL
 SELECT "b"."cliente_id",
    "b"."studio_id",
    "b"."nominativo",
    "b"."utente_operatore_id",
    'BILANCI'::"text" AS "area",
        CASE
            WHEN (COALESCE("b"."invio_bil", false) = true) THEN 'INVIATO'::"text"
            WHEN (COALESCE("b"."bil_approvato", false) = true) THEN 'APPROVATO'::"text"
            WHEN (COALESCE("b"."bilancio_def", false) = true) THEN 'DEFINITIVO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    COALESCE("b"."data_invio", "b"."data_scad_pres", "b"."data_approvazione") AS "data_riferimento",
    COALESCE("b"."conferma_riga", false) AS "confermata",
    COALESCE("b"."ricevuta", false) AS "ricevuta",
    "b"."note",
    "b"."tipo_scadenza_id",
    "b"."created_at",
    "b"."updated_at"
   FROM "public"."tbscadbilanci" "b"
UNION ALL
 SELECT "s"."cliente_id",
    "s"."studio_id",
    "s"."nominativo",
    "s"."utente_operatore_id",
    '770'::"text" AS "area",
        CASE
            WHEN (COALESCE("s"."mod_inviato", false) = true) THEN 'INVIATO'::"text"
            WHEN (COALESCE("s"."mod_definitivo", false) = true) THEN 'DEFINITIVO'::"text"
            WHEN (COALESCE("s"."mod_compilato", false) = true) THEN 'PREDISPOSTO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    "s"."data_invio" AS "data_riferimento",
    COALESCE("s"."conferma_riga", false) AS "confermata",
    COALESCE("s"."ricevuta", false) AS "ricevuta",
    "s"."note",
    "s"."tipo_scadenza_id",
    "s"."created_at",
    "s"."updated_at"
   FROM "public"."tbscad770" "s"
UNION ALL
 SELECT "c"."cliente_id",
    "c"."studio_id",
    "c"."nominativo",
    "c"."utente_operatore_id",
    'CCGG'::"text" AS "area",
        CASE
            WHEN (COALESCE("c"."f24_comunicato", false) = true) THEN 'COMUNICATO'::"text"
            WHEN (COALESCE("c"."f24_generato", false) = true) THEN 'GENERATO'::"text"
            WHEN (COALESCE("c"."importo_calcolato", false) = true) THEN 'CALCOLATO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    "c"."data_comunicato" AS "data_riferimento",
    COALESCE("c"."conferma_riga", false) AS "confermata",
    false AS "ricevuta",
    "c"."note",
    "c"."tipo_scadenza_id",
    "c"."created_at",
    "c"."updated_at"
   FROM "public"."tbscadccgg" "c"
UNION ALL
 SELECT "cu"."cliente_id",
    "cu"."studio_id",
    "cu"."nominativo",
    "cu"."utente_operatore_id",
    'CU'::"text" AS "area",
        CASE
            WHEN (COALESCE("cu"."inviate", false) = true) THEN 'INVIATO'::"text"
            WHEN (COALESCE("cu"."generate", false) = true) THEN 'GENERATO'::"text"
            WHEN (COALESCE("cu"."inserite", false) = true) THEN 'INSERITO'::"text"
            WHEN (COALESCE("cu"."cu_autonomi", false) = true) THEN 'AUTONOMI'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    "cu"."data_invio" AS "data_riferimento",
    COALESCE("cu"."conferma_riga", false) AS "confermata",
    false AS "ricevuta",
    "cu"."note",
    "cu"."tipo_scadenza_id",
    "cu"."created_at",
    "cu"."updated_at"
   FROM "public"."tbscadcu" "cu"
UNION ALL
 SELECT "imu"."cliente_id",
    "imu"."studio_id",
    "imu"."nominativo",
    "imu"."utente_operatore_id",
    'IMU'::"text" AS "area",
        CASE
            WHEN (COALESCE("imu"."conferma_riga", false) = true) THEN 'DEFINITIVO'::"text"
            WHEN ((COALESCE("imu"."acconto_comunicato", false) = true) OR (COALESCE("imu"."saldo_comunicato", false) = true)) THEN 'COMUNICATO'::"text"
            WHEN ((COALESCE("imu"."acconto_imu", false) = true) OR (COALESCE("imu"."saldo_imu", false) = true)) THEN 'INVIATO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    COALESCE("imu"."data_com_acconto", "imu"."data_com_saldo", "imu"."data_scad_dichiarazione") AS "data_riferimento",
    COALESCE("imu"."conferma_riga", false) AS "confermata",
    false AS "ricevuta",
    "imu"."note",
    NULL::"uuid" AS "tipo_scadenza_id",
    "imu"."created_at",
    "imu"."updated_at"
   FROM "public"."tbscadimu" "imu";


ALTER VIEW "public"."vw_scadenzario_unificato" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_scadenzario_riepilogativo_societa" WITH ("security_invoker"='true') AS
 SELECT "studio_id",
    ("min"(("cliente_id")::"text"))::"uuid" AS "cliente_id",
    "max"(TRIM(BOTH FROM "nominativo")) AS "nominativo",
    ("min"(("utente_operatore_id")::"text"))::"uuid" AS "utente_operatore_id",
    "max"(
        CASE
            WHEN ("area" = 'IVA'::"text") THEN "stato"
            ELSE NULL::"text"
        END) AS "stato_iva",
    "max"(
        CASE
            WHEN ("area" = 'IVA'::"text") THEN "data_riferimento"
            ELSE NULL::"date"
        END) AS "data_iva",
    "max"(
        CASE
            WHEN ("area" = 'FISCALI'::"text") THEN "stato"
            ELSE NULL::"text"
        END) AS "stato_fiscali",
    "max"(
        CASE
            WHEN ("area" = 'FISCALI'::"text") THEN "data_riferimento"
            ELSE NULL::"date"
        END) AS "data_fiscali",
    "max"(
        CASE
            WHEN ("area" = 'BILANCI'::"text") THEN "stato"
            ELSE NULL::"text"
        END) AS "stato_bilanci",
    "max"(
        CASE
            WHEN ("area" = 'BILANCI'::"text") THEN "data_riferimento"
            ELSE NULL::"date"
        END) AS "data_bilanci",
    "max"(
        CASE
            WHEN ("area" = '770'::"text") THEN "stato"
            ELSE NULL::"text"
        END) AS "stato_770",
    "max"(
        CASE
            WHEN ("area" = '770'::"text") THEN "data_riferimento"
            ELSE NULL::"date"
        END) AS "data_770",
    "max"(
        CASE
            WHEN ("area" = 'CCGG'::"text") THEN "stato"
            ELSE NULL::"text"
        END) AS "stato_ccgg",
    "max"(
        CASE
            WHEN ("area" = 'CCGG'::"text") THEN "data_riferimento"
            ELSE NULL::"date"
        END) AS "data_ccgg",
    "max"(
        CASE
            WHEN ("area" = 'CU'::"text") THEN "stato"
            ELSE NULL::"text"
        END) AS "stato_cu",
    "max"(
        CASE
            WHEN ("area" = 'CU'::"text") THEN "data_riferimento"
            ELSE NULL::"date"
        END) AS "data_cu",
    "max"(
        CASE
            WHEN ("area" = 'IMU'::"text") THEN "stato"
            ELSE NULL::"text"
        END) AS "stato_imu",
    "max"(
        CASE
            WHEN ("area" = 'IMU'::"text") THEN "data_riferimento"
            ELSE NULL::"date"
        END) AS "data_imu",
    "bool_or"(
        CASE
            WHEN ("area" = 'IVA'::"text") THEN "confermata"
            ELSE false
        END) AS "confermata_iva",
    "bool_or"(
        CASE
            WHEN ("area" = 'FISCALI'::"text") THEN "confermata"
            ELSE false
        END) AS "confermata_fiscali",
    "bool_or"(
        CASE
            WHEN ("area" = 'BILANCI'::"text") THEN "confermata"
            ELSE false
        END) AS "confermata_bilanci",
    "bool_or"(
        CASE
            WHEN ("area" = '770'::"text") THEN "confermata"
            ELSE false
        END) AS "confermata_770",
    "bool_or"(
        CASE
            WHEN ("area" = 'CCGG'::"text") THEN "confermata"
            ELSE false
        END) AS "confermata_ccgg",
    "bool_or"(
        CASE
            WHEN ("area" = 'CU'::"text") THEN "confermata"
            ELSE false
        END) AS "confermata_cu",
    "bool_or"(
        CASE
            WHEN ("area" = 'IMU'::"text") THEN "confermata"
            ELSE false
        END) AS "confermata_imu"
   FROM "public"."vw_scadenzario_unificato" "x"
  GROUP BY "studio_id", ("upper"(TRIM(BOTH FROM "nominativo")));


ALTER VIEW "public"."vw_scadenzario_riepilogativo_societa" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_scadenzario_dashboard_societa" WITH ("security_invoker"='true') AS
 SELECT "studio_id",
    "cliente_id",
    "nominativo",
    "utente_operatore_id",
    "stato_iva",
    "data_iva",
    "stato_fiscali",
    "data_fiscali",
    "stato_bilanci",
    "data_bilanci",
    "stato_770",
    "data_770",
    "stato_ccgg",
    "data_ccgg",
    "stato_cu",
    "data_cu",
    "stato_imu",
    "data_imu",
        CASE
            WHEN ((COALESCE("stato_iva", 'DA FARE'::"text") = 'INVIATO'::"text") AND (COALESCE("stato_fiscali", 'DA FARE'::"text") = 'INVIATO'::"text") AND (COALESCE("stato_bilanci", 'DA FARE'::"text") = ANY (ARRAY['INVIATO'::"text", 'APPROVATO'::"text"])) AND (COALESCE("stato_770", 'DA FARE'::"text") = 'INVIATO'::"text") AND (COALESCE("stato_ccgg", 'DA FARE'::"text") = 'COMUNICATO'::"text") AND (COALESCE("stato_cu", 'DA FARE'::"text") = 'INVIATO'::"text") AND (COALESCE("stato_imu", 'DA FARE'::"text") = ANY (ARRAY['DICHIARAZIONE PRESENTATA'::"text", 'SALDO COMUNICATO'::"text", 'ACCONTO COMUNICATO'::"text"]))) THEN 'COMPLETO'::"text"
            WHEN ((COALESCE("stato_iva", 'DA FARE'::"text") <> 'DA FARE'::"text") OR (COALESCE("stato_fiscali", 'DA FARE'::"text") <> 'DA FARE'::"text") OR (COALESCE("stato_bilanci", 'DA FARE'::"text") <> 'DA FARE'::"text") OR (COALESCE("stato_770", 'DA FARE'::"text") <> 'DA FARE'::"text") OR (COALESCE("stato_ccgg", 'DA FARE'::"text") <> 'DA FARE'::"text") OR (COALESCE("stato_cu", 'DA FARE'::"text") <> 'DA FARE'::"text") OR (COALESCE("stato_imu", 'DA FARE'::"text") <> 'DA FARE'::"text")) THEN 'IN CORSO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato_generale"
   FROM "public"."vw_scadenzario_riepilogativo_societa" "r";


ALTER VIEW "public"."vw_scadenzario_dashboard_societa" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_scadenzario_riepilogo" WITH ("security_invoker"='true') AS
 SELECT "tbscadiva"."id" AS "cliente_id",
    "tbscadiva"."nominativo",
    'IVA'::"text" AS "tipo",
        CASE
            WHEN ("tbscadiva"."mod_inviato" = true) THEN 'INVIATO'::"text"
            WHEN ("tbscadiva"."mod_definitivo" = true) THEN 'DEFINITIVO'::"text"
            WHEN ("tbscadiva"."mod_predisposto" = true) THEN 'PREDISPOSTO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    "tbscadiva"."data_invio" AS "data",
    "tbscadiva"."studio_id"
   FROM "public"."tbscadiva"
UNION ALL
 SELECT "tbscadfiscali"."id" AS "cliente_id",
    "tbscadfiscali"."nominativo",
    'FISCALE'::"text" AS "tipo",
        CASE
            WHEN ("tbscadfiscali"."conferma_riga" = true) THEN 'INVIATO'::"text"
            WHEN (("tbscadfiscali"."mod_r_definitivo" = true) OR ("tbscadfiscali"."mod_i_definitivo" = true)) THEN 'DEFINITIVO'::"text"
            WHEN (("tbscadfiscali"."mod_r_compilato" = true) OR ("tbscadfiscali"."mod_i_compilato" = true)) THEN 'PREDISPOSTO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    COALESCE("tbscadfiscali"."data_r_invio", "tbscadfiscali"."data_i_invio") AS "data",
    "tbscadfiscali"."studio_id"
   FROM "public"."tbscadfiscali"
UNION ALL
 SELECT "tbscadbilanci"."id" AS "cliente_id",
    "tbscadbilanci"."nominativo",
    'BILANCIO'::"text" AS "tipo",
        CASE
            WHEN ("tbscadbilanci"."invio_bil" = true) THEN 'INVIATO'::"text"
            WHEN ("tbscadbilanci"."bil_approvato" = true) THEN 'APPROVATO'::"text"
            WHEN ("tbscadbilanci"."bilancio_def" = true) THEN 'DEFINITIVO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    "tbscadbilanci"."data_invio" AS "data",
    "tbscadbilanci"."studio_id"
   FROM "public"."tbscadbilanci"
UNION ALL
 SELECT "tbscad770"."id" AS "cliente_id",
    "tbscad770"."nominativo",
    '770'::"text" AS "tipo",
        CASE
            WHEN ("tbscad770"."mod_inviato" = true) THEN 'INVIATO'::"text"
            WHEN ("tbscad770"."mod_definitivo" = true) THEN 'DEFINITIVO'::"text"
            WHEN ("tbscad770"."mod_compilato" = true) THEN 'PREDISPOSTO'::"text"
            ELSE 'DA FARE'::"text"
        END AS "stato",
    "tbscad770"."data_invio" AS "data",
    "tbscad770"."studio_id"
   FROM "public"."tbscad770";


ALTER VIEW "public"."vw_scadenzario_riepilogo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_scadenze_centrale_riepilogo" WITH ("security_invoker"='true') AS
 SELECT "s"."id",
    "s"."studio_id",
    "s"."cliente_id",
    "s"."operatore_responsabile_id",
    "s"."origine_modulo",
    "s"."origine_tabella",
    "s"."origine_record_id",
    "s"."tipo_scadenza",
    "s"."titolo",
    "s"."descrizione",
    "s"."data_scadenza",
    "s"."stato" AS "stato_archiviato",
        CASE
            WHEN ("s"."stato" = 'completata'::"text") THEN 'completata'::"text"
            WHEN ("s"."stato" = 'annullata'::"text") THEN 'annullata'::"text"
            WHEN ("s"."stato" = 'sospesa'::"text") THEN 'sospesa'::"text"
            WHEN ("s"."data_scadenza" < CURRENT_DATE) THEN 'scaduta'::"text"
            WHEN ("s"."data_scadenza" = CURRENT_DATE) THEN 'scade_oggi'::"text"
            WHEN ("s"."data_scadenza" <= (CURRENT_DATE + 7)) THEN 'in_scadenza_7_giorni'::"text"
            WHEN ("s"."data_scadenza" <= (CURRENT_DATE + 30)) THEN 'in_scadenza_30_giorni'::"text"
            ELSE 'futura'::"text"
        END AS "stato_calcolato",
    ("s"."data_scadenza" - CURRENT_DATE) AS "giorni_residui",
        CASE
            WHEN ("s"."data_scadenza" < CURRENT_DATE) THEN "abs"(("s"."data_scadenza" - CURRENT_DATE))
            ELSE 0
        END AS "giorni_scaduta_da",
    "s"."priorita",
    "s"."giorni_preavviso_1",
    "s"."giorni_preavviso_2",
    "s"."giorni_preavviso_3",
    "s"."numero_alert_inviati",
    "s"."ultimo_alert_inviato_at",
    "s"."prossimo_alert_at",
    "s"."link_dettaglio",
    "s"."metadati",
    "s"."completata_at",
    "s"."annullata_at",
    "s"."created_at",
    "s"."updated_at",
    "c"."ragione_sociale" AS "cliente",
    "c"."codice_fiscale" AS "cliente_codice_fiscale",
    TRIM(BOTH FROM "concat_ws"(' '::"text", "u"."nome", "u"."cognome")) AS "operatore_responsabile",
    "u"."email" AS "operatore_email",
    "u"."settore" AS "operatore_settore",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tbscadenze_centrale_alert_log" "l"
          WHERE (("l"."scadenza_id" = "s"."id") AND ("l"."esito" = 'inviato'::"text"))) AS "alert_inviati_effettivi",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tbscadenze_centrale_alert_log" "l"
          WHERE (("l"."scadenza_id" = "s"."id") AND ("l"."esito" = 'errore'::"text"))) AS "alert_con_errore",
    ( SELECT "max"("l"."inviato_at") AS "max"
           FROM "public"."tbscadenze_centrale_alert_log" "l"
          WHERE (("l"."scadenza_id" = "s"."id") AND ("l"."esito" = 'inviato'::"text"))) AS "data_ultimo_alert_effettivo"
   FROM (("public"."tbscadenze_centrale" "s"
     LEFT JOIN "public"."tbclienti" "c" ON ((("c"."id" = "s"."cliente_id") AND ("c"."studio_id" = "s"."studio_id"))))
     LEFT JOIN "public"."tbutenti" "u" ON ((("u"."id" = "s"."operatore_responsabile_id") AND ("u"."studio_id" = "s"."studio_id"))));


ALTER VIEW "public"."vw_scadenze_centrale_riepilogo" OWNER TO "postgres";


ALTER TABLE ONLY "public"."tbPraticheAML" ALTER COLUMN "numero_pratica" SET DEFAULT "nextval"('"public"."tbPraticheAML_numero_pratica_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_assegnazioni" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_assegnazioni_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_checklist" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_checklist_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_checklist_template" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_checklist_template_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_modelli_documenti" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_modelli_documenti_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_note" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_note_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_priorita" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_priorita_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_scadenze" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_scadenze_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_stati" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_stati_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_step" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_step_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_step_template" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_step_template_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tbpratiche_tipi" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tbpratiche_tipi_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."event_confirmations"
    ADD CONSTRAINT "event_confirmations_evento_id_user_email_key" UNIQUE ("evento_id", "user_email");



ALTER TABLE ONLY "public"."event_confirmations"
    ADD CONSTRAINT "event_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_confirmations"
    ADD CONSTRAINT "event_confirmations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."event_reminders"
    ADD CONSTRAINT "event_reminders_evento_id_sent_to_key" UNIQUE ("evento_id", "sent_to");



ALTER TABLE ONLY "public"."event_reminders"
    ADD CONSTRAINT "event_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microsoft365_calendar_subscriptions"
    ADD CONSTRAINT "microsoft365_calendar_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microsoft365_config"
    ADD CONSTRAINT "microsoft365_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."microsoft365_connections"
    ADD CONSTRAINT "microsoft365_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbAMLComunicazioni"
    ADD CONSTRAINT "tbAMLComunicazioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbAV1"
    ADD CONSTRAINT "tbAV1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbAV2"
    ADD CONSTRAINT "tbAV2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbAV4"
    ADD CONSTRAINT "tbAV4_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbAV4_titolari"
    ADD CONSTRAINT "tbAV4_titolari_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbAVFascicoliAlert"
    ADD CONSTRAINT "tbAVFascicoliAlert_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbAVFascicoliDocumenti"
    ADD CONSTRAINT "tbAVFascicoliDocumenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbElencoPrestAR"
    ADD CONSTRAINT "tbElencoPrestAR_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbRespAVSocieta"
    ADD CONSTRAINT "tbRespAVSocieta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbRespAV"
    ADD CONSTRAINT "tbRespAV_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tb_comuni_catastali"
    ADD CONSTRAINT "tb_comuni_catastali_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbagenda"
    ADD CONSTRAINT "tbagenda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbalert_log"
    ADD CONSTRAINT "tbalert_log_marker_univoco_key" UNIQUE ("marker_univoco");



ALTER TABLE ONLY "public"."tbalert_log"
    ADD CONSTRAINT "tbalert_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbassunzioni_allegati"
    ADD CONSTRAINT "tbassunzioni_allegati_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbassunzioni_richieste"
    ADD CONSTRAINT "tbassunzioni_richieste_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcassetti_fiscali"
    ADD CONSTRAINT "tbcassetti_fiscali_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbclienti_accessi_pubblici"
    ADD CONSTRAINT "tbclienti_accessi_pubblici_cliente_unique" UNIQUE ("cliente_id");



ALTER TABLE ONLY "public"."tbclienti_accessi_pubblici"
    ADD CONSTRAINT "tbclienti_accessi_pubblici_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_cod_cliente_key" UNIQUE ("cod_cliente");



ALTER TABLE ONLY "public"."tbclienti_documenti_aml"
    ADD CONSTRAINT "tbclienti_documenti_aml_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbclienti_organi_diritti"
    ADD CONSTRAINT "tbclienti_organi_diritti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbclienti_organi"
    ADD CONSTRAINT "tbclienti_organi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbclienti_servizi"
    ADD CONSTRAINT "tbclienti_servizi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcomunicazioni"
    ADD CONSTRAINT "tbcomunicazioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontatti_clienti"
    ADD CONSTRAINT "tbcontatti_clienti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontatti_clienti"
    ADD CONSTRAINT "tbcontatti_clienti_unique" UNIQUE ("contatto_id", "cliente_id", "ruolo");



ALTER TABLE ONLY "public"."tbcontatti"
    ADD CONSTRAINT "tbcontatti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontatti_relazioni"
    ADD CONSTRAINT "tbcontatti_relazioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontatti_relazioni"
    ADD CONSTRAINT "tbcontatti_relazioni_unique" UNIQUE ("contatto_id", "contatto_collegato_id", "tipo_relazione");



ALTER TABLE ONLY "public"."tbcontenzioso_adesione"
    ADD CONSTRAINT "tbcontenzioso_adesione_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_avvisi_bonari"
    ADD CONSTRAINT "tbcontenzioso_avvisi_bonari_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_cartelle"
    ADD CONSTRAINT "tbcontenzioso_cartelle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_cassazione"
    ADD CONSTRAINT "tbcontenzioso_cassazione_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_codici_tributo"
    ADD CONSTRAINT "tbcontenzioso_codici_tributo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_codici_tributo"
    ADD CONSTRAINT "tbcontenzioso_codici_tributo_tributo_unique" UNIQUE ("tributo");



ALTER TABLE ONLY "public"."tbcontenzioso_esattoriale_tributi"
    ADD CONSTRAINT "tbcontenzioso_esattoriale_tributi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_interpello"
    ADD CONSTRAINT "tbcontenzioso_interpello_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_memorie"
    ADD CONSTRAINT "tbcontenzioso_memorie_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_pvc"
    ADD CONSTRAINT "tbcontenzioso_pvc_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_regole_scadenze"
    ADD CONSTRAINT "tbcontenzioso_regole_scadenze_codice_key" UNIQUE ("codice");



ALTER TABLE ONLY "public"."tbcontenzioso_regole_scadenze"
    ADD CONSTRAINT "tbcontenzioso_regole_scadenze_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_ricorso_primo_grado"
    ADD CONSTRAINT "tbcontenzioso_ricorso_primo_grado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_ricorso_secondo_grado"
    ADD CONSTRAINT "tbcontenzioso_ricorso_secondo_grado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_scadenze_generate"
    ADD CONSTRAINT "tbcontenzioso_scadenze_generate_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_processo"
    ADD CONSTRAINT "tbcontenzioso_scadenze_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_schema_atto"
    ADD CONSTRAINT "tbcontenzioso_schema_atto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_sospensioni"
    ADD CONSTRAINT "tbcontenzioso_sospensioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_tipi_atto"
    ADD CONSTRAINT "tbcontenzioso_tipi_atto_descrizione_unique" UNIQUE ("descrizione");



ALTER TABLE ONLY "public"."tbcontenzioso_tipi_atto"
    ADD CONSTRAINT "tbcontenzioso_tipi_atto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontenzioso_tributi_constatazione"
    ADD CONSTRAINT "tbcontenzioso_tributi_constatazione_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontrollo_gestione_allegati"
    ADD CONSTRAINT "tbcontrollo_gestione_allegati_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontrollo_gestione_indici"
    ADD CONSTRAINT "tbcontrollo_gestione_indici_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontrollo_gestione"
    ADD CONSTRAINT "tbcontrollo_gestione_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcontrollo_gestione_utenti"
    ADD CONSTRAINT "tbcontrollo_gestione_utenti_controllo_id_utente_id_key" UNIQUE ("controllo_id", "utente_id");



ALTER TABLE ONLY "public"."tbcontrollo_gestione_utenti"
    ADD CONSTRAINT "tbcontrollo_gestione_utenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbconversazioni"
    ADD CONSTRAINT "tbconversazioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbconversazioni_utenti"
    ADD CONSTRAINT "tbconversazioni_utenti_pkey" PRIMARY KEY ("conversazione_id", "utente_id");



ALTER TABLE ONLY "public"."tbcredenziali_accesso"
    ADD CONSTRAINT "tbcredenziali_accesso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbcron_log"
    ADD CONSTRAINT "tbcron_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbdipendenti"
    ADD CONSTRAINT "tbdipendenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbdipendenti"
    ADD CONSTRAINT "tbdipendenti_utente_id_key" UNIQUE ("utente_id");



ALTER TABLE ONLY "public"."tbemail_template"
    ADD CONSTRAINT "tbemail_template_codice_key" UNIQUE ("codice");



ALTER TABLE ONLY "public"."tbemail_template"
    ADD CONSTRAINT "tbemail_template_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbferie_permessi_richieste"
    ADD CONSTRAINT "tbferie_permessi_richieste_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbfestivita"
    ADD CONSTRAINT "tbfestivita_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbmessaggi_allegati"
    ADD CONSTRAINT "tbmessaggi_allegati_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbmessaggi"
    ADD CONSTRAINT "tbmessaggi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbmicrosoft365_user_tokens"
    ADD CONSTRAINT "tbmicrosoft365_user_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbmicrosoft365_user_tokens"
    ADD CONSTRAINT "tbmicrosoft365_user_tokens_studio_id_user_id_microsoft_connecti" UNIQUE ("studio_id", "user_id", "microsoft_connection_id");



ALTER TABLE ONLY "public"."tbmicrosoft_calendar_mappings"
    ADD CONSTRAINT "tbmicrosoft_calendar_mappings_evento_id_key" UNIQUE ("evento_id");



ALTER TABLE ONLY "public"."tbmicrosoft_calendar_mappings"
    ADD CONSTRAINT "tbmicrosoft_calendar_mappings_outlook_event_id_key" UNIQUE ("outlook_event_id");



ALTER TABLE ONLY "public"."tbmicrosoft_calendar_mappings"
    ADD CONSTRAINT "tbmicrosoft_calendar_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbmicrosoft_settings"
    ADD CONSTRAINT "tbmicrosoft_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbmicrosoft_settings"
    ADD CONSTRAINT "tbmicrosoft_settings_user_id_microsoft_connection_id_key" UNIQUE ("user_id", "microsoft_connection_id");



ALTER TABLE ONLY "public"."tbmicrosoft_tokens"
    ADD CONSTRAINT "tbmicrosoft_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbmicrosoft_tokens"
    ADD CONSTRAINT "tbmicrosoft_tokens_user_id_microsoft_connection_id_key" UNIQUE ("user_id", "microsoft_connection_id");



ALTER TABLE ONLY "public"."tbpayroll_qualifiche"
    ADD CONSTRAINT "tbpayroll_qualifiche_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpayroll_qualifiche"
    ADD CONSTRAINT "tbpayroll_qualifiche_studio_id_codice_key" UNIQUE ("studio_id", "codice");



ALTER TABLE ONLY "public"."tbpratiche_assegnazioni"
    ADD CONSTRAINT "tbpratiche_assegnazioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_checklist"
    ADD CONSTRAINT "tbpratiche_checklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_checklist_template"
    ADD CONSTRAINT "tbpratiche_checklist_template_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_dati_documenti"
    ADD CONSTRAINT "tbpratiche_dati_documenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_dicitura_documenti"
    ADD CONSTRAINT "tbpratiche_dicitura_documenti_codice_key" UNIQUE ("codice");



ALTER TABLE ONLY "public"."tbpratiche_dicitura_documenti"
    ADD CONSTRAINT "tbpratiche_dicitura_documenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_distribuzione_utili"
    ADD CONSTRAINT "tbpratiche_distribuzione_utili_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_documenti"
    ADD CONSTRAINT "tbpratiche_documenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_log"
    ADD CONSTRAINT "tbpratiche_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_modelli"
    ADD CONSTRAINT "tbpratiche_modelli_codice_key" UNIQUE ("codice");



ALTER TABLE ONLY "public"."tbpratiche_modelli_documenti"
    ADD CONSTRAINT "tbpratiche_modelli_documenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_modelli"
    ADD CONSTRAINT "tbpratiche_modelli_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_modelli_utilita"
    ADD CONSTRAINT "tbpratiche_modelli_utilita_codice_key" UNIQUE ("codice");



ALTER TABLE ONLY "public"."tbpratiche_modelli_utilita"
    ADD CONSTRAINT "tbpratiche_modelli_utilita_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_motivi_liquidazione"
    ADD CONSTRAINT "tbpratiche_motivi_liquidazione_codice_key" UNIQUE ("codice");



ALTER TABLE ONLY "public"."tbpratiche_motivi_liquidazione"
    ADD CONSTRAINT "tbpratiche_motivi_liquidazione_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_note"
    ADD CONSTRAINT "tbpratiche_note_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche"
    ADD CONSTRAINT "tbpratiche_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_priorita"
    ADD CONSTRAINT "tbpratiche_priorita_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_scadenze"
    ADD CONSTRAINT "tbpratiche_scadenze_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_soggetti"
    ADD CONSTRAINT "tbpratiche_soggetti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_stati"
    ADD CONSTRAINT "tbpratiche_stati_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_step"
    ADD CONSTRAINT "tbpratiche_step_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_step_template"
    ADD CONSTRAINT "tbpratiche_step_template_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_tipi"
    ADD CONSTRAINT "tbpratiche_tipi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_variazioni"
    ADD CONSTRAINT "tbpratiche_variazioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_variazioni_tipi"
    ADD CONSTRAINT "tbpratiche_variazioni_tipi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "tbpraticheaml_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpresenze_codici"
    ADD CONSTRAINT "tbpresenze_codici_pkey" PRIMARY KEY ("codice");



ALTER TABLE ONLY "public"."tbpresenze_dipendenti"
    ADD CONSTRAINT "tbpresenze_dipendenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpresenze_dipendenti"
    ADD CONSTRAINT "tbpresenze_dipendenti_unique" UNIQUE ("utente_id", "data_presenza");



ALTER TABLE ONLY "public"."tbpresenze_smart_calendario"
    ADD CONSTRAINT "tbpresenze_smart_calendario_gruppo_id_utente_id_data_key" UNIQUE ("gruppo_id", "utente_id", "data");



ALTER TABLE ONLY "public"."tbpresenze_smart_calendario"
    ADD CONSTRAINT "tbpresenze_smart_calendario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpresenze_smart_cambi_turno"
    ADD CONSTRAINT "tbpresenze_smart_cambi_turno_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpresenze_smart_gruppi"
    ADD CONSTRAINT "tbpresenze_smart_gruppi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpresenze_smart_gruppi_utenti"
    ADD CONSTRAINT "tbpresenze_smart_gruppi_utenti_gruppo_id_utente_id_key" UNIQUE ("gruppo_id", "utente_id");



ALTER TABLE ONLY "public"."tbpresenze_smart_gruppi_utenti"
    ADD CONSTRAINT "tbpresenze_smart_gruppi_utenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpresenze_solleciti_log"
    ADD CONSTRAINT "tbpresenze_solleciti_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbprestazioni"
    ADD CONSTRAINT "tbprestazioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpromemoria"
    ADD CONSTRAINT "tbpromemoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbreferimenti_valori"
    ADD CONSTRAINT "tbreferimenti_valori_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbreferimenti_valori"
    ADD CONSTRAINT "tbreferimenti_valori_tipo_valore_key" UNIQUE ("tipo", "valore");



ALTER TABLE ONLY "public"."tbrevisione_checklist"
    ADD CONSTRAINT "tbrevisione_checklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbrevisione_controlli"
    ADD CONSTRAINT "tbrevisione_controlli_incarico_id_anno_trimestre_key" UNIQUE ("incarico_id", "anno", "trimestre");



ALTER TABLE ONLY "public"."tbrevisione_controlli"
    ADD CONSTRAINT "tbrevisione_controlli_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbrevisione_documenti"
    ADD CONSTRAINT "tbrevisione_documenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbrevisione_followup"
    ADD CONSTRAINT "tbrevisione_followup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbrevisione_incarichi"
    ADD CONSTRAINT "tbrevisione_incarichi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbrevisione_modelli"
    ADD CONSTRAINT "tbrevisione_modelli_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbrevisione_modelli"
    ADD CONSTRAINT "tbrevisione_modelli_studio_id_codice_key" UNIQUE ("studio_id", "codice");



ALTER TABLE ONLY "public"."tbrevisione_relazioni"
    ADD CONSTRAINT "tbrevisione_relazioni_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbrevisione_soggetti"
    ADD CONSTRAINT "tbrevisione_soggetti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbroperatore"
    ADD CONSTRAINT "tbroperatore_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadaffitti"
    ADD CONSTRAINT "tbscadaffitti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadbilanci"
    ADD CONSTRAINT "tbscadbilanci_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadccgg"
    ADD CONSTRAINT "tbscadccgg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadcu"
    ADD CONSTRAINT "tbscadcu_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadenze_alert_log"
    ADD CONSTRAINT "tbscadenze_alert_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadenze_alert_log"
    ADD CONSTRAINT "tbscadenze_alert_log_unique" UNIQUE ("tipo_scadenza_id", "utente_id", "alert_numero", "anno_riferimento");



ALTER TABLE ONLY "public"."tbscadenze_centrale_alert_log"
    ADD CONSTRAINT "tbscadenze_centrale_alert_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadenze_centrale_destinatari"
    ADD CONSTRAINT "tbscadenze_centrale_destinatari_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadenze_centrale"
    ADD CONSTRAINT "tbscadenze_centrale_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadestero"
    ADD CONSTRAINT "tbscadestero_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadfiscali"
    ADD CONSTRAINT "tbscadfiscali_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadimu"
    ADD CONSTRAINT "tbscadimu_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadiva"
    ADD CONSTRAINT "tbscadiva_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadlipe"
    ADD CONSTRAINT "tbscadlipe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbscadproforma"
    ADD CONSTRAINT "tbscadproforma_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbsoftware_licenze"
    ADD CONSTRAINT "tbsoftware_licenze_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbsoftware_pagamenti"
    ADD CONSTRAINT "tbsoftware_pagamenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbsoftware_rinnovi"
    ADD CONSTRAINT "tbsoftware_rinnovi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbstudio"
    ADD CONSTRAINT "tbstudio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbtipi_scadenze_alert"
    ADD CONSTRAINT "tbtipi_scadenze_alert_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbtipi_scadenze"
    ADD CONSTRAINT "tbtipi_scadenze_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbtipopromemoria"
    ADD CONSTRAINT "tbtipopromemoria_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."tbtipopromemoria"
    ADD CONSTRAINT "tbtipopromemoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbutenti"
    ADD CONSTRAINT "tbutenti_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."tbutenti"
    ADD CONSTRAINT "tbutenti_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbverifiche_titolare_effettivo_righe"
    ADD CONSTRAINT "tbverifiche_te_righe_unica" UNIQUE ("verifica_id", "chiave_soggetto");



ALTER TABLE ONLY "public"."tbverifiche_titolare_effettivo"
    ADD CONSTRAINT "tbverifiche_titolare_effettivo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbverifiche_titolare_effettivo_righe"
    ADD CONSTRAINT "tbverifiche_titolare_effettivo_righe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tbpratiche_priorita"
    ADD CONSTRAINT "uniq_pratiche_priorita_codice" UNIQUE ("codice");



ALTER TABLE ONLY "public"."tbpratiche_stati"
    ADD CONSTRAINT "uniq_pratiche_stati_codice" UNIQUE ("codice");



ALTER TABLE ONLY "public"."tbpratiche_tipi"
    ADD CONSTRAINT "uniq_tipo_pratica_studio_codice" UNIQUE ("studio_id", "codice");



ALTER TABLE ONLY "public"."tbutenti"
    ADD CONSTRAINT "unique_email" UNIQUE ("email");



ALTER TABLE ONLY "public"."microsoft365_config"
    ADD CONSTRAINT "unique_studio_config" UNIQUE ("studio_id");



ALTER TABLE ONLY "public"."tbclienti_servizi"
    ADD CONSTRAINT "uq_tbclienti_servizi_studio_cliente" UNIQUE ("studio_id", "cliente_id");



CREATE INDEX "idx_alert_tipo_anno" ON "public"."tbtipi_scadenze_alert" USING "btree" ("tipo_scadenza_id", "anno_invio");



CREATE INDEX "idx_assegnazioni_attiva" ON "public"."tbpratiche_assegnazioni" USING "btree" ("attiva");



CREATE INDEX "idx_assegnazioni_cliente" ON "public"."tbpratiche_assegnazioni" USING "btree" ("cliente_id");



CREATE INDEX "idx_assegnazioni_pratica" ON "public"."tbpratiche_assegnazioni" USING "btree" ("pratica_id");



CREATE INDEX "idx_assegnazioni_studio" ON "public"."tbpratiche_assegnazioni" USING "btree" ("studio_id");



CREATE INDEX "idx_assegnazioni_utente" ON "public"."tbpratiche_assegnazioni" USING "btree" ("utente_id");



CREATE INDEX "idx_cassetti_fiscali_nominativo" ON "public"."tbcassetti_fiscali" USING "btree" ("nominativo");



CREATE INDEX "idx_cassetti_fiscali_studio" ON "public"."tbcassetti_fiscali" USING "btree" ("studio_id");



CREATE INDEX "idx_checklist_completato" ON "public"."tbpratiche_checklist" USING "btree" ("completato");



CREATE INDEX "idx_checklist_pratica" ON "public"."tbpratiche_checklist" USING "btree" ("pratica_id");



CREATE INDEX "idx_checklist_template" ON "public"."tbpratiche_checklist" USING "btree" ("checklist_template_id");



CREATE INDEX "idx_checklist_template_ordine" ON "public"."tbpratiche_checklist_template" USING "btree" ("ordine");



CREATE INDEX "idx_checklist_template_tipo" ON "public"."tbpratiche_checklist_template" USING "btree" ("tipo_pratica_id");



CREATE INDEX "idx_clienti_cassetto_fiscale" ON "public"."tbclienti" USING "btree" ("cassetto_fiscale_id");



CREATE INDEX "idx_conversazioni_studio" ON "public"."tbconversazioni" USING "btree" ("studio_id");



CREATE INDEX "idx_conversazioni_utenti_conversazione" ON "public"."tbconversazioni_utenti" USING "btree" ("conversazione_id");



CREATE INDEX "idx_conversazioni_utenti_utente" ON "public"."tbconversazioni_utenti" USING "btree" ("utente_id");



CREATE INDEX "idx_event_confirmations_evento" ON "public"."event_confirmations" USING "btree" ("evento_id");



CREATE INDEX "idx_event_confirmations_token" ON "public"."event_confirmations" USING "btree" ("token");



CREATE INDEX "idx_event_reminders_evento" ON "public"."event_reminders" USING "btree" ("evento_id");



CREATE INDEX "idx_evento_microsoft_id" ON "public"."tbagenda" USING "btree" ("microsoft_event_id");



CREATE INDEX "idx_log_cliente" ON "public"."tbpratiche_log" USING "btree" ("cliente_id");



CREATE INDEX "idx_log_created" ON "public"."tbpratiche_log" USING "btree" ("created_at");



CREATE INDEX "idx_log_evento" ON "public"."tbpratiche_log" USING "btree" ("tipo_evento");



CREATE INDEX "idx_log_pratica" ON "public"."tbpratiche_log" USING "btree" ("pratica_id");



CREATE INDEX "idx_log_step" ON "public"."tbpratiche_log" USING "btree" ("step_id");



CREATE INDEX "idx_log_studio" ON "public"."tbpratiche_log" USING "btree" ("studio_id");



CREATE INDEX "idx_messaggi_conversazione" ON "public"."tbmessaggi" USING "btree" ("conversazione_id");



CREATE INDEX "idx_messaggi_created" ON "public"."tbmessaggi" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messaggi_mittente" ON "public"."tbmessaggi" USING "btree" ("mittente_id");



CREATE INDEX "idx_microsoft365_config_studio" ON "public"."microsoft365_config" USING "btree" ("studio_id");



CREATE INDEX "idx_microsoft365_connections_studio" ON "public"."microsoft365_connections" USING "btree" ("studio_id");



CREATE INDEX "idx_microsoft_tokens_expires_at" ON "public"."tbmicrosoft_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_microsoft_tokens_user" ON "public"."tbmicrosoft_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_microsoft_tokens_user_id" ON "public"."tbmicrosoft_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_modelli_documenti_attivo" ON "public"."tbpratiche_modelli_documenti" USING "btree" ("attivo");



CREATE INDEX "idx_modelli_documenti_step_template" ON "public"."tbpratiche_modelli_documenti" USING "btree" ("step_template_id");



CREATE INDEX "idx_modelli_documenti_studio" ON "public"."tbpratiche_modelli_documenti" USING "btree" ("studio_id");



CREATE INDEX "idx_modelli_documenti_tipo" ON "public"."tbpratiche_modelli_documenti" USING "btree" ("tipo_pratica_id");



CREATE INDEX "idx_note_cliente" ON "public"."tbpratiche_note" USING "btree" ("cliente_id");



CREATE INDEX "idx_note_pratica" ON "public"."tbpratiche_note" USING "btree" ("pratica_id");



CREATE INDEX "idx_note_step" ON "public"."tbpratiche_note" USING "btree" ("step_id");



CREATE INDEX "idx_note_studio" ON "public"."tbpratiche_note" USING "btree" ("studio_id");



CREATE INDEX "idx_password_reset_expires" ON "public"."password_reset_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_password_reset_studio" ON "public"."password_reset_tokens" USING "btree" ("studio_id");



CREATE INDEX "idx_pratiche_priorita_attiva" ON "public"."tbpratiche_priorita" USING "btree" ("attiva");



CREATE INDEX "idx_pratiche_priorita_ordinamento" ON "public"."tbpratiche_priorita" USING "btree" ("ordinamento");



CREATE INDEX "idx_pratiche_stati_attivo" ON "public"."tbpratiche_stati" USING "btree" ("attivo");



CREATE INDEX "idx_pratiche_stati_ordinamento" ON "public"."tbpratiche_stati" USING "btree" ("ordinamento");



CREATE INDEX "idx_pratiche_tipi_ente" ON "public"."tbpratiche_tipi" USING "btree" ("ente");



CREATE INDEX "idx_pratiche_tipi_studio" ON "public"."tbpratiche_tipi" USING "btree" ("studio_id");



CREATE INDEX "idx_riferimenti_valori_tipo" ON "public"."tbreferimenti_valori" USING "btree" ("tipo");



CREATE INDEX "idx_riferimenti_valori_valore" ON "public"."tbreferimenti_valori" USING "btree" ("valore");



CREATE INDEX "idx_scadenze_cliente" ON "public"."tbpratiche_scadenze" USING "btree" ("cliente_id");



CREATE INDEX "idx_scadenze_data" ON "public"."tbpratiche_scadenze" USING "btree" ("data_scadenza");



CREATE INDEX "idx_scadenze_pratica" ON "public"."tbpratiche_scadenze" USING "btree" ("pratica_id");



CREATE INDEX "idx_scadenze_stato" ON "public"."tbpratiche_scadenze" USING "btree" ("stato");



CREATE INDEX "idx_scadenze_step" ON "public"."tbpratiche_scadenze" USING "btree" ("step_id");



CREATE INDEX "idx_scadenze_studio" ON "public"."tbpratiche_scadenze" USING "btree" ("studio_id");



CREATE INDEX "idx_scadproforma_utente_op" ON "public"."tbscadproforma" USING "btree" ("utente_operatore_id");



CREATE INDEX "idx_scadproforma_utente_prof" ON "public"."tbscadproforma" USING "btree" ("utente_professionista_id");



CREATE INDEX "idx_step_pratica" ON "public"."tbpratiche_step" USING "btree" ("pratica_id");



CREATE INDEX "idx_step_responsabile" ON "public"."tbpratiche_step" USING "btree" ("responsabile_id");



CREATE INDEX "idx_step_scadenza" ON "public"."tbpratiche_step" USING "btree" ("data_scadenza");



CREATE INDEX "idx_step_stato" ON "public"."tbpratiche_step" USING "btree" ("stato");



CREATE INDEX "idx_step_template" ON "public"."tbpratiche_step" USING "btree" ("template_step_id");



CREATE INDEX "idx_step_template_ordine" ON "public"."tbpratiche_step_template" USING "btree" ("ordine");



CREATE INDEX "idx_step_template_tipo" ON "public"."tbpratiche_step_template" USING "btree" ("tipo_pratica_id");



CREATE UNIQUE INDEX "idx_studio_attivo" ON "public"."tbstudio" USING "btree" ("attivo") WHERE ("attivo" = true);



CREATE INDEX "idx_tb_comuni_catastali_codice" ON "public"."tb_comuni_catastali" USING "btree" ("codice_catastale");



CREATE UNIQUE INDEX "idx_tb_comuni_catastali_codice_data" ON "public"."tb_comuni_catastali" USING "btree" ("codice_catastale", "data_inizio_validita");



CREATE INDEX "idx_tb_comuni_catastali_comune" ON "public"."tb_comuni_catastali" USING "btree" ("comune");



CREATE INDEX "idx_tbagenda_gruppo_evento" ON "public"."tbagenda" USING "btree" ("gruppo_evento");



CREATE INDEX "idx_tbagenda_microsoft_event_id" ON "public"."tbagenda" USING "btree" ("microsoft_event_id") WHERE ("microsoft_event_id" IS NOT NULL);



CREATE INDEX "idx_tbagenda_outlook_synced" ON "public"."tbagenda" USING "btree" ("outlook_synced");



CREATE INDEX "idx_tbalert_log_data_scadenza" ON "public"."tbalert_log" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbalert_log_destinatario" ON "public"."tbalert_log" USING "btree" ("destinatario_utente_id");



CREATE INDEX "idx_tbalert_log_marker" ON "public"."tbalert_log" USING "btree" ("marker_univoco");



CREATE INDEX "idx_tbalert_log_modulo" ON "public"."tbalert_log" USING "btree" ("modulo");



CREATE INDEX "idx_tbalert_log_riferimento" ON "public"."tbalert_log" USING "btree" ("riferimento_tabella", "riferimento_id");



CREATE INDEX "idx_tbamlcomunicazioni_av4_id" ON "public"."tbAMLComunicazioni" USING "btree" ("av4_id");



CREATE INDEX "idx_tbamlcomunicazioni_cliente_id" ON "public"."tbAMLComunicazioni" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbamlcomunicazioni_data_invio" ON "public"."tbAMLComunicazioni" USING "btree" ("data_invio" DESC);



CREATE INDEX "idx_tbamlcomunicazioni_pratica_id" ON "public"."tbAMLComunicazioni" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbamlcomunicazioni_rapp_legale_id" ON "public"."tbAMLComunicazioni" USING "btree" ("soggetto_cliente_id");



CREATE INDEX "idx_tbamlcomunicazioni_societa_id" ON "public"."tbAMLComunicazioni" USING "btree" ("societa_id");



CREATE INDEX "idx_tbamlcomunicazioni_studio_id" ON "public"."tbAMLComunicazioni" USING "btree" ("studio_id");



CREATE INDEX "idx_tbamlcomunicazioni_tipo" ON "public"."tbAMLComunicazioni" USING "btree" ("tipo_comunicazione");



CREATE INDEX "idx_tbassunzioni_allegati_cliente" ON "public"."tbassunzioni_allegati" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbassunzioni_allegati_richiesta" ON "public"."tbassunzioni_allegati" USING "btree" ("richiesta_id");



CREATE INDEX "idx_tbav1_pratica_id" ON "public"."tbAV1" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbav1_societa_id" ON "public"."tbAV1" USING "btree" ("societa_id");



CREATE INDEX "idx_tbav2_cliente_id" ON "public"."tbAV2" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbav2_created_at" ON "public"."tbAV2" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_tbav2_pratica_id" ON "public"."tbAV2" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbav2_societa_id" ON "public"."tbAV2" USING "btree" ("societa_id");



CREATE INDEX "idx_tbav2_studio_cliente" ON "public"."tbAV2" USING "btree" ("studio_id", "cliente_id");



CREATE INDEX "idx_tbav2_studio_id" ON "public"."tbAV2" USING "btree" ("studio_id");



CREATE INDEX "idx_tbav4_av1_id" ON "public"."tbAV4" USING "btree" ("av1_id");



CREATE INDEX "idx_tbav4_cliente_id" ON "public"."tbAV4" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbav4_pratica_id" ON "public"."tbAV4" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbav4_societa_id" ON "public"."tbAV4" USING "btree" ("societa_id");



CREATE INDEX "idx_tbav4_stato" ON "public"."tbAV4" USING "btree" ("stato");



CREATE INDEX "idx_tbav4_studio_id" ON "public"."tbAV4" USING "btree" ("studio_id");



CREATE INDEX "idx_tbav4_titolari_av4_id" ON "public"."tbAV4_titolari" USING "btree" ("av4_id");



CREATE INDEX "idx_tbav4_titolari_cliente_id" ON "public"."tbAV4_titolari" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbav4_titolari_pratica_id" ON "public"."tbAV4_titolari" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbav4_titolari_rapp_legale_id" ON "public"."tbAV4_titolari" USING "btree" ("soggetto_cliente_id");



CREATE INDEX "idx_tbav4_titolari_sezione" ON "public"."tbAV4_titolari" USING "btree" ("sezione");



CREATE INDEX "idx_tbav4_titolari_societa_id" ON "public"."tbAV4_titolari" USING "btree" ("societa_id");



CREATE INDEX "idx_tbav4_titolari_studio_id" ON "public"."tbAV4_titolari" USING "btree" ("studio_id");



CREATE UNIQUE INDEX "idx_tbavfascicolialert_av1_id" ON "public"."tbAVFascicoliAlert" USING "btree" ("av1_id") WHERE ("av1_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_tbavfascicolialert_pratica_id" ON "public"."tbAVFascicoliAlert" USING "btree" ("pratica_id") WHERE ("pratica_id" IS NOT NULL);



CREATE INDEX "idx_tbavfascicolidocumenti_av1_id" ON "public"."tbAVFascicoliDocumenti" USING "btree" ("av1_id");



CREATE INDEX "idx_tbavfascicolidocumenti_av2_id" ON "public"."tbAVFascicoliDocumenti" USING "btree" ("av2_id");



CREATE INDEX "idx_tbavfascicolidocumenti_cliente_id" ON "public"."tbAVFascicoliDocumenti" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbavfascicolidocumenti_societa_documento" ON "public"."tbAVFascicoliDocumenti" USING "btree" ("studio_id", "pratica_id", "societa_documento_id");



CREATE INDEX "idx_tbclienti_documenti_aml_scadenza" ON "public"."tbclienti_documenti_aml" USING "btree" ("scadenza_documento") WHERE ("attivo" = true);



CREATE INDEX "idx_tbclienti_documenti_aml_soggetto" ON "public"."tbclienti_documenti_aml" USING "btree" ("soggetto_cliente_id");



CREATE INDEX "idx_tbclienti_documenti_aml_studio" ON "public"."tbclienti_documenti_aml" USING "btree" ("studio_id");



CREATE INDEX "idx_tbclienti_organi_cliente" ON "public"."tbclienti_organi" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbclienti_organi_diritti_organo" ON "public"."tbclienti_organi_diritti" USING "btree" ("organo_id");



CREATE INDEX "idx_tbclienti_organi_diritti_soggetto" ON "public"."tbclienti_organi_diritti" USING "btree" ("soggetto_cliente_id");



CREATE INDEX "idx_tbclienti_organi_ruolo" ON "public"."tbclienti_organi" USING "btree" ("ruolo");



CREATE INDEX "idx_tbclienti_organi_studio_id" ON "public"."tbclienti_organi" USING "btree" ("studio_id");



CREATE INDEX "idx_tbcontenzioso_cartelle_avviso_bonario" ON "public"."tbcontenzioso_cartelle" USING "btree" ("avviso_bonario_id");



CREATE INDEX "idx_tbcontenzioso_cartelle_cliente" ON "public"."tbcontenzioso_cartelle" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbcontenzioso_cartelle_data_scadenza" ON "public"."tbcontenzioso_cartelle" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbcontenzioso_cartelle_studio" ON "public"."tbcontenzioso_cartelle" USING "btree" ("studio_id");



CREATE INDEX "idx_tbcontenzioso_cartelle_tipo_atto" ON "public"."tbcontenzioso_cartelle" USING "btree" ("tipo_atto_id");



CREATE INDEX "idx_tbcontenzioso_scadenze_cliente" ON "public"."tbcontenzioso_processo" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbcontenzioso_scadenze_data_scadenza" ON "public"."tbcontenzioso_processo" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbcontenzioso_scadenze_generate_cliente" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbcontenzioso_scadenze_generate_data" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbcontenzioso_scadenze_generate_operatore" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("operatore_responsabile_id");



CREATE INDEX "idx_tbcontenzioso_scadenze_generate_processo" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("processo_id");



CREATE INDEX "idx_tbcontenzioso_scadenze_generate_stato" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("stato");



CREATE INDEX "idx_tbcontenzioso_scadenze_generate_studio" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("studio_id");



CREATE UNIQUE INDEX "idx_tbcontenzioso_scadenze_generate_unique" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("processo_id", "modulo", "modulo_record_id", "tipo_scadenza");



CREATE INDEX "idx_tbcontenzioso_scadenze_studio" ON "public"."tbcontenzioso_processo" USING "btree" ("studio_id");



CREATE INDEX "idx_tbcontenzioso_scadenze_tipo_atto" ON "public"."tbcontenzioso_processo" USING "btree" ("tipo_atto_id");



CREATE UNIQUE INDEX "idx_tbcontenzioso_tributi_constatazione_descrizione" ON "public"."tbcontenzioso_tributi_constatazione" USING "btree" ("lower"(TRIM(BOTH FROM "descrizione")));



CREATE INDEX "idx_tbcontrollo_gestione_allegati_controllo" ON "public"."tbcontrollo_gestione_allegati" USING "btree" ("controllo_id");



CREATE INDEX "idx_tbcontrollo_gestione_cliente" ON "public"."tbcontrollo_gestione" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbcontrollo_gestione_corrente" ON "public"."tbcontrollo_gestione" USING "btree" ("cliente_id", "data_esecuzione" DESC, "created_at" DESC) WHERE ("archiviato" = false);



CREATE INDEX "idx_tbcontrollo_gestione_data_storico" ON "public"."tbcontrollo_gestione" USING "btree" ("data_storico" DESC);



CREATE INDEX "idx_tbcontrollo_gestione_indici_anno" ON "public"."tbcontrollo_gestione_indici" USING "btree" ("anno");



CREATE INDEX "idx_tbcontrollo_gestione_indici_cliente" ON "public"."tbcontrollo_gestione_indici" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbcontrollo_gestione_indici_controllo" ON "public"."tbcontrollo_gestione_indici" USING "btree" ("controllo_gestione_id");



CREATE INDEX "idx_tbcontrollo_gestione_indici_studio" ON "public"."tbcontrollo_gestione_indici" USING "btree" ("studio_id");



CREATE INDEX "idx_tbcontrollo_gestione_studio" ON "public"."tbcontrollo_gestione" USING "btree" ("studio_id");



CREATE INDEX "idx_tbcontrollo_gestione_utenti_controllo" ON "public"."tbcontrollo_gestione_utenti" USING "btree" ("controllo_id");



CREATE INDEX "idx_tbcredenziali_portale" ON "public"."tbcredenziali_accesso" USING "btree" ("portale");



CREATE INDEX "idx_tbcron_log_executed_at" ON "public"."tbcron_log" USING "btree" ("executed_at" DESC);



CREATE INDEX "idx_tbcron_log_nome_cron" ON "public"."tbcron_log" USING "btree" ("nome_cron");



CREATE INDEX "idx_tbcron_log_ok" ON "public"."tbcron_log" USING "btree" ("ok");



CREATE INDEX "idx_tbemail_template_attivo" ON "public"."tbemail_template" USING "btree" ("attivo");



CREATE INDEX "idx_tbemail_template_categoria" ON "public"."tbemail_template" USING "btree" ("categoria");



CREATE INDEX "idx_tbferie_permessi_richieste_data" ON "public"."tbferie_permessi_richieste" USING "btree" ("data_inizio");



CREATE INDEX "idx_tbferie_permessi_richieste_stato" ON "public"."tbferie_permessi_richieste" USING "btree" ("stato");



CREATE INDEX "idx_tbferie_permessi_richieste_studio" ON "public"."tbferie_permessi_richieste" USING "btree" ("studio_id");



CREATE INDEX "idx_tbferie_permessi_richieste_utente" ON "public"."tbferie_permessi_richieste" USING "btree" ("utente_id");



CREATE INDEX "idx_tbfestivita_data" ON "public"."tbfestivita" USING "btree" ("data_festivita");



CREATE INDEX "idx_tbm365_tokens_studio_conn" ON "public"."tbmicrosoft365_user_tokens" USING "btree" ("studio_id", "microsoft_connection_id");



CREATE INDEX "idx_tbm365_tokens_user_conn" ON "public"."tbmicrosoft365_user_tokens" USING "btree" ("user_id", "microsoft_connection_id");



CREATE INDEX "idx_tbmicrosoft365_user_tokens_lookup" ON "public"."tbmicrosoft365_user_tokens" USING "btree" ("studio_id", "user_id", "microsoft_connection_id");



CREATE INDEX "idx_tbmicrosoft_settings_m365_state" ON "public"."tbmicrosoft_settings" USING "btree" ("m365_oauth_state");



CREATE INDEX "idx_tbmicrosoft_settings_microsoft_connection_id" ON "public"."tbmicrosoft_settings" USING "btree" ("microsoft_connection_id");



CREATE INDEX "idx_tbmicrosoft_tokens_user_connection" ON "public"."tbmicrosoft_tokens" USING "btree" ("user_id", "microsoft_connection_id");



CREATE INDEX "idx_tbpratiche_dati_documenti_pratica_id" ON "public"."tbpratiche_dati_documenti" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbpratiche_distribuzione_utili_pratica_id" ON "public"."tbpratiche_distribuzione_utili" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbpratiche_documenti_pratica" ON "public"."tbpratiche_documenti" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbpratiche_modelli_attivo" ON "public"."tbpratiche_modelli" USING "btree" ("attivo");



CREATE INDEX "idx_tbpratiche_modelli_tipo_pratica" ON "public"."tbpratiche_modelli" USING "btree" ("tipo_pratica");



CREATE INDEX "idx_tbpratiche_modelli_utilita_tipo_pratica" ON "public"."tbpratiche_modelli_utilita" USING "btree" ("tipo_pratica_id");



CREATE INDEX "idx_tbpratiche_soggetti_pratica_id" ON "public"."tbpratiche_soggetti" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbpratiche_variazioni_assegnato" ON "public"."tbpratiche_variazioni" USING "btree" ("assegnato_a");



CREATE INDEX "idx_tbpratiche_variazioni_cliente" ON "public"."tbpratiche_variazioni" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbpratiche_variazioni_pratica" ON "public"."tbpratiche_variazioni" USING "btree" ("pratica_id");



CREATE INDEX "idx_tbpratiche_variazioni_scad_ade" ON "public"."tbpratiche_variazioni" USING "btree" ("data_scadenza_ade");



CREATE INDEX "idx_tbpratiche_variazioni_scad_cciaa" ON "public"."tbpratiche_variazioni" USING "btree" ("data_scadenza_cciaa");



CREATE INDEX "idx_tbpratiche_variazioni_stato" ON "public"."tbpratiche_variazioni" USING "btree" ("stato");



CREATE INDEX "idx_tbpraticheaml_av2_corrente_id" ON "public"."tbPraticheAML" USING "btree" ("av2_corrente_id");



CREATE INDEX "idx_tbpraticheaml_cliente_id" ON "public"."tbPraticheAML" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbpraticheaml_societa_id" ON "public"."tbPraticheAML" USING "btree" ("societa_id");



CREATE INDEX "idx_tbpraticheaml_stato" ON "public"."tbPraticheAML" USING "btree" ("stato");



CREATE INDEX "idx_tbpraticheaml_studio_id" ON "public"."tbPraticheAML" USING "btree" ("studio_id");



CREATE INDEX "idx_tbpresenze_dipendenti_studio_data" ON "public"."tbpresenze_dipendenti" USING "btree" ("studio_id", "data_presenza");



CREATE INDEX "idx_tbpresenze_dipendenti_utente_data" ON "public"."tbpresenze_dipendenti" USING "btree" ("utente_id", "data_presenza");



CREATE INDEX "idx_tbpresenze_smart_calendario_studio_id" ON "public"."tbpresenze_smart_calendario" USING "btree" ("studio_id");



CREATE INDEX "idx_tbpresenze_smart_cambi_turno_data" ON "public"."tbpresenze_smart_cambi_turno" USING "btree" ("data_richiedente");



CREATE INDEX "idx_tbpresenze_smart_cambi_turno_gruppo_stato" ON "public"."tbpresenze_smart_cambi_turno" USING "btree" ("gruppo_id", "stato");



CREATE INDEX "idx_tbpresenze_smart_cambi_turno_studio_id" ON "public"."tbpresenze_smart_cambi_turno" USING "btree" ("studio_id");



CREATE INDEX "idx_tbpresenze_smart_gruppi_studio_id" ON "public"."tbpresenze_smart_gruppi" USING "btree" ("studio_id");



CREATE INDEX "idx_tbpresenze_smart_gruppi_utenti_studio_id" ON "public"."tbpresenze_smart_gruppi_utenti" USING "btree" ("studio_id");



CREATE INDEX "idx_tbrespav_cognome_nome" ON "public"."tbRespAV" USING "btree" ("cognome_nome");



CREATE INDEX "idx_tbrespav_studio_id" ON "public"."tbRespAV" USING "btree" ("studio_id");



CREATE INDEX "idx_tbrevisione_checklist_area" ON "public"."tbrevisione_checklist" USING "btree" ("area");



CREATE INDEX "idx_tbrevisione_checklist_controllo" ON "public"."tbrevisione_checklist" USING "btree" ("controllo_id");



CREATE INDEX "idx_tbrevisione_checklist_studio" ON "public"."tbrevisione_checklist" USING "btree" ("studio_id");



CREATE INDEX "idx_tbrevisione_controlli_scadenza" ON "public"."tbrevisione_controlli" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbrevisione_controlli_stato" ON "public"."tbrevisione_controlli" USING "btree" ("stato");



CREATE INDEX "idx_tbrevisione_controlli_studio" ON "public"."tbrevisione_controlli" USING "btree" ("studio_id");



CREATE INDEX "idx_tbrevisione_documenti_controllo" ON "public"."tbrevisione_documenti" USING "btree" ("controllo_id");



CREATE INDEX "idx_tbrevisione_documenti_relazione" ON "public"."tbrevisione_documenti" USING "btree" ("relazione_id");



CREATE INDEX "idx_tbrevisione_documenti_studio" ON "public"."tbrevisione_documenti" USING "btree" ("studio_id");



CREATE INDEX "idx_tbrevisione_incarichi_cliente" ON "public"."tbrevisione_incarichi" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbrevisione_incarichi_studio" ON "public"."tbrevisione_incarichi" USING "btree" ("studio_id");



CREATE INDEX "idx_tbrevisione_modelli_codice" ON "public"."tbrevisione_modelli" USING "btree" ("codice");



CREATE INDEX "idx_tbrevisione_modelli_studio" ON "public"."tbrevisione_modelli" USING "btree" ("studio_id");



CREATE INDEX "idx_tbscad770_anno_archiviato" ON "public"."tbscad770" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscad770_tipo_scadenza" ON "public"."tbscad770" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbscadaffitti_attivo" ON "public"."tbscadaffitti" USING "btree" ("attivo");



CREATE INDEX "idx_tbscadaffitti_cliente_id" ON "public"."tbscadaffitti" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbscadaffitti_data_prossima_scadenza" ON "public"."tbscadaffitti" USING "btree" ("data_prossima_scadenza");



CREATE INDEX "idx_tbscadaffitti_studio_id" ON "public"."tbscadaffitti" USING "btree" ("studio_id");



CREATE INDEX "idx_tbscadaffitti_utente_operatore_id" ON "public"."tbscadaffitti" USING "btree" ("utente_operatore_id");



CREATE INDEX "idx_tbscadbilanci_anno_archiviato" ON "public"."tbscadbilanci" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadbilanci_nominativo" ON "public"."tbscadbilanci" USING "btree" ("nominativo");



CREATE INDEX "idx_tbscadbilanci_tipo_scadenza" ON "public"."tbscadbilanci" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbscadbilanci_utente_oper" ON "public"."tbscadbilanci" USING "btree" ("utente_operatore_id");



CREATE INDEX "idx_tbscadccgg_anno_archiviato" ON "public"."tbscadccgg" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadccgg_tipo_scadenza" ON "public"."tbscadccgg" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbscadcu_anno_archiviato" ON "public"."tbscadcu" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadcu_tipo_scadenza" ON "public"."tbscadcu" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbscadenze_alert_destinatario" ON "public"."tbscadenze_centrale_alert_log" USING "btree" ("studio_id", "destinatario_utente_id", "created_at" DESC);



CREATE INDEX "idx_tbscadenze_centrale_alert_da_inviare" ON "public"."tbscadenze_centrale_alert_log" USING "btree" ("data_programmata") WHERE ("esito" = 'da_inviare'::"text");



CREATE INDEX "idx_tbscadenze_centrale_alert_studio" ON "public"."tbscadenze_centrale_alert_log" USING "btree" ("studio_id");



CREATE INDEX "idx_tbscadenze_centrale_cliente" ON "public"."tbscadenze_centrale" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbscadenze_centrale_cliente_data" ON "public"."tbscadenze_centrale" USING "btree" ("studio_id", "cliente_id", "data_scadenza");



CREATE INDEX "idx_tbscadenze_centrale_data" ON "public"."tbscadenze_centrale" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbscadenze_centrale_destinatari_studio" ON "public"."tbscadenze_centrale_destinatari" USING "btree" ("studio_id");



CREATE INDEX "idx_tbscadenze_centrale_destinatari_utente" ON "public"."tbscadenze_centrale_destinatari" USING "btree" ("utente_id", "attivo");



CREATE INDEX "idx_tbscadenze_centrale_modulo" ON "public"."tbscadenze_centrale" USING "btree" ("studio_id", "origine_modulo");



CREATE INDEX "idx_tbscadenze_centrale_operatore" ON "public"."tbscadenze_centrale" USING "btree" ("operatore_responsabile_id");



CREATE INDEX "idx_tbscadenze_centrale_operatore_data" ON "public"."tbscadenze_centrale" USING "btree" ("studio_id", "operatore_responsabile_id", "data_scadenza");



CREATE INDEX "idx_tbscadenze_centrale_prossimo_alert" ON "public"."tbscadenze_centrale" USING "btree" ("prossimo_alert_at") WHERE (("stato" = 'attiva'::"text") AND ("prossimo_alert_at" IS NOT NULL));



CREATE INDEX "idx_tbscadenze_centrale_stato_data" ON "public"."tbscadenze_centrale" USING "btree" ("studio_id", "stato", "data_scadenza");



CREATE INDEX "idx_tbscadenze_centrale_studio" ON "public"."tbscadenze_centrale" USING "btree" ("studio_id");



CREATE INDEX "idx_tbscadestero_anno_archiviato" ON "public"."tbscadestero" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadestero_nominativo" ON "public"."tbscadestero" USING "btree" ("nominativo");



CREATE INDEX "idx_tbscadestero_operatore" ON "public"."tbscadestero" USING "btree" ("utente_operatore_id");



CREATE INDEX "idx_tbscadestero_professionista" ON "public"."tbscadestero" USING "btree" ("utente_professionista_id");



CREATE INDEX "idx_tbscadestero_tipo_scadenza" ON "public"."tbscadestero" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbscadfiscali_anno_archiviato" ON "public"."tbscadfiscali" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadfiscali_tipo_scadenza" ON "public"."tbscadfiscali" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbscadimu_anno_archiviato" ON "public"."tbscadimu" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadiva_anno_archiviato" ON "public"."tbscadiva" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadiva_tipo_scadenza" ON "public"."tbscadiva" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbscadlipe_anno_archiviato" ON "public"."tbscadlipe" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadlipe_tipo_scadenza" ON "public"."tbscadlipe" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbscadproforma_anno_archiviato" ON "public"."tbscadproforma" USING "btree" ("anno_riferimento", "archiviato");



CREATE INDEX "idx_tbscadproforma_tipo_scadenza" ON "public"."tbscadproforma" USING "btree" ("tipo_scadenza_id");



CREATE INDEX "idx_tbsoftware_licenze_data_scadenza" ON "public"."tbsoftware_licenze" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbsoftware_licenze_studio_id" ON "public"."tbsoftware_licenze" USING "btree" ("studio_id");



CREATE INDEX "idx_tbsoftware_pagamenti_data_scadenza" ON "public"."tbsoftware_pagamenti" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbsoftware_pagamenti_licenza_id" ON "public"."tbsoftware_pagamenti" USING "btree" ("licenza_id");



CREATE INDEX "idx_tbsoftware_pagamenti_stato" ON "public"."tbsoftware_pagamenti" USING "btree" ("stato_pagamento");



CREATE INDEX "idx_tbsoftware_pagamenti_studio_id" ON "public"."tbsoftware_pagamenti" USING "btree" ("studio_id");



CREATE INDEX "idx_tbsoftware_rinnovi_licenza_id" ON "public"."tbsoftware_rinnovi" USING "btree" ("licenza_id");



CREATE INDEX "idx_tbsoftware_rinnovi_studio_id" ON "public"."tbsoftware_rinnovi" USING "btree" ("studio_id");



CREATE INDEX "idx_tbtipi_scadenze_alert_studio_id" ON "public"."tbtipi_scadenze_alert" USING "btree" ("studio_id");



CREATE INDEX "idx_tbtipi_scadenze_alert_tipo" ON "public"."tbtipi_scadenze_alert" USING "btree" ("tipo_scadenza_id", "anno_invio", "tipo_alert");



CREATE INDEX "idx_tbtipi_scadenze_attivo" ON "public"."tbtipi_scadenze" USING "btree" ("attivo");



CREATE INDEX "idx_tbtipi_scadenze_data" ON "public"."tbtipi_scadenze" USING "btree" ("data_scadenza");



CREATE INDEX "idx_tbtipi_scadenze_studio" ON "public"."tbtipi_scadenze" USING "btree" ("studio_id");



CREATE INDEX "idx_tbtipi_scadenze_tipo" ON "public"."tbtipi_scadenze" USING "btree" ("tipo_scadenza");



CREATE INDEX "idx_tbverifiche_te_cliente" ON "public"."tbverifiche_titolare_effettivo" USING "btree" ("cliente_id");



CREATE INDEX "idx_tbverifiche_te_data_riferimento" ON "public"."tbverifiche_titolare_effettivo" USING "btree" ("cliente_id", "data_riferimento" DESC);



CREATE INDEX "idx_tbverifiche_te_righe_cf" ON "public"."tbverifiche_titolare_effettivo_righe" USING "btree" ("codice_fiscale");



CREATE INDEX "idx_tbverifiche_te_righe_persona" ON "public"."tbverifiche_titolare_effettivo_righe" USING "btree" ("persona_id");



CREATE INDEX "idx_tbverifiche_te_righe_verifica" ON "public"."tbverifiche_titolare_effettivo_righe" USING "btree" ("verifica_id");



CREATE INDEX "idx_tbverifiche_te_stato" ON "public"."tbverifiche_titolare_effettivo" USING "btree" ("stato");



CREATE INDEX "idx_tbverifiche_te_studio" ON "public"."tbverifiche_titolare_effettivo" USING "btree" ("studio_id");



CREATE INDEX "idx_tbverifiche_te_variazione" ON "public"."tbverifiche_titolare_effettivo" USING "btree" ("variazione_rilevata", "data_variazione");



CREATE INDEX "tbagenda_microsoft_connection_id_idx" ON "public"."tbagenda" USING "btree" ("microsoft_connection_id");



CREATE UNIQUE INDEX "tbagenda_provider_external_id_key" ON "public"."tbagenda" USING "btree" ("provider", "external_id");



CREATE UNIQUE INDEX "tbclienti_organi_studio_cliente_soggetto_ruolo_uq" ON "public"."tbclienti_organi" USING "btree" ("studio_id", "cliente_id", "soggetto_cliente_id", "ruolo") WHERE ("soggetto_cliente_id" IS NOT NULL);



CREATE UNIQUE INDEX "tbcontatti_cliente_id_unique" ON "public"."tbcontatti" USING "btree" ("cliente_id") WHERE ("cliente_id" IS NOT NULL);



CREATE INDEX "tbcontatti_clienti_cliente_idx" ON "public"."tbcontatti_clienti" USING "btree" ("cliente_id");



CREATE INDEX "tbcontatti_clienti_contatto_idx" ON "public"."tbcontatti_clienti" USING "btree" ("contatto_id");



CREATE INDEX "tbcontatti_clienti_ruolo_idx" ON "public"."tbcontatti_clienti" USING "btree" ("ruolo");



CREATE INDEX "tbcontatti_clienti_studio_idx" ON "public"."tbcontatti_clienti" USING "btree" ("studio_id");



CREATE INDEX "tbcontatti_relazioni_collegato_idx" ON "public"."tbcontatti_relazioni" USING "btree" ("contatto_collegato_id");



CREATE INDEX "tbcontatti_relazioni_contatto_idx" ON "public"."tbcontatti_relazioni" USING "btree" ("contatto_id");



CREATE INDEX "tbcontatti_relazioni_studio_idx" ON "public"."tbcontatti_relazioni" USING "btree" ("studio_id");



CREATE UNIQUE INDEX "tbfestivita_unique_idx" ON "public"."tbfestivita" USING "btree" ("data_festivita", "tipo", COALESCE("codice_catastale", ''::"text"), COALESCE("comune", ''::"text"));



CREATE UNIQUE INDEX "tbpresenze_solleciti_log_unique" ON "public"."tbpresenze_solleciti_log" USING "btree" ("studio_id", "utente_id", "data_sollecito");



CREATE INDEX "tbrespav_societa_id_idx" ON "public"."tbRespAV" USING "btree" ("societa_id");



CREATE INDEX "tbrespavsocieta_denominazione_idx" ON "public"."tbRespAVSocieta" USING "btree" ("Denominazione");



CREATE UNIQUE INDEX "tbrespavsocieta_studio_cf_unique" ON "public"."tbRespAVSocieta" USING "btree" ("studio_id", "codice_fiscale");



CREATE INDEX "tbrespavsocieta_studio_idx" ON "public"."tbRespAVSocieta" USING "btree" ("studio_id");



CREATE UNIQUE INDEX "tbscad770_cliente_anno_uidx" ON "public"."tbscad770" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadbilanci_cliente_anno_uidx" ON "public"."tbscadbilanci" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadccgg_cliente_anno_uidx" ON "public"."tbscadccgg" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadcu_cliente_anno_uidx" ON "public"."tbscadcu" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadestero_cliente_anno_uidx" ON "public"."tbscadestero" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadfiscali_cliente_anno_uidx" ON "public"."tbscadfiscali" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadimu_cliente_anno_uidx" ON "public"."tbscadimu" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadiva_cliente_anno_uidx" ON "public"."tbscadiva" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadlipe_cliente_anno_uidx" ON "public"."tbscadlipe" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbscadproforma_cliente_anno_uidx" ON "public"."tbscadproforma" USING "btree" ("cliente_id", "anno_riferimento");



CREATE UNIQUE INDEX "tbsoftware_licenze_numero_licenza_uidx" ON "public"."tbsoftware_licenze" USING "btree" ("numero_licenza");



CREATE UNIQUE INDEX "tbsoftware_licenze_studio_id_uidx" ON "public"."tbsoftware_licenze" USING "btree" ("studio_id");



CREATE UNIQUE INDEX "uniq_controllo_gestione_cliente_attivo" ON "public"."tbcontrollo_gestione" USING "btree" ("cliente_id") WHERE ("archiviato" = false);



CREATE UNIQUE INDEX "uniq_licenza_studio" ON "public"."tbsoftware_licenze" USING "btree" ("studio_id");



CREATE UNIQUE INDEX "uq_m365_connections_default_per_studio" ON "public"."microsoft365_connections" USING "btree" ("studio_id") WHERE ("is_default" = true);



CREATE UNIQUE INDEX "uq_scadenze_generate_no_doppioni" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("processo_id", "modulo", "descrizione", "data_scadenza");



CREATE UNIQUE INDEX "uq_scadenze_generate_processo_codice" ON "public"."tbcontenzioso_scadenze_generate" USING "btree" ("processo_id", "codice");



CREATE UNIQUE INDEX "uq_tbclienti_codice_fiscale" ON "public"."tbclienti" USING "btree" ("upper"(TRIM(BOTH FROM "codice_fiscale")));



CREATE UNIQUE INDEX "uq_tbclienti_documenti_aml_soggetto" ON "public"."tbclienti_documenti_aml" USING "btree" ("studio_id", "soggetto_cliente_id");



CREATE UNIQUE INDEX "uq_tbpraticheaml_numero_pratica" ON "public"."tbPraticheAML" USING "btree" ("numero_pratica");



CREATE UNIQUE INDEX "uq_tbrespav_studio_cf" ON "public"."tbRespAV" USING "btree" ("studio_id", "codice_fiscale");



CREATE UNIQUE INDEX "uq_tbscadenze_centrale_alert_destinatario" ON "public"."tbscadenze_centrale_alert_log" USING "btree" ("scadenza_id", "destinatario_utente_id", "chiave_invio");



CREATE UNIQUE INDEX "uq_tbscadenze_centrale_destinatari_esterni" ON "public"."tbscadenze_centrale_destinatari" USING "btree" ("scadenza_id", "lower"("destinatario_email")) WHERE ("destinatario_email" IS NOT NULL);



CREATE UNIQUE INDEX "uq_tbscadenze_centrale_destinatari_interni" ON "public"."tbscadenze_centrale_destinatari" USING "btree" ("scadenza_id", "utente_id") WHERE ("utente_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_tbscadenze_centrale_origine" ON "public"."tbscadenze_centrale" USING "btree" ("studio_id", "origine_tabella", "origine_record_id", "tipo_scadenza");



CREATE UNIQUE INDEX "uq_tbtipi_scadenze_alert_tipo" ON "public"."tbtipi_scadenze_alert" USING "btree" ("tipo_scadenza_id", "anno_invio", "tipo_alert");



CREATE UNIQUE INDEX "uq_tbutenti_utente_comunicazioni_studio" ON "public"."tbutenti" USING "btree" ("studio_id") WHERE ("utente_comunicazioni" = true);



CREATE UNIQUE INDEX "ux_fascicolo_doc_auto_unico" ON "public"."tbAVFascicoliDocumenti" USING "btree" ("studio_id", "pratica_id", "origine", "storage_path") WHERE ("origine" <> 'manuale'::"text");



CREATE OR REPLACE TRIGGER "ensure_studio_id_before_insert" BEFORE INSERT ON "public"."tbclienti" FOR EACH ROW EXECUTE FUNCTION "public"."auto_set_studio_id"();



CREATE OR REPLACE TRIGGER "ensure_studio_id_before_update" BEFORE UPDATE ON "public"."tbclienti" FOR EACH ROW EXECUTE FUNCTION "public"."auto_set_studio_id"();



CREATE OR REPLACE TRIGGER "set_cassetti_fiscali_updated_at" BEFORE UPDATE ON "public"."tbcassetti_fiscali" FOR EACH ROW EXECUTE FUNCTION "public"."update_cassetti_fiscali_updated_at"();



CREATE OR REPLACE TRIGGER "set_tbclienti_documenti_aml_updated_at" BEFORE UPDATE ON "public"."tbclienti_documenti_aml" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_tbcontatti_clienti_updated_at" BEFORE UPDATE ON "public"."tbcontatti_clienti" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_tbcontatti_relazioni_updated_at" BEFORE UPDATE ON "public"."tbcontatti_relazioni" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_calcola_scadenza_cartella" BEFORE INSERT OR UPDATE ON "public"."tbcontenzioso_cartelle" FOR EACH ROW EXECUTE FUNCTION "public"."calcola_scadenza_cartella"();



CREATE OR REPLACE TRIGGER "trg_calcola_scadenza_contenzioso" BEFORE INSERT OR UPDATE ON "public"."tbcontenzioso_processo" FOR EACH ROW EXECUTE FUNCTION "public"."calcola_scadenza_contenzioso"();



CREATE OR REPLACE TRIGGER "trg_check_limite_societa_responsabili" BEFORE INSERT ON "public"."tbRespAVSocieta" FOR EACH ROW EXECUTE FUNCTION "public"."check_limite_societa_responsabili"();



CREATE OR REPLACE TRIGGER "trg_completa_dati_scadenza_contenzioso" BEFORE INSERT OR UPDATE ON "public"."tbcontenzioso_scadenze_generate" FOR EACH ROW EXECUTE FUNCTION "public"."completa_dati_scadenza_contenzioso"();



CREATE OR REPLACE TRIGGER "trg_force_studio_on_cassetti" BEFORE INSERT OR UPDATE ON "public"."tbcassetti_fiscali" FOR EACH ROW EXECUTE FUNCTION "public"."trg_cassetti_force_studio"();



CREATE OR REPLACE TRIGGER "trg_m365_tokens_updated_at" BEFORE UPDATE ON "public"."tbmicrosoft365_user_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_scadenze_adesione" AFTER INSERT OR UPDATE ON "public"."tbcontenzioso_adesione" FOR EACH ROW EXECUTE FUNCTION "public"."genera_scadenze_modulo_contenzioso"('ADESIONE');



CREATE OR REPLACE TRIGGER "trg_scadenze_schema_atto" AFTER INSERT OR UPDATE ON "public"."tbcontenzioso_schema_atto" FOR EACH ROW EXECUTE FUNCTION "public"."genera_scadenze_modulo_contenzioso"('SCHEMA_ATTO');



CREATE OR REPLACE TRIGGER "trg_set_updated_at_tbavfascicolidocumenti" BEFORE UPDATE ON "public"."tbAVFascicoliDocumenti" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_tbavfascicolidocumenti"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenza_affitto_centrale" AFTER INSERT OR DELETE OR UPDATE ON "public"."tbscadaffitti" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenza_affitto_centrale"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenza_avviso_bonario" AFTER INSERT OR DELETE OR UPDATE ON "public"."tbcontenzioso_avvisi_bonari" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenza_avviso_bonario"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenza_cartella" AFTER INSERT OR DELETE OR UPDATE ON "public"."tbcontenzioso_cartelle" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenza_cartella"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenza_contenzioso_centrale" AFTER INSERT OR DELETE OR UPDATE ON "public"."tbcontenzioso_scadenze_generate" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenza_contenzioso_centrale"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenza_tbclienti_organi" AFTER INSERT OR DELETE OR UPDATE ON "public"."tbclienti_organi" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenza_tbclienti_organi"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenza_tbpraticheaml" AFTER INSERT OR DELETE OR UPDATE ON "public"."tbPraticheAML" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenza_tbpraticheaml"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenze_adesione" AFTER INSERT OR UPDATE ON "public"."tbcontenzioso_adesione" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenze_adesione"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenze_cassazione" AFTER INSERT OR UPDATE ON "public"."tbcontenzioso_cassazione" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenze_cassazione"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenze_interpello" AFTER INSERT OR UPDATE ON "public"."tbcontenzioso_interpello" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenze_interpello"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenze_primo_grado" AFTER INSERT OR UPDATE ON "public"."tbcontenzioso_ricorso_primo_grado" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenze_primo_grado"();



CREATE OR REPLACE TRIGGER "trg_sync_scadenze_pvc" AFTER INSERT OR UPDATE ON "public"."tbcontenzioso_pvc" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenze_pvc"();

ALTER TABLE "public"."tbcontenzioso_pvc" DISABLE TRIGGER "trg_sync_scadenze_pvc";



CREATE OR REPLACE TRIGGER "trg_sync_scadenze_secondo_grado" AFTER INSERT OR UPDATE ON "public"."tbcontenzioso_ricorso_secondo_grado" FOR EACH ROW EXECUTE FUNCTION "public"."sync_scadenze_secondo_grado"();



CREATE OR REPLACE TRIGGER "trg_sync_tbdipendenti" AFTER INSERT OR UPDATE OF "nome", "cognome", "email", "studio_id", "tipo_rapporto", "attivo" ON "public"."tbutenti" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tbdipendenti_from_utenti"();



CREATE OR REPLACE TRIGGER "trg_sync_tipo_scadenza_centrale" AFTER INSERT OR DELETE OR UPDATE ON "public"."tbtipi_scadenze" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tipo_scadenza_centrale"();



CREATE OR REPLACE TRIGGER "trg_tbamlcomunicazioni_updated_at" BEFORE UPDATE ON "public"."tbAMLComunicazioni" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbav2_updated_at" BEFORE UPDATE ON "public"."tbAV2" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbav4_titolari_updated_at" BEFORE UPDATE ON "public"."tbAV4_titolari" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbcontrollo_gestione_updated_at" BEFORE UPDATE ON "public"."tbcontrollo_gestione" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbpraticheaml_updated_at" BEFORE UPDATE ON "public"."tbPraticheAML" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbrespav_updated_at" BEFORE UPDATE ON "public"."tbRespAV" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbrespavsocieta_updated_at" BEFORE UPDATE ON "public"."tbRespAVSocieta" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbscadaffitti_updated_at" BEFORE UPDATE ON "public"."tbscadaffitti" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbscadenze_centrale_updated_at" BEFORE UPDATE ON "public"."tbscadenze_centrale" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbsoftware_licenze_updated_at" BEFORE UPDATE ON "public"."tbsoftware_licenze" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbsoftware_pagamenti_updated_at" BEFORE UPDATE ON "public"."tbsoftware_pagamenti" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tbsoftware_rinnovi_updated_at" BEFORE UPDATE ON "public"."tbsoftware_rinnovi" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_verifica_destinatario_scadenza_centrale" BEFORE INSERT OR UPDATE ON "public"."tbscadenze_centrale_destinatari" FOR EACH ROW EXECUTE FUNCTION "public"."verifica_destinatario_scadenza_centrale"();



CREATE OR REPLACE TRIGGER "trg_verifica_tbclienti_servizi_studio" BEFORE INSERT OR UPDATE ON "public"."tbclienti_servizi" FOR EACH ROW EXECUTE FUNCTION "public"."verifica_tbclienti_servizi_studio"();



CREATE OR REPLACE TRIGGER "trigger_calcola_data_scad_pres" BEFORE INSERT OR UPDATE OF "data_approvazione" ON "public"."tbscadbilanci" FOR EACH ROW EXECUTE FUNCTION "public"."calcola_data_scad_pres"();



CREATE OR REPLACE TRIGGER "trigger_calcola_scadenze_tbpratiche_variazioni" BEFORE INSERT OR UPDATE OF "data_atto", "giorni_scadenza_cciaa", "obbligo_ade", "data_evasione_cciaa", "giorni_scadenza_ade" ON "public"."tbpratiche_variazioni" FOR EACH ROW EXECUTE FUNCTION "public"."calcola_scadenze_tbpratiche_variazioni"();



CREATE OR REPLACE TRIGGER "trigger_generate_cod_cliente" BEFORE INSERT ON "public"."tbclienti" FOR EACH ROW WHEN ((("new"."cod_cliente" IS NULL) OR ("new"."cod_cliente" = ''::"text"))) EXECUTE FUNCTION "public"."generate_cod_cliente"();



CREATE OR REPLACE TRIGGER "trigger_tbpratiche_variazioni_updated_at" BEFORE UPDATE ON "public"."tbpratiche_variazioni" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_tbscadbilanci_updated_at" BEFORE UPDATE ON "public"."tbscadbilanci" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tbpromemoria_updated_at" BEFORE UPDATE ON "public"."tbpromemoria" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tbscad770_updated_at" BEFORE UPDATE ON "public"."tbscad770" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tbscadlipe_updated_at" BEFORE UPDATE ON "public"."tbscadlipe" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tbtipopromemoria_updated_at" BEFORE UPDATE ON "public"."tbtipopromemoria" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."event_confirmations"
    ADD CONSTRAINT "event_confirmations_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."tbagenda"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_reminders"
    ADD CONSTRAINT "event_reminders_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."tbagenda"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV1"
    ADD CONSTRAINT "fk_av1_cliente" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV1"
    ADD CONSTRAINT "fk_av1_studio" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_avvisi_bonari"
    ADD CONSTRAINT "fk_avvisi_bonari_operatore_responsabile" FOREIGN KEY ("operatore_responsabile_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_avvisi_bonari"
    ADD CONSTRAINT "fk_avvisi_tributo_constatazione" FOREIGN KEY ("tributo_constatazione_id") REFERENCES "public"."tbcontenzioso_tributi_constatazione"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_cartelle"
    ADD CONSTRAINT "fk_cartelle_operatore_responsabile" FOREIGN KEY ("operatore_responsabile_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_cartelle"
    ADD CONSTRAINT "fk_cartelle_tributo_constatazione" FOREIGN KEY ("tributo_constatazione_id") REFERENCES "public"."tbcontenzioso_tributi_constatazione"("id");



ALTER TABLE ONLY "public"."tbpratiche_checklist"
    ADD CONSTRAINT "fk_checklist_template" FOREIGN KEY ("checklist_template_id") REFERENCES "public"."tbpratiche_checklist_template"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche_checklist_template"
    ADD CONSTRAINT "fk_checklist_template_tipo" FOREIGN KEY ("tipo_pratica_id") REFERENCES "public"."tbpratiche_tipi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpratiche_log"
    ADD CONSTRAINT "fk_log_step" FOREIGN KEY ("step_id") REFERENCES "public"."tbpratiche_step"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche_modelli_documenti"
    ADD CONSTRAINT "fk_modelli_documenti_step_template" FOREIGN KEY ("step_template_id") REFERENCES "public"."tbpratiche_step_template"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche_modelli_documenti"
    ADD CONSTRAINT "fk_modelli_documenti_tipo" FOREIGN KEY ("tipo_pratica_id") REFERENCES "public"."tbpratiche_tipi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpratiche_note"
    ADD CONSTRAINT "fk_note_step" FOREIGN KEY ("step_id") REFERENCES "public"."tbpratiche_step"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbcontenzioso_processo"
    ADD CONSTRAINT "fk_processo_tributo_constatazione" FOREIGN KEY ("tributo_constatazione_id") REFERENCES "public"."tbcontenzioso_tributi_constatazione"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_pvc"
    ADD CONSTRAINT "fk_pvc_processo" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpratiche_scadenze"
    ADD CONSTRAINT "fk_scadenza_step" FOREIGN KEY ("step_id") REFERENCES "public"."tbpratiche_step"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche_step"
    ADD CONSTRAINT "fk_step_template" FOREIGN KEY ("template_step_id") REFERENCES "public"."tbpratiche_step_template"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche_step_template"
    ADD CONSTRAINT "fk_step_template_tipo" FOREIGN KEY ("tipo_pratica_id") REFERENCES "public"."tbpratiche_tipi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAMLComunicazioni"
    ADD CONSTRAINT "fk_tbamlcomunicazioni_pratica" FOREIGN KEY ("pratica_id") REFERENCES "public"."tbPraticheAML"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAMLComunicazioni"
    ADD CONSTRAINT "fk_tbamlcomunicazioni_societa" FOREIGN KEY ("societa_id") REFERENCES "public"."tbRespAVSocieta"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbAV1"
    ADD CONSTRAINT "fk_tbav1_pratica" FOREIGN KEY ("pratica_id") REFERENCES "public"."tbPraticheAML"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV1"
    ADD CONSTRAINT "fk_tbav1_societa" FOREIGN KEY ("societa_id") REFERENCES "public"."tbRespAVSocieta"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbAV2"
    ADD CONSTRAINT "fk_tbav2_cliente" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV2"
    ADD CONSTRAINT "fk_tbav2_pratica" FOREIGN KEY ("pratica_id") REFERENCES "public"."tbPraticheAML"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV2"
    ADD CONSTRAINT "fk_tbav2_societa" FOREIGN KEY ("societa_id") REFERENCES "public"."tbRespAVSocieta"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbAV4"
    ADD CONSTRAINT "fk_tbav4_cliente" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV4"
    ADD CONSTRAINT "fk_tbav4_pratica" FOREIGN KEY ("pratica_id") REFERENCES "public"."tbPraticheAML"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV4"
    ADD CONSTRAINT "fk_tbav4_societa" FOREIGN KEY ("societa_id") REFERENCES "public"."tbRespAVSocieta"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbAV4"
    ADD CONSTRAINT "fk_tbav4_studio" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV4_titolari"
    ADD CONSTRAINT "fk_tbav4_titolari_av4" FOREIGN KEY ("av4_id") REFERENCES "public"."tbAV4"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV4_titolari"
    ADD CONSTRAINT "fk_tbav4_titolari_cliente" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV4_titolari"
    ADD CONSTRAINT "fk_tbav4_titolari_pratica" FOREIGN KEY ("pratica_id") REFERENCES "public"."tbPraticheAML"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV4_titolari"
    ADD CONSTRAINT "fk_tbav4_titolari_rapp_legale" FOREIGN KEY ("soggetto_cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbAV4_titolari"
    ADD CONSTRAINT "fk_tbav4_titolari_societa" FOREIGN KEY ("societa_id") REFERENCES "public"."tbRespAVSocieta"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbAV4_titolari"
    ADD CONSTRAINT "fk_tbav4_titolari_studio" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "fk_tbpraticheaml_av1" FOREIGN KEY ("av1_id") REFERENCES "public"."tbAV1"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "fk_tbpraticheaml_av2" FOREIGN KEY ("av2_id") REFERENCES "public"."tbAV2"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "fk_tbpraticheaml_av2_corrente" FOREIGN KEY ("av2_corrente_id") REFERENCES "public"."tbAV2"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "fk_tbpraticheaml_av4" FOREIGN KEY ("av4_id") REFERENCES "public"."tbAV4"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "fk_tbpraticheaml_av4_corrente" FOREIGN KEY ("av4_corrente_id") REFERENCES "public"."tbAV4"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbcontenzioso_avvisi_bonari"
    ADD CONSTRAINT "fk_tipo_atto" FOREIGN KEY ("tipo_atto_id") REFERENCES "public"."tbcontenzioso_tipi_atto"("id");



ALTER TABLE ONLY "public"."microsoft365_config"
    ADD CONSTRAINT "microsoft365_config_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."microsoft365_connections"
    ADD CONSTRAINT "microsoft365_connections_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbagenda"
    ADD CONSTRAINT "tbagenda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id");



ALTER TABLE ONLY "public"."tbagenda"
    ADD CONSTRAINT "tbagenda_microsoft_connection_id_fkey" FOREIGN KEY ("microsoft_connection_id") REFERENCES "public"."microsoft365_connections"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbagenda"
    ADD CONSTRAINT "tbagenda_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id");



ALTER TABLE ONLY "public"."tbagenda"
    ADD CONSTRAINT "tbagenda_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbassunzioni_allegati"
    ADD CONSTRAINT "tbassunzioni_allegati_richiesta_id_fkey" FOREIGN KEY ("richiesta_id") REFERENCES "public"."tbassunzioni_richieste"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbassunzioni_richieste"
    ADD CONSTRAINT "tbassunzioni_richieste_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAV4"
    ADD CONSTRAINT "tbav4_soggetto_cliente_id_fkey" FOREIGN KEY ("soggetto_cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbAVFascicoliDocumenti"
    ADD CONSTRAINT "tbavfascicolidocumenti_av4_id_fkey" FOREIGN KEY ("av4_id") REFERENCES "public"."tbAV4"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbAVFascicoliDocumenti"
    ADD CONSTRAINT "tbavfascicolidocumenti_pratica_id_fkey" FOREIGN KEY ("pratica_id") REFERENCES "public"."tbPraticheAML"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbAVFascicoliDocumenti"
    ADD CONSTRAINT "tbavfascicolidocumenti_societa_documento_id_fkey" FOREIGN KEY ("societa_documento_id") REFERENCES "public"."tbclienti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbcassetti_fiscali"
    ADD CONSTRAINT "tbcassetti_fiscali_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcassetti_fiscali"
    ADD CONSTRAINT "tbcassetti_fiscali_utente_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbclienti_accessi_pubblici"
    ADD CONSTRAINT "tbclienti_accessi_pubblici_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_cassetto_fiscale_id_fkey" FOREIGN KEY ("cassetto_fiscale_id") REFERENCES "public"."tbcassetti_fiscali"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_contatto1_id_fkey" FOREIGN KEY ("contatto1_id") REFERENCES "public"."tbcontatti"("id");



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_contatto2_id_fkey" FOREIGN KEY ("contatto2_id") REFERENCES "public"."tbcontatti"("id");



ALTER TABLE ONLY "public"."tbclienti_documenti_aml"
    ADD CONSTRAINT "tbclienti_documenti_aml_microsoft_fkey" FOREIGN KEY ("microsoft_connection_id") REFERENCES "public"."microsoft365_connections"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbclienti_documenti_aml"
    ADD CONSTRAINT "tbclienti_documenti_aml_soggetto_fkey" FOREIGN KEY ("soggetto_cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti_documenti_aml"
    ADD CONSTRAINT "tbclienti_documenti_aml_studio_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti_organi"
    ADD CONSTRAINT "tbclienti_organi_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti_organi_diritti"
    ADD CONSTRAINT "tbclienti_organi_diritti_organo_id_fkey" FOREIGN KEY ("organo_id") REFERENCES "public"."tbclienti_organi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti_organi_diritti"
    ADD CONSTRAINT "tbclienti_organi_diritti_soggetto_cliente_id_fkey" FOREIGN KEY ("soggetto_cliente_id") REFERENCES "public"."tbclienti"("id");



ALTER TABLE ONLY "public"."tbclienti_organi"
    ADD CONSTRAINT "tbclienti_organi_soggetto_cliente_id_fkey" FOREIGN KEY ("soggetto_cliente_id") REFERENCES "public"."tbclienti"("id");



ALTER TABLE ONLY "public"."tbclienti_organi"
    ADD CONSTRAINT "tbclienti_organi_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_professionista_payroll_id_fkey" FOREIGN KEY ("professionista_payroll_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbclienti_servizi"
    ADD CONSTRAINT "tbclienti_servizi_cliente_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti_servizi"
    ADD CONSTRAINT "tbclienti_servizi_studio_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_tipo_prestazione_id_fkey" FOREIGN KEY ("tipo_prestazione_id") REFERENCES "public"."tbprestazioni"("id");



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_utente_payroll_id_fkey" FOREIGN KEY ("utente_payroll_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbclienti"
    ADD CONSTRAINT "tbclienti_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbcomunicazioni"
    ADD CONSTRAINT "tbcomunicazioni_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontatti"
    ADD CONSTRAINT "tbcontatti_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontatti_clienti"
    ADD CONSTRAINT "tbcontatti_clienti_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontatti_clienti"
    ADD CONSTRAINT "tbcontatti_clienti_contatto_id_fkey" FOREIGN KEY ("contatto_id") REFERENCES "public"."tbcontatti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontatti_clienti"
    ADD CONSTRAINT "tbcontatti_clienti_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontatti_relazioni"
    ADD CONSTRAINT "tbcontatti_relazioni_contatto_collegato_id_fkey" FOREIGN KEY ("contatto_collegato_id") REFERENCES "public"."tbcontatti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontatti_relazioni"
    ADD CONSTRAINT "tbcontatti_relazioni_contatto_id_fkey" FOREIGN KEY ("contatto_id") REFERENCES "public"."tbcontatti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontatti_relazioni"
    ADD CONSTRAINT "tbcontatti_relazioni_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontatti"
    ADD CONSTRAINT "tbcontatti_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_adesione"
    ADD CONSTRAINT "tbcontenzioso_adesione_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_avvisi_bonari"
    ADD CONSTRAINT "tbcontenzioso_avvisi_bonari_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_avvisi_bonari"
    ADD CONSTRAINT "tbcontenzioso_avvisi_bonari_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_cartelle"
    ADD CONSTRAINT "tbcontenzioso_cartelle_avviso_bonario_id_fkey" FOREIGN KEY ("avviso_bonario_id") REFERENCES "public"."tbcontenzioso_avvisi_bonari"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbcontenzioso_cartelle"
    ADD CONSTRAINT "tbcontenzioso_cartelle_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_cartelle"
    ADD CONSTRAINT "tbcontenzioso_cartelle_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_cartelle"
    ADD CONSTRAINT "tbcontenzioso_cartelle_tipo_atto_id_fkey" FOREIGN KEY ("tipo_atto_id") REFERENCES "public"."tbcontenzioso_tipi_atto"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_cassazione"
    ADD CONSTRAINT "tbcontenzioso_cassazione_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_processo"
    ADD CONSTRAINT "tbcontenzioso_esattoriale_avviso_bonario_id_fkey" FOREIGN KEY ("avviso_bonario_id") REFERENCES "public"."tbcontenzioso_avvisi_bonari"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbcontenzioso_processo"
    ADD CONSTRAINT "tbcontenzioso_esattoriale_professionista_incaricato_id_fkey" FOREIGN KEY ("professionista_incaricato_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_processo"
    ADD CONSTRAINT "tbcontenzioso_esattoriale_referente_id_fkey" FOREIGN KEY ("referente_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_esattoriale_tributi"
    ADD CONSTRAINT "tbcontenzioso_esattoriale_tributi_codice_tributo_id_fkey" FOREIGN KEY ("codice_tributo_id") REFERENCES "public"."tbcontenzioso_codici_tributo"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_esattoriale_tributi"
    ADD CONSTRAINT "tbcontenzioso_esattoriale_tributi_esattoriale_id_fkey" FOREIGN KEY ("esattoriale_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_interpello"
    ADD CONSTRAINT "tbcontenzioso_interpello_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_memorie"
    ADD CONSTRAINT "tbcontenzioso_memorie_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_ricorso_primo_grado"
    ADD CONSTRAINT "tbcontenzioso_ricorso_primo_grado_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_ricorso_secondo_grado"
    ADD CONSTRAINT "tbcontenzioso_ricorso_secondo_grado_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_processo"
    ADD CONSTRAINT "tbcontenzioso_scadenze_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_scadenze_generate"
    ADD CONSTRAINT "tbcontenzioso_scadenze_generate_cliente_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_scadenze_generate"
    ADD CONSTRAINT "tbcontenzioso_scadenze_generate_operatore_fkey" FOREIGN KEY ("operatore_responsabile_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbcontenzioso_scadenze_generate"
    ADD CONSTRAINT "tbcontenzioso_scadenze_generate_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_scadenze_generate"
    ADD CONSTRAINT "tbcontenzioso_scadenze_generate_studio_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_processo"
    ADD CONSTRAINT "tbcontenzioso_scadenze_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontenzioso_processo"
    ADD CONSTRAINT "tbcontenzioso_scadenze_tipo_atto_id_fkey" FOREIGN KEY ("tipo_atto_id") REFERENCES "public"."tbcontenzioso_tipi_atto"("id");



ALTER TABLE ONLY "public"."tbcontenzioso_schema_atto"
    ADD CONSTRAINT "tbcontenzioso_schema_atto_processo_id_fkey" FOREIGN KEY ("processo_id") REFERENCES "public"."tbcontenzioso_processo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontrollo_gestione_allegati"
    ADD CONSTRAINT "tbcontrollo_gestione_allegati_controllo_id_fkey" FOREIGN KEY ("controllo_id") REFERENCES "public"."tbcontrollo_gestione"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontrollo_gestione"
    ADD CONSTRAINT "tbcontrollo_gestione_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id");



ALTER TABLE ONLY "public"."tbcontrollo_gestione"
    ADD CONSTRAINT "tbcontrollo_gestione_controllo_precedente_id_fkey" FOREIGN KEY ("controllo_precedente_id") REFERENCES "public"."tbcontrollo_gestione"("id");



ALTER TABLE ONLY "public"."tbcontrollo_gestione"
    ADD CONSTRAINT "tbcontrollo_gestione_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id");



ALTER TABLE ONLY "public"."tbcontrollo_gestione_utenti"
    ADD CONSTRAINT "tbcontrollo_gestione_utenti_controllo_id_fkey" FOREIGN KEY ("controllo_id") REFERENCES "public"."tbcontrollo_gestione"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcontrollo_gestione_utenti"
    ADD CONSTRAINT "tbcontrollo_gestione_utenti_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbconversazioni"
    ADD CONSTRAINT "tbconversazioni_creato_da_fkey" FOREIGN KEY ("creato_da") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbconversazioni"
    ADD CONSTRAINT "tbconversazioni_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbconversazioni_utenti"
    ADD CONSTRAINT "tbconversazioni_utenti_conversazione_id_fkey" FOREIGN KEY ("conversazione_id") REFERENCES "public"."tbconversazioni"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbconversazioni_utenti"
    ADD CONSTRAINT "tbconversazioni_utenti_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbcredenziali_accesso"
    ADD CONSTRAINT "tbcredenziali_accesso_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbcredenziali_accesso"
    ADD CONSTRAINT "tbcredenziali_accesso_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbferie_permessi_richieste"
    ADD CONSTRAINT "tbferie_permessi_richieste_approvato_da_fkey" FOREIGN KEY ("approvato_da") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbferie_permessi_richieste"
    ADD CONSTRAINT "tbferie_permessi_richieste_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbferie_permessi_richieste"
    ADD CONSTRAINT "tbferie_permessi_richieste_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbmessaggi_allegati"
    ADD CONSTRAINT "tbmessaggi_allegati_messaggio_id_fkey" FOREIGN KEY ("messaggio_id") REFERENCES "public"."tbmessaggi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbmessaggi"
    ADD CONSTRAINT "tbmessaggi_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbmessaggi"
    ADD CONSTRAINT "tbmessaggi_conversazione_id_fkey" FOREIGN KEY ("conversazione_id") REFERENCES "public"."tbconversazioni"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbmessaggi"
    ADD CONSTRAINT "tbmessaggi_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."tbagenda"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbmessaggi"
    ADD CONSTRAINT "tbmessaggi_mittente_id_fkey" FOREIGN KEY ("mittente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbmessaggi"
    ADD CONSTRAINT "tbmessaggi_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbmicrosoft365_user_tokens"
    ADD CONSTRAINT "tbmicrosoft365_user_tokens_microsoft_connection_id_fkey" FOREIGN KEY ("microsoft_connection_id") REFERENCES "public"."microsoft365_connections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbmicrosoft_calendar_mappings"
    ADD CONSTRAINT "tbmicrosoft_calendar_mappings_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."tbagenda"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbmicrosoft_settings"
    ADD CONSTRAINT "tbmicrosoft_settings_microsoft_connection_id_fkey" FOREIGN KEY ("microsoft_connection_id") REFERENCES "public"."microsoft365_connections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbmicrosoft_settings"
    ADD CONSTRAINT "tbmicrosoft_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbmicrosoft_tokens"
    ADD CONSTRAINT "tbmicrosoft_tokens_microsoft_connection_id_fkey" FOREIGN KEY ("microsoft_connection_id") REFERENCES "public"."microsoft365_connections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbmicrosoft_tokens"
    ADD CONSTRAINT "tbmicrosoft_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpratiche"
    ADD CONSTRAINT "tbpratiche_pratica_collegata_id_fkey" FOREIGN KEY ("pratica_collegata_id") REFERENCES "public"."tbpratiche"("id");



ALTER TABLE ONLY "public"."tbpratiche"
    ADD CONSTRAINT "tbpratiche_pratica_origine_id_fkey" FOREIGN KEY ("pratica_origine_id") REFERENCES "public"."tbpratiche"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche"
    ADD CONSTRAINT "tbpratiche_pratica_padre_id_fkey" FOREIGN KEY ("pratica_padre_id") REFERENCES "public"."tbpratiche"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche"
    ADD CONSTRAINT "tbpratiche_variazione_id_fkey" FOREIGN KEY ("variazione_id") REFERENCES "public"."tbpratiche_variazioni"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche_variazioni"
    ADD CONSTRAINT "tbpratiche_variazioni_assegnato_a_fkey" FOREIGN KEY ("assegnato_a") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche_variazioni"
    ADD CONSTRAINT "tbpratiche_variazioni_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpratiche_variazioni"
    ADD CONSTRAINT "tbpratiche_variazioni_pratica_id_fkey" FOREIGN KEY ("pratica_id") REFERENCES "public"."tbpratiche"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpratiche_variazioni"
    ADD CONSTRAINT "tbpratiche_variazioni_pratica_origine_id_fkey" FOREIGN KEY ("pratica_origine_id") REFERENCES "public"."tbpratiche"("id");



ALTER TABLE ONLY "public"."tbpratiche_variazioni"
    ADD CONSTRAINT "tbpratiche_variazioni_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpratiche_variazioni_tipi"
    ADD CONSTRAINT "tbpratiche_variazioni_tipi_tipo_pratica_id_fkey" FOREIGN KEY ("tipo_pratica_id") REFERENCES "public"."tbpratiche_tipi"("id");



ALTER TABLE ONLY "public"."tbpratiche_variazioni"
    ADD CONSTRAINT "tbpratiche_variazioni_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "tbpraticheaml_cliente_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "tbpraticheaml_operatore_responsabile_fk" FOREIGN KEY ("operatore_responsabile_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "tbpraticheaml_societa_fkey" FOREIGN KEY ("societa_id") REFERENCES "public"."tbRespAVSocieta"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbPraticheAML"
    ADD CONSTRAINT "tbpraticheaml_studio_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpresenze_dipendenti"
    ADD CONSTRAINT "tbpresenze_dipendenti_codice_presenza_fkey" FOREIGN KEY ("codice_presenza") REFERENCES "public"."tbpresenze_codici"("codice");



ALTER TABLE ONLY "public"."tbpresenze_dipendenti"
    ADD CONSTRAINT "tbpresenze_dipendenti_inserito_da_fkey" FOREIGN KEY ("inserito_da") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbpresenze_dipendenti"
    ADD CONSTRAINT "tbpresenze_dipendenti_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpresenze_dipendenti"
    ADD CONSTRAINT "tbpresenze_dipendenti_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpresenze_smart_calendario"
    ADD CONSTRAINT "tbpresenze_smart_calendario_gruppo_id_fkey" FOREIGN KEY ("gruppo_id") REFERENCES "public"."tbpresenze_smart_gruppi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpresenze_smart_calendario"
    ADD CONSTRAINT "tbpresenze_smart_calendario_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpresenze_smart_cambi_turno"
    ADD CONSTRAINT "tbpresenze_smart_cambi_turno_gruppo_id_fkey" FOREIGN KEY ("gruppo_id") REFERENCES "public"."tbpresenze_smart_gruppi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpresenze_smart_cambi_turno"
    ADD CONSTRAINT "tbpresenze_smart_cambi_turno_richiedente_id_fkey" FOREIGN KEY ("richiedente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpresenze_smart_cambi_turno"
    ADD CONSTRAINT "tbpresenze_smart_cambi_turno_sostituto_id_fkey" FOREIGN KEY ("sostituto_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbpresenze_smart_gruppi_utenti"
    ADD CONSTRAINT "tbpresenze_smart_gruppi_utenti_gruppo_id_fkey" FOREIGN KEY ("gruppo_id") REFERENCES "public"."tbpresenze_smart_gruppi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpresenze_smart_gruppi_utenti"
    ADD CONSTRAINT "tbpresenze_smart_gruppi_utenti_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbprestazioni"
    ADD CONSTRAINT "tbprestazioni_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpromemoria"
    ADD CONSTRAINT "tbpromemoria_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbpromemoria"
    ADD CONSTRAINT "tbpromemoria_operatore_id_fkey" FOREIGN KEY ("operatore_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpromemoria"
    ADD CONSTRAINT "tbpromemoria_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbpromemoria"
    ADD CONSTRAINT "tbpromemoria_tipo_promemoria_id_fkey" FOREIGN KEY ("tipo_promemoria_id") REFERENCES "public"."tbtipopromemoria"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tbreferimenti_valori"
    ADD CONSTRAINT "tbreferimenti_valori_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbRespAV"
    ADD CONSTRAINT "tbrespav_societa_id_fkey" FOREIGN KEY ("societa_id") REFERENCES "public"."tbRespAVSocieta"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbrevisione_checklist"
    ADD CONSTRAINT "tbrevisione_checklist_controllo_id_fkey" FOREIGN KEY ("controllo_id") REFERENCES "public"."tbrevisione_controlli"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbrevisione_controlli"
    ADD CONSTRAINT "tbrevisione_controlli_completato_da_fkey" FOREIGN KEY ("completato_da") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbrevisione_controlli"
    ADD CONSTRAINT "tbrevisione_controlli_incarico_id_fkey" FOREIGN KEY ("incarico_id") REFERENCES "public"."tbrevisione_incarichi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbrevisione_documenti"
    ADD CONSTRAINT "tbrevisione_documenti_controllo_id_fkey" FOREIGN KEY ("controllo_id") REFERENCES "public"."tbrevisione_controlli"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbrevisione_documenti"
    ADD CONSTRAINT "tbrevisione_documenti_generato_da_fkey" FOREIGN KEY ("generato_da") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbrevisione_documenti"
    ADD CONSTRAINT "tbrevisione_documenti_relazione_id_fkey" FOREIGN KEY ("relazione_id") REFERENCES "public"."tbrevisione_relazioni"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbrevisione_followup"
    ADD CONSTRAINT "tbrevisione_followup_controllo_id_fkey" FOREIGN KEY ("controllo_id") REFERENCES "public"."tbrevisione_controlli"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbrevisione_incarichi"
    ADD CONSTRAINT "tbrevisione_incarichi_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbrevisione_incarichi"
    ADD CONSTRAINT "tbrevisione_incarichi_responsabile_id_fkey" FOREIGN KEY ("responsabile_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbrevisione_relazioni"
    ADD CONSTRAINT "tbrevisione_relazioni_controllo_id_fkey" FOREIGN KEY ("controllo_id") REFERENCES "public"."tbrevisione_controlli"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbrevisione_relazioni"
    ADD CONSTRAINT "tbrevisione_relazioni_generata_da_fkey" FOREIGN KEY ("generata_da") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbrevisione_soggetti"
    ADD CONSTRAINT "tbrevisione_soggetti_incarico_id_fkey" FOREIGN KEY ("incarico_id") REFERENCES "public"."tbrevisione_incarichi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbroperatore"
    ADD CONSTRAINT "tbroperatore_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_professionista_payroll_id_fkey" FOREIGN KEY ("professionista_payroll_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_utente_payroll_id_fkey" FOREIGN KEY ("utente_payroll_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscad770"
    ADD CONSTRAINT "tbscad770_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadbilanci"
    ADD CONSTRAINT "tbscadbilanci_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadbilanci"
    ADD CONSTRAINT "tbscadbilanci_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadbilanci"
    ADD CONSTRAINT "tbscadbilanci_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadbilanci"
    ADD CONSTRAINT "tbscadbilanci_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadbilanci"
    ADD CONSTRAINT "tbscadbilanci_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadbilanci"
    ADD CONSTRAINT "tbscadbilanci_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadccgg"
    ADD CONSTRAINT "tbscadccgg_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadccgg"
    ADD CONSTRAINT "tbscadccgg_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadccgg"
    ADD CONSTRAINT "tbscadccgg_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadccgg"
    ADD CONSTRAINT "tbscadccgg_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadccgg"
    ADD CONSTRAINT "tbscadccgg_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadccgg"
    ADD CONSTRAINT "tbscadccgg_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadcu"
    ADD CONSTRAINT "tbscadcu_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadcu"
    ADD CONSTRAINT "tbscadcu_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadcu"
    ADD CONSTRAINT "tbscadcu_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadcu"
    ADD CONSTRAINT "tbscadcu_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadcu"
    ADD CONSTRAINT "tbscadcu_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadcu"
    ADD CONSTRAINT "tbscadcu_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadenze_alert_log"
    ADD CONSTRAINT "tbscadenze_alert_log_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadenze_alert_log"
    ADD CONSTRAINT "tbscadenze_alert_log_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadenze_centrale_alert_log"
    ADD CONSTRAINT "tbscadenze_centrale_alert_log_destinatario_utente_fkey" FOREIGN KEY ("destinatario_utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadenze_centrale_alert_log"
    ADD CONSTRAINT "tbscadenze_centrale_alert_operatore_fkey" FOREIGN KEY ("operatore_responsabile_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadenze_centrale_alert_log"
    ADD CONSTRAINT "tbscadenze_centrale_alert_scadenza_fkey" FOREIGN KEY ("scadenza_id") REFERENCES "public"."tbscadenze_centrale"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadenze_centrale_alert_log"
    ADD CONSTRAINT "tbscadenze_centrale_alert_studio_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadenze_centrale"
    ADD CONSTRAINT "tbscadenze_centrale_cliente_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadenze_centrale_destinatari"
    ADD CONSTRAINT "tbscadenze_centrale_destinatari_scadenza_fkey" FOREIGN KEY ("scadenza_id") REFERENCES "public"."tbscadenze_centrale"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadenze_centrale_destinatari"
    ADD CONSTRAINT "tbscadenze_centrale_destinatari_studio_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadenze_centrale_destinatari"
    ADD CONSTRAINT "tbscadenze_centrale_destinatari_utente_fkey" FOREIGN KEY ("utente_id") REFERENCES "public"."tbutenti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadenze_centrale"
    ADD CONSTRAINT "tbscadenze_centrale_operatore_fkey" FOREIGN KEY ("operatore_responsabile_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadenze_centrale"
    ADD CONSTRAINT "tbscadenze_centrale_studio_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadestero"
    ADD CONSTRAINT "tbscadestero_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadestero"
    ADD CONSTRAINT "tbscadestero_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadestero"
    ADD CONSTRAINT "tbscadestero_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadestero"
    ADD CONSTRAINT "tbscadestero_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadestero"
    ADD CONSTRAINT "tbscadestero_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadestero"
    ADD CONSTRAINT "tbscadestero_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadfiscali"
    ADD CONSTRAINT "tbscadfiscali_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadfiscali"
    ADD CONSTRAINT "tbscadfiscali_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadfiscali"
    ADD CONSTRAINT "tbscadfiscali_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadfiscali"
    ADD CONSTRAINT "tbscadfiscali_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadfiscali"
    ADD CONSTRAINT "tbscadfiscali_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadfiscali"
    ADD CONSTRAINT "tbscadfiscali_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadimu"
    ADD CONSTRAINT "tbscadimu_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadimu"
    ADD CONSTRAINT "tbscadimu_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadimu"
    ADD CONSTRAINT "tbscadimu_operatore_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadimu"
    ADD CONSTRAINT "tbscadimu_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadiva"
    ADD CONSTRAINT "tbscadiva_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadiva"
    ADD CONSTRAINT "tbscadiva_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadiva"
    ADD CONSTRAINT "tbscadiva_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadiva"
    ADD CONSTRAINT "tbscadiva_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadiva"
    ADD CONSTRAINT "tbscadiva_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadiva"
    ADD CONSTRAINT "tbscadiva_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbscadlipe"
    ADD CONSTRAINT "tbscadlipe_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadlipe"
    ADD CONSTRAINT "tbscadlipe_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadlipe"
    ADD CONSTRAINT "tbscadlipe_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadlipe"
    ADD CONSTRAINT "tbscadlipe_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadlipe"
    ADD CONSTRAINT "tbscadlipe_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadlipe"
    ADD CONSTRAINT "tbscadlipe_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadproforma"
    ADD CONSTRAINT "tbscadproforma_archiviato_da_fkey" FOREIGN KEY ("archiviato_da") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadproforma"
    ADD CONSTRAINT "tbscadproforma_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadproforma"
    ADD CONSTRAINT "tbscadproforma_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbscadproforma"
    ADD CONSTRAINT "tbscadproforma_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadproforma"
    ADD CONSTRAINT "tbscadproforma_utente_operatore_id_fkey" FOREIGN KEY ("utente_operatore_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbscadproforma"
    ADD CONSTRAINT "tbscadproforma_utente_professionista_id_fkey" FOREIGN KEY ("utente_professionista_id") REFERENCES "public"."tbutenti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbsoftware_pagamenti"
    ADD CONSTRAINT "tbsoftware_pagamenti_licenza_id_fkey" FOREIGN KEY ("licenza_id") REFERENCES "public"."tbsoftware_licenze"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbsoftware_rinnovi"
    ADD CONSTRAINT "tbsoftware_rinnovi_licenza_id_fkey" FOREIGN KEY ("licenza_id") REFERENCES "public"."tbsoftware_licenze"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbtipi_scadenze_alert"
    ADD CONSTRAINT "tbtipi_scadenze_alert_tipo_scadenza_id_fkey" FOREIGN KEY ("tipo_scadenza_id") REFERENCES "public"."tbtipi_scadenze"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbtipi_scadenze_alert"
    ADD CONSTRAINT "tbtipi_scadenze_alert_utente_invio_id_fkey" FOREIGN KEY ("utente_invio_id") REFERENCES "public"."tbutenti"("id");



ALTER TABLE ONLY "public"."tbtipi_scadenze"
    ADD CONSTRAINT "tbtipi_scadenze_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbtipopromemoria"
    ADD CONSTRAINT "tbtipopromemoria_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbutenti"
    ADD CONSTRAINT "tbutenti_microsoft_connection_id_fkey" FOREIGN KEY ("microsoft_connection_id") REFERENCES "public"."microsoft365_connections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbutenti"
    ADD CONSTRAINT "tbutenti_ruolo_operatore_id_fkey" FOREIGN KEY ("ruolo_operatore_id") REFERENCES "public"."tbroperatore"("id");



ALTER TABLE ONLY "public"."tbutenti"
    ADD CONSTRAINT "tbutenti_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."tbstudio"("id");



ALTER TABLE ONLY "public"."tbverifiche_titolare_effettivo"
    ADD CONSTRAINT "tbverifiche_te_cliente_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."tbclienti"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tbverifiche_titolare_effettivo_righe"
    ADD CONSTRAINT "tbverifiche_te_righe_persona_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."tbclienti"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tbverifiche_titolare_effettivo_righe"
    ADD CONSTRAINT "tbverifiche_te_righe_verifica_fk" FOREIGN KEY ("verifica_id") REFERENCES "public"."tbverifiche_titolare_effettivo"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can create reset tokens" ON "public"."password_reset_tokens" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tbutenti"
  WHERE (("tbutenti"."email" = ("auth"."jwt"() ->> 'email'::"text")) AND ("tbutenti"."tipo_utente" = 'Admin'::"text")))));



CREATE POLICY "Admin can delete tipo promemoria" ON "public"."tbtipopromemoria" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Admin can insert tipo promemoria" ON "public"."tbtipopromemoria" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Admin can manage prestazioni" ON "public"."tbprestazioni" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Admin can manage roles" ON "public"."tbroperatore" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Admin can manage studio" ON "public"."tbstudio" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Admin can manage utenti" ON "public"."tbutenti" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Admin can update own reset tokens" ON "public"."password_reset_tokens" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."tbutenti"
  WHERE (("tbutenti"."email" = ("auth"."jwt"() ->> 'email'::"text")) AND ("tbutenti"."tipo_utente" = 'Admin'::"text")))));



CREATE POLICY "Admin can update tipo promemoria" ON "public"."tbtipopromemoria" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Admin can view own reset tokens" ON "public"."password_reset_tokens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tbutenti"
  WHERE (("tbutenti"."email" = ("auth"."jwt"() ->> 'email'::"text")) AND ("tbutenti"."tipo_utente" = 'Admin'::"text")))));



CREATE POLICY "Allow authenticated insert tipi atto" ON "public"."tbcontenzioso_tipi_atto" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read tipi atto" ON "public"."tbcontenzioso_tipi_atto" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update tipi atto" ON "public"."tbcontenzioso_tipi_atto" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can view prestazioni" ON "public"."tbprestazioni" FOR SELECT USING (true);



CREATE POLICY "Anyone can view roles" ON "public"."tbroperatore" FOR SELECT USING (true);



CREATE POLICY "Anyone can view studio" ON "public"."tbstudio" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can delete all credentials" ON "public"."tbcredenziali_accesso" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert credentials" ON "public"."tbcredenziali_accesso" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can update all credentials" ON "public"."tbcredenziali_accesso" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view all credentials" ON "public"."tbcredenziali_accesso" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Consenti gestione processo contenzioso" ON "public"."tbcontenzioso_processo" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Consenti gestione pvc contenzioso" ON "public"."tbcontenzioso_pvc" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Consenti gestione scadenze generate contenzioso" ON "public"."tbcontenzioso_scadenze_generate" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Consenti lettura tributi constatazione" ON "public"."tbcontenzioso_tributi_constatazione" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Gestione cassetti fiscali" ON "public"."tbcassetti_fiscali" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Gli utenti possono leggere la config del proprio studio" ON "public"."microsoft365_config" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Solo gli admin possono inserire/aggiornare la config" ON "public"."microsoft365_config" USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE (("tbutenti"."id" = "auth"."uid"()) AND ("tbutenti"."tipo_utente" = 'Admin'::"text"))))) WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE (("tbutenti"."id" = "auth"."uid"()) AND ("tbutenti"."tipo_utente" = 'Admin'::"text")))));



CREATE POLICY "Studio members can delete clients" ON "public"."tbclienti" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can delete contacts" ON "public"."tbcontatti" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can delete fiscali" ON "public"."tbscadfiscali" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can delete imu" ON "public"."tbscadimu" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can delete iva" ON "public"."tbscadiva" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can delete messages" ON "public"."tbmessaggi" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can delete promemoria" ON "public"."tbpromemoria" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can insert clients" ON "public"."tbclienti" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can insert contacts" ON "public"."tbcontatti" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can insert fiscali" ON "public"."tbscadfiscali" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can insert imu" ON "public"."tbscadimu" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can insert iva" ON "public"."tbscadiva" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can insert messages" ON "public"."tbmessaggi" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can insert promemoria" ON "public"."tbpromemoria" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can update clients" ON "public"."tbclienti" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can update contacts" ON "public"."tbcontatti" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can update fiscali" ON "public"."tbscadfiscali" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can update imu" ON "public"."tbscadimu" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can update iva" ON "public"."tbscadiva" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can update messages" ON "public"."tbmessaggi" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can update promemoria" ON "public"."tbpromemoria" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can view clients" ON "public"."tbclienti" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can view contacts" ON "public"."tbcontatti" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can view fiscali" ON "public"."tbscadfiscali" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can view imu" ON "public"."tbscadimu" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can view iva" ON "public"."tbscadiva" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can view messages" ON "public"."tbmessaggi" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Studio members can view promemoria" ON "public"."tbpromemoria" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "System can insert reminders" ON "public"."event_reminders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Tutti possono gestire bilanci" ON "public"."tbscadbilanci" USING (true) WITH CHECK (true);



CREATE POLICY "Tutti possono visualizzare tbscadlipe" ON "public"."tbscadlipe" FOR SELECT USING (true);



CREATE POLICY "Users can add attachments to their messages" ON "public"."tbmessaggi_allegati" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tbmessaggi" "m"
  WHERE (("m"."id" = "tbmessaggi_allegati"."messaggio_id") AND ("m"."mittente_id" = "auth"."uid"())))));



CREATE POLICY "Users can create conversations in their studio" ON "public"."tbconversazioni" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("studio_id" IN ( SELECT "tbconversazioni"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"())))));



COMMENT ON POLICY "Users can create conversations in their studio" ON "public"."tbconversazioni" IS 'Allows users to create conversations within their studio';



CREATE POLICY "Users can delete 770 schedules" ON "public"."tbscad770" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can delete IMU records for their studio clients" ON "public"."tbscadimu" FOR DELETE USING (("id" IN ( SELECT "c"."id"
   FROM ("public"."tbclienti" "c"
     JOIN "public"."tbutenti" "u" ON (("u"."id" = "auth"."uid"())))
  WHERE ("c"."id" = "tbscadimu"."id"))));



CREATE POLICY "Users can delete studio clients" ON "public"."tbclienti" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete studio communications" ON "public"."tbcomunicazioni" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete studio contacts" ON "public"."tbcontatti" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete studio credentials" ON "public"."tbcredenziali_accesso" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete studio reference values" ON "public"."tbreferimenti_valori" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete studio reminder types" ON "public"."tbtipopromemoria" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete studio roles" ON "public"."tbroperatore" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete studio services" ON "public"."tbprestazioni" FOR DELETE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete tbscadestero records" ON "public"."tbscadestero" FOR DELETE USING (true);



CREATE POLICY "Users can delete their attachments" ON "public"."tbmessaggi_allegati" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."tbmessaggi" "m"
  WHERE (("m"."id" = "tbmessaggi_allegati"."messaggio_id") AND ("m"."mittente_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own conversations" ON "public"."tbconversazioni" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "creato_da"));



COMMENT ON POLICY "Users can delete their own conversations" ON "public"."tbconversazioni" IS 'Allows users to delete only conversations they created';



CREATE POLICY "Users can delete their own messages" ON "public"."tbmessaggi" FOR DELETE USING (("mittente_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own promemoria" ON "public"."tbpromemoria" FOR DELETE USING (("auth"."uid"() = "operatore_id"));



CREATE POLICY "Users can delete their own tokens" ON "public"."tbmicrosoft_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their studio's tipi scadenze" ON "public"."tbtipi_scadenze" FOR DELETE USING (("studio_id" IN ( SELECT "tbtipi_scadenze"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert 770 schedules" ON "public"."tbscad770" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert IMU records for their studio clients" ON "public"."tbscadimu" FOR INSERT WITH CHECK (("id" IN ( SELECT "c"."id"
   FROM ("public"."tbclienti" "c"
     JOIN "public"."tbutenti" "u" ON (("u"."id" = "auth"."uid"())))
  WHERE ("c"."id" = "tbscadimu"."id"))));



CREATE POLICY "Users can insert alert logs" ON "public"."tbtipi_scadenze_alert" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert confirmations" ON "public"."event_confirmations" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert studio clients" ON "public"."tbclienti" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert studio communications" ON "public"."tbcomunicazioni" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert studio contacts" ON "public"."tbcontatti" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert studio credentials" ON "public"."tbcredenziali_accesso" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert studio reference values" ON "public"."tbreferimenti_valori" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert studio reminder types" ON "public"."tbtipopromemoria" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert studio roles" ON "public"."tbroperatore" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert studio services" ON "public"."tbprestazioni" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert tbscadestero records" ON "public"."tbscadestero" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own promemoria" ON "public"."tbpromemoria" FOR INSERT WITH CHECK (("auth"."uid"() = "operatore_id"));



CREATE POLICY "Users can insert their own tokens" ON "public"."tbmicrosoft_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert tipi scadenze for their studio" ON "public"."tbtipi_scadenze" FOR INSERT WITH CHECK (("studio_id" IN ( SELECT "tbtipi_scadenze"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage calendar mappings" ON "public"."tbmicrosoft_calendar_mappings" USING ((EXISTS ( SELECT 1
   FROM "public"."tbagenda"
  WHERE (("tbagenda"."id" = "tbmicrosoft_calendar_mappings"."evento_id") AND ("tbagenda"."utente_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage clienti" ON "public"."tbclienti" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage comunicazioni" ON "public"."tbcomunicazioni" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage contatti" ON "public"."tbcontatti" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage eventi" ON "public"."tbagenda" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage scadenze ccgg" ON "public"."tbscadccgg" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage scadenze cu" ON "public"."tbscadcu" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage scadenze fiscali" ON "public"."tbscadfiscali" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage scadenze iva" ON "public"."tbscadiva" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage their own settings" ON "public"."tbmicrosoft_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own tokens" ON "public"."tbmicrosoft_tokens" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can send messages in their conversations" ON "public"."tbmessaggi" FOR INSERT WITH CHECK ((("conversazione_id" IN ( SELECT "tbconversazioni_utenti"."conversazione_id"
   FROM "public"."tbconversazioni_utenti"
  WHERE ("tbconversazioni_utenti"."utente_id" = "auth"."uid"()))) AND ("mittente_id" = "auth"."uid"())));



CREATE POLICY "Users can update 770 schedules" ON "public"."tbscad770" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can update IMU records for their studio clients" ON "public"."tbscadimu" FOR UPDATE USING (("id" IN ( SELECT "c"."id"
   FROM ("public"."tbclienti" "c"
     JOIN "public"."tbutenti" "u" ON (("u"."id" = "auth"."uid"())))
  WHERE ("c"."id" = "tbscadimu"."id"))));



CREATE POLICY "Users can update conversations in their studio" ON "public"."tbconversazioni" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() IS NOT NULL) AND ("studio_id" IN ( SELECT "tbconversazioni"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"())))));



COMMENT ON POLICY "Users can update conversations in their studio" ON "public"."tbconversazioni" IS 'Allows users to update conversations within their studio';



CREATE POLICY "Users can update promemoria as operator, recipient or sector re" ON "public"."tbpromemoria" FOR UPDATE USING ((("auth"."uid"() = "operatore_id") OR ("auth"."uid"() = "destinatario_id") OR (EXISTS ( SELECT 1
   FROM "public"."tbutenti"
  WHERE (("tbutenti"."id" = "auth"."uid"()) AND ("tbutenti"."responsabile" = true) AND ("tbutenti"."settore" = "tbpromemoria"."settore"))))));



CREATE POLICY "Users can update studio clients" ON "public"."tbclienti" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update studio communications" ON "public"."tbcomunicazioni" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update studio contacts" ON "public"."tbcontatti" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update studio credentials" ON "public"."tbcredenziali_accesso" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update studio reference values" ON "public"."tbreferimenti_valori" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update studio reminder types" ON "public"."tbtipopromemoria" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update studio roles" ON "public"."tbroperatore" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update studio services" ON "public"."tbprestazioni" FOR UPDATE USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update tbscadestero records" ON "public"."tbscadestero" FOR UPDATE USING (true);



CREATE POLICY "Users can update their own confirmations" ON "public"."event_confirmations" FOR UPDATE USING (true);



CREATE POLICY "Users can update their own messages" ON "public"."tbmessaggi" FOR UPDATE USING (("mittente_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own tokens" ON "public"."tbmicrosoft_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their studio's tipi scadenze" ON "public"."tbtipi_scadenze" FOR UPDATE USING (("studio_id" IN ( SELECT "tbtipi_scadenze"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view 770 schedules" ON "public"."tbscad770" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view IMU records for their studio clients" ON "public"."tbscadimu" FOR SELECT USING (("id" IN ( SELECT "c"."id"
   FROM ("public"."tbclienti" "c"
     JOIN "public"."tbutenti" "u" ON (("u"."id" = "auth"."uid"())))
  WHERE ("c"."id" = "tbscadimu"."id"))));



CREATE POLICY "Users can view alert logs" ON "public"."tbtipi_scadenze_alert" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view all clienti" ON "public"."tbclienti" FOR SELECT USING (true);



CREATE POLICY "Users can view all comunicazioni" ON "public"."tbcomunicazioni" FOR SELECT USING (true);



CREATE POLICY "Users can view all contatti" ON "public"."tbcontatti" FOR SELECT USING (true);



CREATE POLICY "Users can view all scadenze ccgg" ON "public"."tbscadccgg" FOR SELECT USING (true);



CREATE POLICY "Users can view all scadenze cu" ON "public"."tbscadcu" FOR SELECT USING (true);



CREATE POLICY "Users can view all scadenze fiscali" ON "public"."tbscadfiscali" FOR SELECT USING (true);



CREATE POLICY "Users can view all scadenze iva" ON "public"."tbscadiva" FOR SELECT USING (true);



CREATE POLICY "Users can view all tbscadestero records" ON "public"."tbscadestero" FOR SELECT USING (true);



CREATE POLICY "Users can view all utenti" ON "public"."tbutenti" FOR SELECT USING (true);



CREATE POLICY "Users can view attachments of their messages" ON "public"."tbmessaggi_allegati" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tbmessaggi" "m"
  WHERE (("m"."id" = "tbmessaggi_allegati"."messaggio_id") AND "public"."is_chat_participant"("m"."conversazione_id")))));



CREATE POLICY "Users can view confirmations for their events" ON "public"."event_confirmations" FOR SELECT USING (true);



CREATE POLICY "Users can view conversations in their studio" ON "public"."tbconversazioni" FOR SELECT TO "authenticated" USING ((("auth"."uid"() IS NOT NULL) AND ("studio_id" IN ( SELECT "tbconversazioni"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"())))));



COMMENT ON POLICY "Users can view conversations in their studio" ON "public"."tbconversazioni" IS 'Allows users to view all conversations within their studio';



CREATE POLICY "Users can view eventi in their studio" ON "public"."tbagenda" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view messages in their conversations" ON "public"."tbmessaggi" FOR SELECT USING (("conversazione_id" IN ( SELECT "tbconversazioni_utenti"."conversazione_id"
   FROM "public"."tbconversazioni_utenti"
  WHERE ("tbconversazioni_utenti"."utente_id" = "auth"."uid"()))));



CREATE POLICY "Users can view messages of their conversations" ON "public"."tbmessaggi" FOR SELECT USING ("public"."is_chat_participant"("conversazione_id"));



CREATE POLICY "Users can view promemoria based on role" ON "public"."tbpromemoria" FOR SELECT USING ((("auth"."uid"() = "operatore_id") OR ("auth"."uid"() = "destinatario_id") OR (EXISTS ( SELECT 1
   FROM "public"."tbutenti"
  WHERE (("tbutenti"."id" = "auth"."uid"()) AND ("tbutenti"."responsabile" = true) AND ("tbutenti"."settore" = "tbpromemoria"."settore"))))));



COMMENT ON POLICY "Users can view promemoria based on role" ON "public"."tbpromemoria" IS 'Filtro automatico: Responsabili vedono tutto il loro settore, utenti generici solo i propri promemoria';



CREATE POLICY "Users can view reminders" ON "public"."event_reminders" FOR SELECT USING (true);



CREATE POLICY "Users can view their own tokens" ON "public"."tbmicrosoft_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their studio clients" ON "public"."tbclienti" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their studio communications" ON "public"."tbcomunicazioni" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their studio contacts" ON "public"."tbcontatti" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their studio credentials" ON "public"."tbcredenziali_accesso" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their studio reference values" ON "public"."tbreferimenti_valori" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their studio reminder types" ON "public"."tbtipopromemoria" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their studio roles" ON "public"."tbroperatore" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their studio services" ON "public"."tbprestazioni" FOR SELECT USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their studio's tipi scadenze" ON "public"."tbtipi_scadenze" FOR SELECT USING (("studio_id" IN ( SELECT "tbtipi_scadenze"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view tipo promemoria" ON "public"."tbtipopromemoria" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti autenticati possono aggiornare tbscadlipe" ON "public"."tbscadlipe" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti autenticati possono eliminare tbscadlipe" ON "public"."tbscadlipe" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti autenticati possono inserire tbscadlipe" ON "public"."tbscadlipe" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti possono aggiornare scadenze Proforma" ON "public"."tbscadproforma" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti possono eliminare scadenze Proforma" ON "public"."tbscadproforma" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti possono eliminare valori riferimenti" ON "public"."tbreferimenti_valori" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti possono inserire scadenze Proforma" ON "public"."tbscadproforma" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti possono inserire valori riferimenti" ON "public"."tbreferimenti_valori" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti possono vedere scadenze Proforma" ON "public"."tbscadproforma" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Utenti possono vedere valori riferimenti" ON "public"."tbreferimenti_valori" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "admin_vendite_read_licenze" ON "public"."tbsoftware_licenze" FOR SELECT USING (true);



CREATE POLICY "admin_vendite_read_pagamenti" ON "public"."tbsoftware_pagamenti" FOR SELECT USING (true);



CREATE POLICY "allow all adesione" ON "public"."tbcontenzioso_adesione" USING (true) WITH CHECK (true);



CREATE POLICY "allow all cassazione" ON "public"."tbcontenzioso_cassazione" USING (true) WITH CHECK (true);



CREATE POLICY "allow all interpello" ON "public"."tbcontenzioso_interpello" USING (true) WITH CHECK (true);



CREATE POLICY "allow all primo grado" ON "public"."tbcontenzioso_ricorso_primo_grado" USING (true) WITH CHECK (true);



CREATE POLICY "allow all schema atto" ON "public"."tbcontenzioso_schema_atto" USING (true) WITH CHECK (true);



CREATE POLICY "allow all secondo grado" ON "public"."tbcontenzioso_ricorso_secondo_grado" USING (true) WITH CHECK (true);



CREATE POLICY "allow_delete_conversations" ON "public"."tbconversazioni" FOR DELETE TO "authenticated" USING (("creato_da" = "auth"."uid"()));



CREATE POLICY "allow_delete_partecipanti" ON "public"."tbconversazioni_utenti" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tbconversazioni" "c"
  WHERE (("c"."id" = "tbconversazioni_utenti"."conversazione_id") AND ("c"."studio_id" IN ( SELECT "c"."studio_id"
           FROM "public"."tbutenti"
          WHERE ("tbutenti"."id" = "auth"."uid"())))))));



COMMENT ON POLICY "allow_delete_partecipanti" ON "public"."tbconversazioni_utenti" IS 'Allows users to remove participants from conversations in their studio';



CREATE POLICY "allow_insert_conversazioni" ON "public"."tbconversazioni" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("studio_id" IS NOT NULL) AND (("tipo" = 'diretta'::"text") OR (("tipo" = 'gruppo'::"text") AND ("creato_da" = "auth"."uid"())))));



COMMENT ON POLICY "allow_insert_conversazioni" ON "public"."tbconversazioni" IS 'Allows authenticated users to create conversations where they are participants';



CREATE POLICY "allow_insert_partecipanti" ON "public"."tbconversazioni_utenti" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tbconversazioni" "c"
  WHERE (("c"."id" = "tbconversazioni_utenti"."conversazione_id") AND ("c"."studio_id" IN ( SELECT "c"."studio_id"
           FROM "public"."tbutenti"
          WHERE ("tbutenti"."id" = "auth"."uid"())))))));



COMMENT ON POLICY "allow_insert_partecipanti" ON "public"."tbconversazioni_utenti" IS 'Allows authenticated users to add participants to conversations in their studio';



CREATE POLICY "allow_insert_participants" ON "public"."tbconversazioni_utenti" FOR INSERT TO "authenticated" WITH CHECK (("utente_id" = "auth"."uid"()));



CREATE POLICY "allow_select_conversations" ON "public"."tbconversazioni" FOR SELECT TO "authenticated" USING ("public"."is_chat_participant"("id"));



CREATE POLICY "allow_select_partecipanti" ON "public"."tbconversazioni_utenti" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tbconversazioni" "c"
  WHERE (("c"."id" = "tbconversazioni_utenti"."conversazione_id") AND ("c"."studio_id" IN ( SELECT "c"."studio_id"
           FROM "public"."tbutenti"
          WHERE ("tbutenti"."id" = "auth"."uid"())))))));



COMMENT ON POLICY "allow_select_partecipanti" ON "public"."tbconversazioni_utenti" IS 'Allows users to view participants of conversations in their studio';



CREATE POLICY "allow_select_participants" ON "public"."tbconversazioni_utenti" FOR SELECT TO "authenticated" USING ("public"."is_chat_participant"("conversazione_id"));



CREATE POLICY "allow_update_conversations" ON "public"."tbconversazioni" FOR UPDATE TO "authenticated" USING ("public"."is_chat_participant"("id"));



CREATE POLICY "allow_update_partecipanti" ON "public"."tbconversazioni_utenti" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tbconversazioni" "c"
  WHERE (("c"."id" = "tbconversazioni_utenti"."conversazione_id") AND ("c"."studio_id" IN ( SELECT "c"."studio_id"
           FROM "public"."tbutenti"
          WHERE ("tbutenti"."id" = "auth"."uid"())))))));



COMMENT ON POLICY "allow_update_partecipanti" ON "public"."tbconversazioni_utenti" IS 'Allows users to update participants of conversations in their studio';



CREATE POLICY "allow_update_participants" ON "public"."tbconversazioni_utenti" FOR UPDATE TO "authenticated" USING (("utente_id" = "auth"."uid"()));



CREATE POLICY "allow_users_view_own_conversations" ON "public"."tbconversazioni_utenti" FOR SELECT TO "authenticated" USING (("utente_id" = "auth"."uid"()));



CREATE POLICY "authenticated_all" ON "public"."tbAMLComunicazioni" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbAV1" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbAV4" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbAV4_titolari" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbAVFascicoliDocumenti" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbRespAV" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbcontatti_clienti" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbcontatti_relazioni" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbcontrollo_gestione" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbcontrollo_gestione_allegati" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbcontrollo_gestione_utenti" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."tbpratiche_modelli" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."backup_tbpromemoria_alert_20260603" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."backup_zz_tbpratiche_nominativi_old_20260603" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete contenzioso" ON "public"."tbcontenzioso_avvisi_bonari" FOR DELETE USING (true);



CREATE POLICY "delete sospensioni contenzioso" ON "public"."tbcontenzioso_sospensioni" FOR DELETE USING (true);



ALTER TABLE "public"."event_confirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_reminders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert avvisi bonari same studio" ON "public"."tbcontenzioso_avvisi_bonari" FOR INSERT TO "authenticated" WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "insert sospensioni contenzioso" ON "public"."tbcontenzioso_sospensioni" FOR INSERT WITH CHECK (true);



CREATE POLICY "insert tbPraticheAML authenticated" ON "public"."tbPraticheAML" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "insert tbPraticheAML authenticated temp" ON "public"."tbPraticheAML" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."microsoft365_calendar_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."microsoft365_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_read_av4_token" ON "public"."tbAV4" FOR SELECT TO "anon" USING (("public_enabled" = true));



CREATE POLICY "public_update_av4_token" ON "public"."tbAV4" FOR UPDATE TO "anon" USING (("public_token" IS NOT NULL)) WITH CHECK (true);



ALTER TABLE "public"."rapp_legali_backup_20260809" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rapp_legali_backup_20260811" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read regole scadenze" ON "public"."tbcontenzioso_regole_scadenze" FOR SELECT USING (true);



CREATE POLICY "read sospensioni contenzioso" ON "public"."tbcontenzioso_sospensioni" FOR SELECT USING (true);



CREATE POLICY "select avvisi bonari same studio" ON "public"."tbcontenzioso_avvisi_bonari" FOR SELECT TO "authenticated" USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "select richieste ferie permessi studio" ON "public"."tbferie_permessi_richieste" FOR SELECT TO "authenticated" USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



ALTER TABLE "public"."tbAMLComunicazioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbAMLComunicazioni_backup_rapp_legale_20260811" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbAV1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbAV4" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbAV4_titolari_backup_20260810" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbAVFascicoliAlert" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbAVFascicoliDocumenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbPraticheAML" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tbPraticheAML_delete_debug_all" ON "public"."tbPraticheAML" FOR DELETE USING (true);



CREATE POLICY "tbPraticheAML_insert_debug_all" ON "public"."tbPraticheAML" FOR INSERT WITH CHECK (true);



CREATE POLICY "tbPraticheAML_select_debug_all" ON "public"."tbPraticheAML" FOR SELECT USING (true);



CREATE POLICY "tbPraticheAML_update_debug_all" ON "public"."tbPraticheAML" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."tbRespAV" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbagenda" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbalert_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbassunzioni_allegati" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbassunzioni_richieste" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcassetti_fiscali" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti_accessi_pubblici" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti_backup_rapp_legale_20260809" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti_documenti_aml" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti_documenti_aml_backup_20260809" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tbclienti_documenti_aml_delete" ON "public"."tbclienti_documenti_aml" FOR DELETE TO "authenticated" USING (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"()))));



CREATE POLICY "tbclienti_documenti_aml_insert" ON "public"."tbclienti_documenti_aml" FOR INSERT TO "authenticated" WITH CHECK (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"()))));



CREATE POLICY "tbclienti_documenti_aml_select" ON "public"."tbclienti_documenti_aml" FOR SELECT TO "authenticated" USING (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"()))));



CREATE POLICY "tbclienti_documenti_aml_update" ON "public"."tbclienti_documenti_aml" FOR UPDATE TO "authenticated" USING (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"())))) WITH CHECK (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."tbclienti_flag_scadenzari_backup_20260810" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti_organi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti_organi_diritti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti_rapp_legale_backup_20260811" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbclienti_servizi" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tbclienti_servizi_delete" ON "public"."tbclienti_servizi" FOR DELETE TO "authenticated" USING (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"()))));



CREATE POLICY "tbclienti_servizi_insert" ON "public"."tbclienti_servizi" FOR INSERT TO "authenticated" WITH CHECK (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"()))));



CREATE POLICY "tbclienti_servizi_select" ON "public"."tbclienti_servizi" FOR SELECT TO "authenticated" USING (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"()))));



CREATE POLICY "tbclienti_servizi_update" ON "public"."tbclienti_servizi" FOR UPDATE TO "authenticated" USING (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"())))) WITH CHECK (("studio_id" IN ( SELECT "u"."studio_id"
   FROM "public"."tbutenti" "u"
  WHERE ("u"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."tbcomunicazioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontatti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontatti_clienti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontatti_relazioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_adesione" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_avvisi_bonari" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_cartelle" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_cassazione" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_codici_tributo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_esattoriale_tributi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_interpello" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_memorie" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_processo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_pvc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_regole_scadenze" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_ricorso_primo_grado" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_ricorso_secondo_grado" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_scadenze_generate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_schema_atto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_sospensioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_tipi_atto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontenzioso_tributi_constatazione" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontrollo_gestione" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontrollo_gestione_allegati" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontrollo_gestione_indici" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcontrollo_gestione_utenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbconversazioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbconversazioni_utenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcredenziali_accesso" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbcron_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbferie_permessi_richieste" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbmessaggi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbmessaggi_allegati" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbmicrosoft_calendar_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbmicrosoft_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbmicrosoft_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpayroll_qualifiche" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_assegnazioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_checklist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_checklist_template" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_dati_documenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_dicitura_documenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_distribuzione_utili" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_documenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_modelli" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_modelli_documenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_motivi_liquidazione" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_priorita" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_scadenze" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_soggetti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_stati" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_step" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_step_template" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_tipi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpratiche_variazioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpresenze_smart_calendario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpresenze_smart_cambi_turno" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpresenze_smart_gruppi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpresenze_smart_gruppi_utenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpresenze_solleciti_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbprestazioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbpromemoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbreferimenti_valori" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbrevisione_checklist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbrevisione_controlli" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbrevisione_documenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbrevisione_followup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbrevisione_incarichi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbrevisione_modelli" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbrevisione_relazioni" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbrevisione_soggetti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbroperatore" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscad770" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadbilanci" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadccgg" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadcu" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadenze_alert_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadenze_centrale" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadenze_centrale_alert_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadenze_centrale_destinatari" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadestero" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadfiscali" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadimu" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadiva" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadlipe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbscadproforma" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbsoftware_licenze" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbsoftware_pagamenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbsoftware_rinnovi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbstudio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbtipi_scadenze" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbtipi_scadenze_alert" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbtipopromemoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbutenti" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbverifiche_titolare_effettivo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tbverifiche_titolare_effettivo_righe" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update avvisi bonari same studio" ON "public"."tbcontenzioso_avvisi_bonari" FOR UPDATE TO "authenticated" USING (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."email" = ("auth"."jwt"() ->> 'email'::"text"))))) WITH CHECK (("studio_id" IN ( SELECT "tbutenti"."studio_id"
   FROM "public"."tbutenti"
  WHERE ("tbutenti"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "update regole scadenze" ON "public"."tbcontenzioso_regole_scadenze" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "update sospensioni contenzioso" ON "public"."tbcontenzioso_sospensioni" FOR UPDATE USING (true) WITH CHECK (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "github_schema_sync";



GRANT ALL ON FUNCTION "public"."aggiorna_giorni_residui_contenzioso"() TO "anon";
GRANT ALL ON FUNCTION "public"."aggiorna_giorni_residui_contenzioso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."aggiorna_giorni_residui_contenzioso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_set_studio_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_set_studio_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_set_studio_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcola_data_scad_pres"() TO "anon";
GRANT ALL ON FUNCTION "public"."calcola_data_scad_pres"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcola_data_scad_pres"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcola_giorni_restanti_contenzioso"() TO "anon";
GRANT ALL ON FUNCTION "public"."calcola_giorni_restanti_contenzioso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcola_giorni_restanti_contenzioso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcola_scadenza_cartella"() TO "anon";
GRANT ALL ON FUNCTION "public"."calcola_scadenza_cartella"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcola_scadenza_cartella"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcola_scadenza_con_sospensione"("data_base" "date", "giorni" integer, "direzione" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calcola_scadenza_con_sospensione"("data_base" "date", "giorni" integer, "direzione" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcola_scadenza_con_sospensione"("data_base" "date", "giorni" integer, "direzione" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calcola_scadenza_con_sospensione"("p_data_base" "date", "p_giorni" integer, "p_direzione" "text", "p_applica_sospensione" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."calcola_scadenza_con_sospensione"("p_data_base" "date", "p_giorni" integer, "p_direzione" "text", "p_applica_sospensione" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcola_scadenza_con_sospensione"("p_data_base" "date", "p_giorni" integer, "p_direzione" "text", "p_applica_sospensione" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."calcola_scadenza_contenzioso"() TO "anon";
GRANT ALL ON FUNCTION "public"."calcola_scadenza_contenzioso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcola_scadenza_contenzioso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcola_scadenze_tbpratiche_variazioni"() TO "anon";
GRANT ALL ON FUNCTION "public"."calcola_scadenze_tbpratiche_variazioni"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcola_scadenze_tbpratiche_variazioni"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_limite_societa_responsabili"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_limite_societa_responsabili"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_limite_societa_responsabili"() TO "service_role";



GRANT ALL ON FUNCTION "public"."completa_dati_scadenza_contenzioso"() TO "anon";
GRANT ALL ON FUNCTION "public"."completa_dati_scadenza_contenzioso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."completa_dati_scadenza_contenzioso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."genera_alert_contenzioso_base"() TO "anon";
GRANT ALL ON FUNCTION "public"."genera_alert_contenzioso_base"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."genera_alert_contenzioso_base"() TO "service_role";



GRANT ALL ON FUNCTION "public"."genera_rate_iniziali_software"("p_licenza_id" "uuid", "p_studio_id" "uuid", "p_data_attivazione" "date", "p_modalita" "text", "p_importo_totale" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."genera_rate_iniziali_software"("p_licenza_id" "uuid", "p_studio_id" "uuid", "p_data_attivazione" "date", "p_modalita" "text", "p_importo_totale" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."genera_rate_iniziali_software"("p_licenza_id" "uuid", "p_studio_id" "uuid", "p_data_attivazione" "date", "p_modalita" "text", "p_importo_totale" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."genera_scadenze_modulo_contenzioso"() TO "anon";
GRANT ALL ON FUNCTION "public"."genera_scadenze_modulo_contenzioso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."genera_scadenze_modulo_contenzioso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."genera_scadenze_processo"("p_processo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."genera_scadenze_processo"("p_processo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."genera_scadenze_processo"("p_processo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_cod_cliente"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_cod_cliente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_cod_cliente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_promemoria_badge_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_promemoria_badge_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_promemoria_badge_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_chat_participant"("_conversazione_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_participant"("_conversazione_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_participant"("_conversazione_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rigenera_scadenze_contenzioso_base"() TO "anon";
GRANT ALL ON FUNCTION "public"."rigenera_scadenze_contenzioso_base"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rigenera_scadenze_contenzioso_base"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rinnova_controllo_gestione"("p_controllo_id" "uuid", "p_data_esecuzione" "date", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_tbavfascicolidocumenti"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_tbavfascicolidocumenti"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_tbavfascicolidocumenti"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_destinatari_scadenza_centrale"("p_scadenza_id" "uuid", "p_studio_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_settore_fiscale" boolean, "p_settore_lavoro" boolean, "p_settore_consulenza" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_destinatari_scadenza_centrale"("p_scadenza_id" "uuid", "p_studio_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_settore_fiscale" boolean, "p_settore_lavoro" boolean, "p_settore_consulenza" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_destinatari_scadenza_centrale"("p_scadenza_id" "uuid", "p_studio_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_settore_fiscale" boolean, "p_settore_lavoro" boolean, "p_settore_consulenza" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenza_affitto_centrale"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenza_affitto_centrale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenza_affitto_centrale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenza_avviso_bonario"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenza_avviso_bonario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenza_avviso_bonario"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenza_cartella"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenza_cartella"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenza_cartella"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenza_contenzioso_centrale"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenza_contenzioso_centrale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenza_contenzioso_centrale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenza_tbclienti_organi"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenza_tbclienti_organi"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenza_tbclienti_organi"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenza_tbpraticheaml"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenza_tbpraticheaml"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenza_tbpraticheaml"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenze_adesione"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenze_adesione"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenze_adesione"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenze_cassazione"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenze_cassazione"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenze_cassazione"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenze_interpello"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenze_interpello"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenze_interpello"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenze_primo_grado"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenze_primo_grado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenze_primo_grado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenze_pvc"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenze_pvc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenze_pvc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenze_schema_atto"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenze_schema_atto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenze_schema_atto"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_scadenze_secondo_grado"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_scadenze_secondo_grado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_scadenze_secondo_grado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_tbdipendenti_from_utenti"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_tbdipendenti_from_utenti"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_tbdipendenti_from_utenti"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_tipo_scadenza_centrale"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_tipo_scadenza_centrale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_tipo_scadenza_centrale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_cassetti_force_studio"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_cassetti_force_studio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_cassetti_force_studio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_cassetti_fiscali_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_cassetti_fiscali_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_cassetti_fiscali_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_contenzioso_scadenza"("p_processo_id" "uuid", "p_modulo" "text", "p_modulo_record_id" "uuid", "p_tipo_scadenza" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_contenzioso_scadenza"("p_processo_id" "uuid", "p_modulo" "text", "p_modulo_record_id" "uuid", "p_tipo_scadenza" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_contenzioso_scadenza"("p_processo_id" "uuid", "p_modulo" "text", "p_modulo_record_id" "uuid", "p_tipo_scadenza" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_scadenza_centrale"("p_studio_id" "uuid", "p_cliente_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_origine_modulo" "text", "p_origine_tabella" "text", "p_origine_record_id" "uuid", "p_tipo_scadenza" "text", "p_titolo" "text", "p_descrizione" "text", "p_data_scadenza" "date", "p_link_dettaglio" "text", "p_metadati" "jsonb", "p_giorni_preavviso_1" integer, "p_giorni_preavviso_2" integer, "p_giorni_preavviso_3" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_scadenza_centrale"("p_studio_id" "uuid", "p_cliente_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_origine_modulo" "text", "p_origine_tabella" "text", "p_origine_record_id" "uuid", "p_tipo_scadenza" "text", "p_titolo" "text", "p_descrizione" "text", "p_data_scadenza" "date", "p_link_dettaglio" "text", "p_metadati" "jsonb", "p_giorni_preavviso_1" integer, "p_giorni_preavviso_2" integer, "p_giorni_preavviso_3" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_scadenza_centrale"("p_studio_id" "uuid", "p_cliente_id" "uuid", "p_operatore_responsabile_id" "uuid", "p_origine_modulo" "text", "p_origine_tabella" "text", "p_origine_record_id" "uuid", "p_tipo_scadenza" "text", "p_titolo" "text", "p_descrizione" "text", "p_data_scadenza" "date", "p_link_dettaglio" "text", "p_metadati" "jsonb", "p_giorni_preavviso_1" integer, "p_giorni_preavviso_2" integer, "p_giorni_preavviso_3" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo_record_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo_record_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_scadenza_contenzioso"("p_processo_id" "uuid", "p_modulo_record_id" "uuid", "p_modulo" "text", "p_codice" "text", "p_descrizione" "text", "p_data_scadenza" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."verifica_destinatario_scadenza_centrale"() TO "anon";
GRANT ALL ON FUNCTION "public"."verifica_destinatario_scadenza_centrale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verifica_destinatario_scadenza_centrale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verifica_tbclienti_servizi_studio"() TO "anon";
GRANT ALL ON FUNCTION "public"."verifica_tbclienti_servizi_studio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verifica_tbclienti_servizi_studio"() TO "service_role";



GRANT ALL ON TABLE "public"."backup_tbpromemoria_alert_20260603" TO "anon";
GRANT ALL ON TABLE "public"."backup_tbpromemoria_alert_20260603" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_tbpromemoria_alert_20260603" TO "service_role";
GRANT SELECT ON TABLE "public"."backup_tbpromemoria_alert_20260603" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."backup_zz_tbpratiche_nominativi_old_20260603" TO "anon";
GRANT ALL ON TABLE "public"."backup_zz_tbpratiche_nominativi_old_20260603" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_zz_tbpratiche_nominativi_old_20260603" TO "service_role";
GRANT SELECT ON TABLE "public"."backup_zz_tbpratiche_nominativi_old_20260603" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."cod_cliente_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cod_cliente_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cod_cliente_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."cod_cliente_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."event_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."event_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."event_confirmations" TO "service_role";
GRANT SELECT ON TABLE "public"."event_confirmations" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."event_reminders" TO "anon";
GRANT ALL ON TABLE "public"."event_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."event_reminders" TO "service_role";
GRANT SELECT ON TABLE "public"."event_reminders" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."microsoft365_calendar_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."microsoft365_calendar_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."microsoft365_calendar_subscriptions" TO "service_role";
GRANT SELECT ON TABLE "public"."microsoft365_calendar_subscriptions" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."microsoft365_config" TO "anon";
GRANT ALL ON TABLE "public"."microsoft365_config" TO "authenticated";
GRANT ALL ON TABLE "public"."microsoft365_config" TO "service_role";
GRANT SELECT ON TABLE "public"."microsoft365_config" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."microsoft365_connections" TO "anon";
GRANT ALL ON TABLE "public"."microsoft365_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."microsoft365_connections" TO "service_role";
GRANT SELECT ON TABLE "public"."microsoft365_connections" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "service_role";
GRANT SELECT ON TABLE "public"."password_reset_tokens" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."rapp_legali_backup_20260809" TO "anon";
GRANT ALL ON TABLE "public"."rapp_legali_backup_20260809" TO "authenticated";
GRANT ALL ON TABLE "public"."rapp_legali_backup_20260809" TO "service_role";
GRANT SELECT ON TABLE "public"."rapp_legali_backup_20260809" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."rapp_legali_backup_20260811" TO "anon";
GRANT ALL ON TABLE "public"."rapp_legali_backup_20260811" TO "authenticated";
GRANT ALL ON TABLE "public"."rapp_legali_backup_20260811" TO "service_role";
GRANT SELECT ON TABLE "public"."rapp_legali_backup_20260811" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAMLComunicazioni" TO "anon";
GRANT ALL ON TABLE "public"."tbAMLComunicazioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAMLComunicazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAMLComunicazioni" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAMLComunicazioni_backup_rapp_legale_20260811" TO "anon";
GRANT ALL ON TABLE "public"."tbAMLComunicazioni_backup_rapp_legale_20260811" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAMLComunicazioni_backup_rapp_legale_20260811" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAMLComunicazioni_backup_rapp_legale_20260811" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAV1" TO "anon";
GRANT ALL ON TABLE "public"."tbAV1" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAV1" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAV1" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbAV1_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbAV1_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbAV1_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbAV1_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAV2" TO "anon";
GRANT ALL ON TABLE "public"."tbAV2" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAV2" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAV2" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAV4" TO "anon";
GRANT ALL ON TABLE "public"."tbAV4" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAV4" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAV4" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAV4_titolari" TO "anon";
GRANT ALL ON TABLE "public"."tbAV4_titolari" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAV4_titolari" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAV4_titolari" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAV4_titolari_backup_20260810" TO "anon";
GRANT ALL ON TABLE "public"."tbAV4_titolari_backup_20260810" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAV4_titolari_backup_20260810" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAV4_titolari_backup_20260810" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAVFascicoliAlert" TO "anon";
GRANT ALL ON TABLE "public"."tbAVFascicoliAlert" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAVFascicoliAlert" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAVFascicoliAlert" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbAVFascicoliDocumenti" TO "anon";
GRANT ALL ON TABLE "public"."tbAVFascicoliDocumenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbAVFascicoliDocumenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbAVFascicoliDocumenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbElencoPrestAR" TO "anon";
GRANT ALL ON TABLE "public"."tbElencoPrestAR" TO "authenticated";
GRANT ALL ON TABLE "public"."tbElencoPrestAR" TO "service_role";
GRANT SELECT ON TABLE "public"."tbElencoPrestAR" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbElencoPrestAR_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbElencoPrestAR_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbElencoPrestAR_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbElencoPrestAR_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbPraticheAML" TO "anon";
GRANT ALL ON TABLE "public"."tbPraticheAML" TO "authenticated";
GRANT ALL ON TABLE "public"."tbPraticheAML" TO "service_role";
GRANT SELECT ON TABLE "public"."tbPraticheAML" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbPraticheAML_numero_pratica_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbPraticheAML_numero_pratica_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbPraticheAML_numero_pratica_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbPraticheAML_numero_pratica_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbRespAV" TO "anon";
GRANT ALL ON TABLE "public"."tbRespAV" TO "authenticated";
GRANT ALL ON TABLE "public"."tbRespAV" TO "service_role";
GRANT SELECT ON TABLE "public"."tbRespAV" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbRespAVSocieta" TO "anon";
GRANT ALL ON TABLE "public"."tbRespAVSocieta" TO "authenticated";
GRANT ALL ON TABLE "public"."tbRespAVSocieta" TO "service_role";
GRANT SELECT ON TABLE "public"."tbRespAVSocieta" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tb_comuni_catastali" TO "anon";
GRANT ALL ON TABLE "public"."tb_comuni_catastali" TO "authenticated";
GRANT ALL ON TABLE "public"."tb_comuni_catastali" TO "service_role";
GRANT SELECT ON TABLE "public"."tb_comuni_catastali" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbagenda" TO "anon";
GRANT ALL ON TABLE "public"."tbagenda" TO "authenticated";
GRANT ALL ON TABLE "public"."tbagenda" TO "service_role";
GRANT SELECT ON TABLE "public"."tbagenda" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbalert_log" TO "anon";
GRANT ALL ON TABLE "public"."tbalert_log" TO "authenticated";
GRANT ALL ON TABLE "public"."tbalert_log" TO "service_role";
GRANT SELECT ON TABLE "public"."tbalert_log" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbassunzioni_allegati" TO "anon";
GRANT ALL ON TABLE "public"."tbassunzioni_allegati" TO "authenticated";
GRANT ALL ON TABLE "public"."tbassunzioni_allegati" TO "service_role";
GRANT SELECT ON TABLE "public"."tbassunzioni_allegati" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbassunzioni_richieste" TO "anon";
GRANT ALL ON TABLE "public"."tbassunzioni_richieste" TO "authenticated";
GRANT ALL ON TABLE "public"."tbassunzioni_richieste" TO "service_role";
GRANT SELECT ON TABLE "public"."tbassunzioni_richieste" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcassetti_fiscali" TO "anon";
GRANT ALL ON TABLE "public"."tbcassetti_fiscali" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcassetti_fiscali" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcassetti_fiscali" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_accessi_pubblici" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_accessi_pubblici" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_accessi_pubblici" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_accessi_pubblici" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_backup_rapp_legale_20260809" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_backup_rapp_legale_20260809" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_backup_rapp_legale_20260809" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_backup_rapp_legale_20260809" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_documenti_aml" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_documenti_aml" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_documenti_aml" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_documenti_aml" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_documenti_aml_backup_20260809" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_documenti_aml_backup_20260809" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_documenti_aml_backup_20260809" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_documenti_aml_backup_20260809" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_flag_scadenzari_backup_20260810" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_flag_scadenzari_backup_20260810" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_flag_scadenzari_backup_20260810" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_flag_scadenzari_backup_20260810" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_organi" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_organi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_organi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_organi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_organi_diritti" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_organi_diritti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_organi_diritti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_organi_diritti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_rapp_legale_backup_20260811" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_rapp_legale_backup_20260811" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_rapp_legale_backup_20260811" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_rapp_legale_backup_20260811" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbclienti_servizi" TO "anon";
GRANT ALL ON TABLE "public"."tbclienti_servizi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbclienti_servizi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbclienti_servizi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcomunicazioni" TO "anon";
GRANT ALL ON TABLE "public"."tbcomunicazioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcomunicazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcomunicazioni" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontatti" TO "anon";
GRANT ALL ON TABLE "public"."tbcontatti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontatti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontatti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontatti_clienti" TO "anon";
GRANT ALL ON TABLE "public"."tbcontatti_clienti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontatti_clienti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontatti_clienti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontatti_relazioni" TO "anon";
GRANT ALL ON TABLE "public"."tbcontatti_relazioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontatti_relazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontatti_relazioni" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_adesione" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_adesione" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_adesione" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_adesione" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_avvisi_bonari" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_avvisi_bonari" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_avvisi_bonari" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_avvisi_bonari" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_cartelle" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_cartelle" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_cartelle" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_cartelle" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_cassazione" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_cassazione" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_cassazione" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_cassazione" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_codici_tributo" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_codici_tributo" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_codici_tributo" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_codici_tributo" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_esattoriale_tributi" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_esattoriale_tributi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_esattoriale_tributi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_esattoriale_tributi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_interpello" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_interpello" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_interpello" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_interpello" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_memorie" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_memorie" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_memorie" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_memorie" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_processo" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_processo" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_processo" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_processo" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_pvc" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_pvc" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_pvc" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_pvc" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_regole_scadenze" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_regole_scadenze" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_regole_scadenze" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_regole_scadenze" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_ricorso_primo_grado" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_ricorso_primo_grado" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_ricorso_primo_grado" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_ricorso_primo_grado" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_ricorso_secondo_grado" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_ricorso_secondo_grado" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_ricorso_secondo_grado" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_ricorso_secondo_grado" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_scadenze_generate" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_scadenze_generate" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_scadenze_generate" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_scadenze_generate" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_schema_atto" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_schema_atto" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_schema_atto" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_schema_atto" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_sospensioni" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_sospensioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_sospensioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_sospensioni" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_tipi_atto" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_tipi_atto" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_tipi_atto" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_tipi_atto" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontenzioso_tributi_constatazione" TO "anon";
GRANT ALL ON TABLE "public"."tbcontenzioso_tributi_constatazione" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontenzioso_tributi_constatazione" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontenzioso_tributi_constatazione" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontrollo_gestione" TO "anon";
GRANT ALL ON TABLE "public"."tbcontrollo_gestione" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontrollo_gestione" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontrollo_gestione" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontrollo_gestione_allegati" TO "anon";
GRANT ALL ON TABLE "public"."tbcontrollo_gestione_allegati" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontrollo_gestione_allegati" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontrollo_gestione_allegati" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontrollo_gestione_indici" TO "anon";
GRANT ALL ON TABLE "public"."tbcontrollo_gestione_indici" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontrollo_gestione_indici" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontrollo_gestione_indici" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcontrollo_gestione_utenti" TO "anon";
GRANT ALL ON TABLE "public"."tbcontrollo_gestione_utenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcontrollo_gestione_utenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcontrollo_gestione_utenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbconversazioni" TO "anon";
GRANT ALL ON TABLE "public"."tbconversazioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbconversazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbconversazioni" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbconversazioni_utenti" TO "anon";
GRANT ALL ON TABLE "public"."tbconversazioni_utenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbconversazioni_utenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbconversazioni_utenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcredenziali_accesso" TO "anon";
GRANT ALL ON TABLE "public"."tbcredenziali_accesso" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcredenziali_accesso" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcredenziali_accesso" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbcron_log" TO "anon";
GRANT ALL ON TABLE "public"."tbcron_log" TO "authenticated";
GRANT ALL ON TABLE "public"."tbcron_log" TO "service_role";
GRANT SELECT ON TABLE "public"."tbcron_log" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbdipendenti" TO "anon";
GRANT ALL ON TABLE "public"."tbdipendenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbdipendenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbdipendenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbemail_template" TO "anon";
GRANT ALL ON TABLE "public"."tbemail_template" TO "authenticated";
GRANT ALL ON TABLE "public"."tbemail_template" TO "service_role";
GRANT SELECT ON TABLE "public"."tbemail_template" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbferie_permessi_richieste" TO "anon";
GRANT ALL ON TABLE "public"."tbferie_permessi_richieste" TO "authenticated";
GRANT ALL ON TABLE "public"."tbferie_permessi_richieste" TO "service_role";
GRANT SELECT ON TABLE "public"."tbferie_permessi_richieste" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbfestivita" TO "anon";
GRANT ALL ON TABLE "public"."tbfestivita" TO "authenticated";
GRANT ALL ON TABLE "public"."tbfestivita" TO "service_role";
GRANT SELECT ON TABLE "public"."tbfestivita" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbmessaggi" TO "anon";
GRANT ALL ON TABLE "public"."tbmessaggi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbmessaggi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbmessaggi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbmessaggi_allegati" TO "anon";
GRANT ALL ON TABLE "public"."tbmessaggi_allegati" TO "authenticated";
GRANT ALL ON TABLE "public"."tbmessaggi_allegati" TO "service_role";
GRANT SELECT ON TABLE "public"."tbmessaggi_allegati" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbmicrosoft365_user_tokens" TO "anon";
GRANT ALL ON TABLE "public"."tbmicrosoft365_user_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."tbmicrosoft365_user_tokens" TO "service_role";
GRANT SELECT ON TABLE "public"."tbmicrosoft365_user_tokens" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbmicrosoft_calendar_mappings" TO "anon";
GRANT ALL ON TABLE "public"."tbmicrosoft_calendar_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."tbmicrosoft_calendar_mappings" TO "service_role";
GRANT SELECT ON TABLE "public"."tbmicrosoft_calendar_mappings" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbmicrosoft_settings" TO "anon";
GRANT ALL ON TABLE "public"."tbmicrosoft_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tbmicrosoft_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."tbmicrosoft_settings" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbmicrosoft_tokens" TO "anon";
GRANT ALL ON TABLE "public"."tbmicrosoft_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."tbmicrosoft_tokens" TO "service_role";
GRANT SELECT ON TABLE "public"."tbmicrosoft_tokens" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpayroll_qualifiche" TO "anon";
GRANT ALL ON TABLE "public"."tbpayroll_qualifiche" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpayroll_qualifiche" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpayroll_qualifiche" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_assegnazioni" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_assegnazioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_assegnazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_assegnazioni" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_assegnazioni_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_assegnazioni_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_assegnazioni_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_assegnazioni_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_checklist" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_checklist" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_checklist" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_checklist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_checklist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_checklist_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_checklist_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_checklist_template" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_checklist_template" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_checklist_template" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_checklist_template" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_checklist_template_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_checklist_template_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_checklist_template_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_checklist_template_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_dati_documenti" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_dati_documenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_dati_documenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_dati_documenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_dicitura_documenti" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_dicitura_documenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_dicitura_documenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_dicitura_documenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_distribuzione_utili" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_distribuzione_utili" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_distribuzione_utili" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_distribuzione_utili" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_documenti" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_documenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_documenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_documenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_log" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_log" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_log" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_log" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_log_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_log_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_modelli" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_modelli" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_modelli" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_modelli" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_modelli_documenti" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_modelli_documenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_modelli_documenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_modelli_documenti" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_modelli_documenti_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_modelli_documenti_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_modelli_documenti_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_modelli_documenti_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_modelli_utilita" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_modelli_utilita" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_modelli_utilita" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_modelli_utilita" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_motivi_liquidazione" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_motivi_liquidazione" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_motivi_liquidazione" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_motivi_liquidazione" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_note" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_note" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_note" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_note" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_note_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_note_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_note_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_note_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_priorita" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_priorita" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_priorita" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_priorita" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_priorita_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_priorita_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_priorita_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_priorita_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_scadenze" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_scadenze" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_scadenze" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_scadenze" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_scadenze_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_scadenze_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_scadenze_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_scadenze_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_soggetti" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_soggetti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_soggetti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_soggetti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_stati" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_stati" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_stati" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_stati" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_stati_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_stati_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_stati_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_stati_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_step" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_step" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_step" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_step" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_step_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_step_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_step_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_step_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_step_template" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_step_template" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_step_template" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_step_template" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_step_template_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_step_template_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_step_template_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_step_template_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_tipi" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_tipi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_tipi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_tipi" TO "github_schema_sync";



GRANT ALL ON SEQUENCE "public"."tbpratiche_tipi_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tbpratiche_tipi_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tbpratiche_tipi_id_seq" TO "service_role";
GRANT SELECT ON SEQUENCE "public"."tbpratiche_tipi_id_seq" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_variazioni" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_variazioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_variazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_variazioni" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpratiche_variazioni_tipi" TO "anon";
GRANT ALL ON TABLE "public"."tbpratiche_variazioni_tipi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpratiche_variazioni_tipi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpratiche_variazioni_tipi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpresenze_codici" TO "anon";
GRANT ALL ON TABLE "public"."tbpresenze_codici" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpresenze_codici" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpresenze_codici" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpresenze_dipendenti" TO "anon";
GRANT ALL ON TABLE "public"."tbpresenze_dipendenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpresenze_dipendenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpresenze_dipendenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpresenze_smart_calendario" TO "anon";
GRANT ALL ON TABLE "public"."tbpresenze_smart_calendario" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpresenze_smart_calendario" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpresenze_smart_calendario" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpresenze_smart_cambi_turno" TO "anon";
GRANT ALL ON TABLE "public"."tbpresenze_smart_cambi_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpresenze_smart_cambi_turno" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpresenze_smart_cambi_turno" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpresenze_smart_gruppi" TO "anon";
GRANT ALL ON TABLE "public"."tbpresenze_smart_gruppi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpresenze_smart_gruppi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpresenze_smart_gruppi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpresenze_smart_gruppi_utenti" TO "anon";
GRANT ALL ON TABLE "public"."tbpresenze_smart_gruppi_utenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpresenze_smart_gruppi_utenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpresenze_smart_gruppi_utenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpresenze_solleciti_log" TO "anon";
GRANT ALL ON TABLE "public"."tbpresenze_solleciti_log" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpresenze_solleciti_log" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpresenze_solleciti_log" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbprestazioni" TO "anon";
GRANT ALL ON TABLE "public"."tbprestazioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbprestazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbprestazioni" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbpromemoria" TO "anon";
GRANT ALL ON TABLE "public"."tbpromemoria" TO "authenticated";
GRANT ALL ON TABLE "public"."tbpromemoria" TO "service_role";
GRANT SELECT ON TABLE "public"."tbpromemoria" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbreferimenti_valori" TO "anon";
GRANT ALL ON TABLE "public"."tbreferimenti_valori" TO "authenticated";
GRANT ALL ON TABLE "public"."tbreferimenti_valori" TO "service_role";
GRANT SELECT ON TABLE "public"."tbreferimenti_valori" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbrevisione_checklist" TO "anon";
GRANT ALL ON TABLE "public"."tbrevisione_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."tbrevisione_checklist" TO "service_role";
GRANT SELECT ON TABLE "public"."tbrevisione_checklist" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbrevisione_controlli" TO "anon";
GRANT ALL ON TABLE "public"."tbrevisione_controlli" TO "authenticated";
GRANT ALL ON TABLE "public"."tbrevisione_controlli" TO "service_role";
GRANT SELECT ON TABLE "public"."tbrevisione_controlli" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbrevisione_documenti" TO "anon";
GRANT ALL ON TABLE "public"."tbrevisione_documenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbrevisione_documenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbrevisione_documenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbrevisione_followup" TO "anon";
GRANT ALL ON TABLE "public"."tbrevisione_followup" TO "authenticated";
GRANT ALL ON TABLE "public"."tbrevisione_followup" TO "service_role";
GRANT SELECT ON TABLE "public"."tbrevisione_followup" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbrevisione_incarichi" TO "anon";
GRANT ALL ON TABLE "public"."tbrevisione_incarichi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbrevisione_incarichi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbrevisione_incarichi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbrevisione_modelli" TO "anon";
GRANT ALL ON TABLE "public"."tbrevisione_modelli" TO "authenticated";
GRANT ALL ON TABLE "public"."tbrevisione_modelli" TO "service_role";
GRANT SELECT ON TABLE "public"."tbrevisione_modelli" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbrevisione_relazioni" TO "anon";
GRANT ALL ON TABLE "public"."tbrevisione_relazioni" TO "authenticated";
GRANT ALL ON TABLE "public"."tbrevisione_relazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."tbrevisione_relazioni" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbrevisione_soggetti" TO "anon";
GRANT ALL ON TABLE "public"."tbrevisione_soggetti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbrevisione_soggetti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbrevisione_soggetti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbroperatore" TO "anon";
GRANT ALL ON TABLE "public"."tbroperatore" TO "authenticated";
GRANT ALL ON TABLE "public"."tbroperatore" TO "service_role";
GRANT SELECT ON TABLE "public"."tbroperatore" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscad770" TO "anon";
GRANT ALL ON TABLE "public"."tbscad770" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscad770" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscad770" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadaffitti" TO "anon";
GRANT ALL ON TABLE "public"."tbscadaffitti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadaffitti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadaffitti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadbilanci" TO "anon";
GRANT ALL ON TABLE "public"."tbscadbilanci" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadbilanci" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadbilanci" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadccgg" TO "anon";
GRANT ALL ON TABLE "public"."tbscadccgg" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadccgg" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadccgg" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadcu" TO "anon";
GRANT ALL ON TABLE "public"."tbscadcu" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadcu" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadcu" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadenze_alert_log" TO "anon";
GRANT ALL ON TABLE "public"."tbscadenze_alert_log" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadenze_alert_log" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadenze_alert_log" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadenze_centrale" TO "anon";
GRANT ALL ON TABLE "public"."tbscadenze_centrale" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadenze_centrale" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadenze_centrale" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadenze_centrale_alert_log" TO "anon";
GRANT ALL ON TABLE "public"."tbscadenze_centrale_alert_log" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadenze_centrale_alert_log" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadenze_centrale_alert_log" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadenze_centrale_destinatari" TO "anon";
GRANT ALL ON TABLE "public"."tbscadenze_centrale_destinatari" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadenze_centrale_destinatari" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadenze_centrale_destinatari" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadestero" TO "anon";
GRANT ALL ON TABLE "public"."tbscadestero" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadestero" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadestero" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadfiscali" TO "anon";
GRANT ALL ON TABLE "public"."tbscadfiscali" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadfiscali" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadfiscali" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadimu" TO "anon";
GRANT ALL ON TABLE "public"."tbscadimu" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadimu" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadimu" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadiva" TO "anon";
GRANT ALL ON TABLE "public"."tbscadiva" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadiva" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadiva" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadlipe" TO "anon";
GRANT ALL ON TABLE "public"."tbscadlipe" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadlipe" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadlipe" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbscadproforma" TO "anon";
GRANT ALL ON TABLE "public"."tbscadproforma" TO "authenticated";
GRANT ALL ON TABLE "public"."tbscadproforma" TO "service_role";
GRANT SELECT ON TABLE "public"."tbscadproforma" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbsoftware_licenze" TO "anon";
GRANT ALL ON TABLE "public"."tbsoftware_licenze" TO "authenticated";
GRANT ALL ON TABLE "public"."tbsoftware_licenze" TO "service_role";
GRANT SELECT ON TABLE "public"."tbsoftware_licenze" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbsoftware_pagamenti" TO "anon";
GRANT ALL ON TABLE "public"."tbsoftware_pagamenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbsoftware_pagamenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbsoftware_pagamenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbsoftware_rinnovi" TO "anon";
GRANT ALL ON TABLE "public"."tbsoftware_rinnovi" TO "authenticated";
GRANT ALL ON TABLE "public"."tbsoftware_rinnovi" TO "service_role";
GRANT SELECT ON TABLE "public"."tbsoftware_rinnovi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbstudio" TO "anon";
GRANT ALL ON TABLE "public"."tbstudio" TO "authenticated";
GRANT ALL ON TABLE "public"."tbstudio" TO "service_role";
GRANT SELECT ON TABLE "public"."tbstudio" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbtipi_scadenze" TO "anon";
GRANT ALL ON TABLE "public"."tbtipi_scadenze" TO "authenticated";
GRANT ALL ON TABLE "public"."tbtipi_scadenze" TO "service_role";
GRANT SELECT ON TABLE "public"."tbtipi_scadenze" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbtipi_scadenze_alert" TO "anon";
GRANT ALL ON TABLE "public"."tbtipi_scadenze_alert" TO "authenticated";
GRANT ALL ON TABLE "public"."tbtipi_scadenze_alert" TO "service_role";
GRANT SELECT ON TABLE "public"."tbtipi_scadenze_alert" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbtipopromemoria" TO "anon";
GRANT ALL ON TABLE "public"."tbtipopromemoria" TO "authenticated";
GRANT ALL ON TABLE "public"."tbtipopromemoria" TO "service_role";
GRANT SELECT ON TABLE "public"."tbtipopromemoria" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbutenti" TO "anon";
GRANT ALL ON TABLE "public"."tbutenti" TO "authenticated";
GRANT ALL ON TABLE "public"."tbutenti" TO "service_role";
GRANT SELECT ON TABLE "public"."tbutenti" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbverifiche_titolare_effettivo" TO "anon";
GRANT ALL ON TABLE "public"."tbverifiche_titolare_effettivo" TO "authenticated";
GRANT ALL ON TABLE "public"."tbverifiche_titolare_effettivo" TO "service_role";
GRANT SELECT ON TABLE "public"."tbverifiche_titolare_effettivo" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."tbverifiche_titolare_effettivo_righe" TO "anon";
GRANT ALL ON TABLE "public"."tbverifiche_titolare_effettivo_righe" TO "authenticated";
GRANT ALL ON TABLE "public"."tbverifiche_titolare_effettivo_righe" TO "service_role";
GRANT SELECT ON TABLE "public"."tbverifiche_titolare_effettivo_righe" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."v_cassetti_fiscali" TO "anon";
GRANT ALL ON TABLE "public"."v_cassetti_fiscali" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cassetti_fiscali" TO "service_role";
GRANT SELECT ON TABLE "public"."v_cassetti_fiscali" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."v_clienti_con_cassetto" TO "anon";
GRANT ALL ON TABLE "public"."v_clienti_con_cassetto" TO "authenticated";
GRANT ALL ON TABLE "public"."v_clienti_con_cassetto" TO "service_role";
GRANT SELECT ON TABLE "public"."v_clienti_con_cassetto" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_controllo_gestione_corrente" TO "anon";
GRANT ALL ON TABLE "public"."vw_controllo_gestione_corrente" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_controllo_gestione_corrente" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_controllo_gestione_corrente" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_rappresentanti_aml" TO "anon";
GRANT ALL ON TABLE "public"."vw_rappresentanti_aml" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_rappresentanti_aml" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_rappresentanti_aml" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_revisione_controlli" TO "anon";
GRANT ALL ON TABLE "public"."vw_revisione_controlli" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_revisione_controlli" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_revisione_controlli" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_revisione_incarichi" TO "anon";
GRANT ALL ON TABLE "public"."vw_revisione_incarichi" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_revisione_incarichi" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_revisione_incarichi" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_scadenzario_unificato" TO "anon";
GRANT ALL ON TABLE "public"."vw_scadenzario_unificato" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_scadenzario_unificato" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_scadenzario_unificato" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_scadenzario_riepilogativo_societa" TO "anon";
GRANT ALL ON TABLE "public"."vw_scadenzario_riepilogativo_societa" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_scadenzario_riepilogativo_societa" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_scadenzario_riepilogativo_societa" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_scadenzario_dashboard_societa" TO "anon";
GRANT ALL ON TABLE "public"."vw_scadenzario_dashboard_societa" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_scadenzario_dashboard_societa" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_scadenzario_dashboard_societa" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_scadenzario_riepilogo" TO "anon";
GRANT ALL ON TABLE "public"."vw_scadenzario_riepilogo" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_scadenzario_riepilogo" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_scadenzario_riepilogo" TO "github_schema_sync";



GRANT ALL ON TABLE "public"."vw_scadenze_centrale_riepilogo" TO "anon";
GRANT ALL ON TABLE "public"."vw_scadenze_centrale_riepilogo" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_scadenze_centrale_riepilogo" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_scadenze_centrale_riepilogo" TO "github_schema_sync";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON SEQUENCES TO "github_schema_sync";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "github_schema_sync";







