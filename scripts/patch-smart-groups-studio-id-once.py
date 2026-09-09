from pathlib import Path

# Patch UI: read current user's studio_id and send it when creating the group.
p = Path('src/pages/presenze/smart-gruppi.tsx')
s = p.read_text(encoding='utf-8')
old = s

s = s.replace('const [microsoftConnectionId, setMicrosoftConnectionId] = useState("");', 'const [microsoftConnectionId, setMicrosoftConnectionId] = useState("");\nconst [studioId, setStudioId] = useState("");', 1)
s = s.replace('.select("id, tipo_utente, microsoft_connection_id")', '.select("id, tipo_utente, microsoft_connection_id, studio_id")', 1)
s = s.replace('setMicrosoftConnectionId(data?.microsoft_connection_id || "");', 'setMicrosoftConnectionId(data?.microsoft_connection_id || "");\n      setStudioId(data?.studio_id || "");', 1)
s = s.replace('''        body: JSON.stringify({
          ...form,
          utenti: utentiSelezionati.map((utente_id) => ({''','''        body: JSON.stringify({
          ...form,
          studio_id: studioId,
          utenti: utentiSelezionati.map((utente_id) => ({''', 1)

if s == old:
    raise SystemExit('smart-gruppi.tsx: no changes')
assert 'const [studioId, setStudioId] = useState("");' in s
assert '.select("id, tipo_utente, microsoft_connection_id, studio_id")' in s
assert 'studio_id: studioId,' in s
p.write_text(s, encoding='utf-8')

# Patch API: require studio_id and persist it on the parent group.
p = Path('src/pages/api/presenze/smart/gruppi.ts')
s = p.read_text(encoding='utf-8')
old = s

s = s.replace('''      scelta_libera,
      utenti,
    } = req.body;''','''      scelta_libera,
      studio_id,
      utenti,
    } = req.body;''', 1)
s = s.replace('''    if (!settore || !nome_gruppo || !Array.isArray(utenti)) {
      return res.status(400).json({
        error: "settore, nome_gruppo e utenti sono obbligatori",
      });
    }''','''    if (!settore || !nome_gruppo || !studio_id || !Array.isArray(utenti)) {
      return res.status(400).json({
        error: "studio_id, settore, nome_gruppo e utenti sono obbligatori",
      });
    }''', 1)
s = s.replace('''      .insert({
        settore,''','''      .insert({
        studio_id,
        settore,''', 1)

if s == old:
    raise SystemExit('gruppi.ts: no changes')
assert 'studio_id,' in s
assert 'error: "studio_id, settore, nome_gruppo e utenti sono obbligatori"' in s
assert '.insert({\n        studio_id,' in s
p.write_text(s, encoding='utf-8')
