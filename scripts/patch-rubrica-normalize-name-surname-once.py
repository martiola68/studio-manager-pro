from pathlib import Path

p = Path('src/pages/contatti/index.tsx')
s = p.read_text(encoding='utf-8')
old = s

# 1) Helper di normalizzazione condiviso.
marker = '''const initialFormData: FormDataState = {\n'''
helper = '''const normalizeCognomeNome = (cognomeValue: unknown, nomeValue: unknown) => {\n  const cognome = String(cognomeValue || "").trim().replace(/\\s+/g, " ");\n  const nome = String(nomeValue || "").trim().replace(/\\s+/g, " ");\n\n  if (!cognome || !nome) {\n    return { cognome, nome };\n  }\n\n  const cognomeUpper = cognome.toUpperCase();\n  const nomeUpper = nome.toUpperCase();\n  const suffix = ` ${nomeUpper}`;\n\n  // Corregge solo il caso tipico di nome duplicato in coda al cognome,\n  // evitando sostituzioni nel mezzo di cognomi composti reali.\n  if (cognomeUpper.endsWith(suffix)) {\n    return {\n      cognome: cognome.slice(0, cognome.length - nome.length).trim(),\n      nome,\n    };\n  }\n\n  return { cognome, nome };\n};\n\n'''
if 'const normalizeCognomeNome = (' not in s:
    if s.count(marker) != 1:
        raise SystemExit('initialFormData marker mismatch')
    s = s.replace(marker, helper + marker, 1)

# 2) Normalizza subito i dati caricati, così i record già sporchi vengono mostrati corretti.
old_load = '''      const hydrated = await hydrateContatti(data, enabled);\n      setContatti(hydrated);\n'''
new_load = '''      const hydrated = await hydrateContatti(data, enabled);\n      const normalized = hydrated.map((contatto) => {\n        const nominativo = normalizeCognomeNome(contatto.cognome, contatto.nome);\n        return {\n          ...contatto,\n          cognome: nominativo.cognome,\n          nome: nominativo.nome,\n        };\n      });\n      setContatti(normalized);\n'''
if old_load in s:
    s = s.replace(old_load, new_load, 1)

# 3) La modale apre cognome/nome già corretti.
old_open = '''  const openEditDialog = (contatto: Contatto) => {\n    setEditingContatto(contatto);\n   setFormData({\n  cognome: contatto.cognome || "",\n  nome: contatto.nome || "",\n'''
new_open = '''  const openEditDialog = (contatto: Contatto) => {\n    setEditingContatto(contatto);\n    const nominativo = normalizeCognomeNome(contatto.cognome, contatto.nome);\n   setFormData({\n  cognome: nominativo.cognome,\n  nome: nominativo.nome,\n'''
if old_open in s:
    s = s.replace(old_open, new_open, 1)

# 4) Prima di salvare, persiste il cognome già ripulito.
old_submit = '''let dataToSave: any = {\n  studio_id: studioId || null,\n  cognome: formData.cognome,\n  nome: formData.nome || "",\n'''
new_submit = '''const nominativoNormalizzato = normalizeCognomeNome(\n  formData.cognome,\n  formData.nome\n);\n\nlet dataToSave: any = {\n  studio_id: studioId || null,\n  cognome: nominativoNormalizzato.cognome,\n  nome: nominativoNormalizzato.nome,\n'''
if old_submit in s:
    s = s.replace(old_submit, new_submit, 1)

# 5) Anche i nuovi import vengono normalizzati prima dell'inserimento.
old_import = '''          let contattoData: any = {\n            cognome: row.cognome.trim(),\n            nome: row.nome?.trim() || "",\n'''
new_import = '''          const nominativoImport = normalizeCognomeNome(\n            row.cognome,\n            row.nome\n          );\n\n          let contattoData: any = {\n            cognome: nominativoImport.cognome,\n            nome: nominativoImport.nome,\n'''
if old_import in s:
    s = s.replace(old_import, new_import, 1)

if s == old:
    raise SystemExit('no Rubrica normalization changes applied')

assert 'const normalizeCognomeNome = (' in s
assert 'const normalized = hydrated.map((contatto) =>' in s
assert 'const nominativoNormalizzato = normalizeCognomeNome(' in s
assert 'const nominativoImport = normalizeCognomeNome(' in s

p.write_text(s, encoding='utf-8')
