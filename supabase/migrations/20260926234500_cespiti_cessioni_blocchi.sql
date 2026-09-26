alter table public.tbcespiti_movimenti add column if not exists corrispettivo numeric(16,2) check (corrispettivo is null or corrispettivo >= 0);
alter table public.tbcespiti_movimenti add column if not exists valore_netto_contabile numeric(16,2);
alter table public.tbcespiti_movimenti add column if not exists plus_minusvalenza numeric(16,2);

create or replace function public.cespiti_blocca_esercizio_chiuso()
returns trigger language plpgsql set search_path=public as $$
declare d date; cid uuid; sid uuid; y integer;
begin
 d:=coalesce(new.data_movimento,old.data_movimento); cid:=coalesce(new.cliente_id,old.cliente_id); sid:=coalesce(new.studio_id,old.studio_id); y:=extract(year from d);
 if exists(select 1 from public.tbcespiti_esercizi e where e.studio_id=sid and e.cliente_id=cid and e.esercizio=y and e.stato='chiuso') then
   raise exception 'Esercizio % chiuso: movimento non consentito',y;
 end if;
 return coalesce(new,old);
end $$;
drop trigger if exists trg_cespiti_movimenti_esercizio on public.tbcespiti_movimenti;
create trigger trg_cespiti_movimenti_esercizio before insert or update or delete on public.tbcespiti_movimenti for each row execute function public.cespiti_blocca_esercizio_chiuso();
