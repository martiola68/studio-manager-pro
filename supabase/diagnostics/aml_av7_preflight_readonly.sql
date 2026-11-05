-- SOLO LETTURA: eseguire su Supabase prima di migrare AV7.
-- Non modifica dati, tabelle, permessi o storage.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and (
    (c.table_name in ('tbPraticheAML','tbclienti','tbstudio') and c.column_name in ('id','studio_id','cliente_id','av1_corrente_id','av4_corrente_id','data_prossimo_rinnovo'))
    or (c.table_name in ('tbAV1','tbAV4','tbAVFascicoliDocumenti') and c.column_name in ('id','pratica_id','studio_id','cliente_id','av1_id'))
  )
order by c.table_name, c.column_name;

-- Verificare che non esistano vincoli UNIQUE su pratica_id di AV1/AV4,
-- altrimenti la conservazione di più versioni richiede prima una migrazione.
select
  con.conrelid::regclass::text as tabella,
  con.conname as nome_vincolo,
  pg_get_constraintdef(con.oid) as definizione
from pg_constraint con
where con.conrelid in ('public."tbAV1"'::regclass, 'public."tbAV4"'::regclass)
  and con.contype in ('p','u','f')
order by tabella, nome_vincolo;

-- Lo storico di versione non deve perdere alcuna relazione preesistente.
select
  'Pratiche' as oggetto, count(*) as totale
from public."tbPraticheAML"
union all
select 'AV1', count(*) from public."tbAV1"
union all
select 'AV4', count(*) from public."tbAV4"
union all
select 'Documenti fascicolo', count(*) from public."tbAVFascicoliDocumenti";

-- Pratiche che contengono più AV1 già prima dell'aggiornamento.
select pratica_id, count(*) as versioni_av1
from public."tbAV1"
where pratica_id is not null
group by pratica_id having count(*) > 1
order by versioni_av1 desc limit 100;

-- Valutare i riferimenti iniziali/correnti non valorizzati.
select
  count(*) filter (where av1_id is null) as av1_iniziale_assente,
  count(*) filter (where av1_corrente_id is null) as av1_corrente_assente,
  count(*) filter (where av4_id is null) as av4_iniziale_assente,
  count(*) filter (where av4_corrente_id is null) as av4_corrente_assente
from public."tbPraticheAML";
