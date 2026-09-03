from pathlib import Path
import re


def edit(path, fn):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    n = fn(s)
    if n == s:
        raise SystemExit(f'no changes: {path}')
    p.write_text(n, encoding='utf-8')

# 1. Gestione scadenzari: rimuove Proforma e isola archivio/eliminazione per studio.
def patch_scadenzari(s):
    s = s.replace('  proforma: boolean;\n', '')
    s = s.replace('  { key: "proforma", label: "Proforma", table: "tbscadproforma" },\n', '')
    s = s.replace('      proforma: true,\n', '')

    # Rimuove l'intero blocco di generazione Proforma, lasciando intatti gli altri.
    start = s.find('      if (scadenzariFlags.proforma) {')
    if start < 0:
        raise SystemExit('Proforma generation block start not found')
    next_imu = s.find('      if (scadenzariFlags.imu) {', start)
    if next_imu < 0:
        raise SystemExit('IMU generation block not found after Proforma')
    s = s[:start] + s[next_imu:]

    # Helper studio corrente per operazioni archivio/eliminazione.
    marker = '  const getSelectedScadenzari = () =>\n    SCADENZARI_CONFIG.filter((item) => scadenzariFlags[item.key]);\n'
    helper = marker + '''\n  const getCurrentStudioId = async (): Promise<string> => {\n    const { data: { session } } = await supabase.auth.getSession();\n    if (!session?.user?.id) throw new Error("Sessione non valida");\n\n    const { data, error } = await supabase\n      .from("tbutenti")\n      .select("studio_id")\n      .eq("user_id", session.user.id)\n      .maybeSingle();\n\n    if (error || !data?.studio_id) {\n      throw error || new Error("Studio non disponibile");\n    }\n    return data.studio_id;\n  };\n'''
    if s.count(marker) != 1:
        raise SystemExit('getSelectedScadenzari marker mismatch')
    s = s.replace(marker, helper, 1)

    # Gli anni disponibili devono essere quelli dello studio corrente.
    marker = '    const selezionati = getSelectedScadenzari();\n\n    if (selezionati.length === 0) {'
    repl = '    const selezionati = getSelectedScadenzari();\n    const currentStudioId = await getCurrentStudioId();\n\n    if (selezionati.length === 0) {'
    # Prima occorrenza = loadAnniDisponibili.
    if s.count(marker) < 2:
        raise SystemExit('selected scadenzari markers missing')
    s = s.replace(marker, repl, 1)
    s = s.replace('.select("anno_riferimento")\n        .eq("archiviato", false);', '.select("anno_riferimento")\n        .eq("studio_id", currentStudioId)\n        .eq("archiviato", false);', 1)
    s = s.replace('.select("anno_riferimento")\n        .eq("archiviato", true);', '.select("anno_riferimento")\n        .eq("studio_id", currentStudioId)\n        .eq("archiviato", true);', 1)

    # Archiviazione: studio + anno + non archiviato.
    arch_marker = '  const handleArchivia = async () => {\n    const selezionati = getSelectedScadenzari();'
    arch_repl = '  const handleArchivia = async () => {\n    const selezionati = getSelectedScadenzari();\n    const currentStudioId = await getCurrentStudioId();'
    if s.count(arch_marker) != 1:
        raise SystemExit('handleArchivia marker mismatch')
    s = s.replace(arch_marker, arch_repl, 1)
    archive_eq = '.eq("anno_riferimento", annoArchiviazione)\n          .eq("archiviato", false);'
    archive_eq_new = '.eq("studio_id", currentStudioId)\n          .eq("anno_riferimento", annoArchiviazione)\n          .eq("archiviato", false);'
    if s.count(archive_eq) != 1:
        raise SystemExit('archive filter marker mismatch')
    s = s.replace(archive_eq, archive_eq_new, 1)

    # Dopo archiviazione aggiorna subito gli anni disponibili.
    success = '      toast({\n        title: "Successo",\n        description: `Archiviazione logica completata per l\'anno ${annoArchiviazione}`,\n      });'
    success_new = success + '\n      await loadAnniDisponibili();'
    if s.count(success) != 1:
        raise SystemExit('archive success marker mismatch')
    s = s.replace(success, success_new, 1)

    # Eliminazione definitiva: stesso isolamento studio + anno + archiviato.
    delete_try = '    try {\n      setProcessing(true);\n\n      const { error } = await supabase\n        .from(nomeTabella as any)'
    delete_new = '    try {\n      setProcessing(true);\n      const currentStudioId = await getCurrentStudioId();\n\n      const { error } = await supabase\n        .from(nomeTabella as any)'
    if s.count(delete_try) != 1:
        raise SystemExit('delete try marker mismatch')
    s = s.replace(delete_try, delete_new, 1)
    delete_eq = '.delete()\n        .eq("anno_riferimento", annoEliminazione)\n        .eq("archiviato", true);'
    delete_eq_new = '.delete()\n        .eq("studio_id", currentStudioId)\n        .eq("anno_riferimento", annoEliminazione)\n        .eq("archiviato", true);'
    if s.count(delete_eq) != 1:
        raise SystemExit('delete filter marker mismatch')
    s = s.replace(delete_eq, delete_eq_new, 1)
    return s

