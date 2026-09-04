from pathlib import Path
import re

p = Path('src/pages/scadenze/modello-770.tsx')
s = p.read_text(encoding='utf-8')
original = s

# Operator sorting: first name, then surname.
s = s.replace('.order("cognome", { ascending: true });', '.order("nome", { ascending: true }).order("cognome", { ascending: true });', 1)

# Bounded page layout like approved scadenzari.
s = s.replace('<div className="space-y-6">', '<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-slate-200/70 px-3 pb-3 pt-2">', 1)
s = s.replace('<div className="flex items-center justify-between gap-4 flex-wrap">', '<div className="flex shrink-0 items-center justify-between gap-4 flex-wrap">', 1)
s = s.replace('<div className="grid grid-cols-1 md:grid-cols-3 gap-4">', '<div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3">', 1)

# Stat cards.
s = s.replace('<Card>\n          <CardContent className="pt-6">', '<Card className="border border-sky-200 bg-slate-50 shadow-sm">\n          <CardContent className="pt-5">', 3)

# Filter card / controls.
s = s.replace('<Card className="mb-6">', '<Card className="shrink-0 border border-sky-200 bg-slate-50 shadow-sm">', 1)
s = s.replace('<CardHeader>', '<CardHeader className="pb-3">', 1)
s = s.replace('className="pl-10"', 'className="h-9 border-slate-300 bg-white pl-10"', 1)
s = s.replace('<SelectTrigger>', '<SelectTrigger className="h-9 border-slate-300 bg-white">', 5)

# Main table card and internal scrolling.
s = s.replace('      <Card>\n        <CardContent className="p-0">\n          <div className="relative w-full overflow-auto max-h-[600px]">', '      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-sky-200 bg-slate-50 shadow-sm">\n        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">\n          <div className="h-full w-full overflow-auto">', 1)

# Dark compact sticky header.
s = s.replace('<thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">', '<thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm [&_tr]:border-b [&_tr]:border-slate-500">', 1)
s = s.replace('className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"', 'className="border-b border-slate-500"', 1)
s = re.sub(
    r'className="h-10 px-2 ([^"]*?)font-medium text-muted-foreground([^"]*)"',
    lambda m: 'className="h-9 px-2 ' + m.group(1) + 'font-semibold text-slate-50 border-r border-slate-500 bg-slate-600' + m.group(2).replace(' border-r', '') + '"',
    s,
)
# Nominativo needs to override global white sticky header.
s = s.replace('sticky-col-header border-r min-w-[200px]', 'sticky-col-header border-r border-slate-500 min-w-[260px] !bg-slate-600', 1)

# Compact cells and wider nominativo.
s = s.replace('className={`p-2 align-middle sticky-col-cell border-r font-medium min-w-[200px]', 'className={`px-2 py-1 align-middle sticky-col-cell border-r font-medium min-w-[260px]', 1)
s = s.replace('className="p-2 align-middle', 'className="px-2 py-1 align-middle')

# Confirmed row color consistent with approved scadenzari.
s = s.replace('? "bg-green-100 hover:bg-green-100"\n                            : "hover:bg-green-50"', '? "bg-green-200 hover:bg-green-200"\n                            : "bg-slate-50 hover:bg-slate-100"', 1)
s = s.replace('? "#dcfce7"\n                              : "#ffffff"', '? "#bbf7d0"\n                              : "#f8fafc"', 1)

# White compact operator inputs.
s = s.replace('className="w-full text-xs bg-gray-50 cursor-not-allowed"', 'className="h-8 w-full border-slate-300 bg-white text-xs disabled:bg-slate-100"')

# Compact Tipo invio / Tipo 770 triggers.
s = s.replace('<SelectTrigger className="w-full text-xs">', '<SelectTrigger className="h-8 w-full border-slate-300 bg-white text-xs">', 2)

# Convert boolean checkboxes to compact SI/NO selects while preserving disabled state.
checkbox_rx = re.compile(
    r'''<input\s+type="checkbox"\s+checked=\{(?P<checked>scadenza\.(?P<field>mod_compilato|mod_definitivo|mod_inviato)|isRicevuta|isConfermata)(?:\s*\|\|\s*false)?\}\s+onChange=\{\(\)\s*=>\s*handleToggleField\(\s*scadenza\.id,\s*"(?P<dbfield>mod_compilato|mod_definitivo|mod_inviato|ricevuta|conferma_riga)",\s*(?P<current>scadenza\.(?:mod_compilato|mod_definitivo|mod_inviato|ricevuta|conferma_riga)|isConfermata)\s*\)\s*\}\s+className="rounded w-4 h-4 cursor-pointer"(?P<disabled>\s+disabled=\{isConfermata\})?\s*/>''',
    re.S,
)

def checkbox_to_select(m):
    checked = m.group('checked')
    dbfield = m.group('dbfield')
    current = m.group('current')
    disabled = ' disabled={isConfermata}' if m.group('disabled') else ''
    return f'''<select
                            value={{{checked} ? "SI" : "NO"}}
                            onChange={{(e) => {{
                              const nextValue = e.target.value === "SI";
                              if (nextValue !== Boolean({checked})) {{
                                handleToggleField(scadenza.id, "{dbfield}", {current});
                              }}
                            }}}}{disabled}
                            className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="NO">NO</option>
                            <option value="SI">SI</option>
                          </select>'''

s, converted = checkbox_rx.subn(checkbox_to_select, s)
if converted != 5:
    raise SystemExit(f'Expected 5 checkbox conversions, got {converted}')

# Compact date / textarea.
s = s.replace('className="w-36 text-xs"', 'className="h-8 w-36 border-slate-300 bg-white text-xs"', 1)
s = s.replace('className="min-h-[60px] text-xs resize-none"', 'rows={1}\n                            className="h-8 min-h-8 resize-none border-slate-300 bg-white py-1.5 text-xs"', 1)

# Empty state remains 14 columns.

required = [
    'bg-slate-600 text-white',
    'border border-sky-200 bg-slate-50',
    'h-full w-full overflow-auto',
    'value={scadenza.mod_compilato ? "SI" : "NO"}',
    'value={scadenza.mod_definitivo ? "SI" : "NO"}',
    'value={scadenza.mod_inviato ? "SI" : "NO"}',
    'value={isRicevuta ? "SI" : "NO"}',
    'value={isConfermata ? "SI" : "NO"}',
    '.order("nome", { ascending: true }).order("cognome", { ascending: true });',
    '!bg-slate-600',
]
for token in required:
    if token not in s:
        raise SystemExit('Verification failed: ' + token)
if 'type="checkbox"' in s:
    raise SystemExit('Checkbox still present in 770 runtime')
if s == original:
    raise SystemExit('No changes')

p.write_text(s, encoding='utf-8')
print(f'770 visual patch applied; converted {converted} checkbox controls')
