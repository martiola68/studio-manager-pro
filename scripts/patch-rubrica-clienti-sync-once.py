from pathlib import Path

# 1) Corregge la sincronizzazione tbclienti -> tbcontatti per le persone fisiche
p = Path('src/pages/clienti/index.tsx')
s = p.read_text(encoding='utf-8')
old = s

marker = ''' const isPersonaFisica = clienteData.tipo_cliente === "Persona fisica";\n\nconst cognomeContatto = isPersonaFisica\n  ? String((clienteData as any).cognome || "").trim()\n  : String(clienteData.ragione_sociale || "").trim();\n\nconst nomeContatto = isPersonaFisica\n  ? String((clienteData as any).nome || "").trim()\n  : "";\n'''
replacement = ''' const isPersonaFisica = clienteData.tipo_cliente === "Persona fisica";\n\nconst nomePersona = isPersonaFisica\n  ? String((clienteData as any).nome || "").trim()\n  : "";\n\nconst cognomePersonaRaw = isPersonaFisica\n  ? String((clienteData as any).cognome || "").trim()\n  : "";\n\nconst cognomePersona =\n  nomePersona &&\n  cognomePersonaRaw.toUpperCase().endsWith(` ${nomePersona.toUpperCase()}`)\n    ? cognomePersonaRaw.slice(0, -nomePersona.length).trim()\n    : cognomePersonaRaw;\n\nconst cognomeContatto = isPersonaFisica\n  ? cognomePersona\n  : String(clienteData.ragione_sociale || "").trim();\n\nconst nomeContatto = nomePersona;\n'''

if 'const cognomePersonaRaw = isPersonaFisica' not in s:
    if s.count(marker) != 1:
        raise SystemExit('clienti sync marker mismatch')
    s = s.replace(marker, replacement, 1)

if s != old:
    p.write_text(s, encoding='utf-8')

# 2) Nella ricerca Rubrica include sempre i clienti tbclienti, anche se non hanno referenti
p = Path('src/pages/contatti/index.tsx')
s = p.read_text(encoding='utf-8')
old = s

marker = '''  const map = new Map<string, any>();\n\n  contatti.forEach((contatto) => {\n'''
replacement = '''  const map = new Map<string, any>();\n\n  // Mostra anche i clienti provenienti direttamente da tbclienti,\n  // indipendentemente dalla presenza di relazioni/referenti in tbcontatti_clienti.\n  clienti.forEach((cliente) => {\n    const nomeSocieta = cliente.ragione_sociale || "";\n    const matchSocieta =\n      nomeSocieta.toLowerCase().includes(query) ||\n      (cliente.email || "").toLowerCase().includes(query) ||\n      (cliente.telefono || "").toLowerCase().includes(query) ||\n      (cliente.pec || "").toLowerCase().includes(query);\n\n    if (!matchSocieta) return;\n\n    map.set(cliente.id, {\n      cliente_id: cliente.id,\n      ragione_sociale: nomeSocieta,\n      email: cliente.email || "",\n      telefono: cliente.telefono || "",\n      pec: cliente.pec || "",\n      referenti: [],\n    });\n  });\n\n  contatti.forEach((contatto) => {\n'''

if 'Mostra anche i clienti provenienti direttamente da tbclienti' not in s:
    if s.count(marker) != 1:
        raise SystemExit('rubrica grouping marker mismatch')
    s = s.replace(marker, replacement, 1)

if s != old:
    p.write_text(s, encoding='utf-8')
