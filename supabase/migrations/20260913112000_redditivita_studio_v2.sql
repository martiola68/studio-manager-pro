-- Redditività Studio v2
-- 1) separa il costo aggregato dei collaboratori diretti dal costo personale dipendente;
-- 2) mantiene il costo del lavoro a livello studio, non per singolo operatore;
-- 3) riallinea il peso dei servizi all'operatore associato in anagrafica cliente.

alter table public.tbcdg_studio_parametri
  add column if not exists costo_collaboratori_diretti numeric(14,2) not null default 0;

alter table public.tbcdg_studio_parametri
  drop constraint if exists ck_tbcdg_studio_parametri_collaboratori_diretti;

alter table public.tbcdg_studio_parametri
  add constraint ck_tbcdg_studio_parametri_collaboratori_diretti
  check (costo_collaboratori_diretti >= 0);

comment on column public.tbcdg_studio_parametri.costo_personale is
'Costo annuo aggregato del personale dipendente. Non è ripartito per singolo operatore.';

comment on column public.tbcdg_studio_parametri.costo_collaboratori_diretti is
'Costo annuo aggregato dei collaboratori diretti equiparati al personale ai fini del costo pieno dello studio.';

-- Nuovo modello di attribuzione: se il cliente ha utente_operatore_id,
-- tutto il lavoro del cliente viene attribuito al 100% a quell'operatore.
-- Le allocazioni di clienti privi di operatore associato non vengono toccate.

delete from public.tbcdg_cliente_attivita_operatori r
using public.tbcdg_cliente_servizi s,
      public.tbclienti c
where r.cliente_servizio_id = s.id
  and c.id = s.cliente_id
  and c.studio_id = s.studio_id
  and c.utente_operatore_id is not null;

insert into public.tbcdg_cliente_attivita_operatori (
  studio_id,
  esercizio,
  cliente_id,
  cliente_servizio_id,
  operatore_id,
  percentuale_ripartizione_attivita,
  numero_operazioni_attribuite,
  ore_attribuite,
  costo_attribuito
)
select
  s.studio_id,
  s.esercizio,
  s.cliente_id,
  s.id,
  c.utente_operatore_id,
  100,
  s.quantita_driver,
  s.ore_equivalenti,
  s.costo_stimato
from public.tbcdg_cliente_servizi s
join public.tbclienti c
  on c.id = s.cliente_id
 and c.studio_id = s.studio_id
join public.tbutenti u
  on u.id = c.utente_operatore_id
 and u.studio_id = s.studio_id
where s.attivo = true
  and c.utente_operatore_id is not null
  and coalesce(u.attivo, true) = true
on conflict (cliente_servizio_id, operatore_id)
do update set
  percentuale_ripartizione_attivita = excluded.percentuale_ripartizione_attivita,
  numero_operazioni_attribuite = excluded.numero_operazioni_attribuite,
  ore_attribuite = excluded.ore_attribuite,
  costo_attribuito = excluded.costo_attribuito,
  updated_at = now();
