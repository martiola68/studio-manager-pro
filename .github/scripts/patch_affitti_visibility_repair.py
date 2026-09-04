from pathlib import Path

p = Path('src/pages/scadenze/affitti/index.tsx')
s = p.read_text(encoding='utf-8')

old = '''      const enabled = await isEncryptionEnabled(currentStudioId as string);\n      setEncryptionEnabled(Boolean(enabled));\n\n      const { data, error } = await supabaseAny\n        .from("tbscadaffitti")'''
new = '''      const enabled = await isEncryptionEnabled(currentStudioId as string);\n      setEncryptionEnabled(Boolean(enabled));\n\n      const { data: sessionData } = await supabase.auth.getSession();\n      const accessToken = sessionData.session?.access_token;\n      if (accessToken) {\n        const repairResponse = await fetch("/api/scadenze/affitti/ripristina-visibilita", {\n          method: "POST",\n          headers: { Authorization: `Bearer ${accessToken}` },\n        });\n        if (!repairResponse.ok) {\n          console.error("Ripristino visibilità contratti affitto fallito", await repairResponse.text());\n        }\n      }\n\n      const { data, error } = await supabaseAny\n        .from("tbscadaffitti")'''

if old not in s:
    raise SystemExit('Insertion marker not found')
s = s.replace(old, new, 1)

if '/api/scadenze/affitti/ripristina-visibilita' not in s:
    raise SystemExit('Repair endpoint call missing')

p.write_text(s, encoding='utf-8')
print('Affitti visibility repair hook added')