edit('src/pages/impostazioni/scadenzari.tsx', patch_scadenzari)

# 2. Servizi cliente: elimina completamente flag Proforma; IMU resta e occupa la nona posizione della griglia.
def patch_servizi(s):
    for x in [
        '  flag_proforma: boolean;\n',
        '  flag_proforma: false,\n',
        '  | "flag_proforma"',
        '  { key: "flag_proforma", label: "Proforma" },\n',
        '          flag_proforma: Boolean(serviziData.flag_proforma),\n',
        '        flag_proforma: formData.flag_proforma,\n',
    ]:
        s = s.replace(x, '')
    return s
edit('src/pages/clienti/servizi.tsx', patch_servizi)

# 3. Menu: nessun collegamento alla pagina Proforma.
for path in ['src/components/Sidebar.tsx', 'src/components/TopNavBar.tsx']:
    edit(path, lambda s: re.sub(r'^.*(?:label: "Proforma"|/scadenze/proforma).*\n', '', s, flags=re.M))

# 4. Runtime services/API: rimuove tabella/flag Proforma senza toccare gli altri scadenzari.
def remove_tokens(s):
    s = s.replace('"tbscadproforma", ', '').replace(', "tbscadproforma"', '')
    s = re.sub(r'^.*"tbscadproforma".*\n', '', s, flags=re.M)
    s = re.sub(r'^.*flag_proforma.*\n', '', s, flags=re.M)
    return s

for path in [
    'src/services/scadenzaService.ts',
    'src/services/scadenzaAlertService.ts',
    'src/pages/api/scadenzari/cleanup-inattivi.ts',
    'src/pages/api/clienti/update.ts',
]:
    edit(path, remove_tokens)

# 5. Pagina Clienti: rimuove riferimenti alla configurazione/generazione Proforma.
def patch_clienti(s):
    s = re.sub(r'^.*flag_proforma.*\n', '', s, flags=re.M)
    # Rimuove eventuale blocco push Proforma rimasto su due righe.
    s = re.sub(r'\nif \(serviziCliente\?\.flag_proforma\)\s*\n\s*scadenzariAttivi\.push\("Proforma"\);', '', s)
    # Rimuove blocchi dedicati a tbscadproforma fino al successivo scadenzario noto.
    s = re.sub(r'\n\s*if \([^\n]*proforma[^\n]*\)\s*\{.*?\n\s*\}', '', s, flags=re.S|re.I)
    s = re.sub(r'\n\s*const\s+\w*[Pp]roforma\w*\s*=.*?;\n', '\n', s, flags=re.S)
    s = re.sub(r'\n\s*await eseguiInsert\(\s*"tbscadproforma".*?\n\s*\);', '', s, flags=re.S)
    s = re.sub(r'\n\s*await esisteRecord\(\s*"tbscadproforma"\s*\);', '', s, flags=re.S)
    return s
edit('src/pages/clienti/index.tsx', patch_clienti)

# 6. Tipi/calendario: Proforma non deve essere selezionabile come tipo scadenza.
for path in ['src/pages/scadenze/calendario.tsx', 'src/pages/impostazioni/tipi-scadenze.tsx']:
    edit(path, lambda s: re.sub(r'^.*value: "proforma".*\n', '', s, flags=re.M))

# 7. Costante applicativa.
edit('src/types/index.ts', lambda s: re.sub(r'^\s*PROFORMA:\s*"Proforma",?\s*\n', '', s, flags=re.M))

