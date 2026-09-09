from pathlib import Path

p = Path('src/pages/contatti/index.tsx')
s = p.read_text(encoding='utf-8')
old = s

marker = '''  const filterContatti = () => {\n    let filtered = [...contatti];\n\n    if (searchQuery) {\n'''
replacement = '''  const filterContatti = () => {\n    // In Rubrica devono comparire solo nominativi con almeno un recapito reale.\n    // Un record privo di email/PEC/telefono/cellulare non è utile come contatto.\n    let filtered = contatti.filter((c) =>\n      [\n        c.email,\n        c.pec,\n        c.cell,\n        c.tel,\n        c.altro_telefono,\n        c.email_secondaria,\n        c.email_altro,\n      ].some((value) => String(value || "").trim().length > 0)\n    );\n\n    if (searchQuery) {\n'''

if 'Un record privo di email/PEC/telefono/cellulare non è utile come contatto.' not in s:
    if s.count(marker) != 1:
        raise SystemExit('Rubrica filter marker mismatch')
    s = s.replace(marker, replacement, 1)

if s == old:
    raise SystemExit('no Rubrica empty-contact filter changes applied')

assert 'c.email_secondaria' in s
assert 'c.email_altro' in s
assert 'contatti.filter((c) =>' in s

p.write_text(s, encoding='utf-8')
