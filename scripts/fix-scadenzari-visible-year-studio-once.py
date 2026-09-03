from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"{label}: expected 1 match, found {text.count(old)}")
    return text.replace(old, new, 1)


# 1) Pagina reale "Servizi e scadenzari": Proforma sparisce, IMU resta nona voce.
p = Path("src/pages/clienti/servizi.tsx")
s = p.read_text(encoding="utf-8")
for old in [
    '  flag_proforma: boolean;\n',
    '  flag_proforma: false,\n',
    '  | "flag_proforma"',
    '  { key: "flag_proforma", label: "Proforma" },\n',
    '          flag_proforma: Boolean(serviziData.flag_proforma),\n',
    '        flag_proforma: formData.flag_proforma,\n',
]:
    if old not in s:
        raise SystemExit(f"servizi.tsx marker missing: {old!r}")
    s = s.replace(old, "")
p.write_text(s, encoding="utf-8")


# 2) Pagina reale di gestione/generazione scadenzari.
p = Path("src/pages/impostazioni/scadenzari.tsx")
s = p.read_text(encoding="utf-8")
for old in [
    '  proforma: boolean;\n',
    '  { key: "proforma", label: "Proforma", table: "tbscadproforma" },\n',
    '      proforma: true,\n',
]:
    if old not in s:
        raise SystemExit(f"scadenzari.tsx marker missing: {old!r}")
    s = s.replace(old, "")

marker = '''  const getSelectedScadenzari = () =>
    SCADENZARI_CONFIG.filter((item) => scadenzariFlags[item.key]);
'''
helper = marker + '''
  const getCurrentStudioId = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("Sessione non valida");

    let { data: utente, error } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if ((!utente || error) && session.user.email) {
      const fallback = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("email", session.user.email)
        .maybeSingle();
      utente = fallback.data;
      error = fallback.error;
    }

    if (error || !utente?.studio_id) {
      throw error || new Error("Studio non disponibile");
    }
    return utente.studio_id;
  };
'''
s = replace_once(s, marker, helper, "insert getCurrentStudioId")

marker = '    const selezionati = getSelectedScadenzari();\n\n    if (selezionati.length === 0) {'
replacement = '    const selezionati = getSelectedScadenzari();\n    const currentStudioId = await getCurrentStudioId();\n\n    if (selezionati.length === 0) {'
s = replace_once(s, marker, replacement, "loadAnni studio")

s = replace_once(
    s,
    '.select("anno_riferimento")\n        .eq("archiviato", false);',
    '.select("anno_riferimento")\n        .eq("studio_id", currentStudioId)\n        .eq("archiviato", false);',
    "archiviabili studio filter",
)
s = replace_once(
    s,
    '.select("anno_riferimento")\n        .eq("archiviato", true);',
    '.select("anno_riferimento")\n        .eq("studio_id", currentStudioId)\n        .eq("archiviato", true);',
    "eliminabili studio filter",
)

archive_marker = '  const handleArchivia = async () => {\n    const selezionati = getSelectedScadenzari();'
archive_replacement = '  const handleArchivia = async () => {\n    const selezionati = getSelectedScadenzari();'
# Studio id viene risolto nel try, dopo le conferme.
if s.count(archive_marker) != 1:
    raise SystemExit("handleArchivia marker mismatch")

s = replace_once(
    s,
    '    try {\n      setProcessing(true);\n\n      for (const item of selezionati) {',
    '    try {\n      setProcessing(true);\n      const currentStudioId = await getCurrentStudioId();\n\n      for (const item of selezionati) {',
    "handleArchivia current studio",
)
s = replace_once(
    s,
    '          } as any)\n          .eq("anno_riferimento", annoArchiviazione)\n          .eq("archiviato", false);',
    '          } as any)\n          .eq("studio_id", currentStudioId)\n          .eq("anno_riferimento", annoArchiviazione)\n          .eq("archiviato", false);',
    "archive update studio filter",
)
s = replace_once(
    s,
    '        description: `Archiviazione logica completata per l\'anno ${annoArchiviazione}`,\n      });',
    '        description: `Archiviazione logica completata per l\'anno ${annoArchiviazione}`,\n      });\n      await loadAnniDisponibili();',
    "refresh after archive",
)

