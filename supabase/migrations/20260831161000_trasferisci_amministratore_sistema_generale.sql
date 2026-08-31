-- Trasferimento atomico dell'Amministratore di sistema generale.
-- La funzione è eseguibile solo con service_role; l'identità del richiedente
-- viene verificata dall'API applicativa prima della chiamata RPC.

create or replace function public.trasferisci_amministratore_sistema_generale(
  p_da_utente_id uuid,
  p_a_utente_id uuid
)
returns table (
  precedente_utente_id uuid,
  nuovo_utente_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corrente public.tbutenti%rowtype;
  v_nuovo public.tbutenti%rowtype;
begin
  if p_da_utente_id is null or p_a_utente_id is null then
    raise exception 'Utente corrente e nuovo utente sono obbligatori';
  end if;

  if p_da_utente_id = p_a_utente_id then
    raise exception 'Il nuovo Amministratore di sistema generale deve essere diverso da quello corrente';
  end if;

  -- Serializza ogni trasferimento globale.
  perform pg_advisory_xact_lock(hashtext('amministratore_sistema_generale_globale'));

  select * into v_corrente
  from public.tbutenti
  where id = p_da_utente_id
    and amministratore_sistema_generale = true
  for update;

  if not found then
    raise exception 'Amministratore di sistema generale corrente non valido';
  end if;

  select * into v_nuovo
  from public.tbutenti
  where id = p_a_utente_id
  for update;

  if not found then
    raise exception 'Nuovo utente non trovato';
  end if;

  if coalesce(v_nuovo.attivo, true) = false then
    raise exception 'Il nuovo Amministratore di sistema generale deve essere attivo';
  end if;

  if upper(trim(coalesce(v_nuovo.tipo_utente, ''))) <> 'ADMIN' then
    raise exception 'Il nuovo Amministratore di sistema generale deve essere un Amministratore';
  end if;

  -- Le due operazioni avvengono nella stessa transazione PostgreSQL.
  update public.tbutenti
  set amministratore_sistema_generale = false
  where id = p_da_utente_id;

  update public.tbutenti
  set amministratore_sistema_generale = true
  where id = p_a_utente_id;

  return query
  select p_da_utente_id, p_a_utente_id;
end;
$$;

revoke all on function public.trasferisci_amministratore_sistema_generale(uuid, uuid) from public;
revoke all on function public.trasferisci_amministratore_sistema_generale(uuid, uuid) from anon;
revoke all on function public.trasferisci_amministratore_sistema_generale(uuid, uuid) from authenticated;
grant execute on function public.trasferisci_amministratore_sistema_generale(uuid, uuid) to service_role;

comment on function public.trasferisci_amministratore_sistema_generale(uuid, uuid) is
  'Trasferisce atomicamente il privilegio globale da un amministratore attivo a un altro. Eseguibile solo con service_role.';
