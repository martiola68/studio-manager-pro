from pathlib import Path

p = Path('src/pages/impostazioni/scadenzari.tsx')
s = p.read_text(encoding='utf-8')


def one(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, found {n}')
    s = s.replace(old, new, 1)

# Proforma: rimosso anche dalla Gestione Scadenzari.
one('  proforma: boolean;\n', '', 'type proforma')
one('  { key: "proforma", label: "Proforma", table: "tbscadproforma" },\n', '', 'config proforma')
one('      proforma: true,\n', '', 'state proforma')

# Helper unico per recuperare correttamente lo studio dell'utente autenticato.
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
one(marker, helper, 'studio helper')

# Anni archiviabili/eliminabili: solo dati dello studio corrente.
one(
'''    const selezionati = getSelectedScadenzari();

    if (selezionati.length === 0) {''',
'''    const selezionati = getSelectedScadenzari();
    const currentStudioId = await getCurrentStudioId();

    if (selezionati.length === 0) {''',
'load anni studio id')
one(
'''        .select("anno_riferimento")
        .eq("archiviato", false);''',
'''        .select("anno_riferimento")
        .eq("studio_id", currentStudioId)
        .eq("archiviato", false);''',
'archiviabili studio filter')
one(
'''        .select("anno_riferimento")
        .eq("archiviato", true);''',
'''        .select("anno_riferimento")
        .eq("studio_id", currentStudioId)
        .eq("archiviato", true);''',
'eliminabili studio filter')

# Archiviazione: anno + studio e refresh immediato degli anni.
one(
'''    try {
      setProcessing(true);

      for (const item of selezionati) {''',
'''    try {
      setProcessing(true);
      const currentStudioId = await getCurrentStudioId();

      for (const item of selezionati) {''',
'archive studio id')
one(
'''          } as any)
          .eq("anno_riferimento", annoArchiviazione)
          .eq("archiviato", false);''',
'''          } as any)
          .eq("studio_id", currentStudioId)
          .eq("anno_riferimento", annoArchiviazione)
          .eq("archiviato", false);''',
'archive filters')
one(
'''      toast({
        title: "Successo",
        description: `Archiviazione logica completata per l'anno ${annoArchiviazione}`,
      });''',
'''      toast({
        title: "Successo",
        description: `Archiviazione logica completata per l'anno ${annoArchiviazione}`,
      });
      await loadAnniDisponibili();''',
'archive refresh')

# Eliminazione definitiva: sempre anno + studio.
one(
'''    try {
      setProcessing(true);

      const { error } = await supabase
        .from(nomeTabella as any)''',
'''    try {
      setProcessing(true);
      const currentStudioId = await getCurrentStudioId();

      const { error } = await supabase
        .from(nomeTabella as any)''',
'delete studio id')
one(
'''        .delete()
        .eq("anno_riferimento", annoEliminazione)
        .eq("archiviato", true);''',
'''        .delete()
        .eq("studio_id", currentStudioId)
        .eq("anno_riferimento", annoEliminazione)
        .eq("archiviato", true);''',
'delete filters')
one(
'''      toast({
        title: "Successo",
        description: `Archivi ${nomeScadenzario} dell'anno ${annoEliminazione} eliminati definitivamente`,
      });''',
'''      toast({
        title: "Successo",
        description: `Archivi ${nomeScadenzario} dell'anno ${annoEliminazione} eliminati definitivamente`,
      });
      await loadAnniDisponibili();''',
'delete refresh')

# Generazione: sostituisce lookup errato tbutenti.id = auth user id.
old_lookup = '''      const { data: utenteData, error: utenteError } = await supabase
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
one(old_lookup, '      const currentStudioId = await getCurrentStudioId();\n', 'generation studio lookup')

# I controlli anti-duplicazione devono essere tenant-safe.
s = s.replace(
'''              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)''',
'''              .eq("cliente_id", cliente.id)
              .eq("studio_id", currentStudioId)
              .eq("anno_riferimento", annoGenerazione)''')

# Elimina il blocco Proforma dalla generazione, lasciando intatto IMU.
start = s.find('      if (scadenzariFlags.proforma) {')
if start < 0:
    raise SystemExit('generation Proforma block not found')
end = s.find('      if (scadenzariFlags.imu) {', start)
if end < 0:
    raise SystemExit('IMU block after Proforma not found')
s = s[:start] + s[end:]

# Dopo la generazione ricarica gli anni disponibili nella gestione.
one(
'''      setShowScadenzeModal(false);''',
'''      await loadAnniDisponibili();
      setShowScadenzeModal(false);''',
'generation refresh')

for forbidden in ['proforma: boolean', 'tbscadproforma', 'scadenzariFlags.proforma', 'flag_proforma']:
    if forbidden in s:
        raise SystemExit(f'residual Proforma ref: {forbidden}')

if '.eq("id", session.user.id)' in s:
    raise SystemExit('old wrong tbutenti id lookup still present')

p.write_text(s, encoding='utf-8')
print('scadenzari step 2 patched')