# Eliminazione archivio: sempre limitata allo studio corrente.
s = replace_once(
    s,
    '    try {\n      setProcessing(true);\n\n      const { error } = await supabase\n        .from(nomeTabella as any)',
    '    try {\n      setProcessing(true);\n      const currentStudioId = await getCurrentStudioId();\n\n      const { error } = await supabase\n        .from(nomeTabella as any)',
    "delete current studio",
)
s = replace_once(
    s,
    '        .delete()\n        .eq("anno_riferimento", annoEliminazione)\n        .eq("archiviato", true);',
    '        .delete()\n        .eq("studio_id", currentStudioId)\n        .eq("anno_riferimento", annoEliminazione)\n        .eq("archiviato", true);',
    "delete studio filter",
)
s = replace_once(
    s,
    '        description: `Archivi ${nomeScadenzario} dell\'anno ${annoEliminazione} eliminati definitivamente`,\n      });',
    '        description: `Archivi ${nomeScadenzario} dell\'anno ${annoEliminazione} eliminati definitivamente`,\n      });\n      await loadAnniDisponibili();',
    "refresh after delete",
)

# Generazione: il vecchio codice confrontava tbutenti.id con auth.users.id.
old_user_lookup = '''      const { data: utenteData, error: utenteError } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", session.user.id)
        .single();

      if (utenteError || !utenteData?.studio_id) {
        toast({
          title: "Errore",
          description: "Impossibile recuperare lo studio_id",
          variant: "destructive",
        });
        return;
      }

      const currentStudioId = utenteData.studio_id;
'''
s = replace_once(
    s,
    old_user_lookup,
    '      const currentStudioId = await getCurrentStudioId();\n',
    "generation studio lookup",
)

# Qualunque controllo di esistenza per anno/cliente deve essere tenant-safe.
s = s.replace(
    '.eq("cliente_id", cliente.id)\n              .eq("anno_riferimento", annoGenerazione)',
    '.eq("cliente_id", cliente.id)\n              .eq("studio_id", currentStudioId)\n              .eq("anno_riferimento", annoGenerazione)',
)

# Rimuove il blocco di generazione Proforma senza toccare quello IMU successivo.
start = s.find('      if (scadenzariFlags.proforma) {')
if start < 0:
    raise SystemExit("Proforma generation block start not found")
end = s.find('      if (scadenzariFlags.imu) {', start)
if end < 0:
    raise SystemExit("IMU generation block not found after Proforma")
s = s[:start] + s[end:]

# Aggiorna subito gli anni disponibili dopo una generazione riuscita.
toast_marker = '''      toast({
        title: "Generazione completata",
        description: `Generati ${generati} nuovi scadenzari per l'anno ${annoGenerazione}${
          errori > 0 ? ` (${errori} errori)` : ""
        }`,
'''
if toast_marker not in s:
    raise SystemExit("generation toast marker missing")
# Inseriamo il refresh subito dopo la chiusura del toast cercando il primo blocco successivo.
pos = s.find(toast_marker)
close = s.find('      });', pos)
if close < 0:
    raise SystemExit("generation toast close missing")
close += len('      });')
s = s[:close] + '\n      await loadAnniDisponibili();' + s[close:]

for forbidden in ['scadenzariFlags.proforma', 'tbscadproforma']:
    if forbidden in s:
        raise SystemExit(f"Residual {forbidden} in scadenzari.tsx")
p.write_text(s, encoding="utf-8")


# 3) Pagina reale Scadenzario IVA: anni e righe limitati allo studio corrente.
p = Path("src/pages/scadenze/iva.tsx")
s = p.read_text(encoding="utf-8")
marker = '  const loadScadenze = async (): Promise<ScadenzaIva[]> => {\n'
replacement = marker + '''    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("Sessione non valida");

    let { data: utente, error: utenteError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if ((!utente || utenteError) && session.user.email) {
      const fallback = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("email", session.user.email)
        .maybeSingle();
      utente = fallback.data;
      utenteError = fallback.error;
    }

    if (utenteError || !utente?.studio_id) {
      throw utenteError || new Error("Studio non disponibile");
    }
    const currentStudioId = utente.studio_id;
'''
s = replace_once(s, marker, replacement, "IVA current studio")
s = replace_once(
    s,
    '      .from("tbscadiva" as any)\n      .select("anno_riferimento")\n      .order("anno_riferimento", { ascending: true });',
    '      .from("tbscadiva" as any)\n      .select("anno_riferimento")\n      .eq("studio_id", currentStudioId)\n      .order("anno_riferimento", { ascending: true });',
    "IVA years studio filter",
)
s = replace_once(
    s,
    '      .from("tbscadiva" as any)\n      .select("*")\n      .eq("anno_riferimento", annoDaUsare)',
    '      .from("tbscadiva" as any)\n      .select("*")\n      .eq("studio_id", currentStudioId)\n      .eq("anno_riferimento", annoDaUsare)',
    "IVA rows studio filter",
)
p.write_text(s, encoding="utf-8")

print("Guarded scadenzari fixes applied")