# 8. Elimina la pagina dedicata Proforma.
p = Path('src/pages/scadenze/proforma.tsx')
if not p.exists():
    raise SystemExit('Proforma page already missing unexpectedly')
p.unlink()

# 9. Migrazione DB sicura: aggiorna trigger/funzioni PRIMA di eliminare flag e tabella.
migration = Path('supabase/migrations/20260903103000_remove_proforma_scadenzario.sql')
if migration.exists():
    raise SystemExit('migration already exists')
migration.write_text(r'''-- Rimozione definitiva dello scadenzario Proforma.
-- Mantiene invariati tutti gli altri scadenzari e aggiorna prima le dipendenze DB.

BEGIN;

CREATE OR REPLACE FUNCTION public.rimuovi_cliente_inattivo_da_scadenzari()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.attivo IS TRUE AND NEW.attivo IS NOT TRUE THEN
    UPDATE public.tbclienti_servizi
    SET
      flag_iva = false,
      flag_cu = false,
      flag_bilancio = false,
      flag_fiscali = false,
      flag_lipe = false,
      flag_770 = false,
      flag_esterometro = false,
      flag_ccgg = false,
      flag_imu = false,
      updated_at = now()
    WHERE cliente_id = NEW.id
      AND studio_id = NEW.studio_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blocca_scadenzari_cliente_inattivo ON public.tbclienti_servizi;

CREATE OR REPLACE FUNCTION public.blocca_scadenzari_per_cliente_inattivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attivo boolean;
BEGIN
  IF NOT (
    NEW.flag_iva IS TRUE OR NEW.flag_cu IS TRUE OR NEW.flag_bilancio IS TRUE OR
    NEW.flag_fiscali IS TRUE OR NEW.flag_lipe IS TRUE OR NEW.flag_770 IS TRUE OR
    NEW.flag_esterometro IS TRUE OR NEW.flag_ccgg IS TRUE OR NEW.flag_imu IS TRUE
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.attivo INTO v_attivo
  FROM public.tbclienti AS c
  WHERE c.id = NEW.cliente_id AND c.studio_id = NEW.studio_id;

  IF v_attivo IS NOT TRUE THEN
    RAISE EXCEPTION 'Cliente inattivo: impossibile attivare scadenzari.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE IF EXISTS public.tbclienti_servizi
  DROP COLUMN IF EXISTS flag_proforma;

CREATE TRIGGER trg_blocca_scadenzari_cliente_inattivo
BEFORE INSERT OR UPDATE OF
  flag_iva, flag_cu, flag_bilancio, flag_fiscali, flag_lipe,
  flag_770, flag_esterometro, flag_ccgg, flag_imu
ON public.tbclienti_servizi
FOR EACH ROW
EXECUTE FUNCTION public.blocca_scadenzari_per_cliente_inattivo();

-- Elimina eventuali configurazioni del tipo Proforma prima di restringere il check.
DELETE FROM public.tbtipi_scadenze WHERE tipo_scadenza = 'proforma';

ALTER TABLE public.tbtipi_scadenze
  DROP CONSTRAINT IF EXISTS tbtipi_scadenze_tipo_scadenza_check;
ALTER TABLE public.tbtipi_scadenze
  ADD CONSTRAINT tbtipi_scadenze_tipo_scadenza_check
  CHECK (tipo_scadenza IN ('iva','fiscale','bilancio','770','lipe','esterometro','ccgg','cu','antiriciclaggio','imu','lavoro'));

DROP TABLE IF EXISTS public.tbscadproforma CASCADE;

REVOKE ALL ON FUNCTION public.rimuovi_cliente_inattivo_da_scadenzari() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.blocca_scadenzari_per_cliente_inattivo() FROM PUBLIC;

COMMIT;
''', encoding='utf-8')

# Guardie finali sul runtime (i database.types generati saranno rigenerabili dopo la migration).
for root in ['src/pages', 'src/components', 'src/services']:
    for f in Path(root).rglob('*'):
        if f.is_file() and f.suffix in {'.ts', '.tsx'} and f.name != 'database.types.ts':
            text = f.read_text(encoding='utf-8')
            bad = [x for x in ['tbscadproforma', 'flag_proforma', '/scadenze/proforma', 'scadenzariFlags.proforma'] if x in text]
            if bad:
                raise SystemExit(f'residual Proforma refs in {f}: {bad}')
