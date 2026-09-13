-- Redditività Studio - listino professionale modificabile da database
-- Il listino è per studio e vive nel catalogo attività.

alter table public.tbcdg_attivita_catalogo
  add column if not exists prezzo_minimo numeric(14,2) not null default 0,
  add column if not exists prezzo_massimo numeric(14,2) not null default 0,
  add column if not exists modalita_prezzo text not null default 'unitario',
  add column if not exists gruppo_listino text,
  add column if not exists listino_attivo boolean not null default true;

alter table public.tbcdg_attivita_catalogo
  drop constraint if exists ck_tbcdg_attivita_prezzo_minimo,
  drop constraint if exists ck_tbcdg_attivita_prezzo_massimo,
  drop constraint if exists ck_tbcdg_attivita_modalita_prezzo;

alter table public.tbcdg_attivita_catalogo
  add constraint ck_tbcdg_attivita_prezzo_minimo check (prezzo_minimo >= 0),
  add constraint ck_tbcdg_attivita_prezzo_massimo check (prezzo_massimo >= prezzo_minimo),
  add constraint ck_tbcdg_attivita_modalita_prezzo check (modalita_prezzo in ('unitario','mensile','orario'));

comment on column public.tbcdg_attivita_catalogo.prezzo_minimo is
'Compenso minimo di listino per l unita tariffaria del servizio.';
comment on column public.tbcdg_attivita_catalogo.prezzo_massimo is
'Compenso massimo di listino per l unita tariffaria del servizio.';
comment on column public.tbcdg_attivita_catalogo.modalita_prezzo is
'unitario = quantità x tariffa; mensile = tariffa x 12; orario = ore/quantità x tariffa.';
comment on column public.tbcdg_attivita_catalogo.gruppo_listino is
'Prestazioni con lo stesso gruppo vengono valorizzate una sola volta. Esempio COGE.';
comment on column public.tbcdg_attivita_catalogo.listino_attivo is
'Abilita la voce al calcolo del ricavo minimo e previsto.';

-- COGE: le attività operative concorrono a carico/costo, ma il compenso
-- viene calcolato una sola volta sul gruppo COGE, con fascia mensile 250-1000.
update public.tbcdg_attivita_catalogo
set prezzo_minimo = 250,
    prezzo_massimo = 1000,
    modalita_prezzo = 'mensile',
    gruppo_listino = 'COGE',
    listino_attivo = true
where codice in ('CONT_MOV_IVA','CONT_MOV_CONT','CONT_RICONC','CONT_LIQ_IVA');

-- Bilancio e rettifiche.
update public.tbcdg_attivita_catalogo
set prezzo_minimo = 500,
    prezzo_massimo = 2000,
    modalita_prezzo = 'unitario',
    gruppo_listino = null,
    listino_attivo = true
where codice = 'BIL_BILANCIO';

update public.tbcdg_attivita_catalogo
set prezzo_minimo = 100,
    prezzo_massimo = 500,
    modalita_prezzo = 'unitario',
    gruppo_listino = null,
    listino_attivo = true
where codice = 'BIL_RETT';

-- Dichiarativi.
update public.tbcdg_attivita_catalogo
set prezzo_minimo = 150,
    prezzo_massimo = 300,
    modalita_prezzo = 'unitario',
    gruppo_listino = null,
    listino_attivo = true
where codice in ('DICH_REDDITI','DICH_IVA','DICH_770','DICH_CU','DICH_IRAP');

-- Consulenza / societario / revisione: valori iniziali modificabili dalla UI.
update public.tbcdg_attivita_catalogo
set prezzo_minimo = 100,
    prezzo_massimo = 250,
    modalita_prezzo = 'orario',
    gruppo_listino = null,
    listino_attivo = true
where codice in ('CONS_ORE','REV_ORE');

update public.tbcdg_attivita_catalogo
set prezzo_minimo = 300,
    prezzo_massimo = 1500,
    modalita_prezzo = 'unitario',
    gruppo_listino = null,
    listino_attivo = true
where codice = 'SOC_PRAT';
