from pathlib import Path

p = Path('src/pages/impostazioni/scadenzari.tsx')
s = p.read_text(encoding='utf-8')


def once(old, new, label):
    global s
    if s.count(old) != 1:
        raise SystemExit(f'{label}: found {s.count(old)} matches')
    s = s.replace(old, new, 1)

marker = '''  const getSelectedScadenzari = () =>
    SCADENZARI_CONFIG.filter((item) => scadenzariFlags[item.key]);
'''
helper = marker + '''
  const getCurrentStudioUser = async (): Promise<{ studioId: string; utenteId: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("Sessione non valida");

    let { data: utente, error } = await supabase
      .from("tbutenti")
      .select("id, studio_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if ((!utente || error) && session.user.email) {
      const fallback = await supabase
        .from("tbutenti")
        .select("id, studio_id")
        .eq("email", session.user.email)
        .maybeSingle();
      utente = fallback.data;
      error = fallback.error;
    }

    if (error || !utente?.id || !utente?.studio_id) {
      throw error || new Error("Utente studio non disponibile");
    }

    return { studioId: utente.studio_id, utenteId: utente.id };
  };
'''
once(marker, helper, 'helper')

# load anni per studio
once(
'''    const selezionati = getSelectedScadenzari();

    if (selezionati.length === 0) {''',
'''    const selezionati = getSelectedScadenzari();
    const { studioId: currentStudioId } = await getCurrentStudioUser();

    if (selezionati.length === 0) {''',
'load anni studio')
once(
'''        .select("anno_riferimento")
        .eq("archiviato", false);''',
'''        .select("anno_riferimento")
        .eq("studio_id", currentStudioId)
        .eq("archiviato", false);''',
'arch false studio')
once(
'''        .select("anno_riferimento")
        .eq("archiviato", true);''',
'''        .select("anno_riferimento")
        .eq("studio_id", currentStudioId)
        .eq("archiviato", true);''',
'arch true studio')

# archiviazione usa tbutenti.id, non auth.users.id
once(
'''    try {
      setProcessing(true);

      for (const item of selezionati) {''',
'''    try {
      setProcessing(true);
      const { studioId: currentStudioId, utenteId: currentUtenteId } = await getCurrentStudioUser();

      for (const item of selezionati) {''',
'archive user')
once('''            archiviato_da: session.user.id,''', '''            archiviato_da: currentUtenteId,''', 'archiviato_da')
once(
'''          } as any)
          .eq("anno_riferimento", annoArchiviazione)
          .eq("archiviato", false);''',
'''          } as any)
          .eq("studio_id", currentStudioId)
          .eq("anno_riferimento", annoArchiviazione)
          .eq("archiviato", false);''',
'archive filter')

# generazione usa user_id->tbutenti e studio corretto
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
once(old_lookup, '      const { studioId: currentStudioId } = await getCurrentStudioUser();\n', 'generation lookup')

# tenant-safe duplicate check
s = s.replace(
'''              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)''',
'''              .eq("cliente_id", cliente.id)
              .eq("studio_id", currentStudioId)
              .eq("anno_riferimento", annoGenerazione)''')

# refresh UI after archive/generation
once(
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
once('''      setShowScadenzeModal(false);''', '''      await loadAnniDisponibili();
      setShowScadenzeModal(false);''', 'generation refresh')

if 'archiviato_da: session.user.id' in s:
    raise SystemExit('old archiviato_da still present')
if '.eq("id", session.user.id)' in s:
    raise SystemExit('old wrong user lookup still present')

p.write_text(s, encoding='utf-8')
print('fixed scadenzari identity + yearly filters')
