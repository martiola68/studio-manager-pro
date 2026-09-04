from pathlib import Path

p = Path('src/pages/scadenze/affitti/index.tsx')
s = p.read_text(encoding='utf-8')

old = '''      let { data: utenteDb, error: utenteError } = await supabaseAny\n        .from("tbutenti")\n        .select("id, studio_id, email")\n        .eq("user_id", user.id)\n        .maybeSingle();\n\n      if (!utenteDb && user.email) {\n        const fallback = await supabaseAny\n          .from("tbutenti")\n          .select("id, studio_id, email")\n          .ilike("email", user.email)\n          .maybeSingle();\n        utenteDb = fallback.data;\n        utenteError = fallback.error;\n      }\n\n      if (utenteError || !utenteDb?.studio_id) {\n        console.error("Errore recupero studio utente:", utenteError);\n        setContratti([]);\n        return;\n      }\n\n      const currentStudioId = utenteDb.studio_id as string;\n      setStudioId(currentStudioId);'''
new = '''      const { data: currentStudioId, error: studioError } = await supabaseAny\n        .rpc("current_studio_id");\n\n      if (studioError || !currentStudioId) {\n        console.error("Errore recupero studio corrente:", studioError);\n        setContratti([]);\n        return;\n      }\n\n      setStudioId(currentStudioId as string);'''

if old not in s:
    raise SystemExit('Affitti current studio block not found')
s = s.replace(old, new, 1)

s = s.replace(
    '''      const { data, error } = await supabaseAny\n        .from("tbscadaffitti")\n        .select("*")\n        .eq("studio_id", currentStudioId)\n        .order("data_prossima_scadenza", { ascending: true });''',
    '''      const { data, error } = await supabaseAny\n        .from("tbscadaffitti")\n        .select("*")\n        .order("data_prossima_scadenza", { ascending: true });''',
    1,
)

s = s.replace('const enabled = await isEncryptionEnabled(currentStudioId);', 'const enabled = await isEncryptionEnabled(currentStudioId as string);', 1)

if '.rpc("current_studio_id")' not in s:
    raise SystemExit('RPC current_studio_id missing')
if '.from("tbscadaffitti")\n        .select("*")\n        .eq("studio_id", currentStudioId)' in s:
    raise SystemExit('Explicit studio filter still present on list')

p.write_text(s, encoding='utf-8')
print('Affitti list now relies on DB current_studio_id + RLS')
