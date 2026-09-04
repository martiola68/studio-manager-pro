from pathlib import Path

INDEX = Path('src/pages/scadenze/affitti/index.tsx')
NUOVO = Path('src/pages/scadenze/affitti/nuovo.tsx')


def patch_index():
    s = INDEX.read_text(encoding='utf-8')
    old = '''      const { data: utenteDb, error: utenteError } = await supabase\n        .from("tbutenti")\n        .select("id, studio_id")\n        .eq("id", user.id)\n        .single();\n\n      if (utenteError || !utenteDb?.studio_id) {\n        console.error("Errore recupero studio utente:", utenteError);\n        setContratti([]);\n        return;\n      }\n\n      const currentStudioId = utenteDb.studio_id as string;'''
    new = '''      let { data: utenteDb, error: utenteError } = await supabaseAny\n        .from("tbutenti")\n        .select("id, studio_id, email")\n        .eq("user_id", user.id)\n        .maybeSingle();\n\n      if (!utenteDb && user.email) {\n        const fallback = await supabaseAny\n          .from("tbutenti")\n          .select("id, studio_id, email")\n          .ilike("email", user.email)\n          .maybeSingle();\n        utenteDb = fallback.data;\n        utenteError = fallback.error;\n      }\n\n      if (utenteError || !utenteDb?.studio_id) {\n        console.error("Errore recupero studio utente:", utenteError);\n        setContratti([]);\n        return;\n      }\n\n      const currentStudioId = utenteDb.studio_id as string;'''
    if old not in s:
        raise SystemExit('Index auth block not found')
    s = s.replace(old, new, 1)
    if '.eq("id", user.id)' in s:
        raise SystemExit('Legacy auth id lookup remains in index')
    if '.eq("user_id", user.id)' not in s or '.ilike("email", user.email)' not in s:
        raise SystemExit('Index verification failed')
    INDEX.write_text(s, encoding='utf-8')


def patch_nuovo():
    s = NUOVO.read_text(encoding='utf-8')
    old = '''      const { data: utenteDb, error: utenteError } = await supabase\n        .from("tbutenti")\n        .select("id, studio_id, nome, cognome, email")\n        .eq("id", user.id)\n        .single();\n\n      if (utenteError || !utenteDb?.studio_id) {\n        console.error("Errore recupero dati utente:", utenteError);\n        setLoading(false);\n        return;\n      }'''
    new = '''      let { data: utenteDb, error: utenteError } = await supabaseAny\n        .from("tbutenti")\n        .select("id, studio_id, nome, cognome, email")\n        .eq("user_id", user.id)\n        .maybeSingle();\n\n      if (!utenteDb && user.email) {\n        const fallback = await supabaseAny\n          .from("tbutenti")\n          .select("id, studio_id, nome, cognome, email")\n          .ilike("email", user.email)\n          .maybeSingle();\n        utenteDb = fallback.data;\n        utenteError = fallback.error;\n      }\n\n      if (utenteError || !utenteDb?.studio_id) {\n        console.error("Errore recupero dati utente:", utenteError);\n        setLoading(false);\n        return;\n      }'''
    if old not in s:
        raise SystemExit('Nuovo auth block not found')
    s = s.replace(old, new, 1)

    # utente_operatore_id is a FK to tbutenti.id, not the Supabase auth uid.
    s = s.replace('utente_operatore_id: contratto.utente_operatore_id || user.id,',
                  'utente_operatore_id: contratto.utente_operatore_id || utenteDb.id,', 1)
    s = s.replace('utente_operatore_id: user.id,',
                  'utente_operatore_id: utenteDb.id,', 1)

    if '.eq("id", user.id)' in s:
        raise SystemExit('Legacy auth id lookup remains in nuovo')
    if '.eq("user_id", user.id)' not in s or '.ilike("email", user.email)' not in s:
        raise SystemExit('Nuovo verification failed')
    if 'utente_operatore_id: contratto.utente_operatore_id || utenteDb.id,' not in s:
        raise SystemExit('Edit operator fallback not fixed')
    if 'utente_operatore_id: utenteDb.id,' not in s:
        raise SystemExit('New operator id not fixed')
    NUOVO.write_text(s, encoding='utf-8')


patch_index()
patch_nuovo()
print('Affitti auth mapping hotfix applied')
