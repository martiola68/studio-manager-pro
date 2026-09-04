from pathlib import Path
import re

p = Path('src/pages/scadenze/bilanci.tsx')
s = p.read_text(encoding='utf-8')
original = s

# Operatori: Nome -> Cognome
s = s.replace('.order("cognome", { ascending: true });', '.order("nome", { ascending: true }).order("cognome", { ascending: true });', 1)

# Pagina bounded come gli scadenzari approvati.
s = s.replace('<div className="space-y-6">', '<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-slate-200/70 px-3 pb-3 pt-2">', 1)
s = s.replace('<div className="flex items-center justify-between gap-4 flex-wrap">', '<div className="flex shrink-0 items-center justify-between gap-4 flex-wrap">', 1)
s = s.replace('<div className="grid grid-cols-1 md:grid-cols-3 gap-4">', '<div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3">', 1)

# Stat cards
s = s.replace('<Card>\n          <CardContent className="pt-6">', '<Card className="border border-sky-200 bg-slate-50 shadow-sm">\n          <CardContent className="pt-5">', 3)

# Filter card
s = s.replace('      <Card>\n        <CardHeader>\n          <CardTitle>Filtri e Ricerca</CardTitle>\n        </CardHeader>', '      <Card className="shrink-0 border border-sky-200 bg-slate-50 shadow-sm">\n        <CardHeader className="pb-3">\n          <CardTitle>Filtri e Ricerca</CardTitle>\n        </CardHeader>', 1)
s = s.replace('className="pl-10"', 'className="h-9 border-slate-300 bg-white pl-10"', 1)
s = s.replace('<SelectTrigger>', '<SelectTrigger className="h-9 border-slate-300 bg-white">', 3)

# Main table card + viewport scroll
s = s.replace('      <Card>\n        <CardContent className="p-0">\n          <div className="relative w-full overflow-auto max-h-[600px]">', '      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-sky-200 bg-slate-50 shadow-sm">\n        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">\n          <div className="h-full w-full overflow-auto">', 1)

# Dark sticky header, compact rows
s = s.replace('<thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">', '<thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm [&_tr]:border-b [&_tr]:border-slate-500">', 1)
s = s.replace('className="border-b-2 border-gray-300 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"', 'className="border-b border-slate-500"', 1)

# Header cells: preserve widths but standardize visual classes.
s = re.sub(
    r'className="h-10 px-2 text-left align-middle font-medium text-muted-foreground([^\"]*)"',
    lambda m: 'className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600' + m.group(1).replace(' border-r-2 border-gray-300', '') + '"',
    s,
)

# Sticky Nominativo header must stay same dark tone.
s = s.replace('sticky-col-header border-r border-slate-500 min-w-[200px]', 'sticky-col-header border-r border-slate-500 min-w-[200px] !bg-slate-600', 1)

# Generic checkbox -> compact SI/NO select, preserving exact toggle handler/field/current value.
checkbox_rx = re.compile(
    r'''<input\s+type="checkbox"\s+checked=\{scadenza\.(?P<field>[A-Za-z0-9_]+)\s*\|\|\s*false\}\s+onChange=\{\(\)\s*=>\s*handleToggleField\(\s*scadenza\.id,\s*"(?P=field)",\s*scadenza\.(?P=field)\s*\)\s*\}\s+className="rounded w-4 h-4 cursor-pointer"\s*/>''',
    re.S,
)

def repl(m):
    f = m.group('field')
    return f'''<select\n                          value={{scadenza.{f} ? "SI" : "NO"}}\n                          onChange={{(e) => {{\n                            const nextValue = e.target.value === "SI";\n                            if (nextValue !== Boolean(scadenza.{f})) {{\n                              handleToggleField(scadenza.id, "{f}", scadenza.{f});\n                            }}\n                          }}}}\n                          className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700"\n                        >\n                          <option value="NO">NO</option>\n                          <option value="SI">SI</option>\n                        </select>'''

s, converted = checkbox_rx.subn(repl, s)
if converted < 9:
    raise SystemExit(f'Expected at least 9 checkbox conversions, got {converted}')

# Compact cells and fields.
s = s.replace('"p-2 align-middle', '"px-2 py-1 align-middle')
s = s.replace('className={dateInputClass(scadenza.data_approvazione)}', 'className={`${dateInputClass(scadenza.data_approvazione)} h-8 border-slate-300 bg-white text-xs`}', 1)
s = s.replace('className={dateInputClass(\n                            scadenza.data_scad_pres,\n                            true\n                          )}', 'className={`${dateInputClass(\n                            scadenza.data_scad_pres,\n                            true\n                          )} h-8 border-slate-300 text-xs`}', 1)
s = s.replace('className={dateInputClass(scadenza.data_invio)}', 'className={`${dateInputClass(scadenza.data_invio)} h-8 border-slate-300 bg-white text-xs`}', 1)

# Textarea compact white.
s = s.replace('placeholder="Aggiungi note..."', 'placeholder="Aggiungi note..."\n                          rows={1}\n                          className="h-8 min-h-8 resize-none border-slate-300 bg-white py-1.5"', 1)
# Remove original className if it immediately follows our inserted textarea attrs.
s = s.replace('className="h-8 min-h-8 resize-none border-slate-300 bg-white py-1.5"\n                          className=', 'className=', 1) if False else s

# Unconfirmed rows neutral; confirmed remains green, including sticky nominativo.
s = s.replace('"border-b-2 border-gray-500 transition-colors",', '"border-b border-gray-300 transition-colors",', 1)
s = s.replace('? "bg-green-300 hover:bg-green-300"\n                          : "hover:bg-green-50",', '? "bg-green-200 hover:bg-green-200"\n                          : "bg-slate-50 hover:bg-slate-100",', 1)
s = s.replace('scadenza.conferma_riga ? "!bg-green-300" : "!bg-white"', 'scadenza.conferma_riga ? "!bg-green-200" : "!bg-slate-50"', 1)

# Verification
required = [
    'bg-slate-600 text-white',
    'border border-sky-200 bg-slate-50',
    'h-full w-full overflow-auto',
    'value={scadenza.consorzio ? "SI" : "NO"}',
    'value={scadenza.conferma_riga ? "SI" : "NO"}',
    '.order("nome", { ascending: true }).order("cognome", { ascending: true });',
]
for token in required:
    if token not in s:
        raise SystemExit('Verification failed: ' + token)
if 'type="checkbox"' in s:
    raise SystemExit('Checkbox still present in Bilanci page')
if s == original:
    raise SystemExit('No changes')

p.write_text(s, encoding='utf-8')
print(f'Bilanci visual patch applied; converted {converted} checkbox controls')
