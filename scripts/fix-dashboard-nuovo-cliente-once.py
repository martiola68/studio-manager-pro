from pathlib import Path

# Dashboard: point to the existing Clienti page instead of the non-existent /clienti/nuovo route.
dashboard = Path('src/pages/dashboard.tsx')
s = dashboard.read_text(encoding='utf-8')
old = s
needle = '{ label: "Nuovo cliente", href: "/clienti/nuovo", icon: UserRoundPlus }'
repl = '{ label: "Nuovo cliente", href: "/clienti?nuovo=1", icon: UserRoundPlus }'
if s.count(needle) != 1:
    raise SystemExit('dashboard Nuovo cliente marker mismatch')
s = s.replace(needle, repl, 1)
if s == old:
    raise SystemExit('dashboard no changes')
dashboard.write_text(s, encoding='utf-8')

# Clienti: when arriving with ?nuovo=1, invoke the SAME existing handleAddNew logic.
clienti = Path('src/pages/clienti/index.tsx')
c = clienti.read_text(encoding='utf-8')
old_c = c
marker = '''  const handleAddNew = () => {\n    resetForm();\n    setIsDialogOpen(true);\n  };\n\nconst handleEdit = async (cliente: ClienteRow) => {'''
replacement = '''  const handleAddNew = () => {\n    resetForm();\n    setIsDialogOpen(true);\n  };\n\n  useEffect(() => {\n    if (!router.isReady || router.query.nuovo !== "1") return;\n\n    handleAddNew();\n\n    // Rimuove il parametro senza ricaricare la pagina: chiudendo la modale\n    // non si riapre accidentalmente al prossimo render/back navigation.\n    void router.replace("/clienti", undefined, { shallow: true });\n  }, [router.isReady, router.query.nuovo]);\n\nconst handleEdit = async (cliente: ClienteRow) => {'''
if c.count(marker) != 1:
    raise SystemExit('clienti handleAddNew marker mismatch')
c = c.replace(marker, replacement, 1)

assert '/clienti/nuovo' not in s
assert '/clienti?nuovo=1' in s
assert 'router.query.nuovo !== "1"' in c
assert 'handleAddNew();' in c

if c == old_c:
    raise SystemExit('clienti no changes')
clienti.write_text(c, encoding='utf-8')
