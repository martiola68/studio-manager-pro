create or replace function public.revisione_preincarico_bloccato(p_preincarico_id uuid)
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.tbrevisione_preincarichi p where p.id = p_preincarico_id and p.stato = 'generato');
$$;

create or replace function public.trg_blocca_preincarico_generato()
returns trigger language plpgsql as $$
begin
  if old.stato = 'generato' then raise exception 'Presa in carico già generata: modifica non consentita'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists trg_blocca_preincarico_generato on public.tbrevisione_preincarichi;
create trigger trg_blocca_preincarico_generato before update or delete on public.tbrevisione_preincarichi for each row execute function public.trg_blocca_preincarico_generato();

create or replace function public.trg_blocca_questionario_preincarico_generato()
returns trigger language plpgsql as $$
declare v_pre uuid;
begin
  if tg_op = 'DELETE' then v_pre := old.preincarico_id; else v_pre := new.preincarico_id; end if;
  if public.revisione_preincarico_bloccato(v_pre) then raise exception 'Presa in carico già generata: questionario non modificabile'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists trg_blocca_questionario_preincarico_generato on public.tbrevisione_questionari;
create trigger trg_blocca_questionario_preincarico_generato before insert or update or delete on public.tbrevisione_questionari for each row execute function public.trg_blocca_questionario_preincarico_generato();

create or replace function public.trg_blocca_risposta_preincarico_generato()
returns trigger language plpgsql as $$
declare v_q uuid; v_pre uuid;
begin
  if tg_op = 'DELETE' then v_q := old.questionario_id; else v_q := new.questionario_id; end if;
  select preincarico_id into v_pre from public.tbrevisione_questionari where id = v_q;
  if public.revisione_preincarico_bloccato(v_pre) then raise exception 'Presa in carico già generata: risposta non modificabile'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists trg_blocca_risposta_preincarico_generato on public.tbrevisione_risposte;
create trigger trg_blocca_risposta_preincarico_generato before insert or update or delete on public.tbrevisione_risposte for each row execute function public.trg_blocca_risposta_preincarico_generato();

create or replace function public.trg_blocca_documento_preincarico_generato()
returns trigger language plpgsql as $$
declare v_pre uuid;
begin
  if tg_op = 'DELETE' then v_pre := old.preincarico_id; else v_pre := new.preincarico_id; end if;
  if public.revisione_preincarico_bloccato(v_pre) then raise exception 'Presa in carico già generata: documento non modificabile'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists trg_blocca_documento_preincarico_generato on public.tbrevisione_preincarico_documenti;
create trigger trg_blocca_documento_preincarico_generato before insert or update or delete on public.tbrevisione_preincarico_documenti for each row execute function public.trg_blocca_documento_preincarico_generato();
