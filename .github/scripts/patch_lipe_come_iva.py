from pathlib import Path
import re

p = Path('src/pages/scadenze/lipe.tsx')
s = p.read_text(encoding='utf-8')
original = s

# Imports / types.
s = s.replace('import { Checkbox } from "@/components/ui/checkbox";\n', '', 1)
s = s.replace('  operatore?: string;\n};', '  operatore?: string;\n  anno_riferimento?: number | null;\n  archiviato?: boolean | null;\n};', 1)

# Compact approved visual tokens.
s = s.replace(
    'const baseHeaderClass =\n  "h-10 px-2 text-center align-middle font-medium text-muted-foreground border-r border-gray-300";',
    'const baseHeaderClass =\n  "h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600";',
    1,
)
s = s.replace('const baseCellClass = "p-2 align-middle border-r border-gray-300";', 'const baseCellClass = "px-2 py-1 align-middle border-r border-slate-200";', 1)
s = s.replace('const groupHeaderQ1 = "bg-sky-100";', 'const groupHeaderQ1 = "bg-slate-600";', 1)
s = s.replace('const groupHeaderQ2 = "bg-emerald-100";', 'const groupHeaderQ2 = "bg-slate-600";', 1)
s = s.replace('const groupHeaderQ3 = "bg-amber-100";', 'const groupHeaderQ3 = "bg-slate-600";', 1)
s = s.replace('const groupHeaderQ4 = "bg-violet-100";', 'const groupHeaderQ4 = "bg-slate-600";', 1)

# Reusable compact SI/NO control.
marker = '''const isInvioMancante = (\n  lipe: boolean | null | undefined,\n  dataInvio: string | null | undefined\n) => {\n  return lipe === true && !dataInvio;\n};\n'''
helper = marker + '''\nfunction BooleanSelect({\n  value,\n  disabled = false,\n  onChange,\n}: {\n  value: boolean;\n  disabled?: boolean;\n  onChange: (value: boolean) => void;\n}) {\n  return (\n    <select\n      value={value ? "SI" : "NO"}\n      disabled={disabled}\n      onChange={(e) => onChange(e.target.value === "SI")}\n      className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"\n    >\n      <option value="NO">NO</option>\n      <option value="SI">SI</option>\n    </select>\n  );\n}\n'''
if marker not in s:
    raise SystemExit('isInvioMancante marker not found')
s = s.replace(marker, helper, 1)

# Year consultation state, same pattern as the approved scadenzari.
s = s.replace('  const { toast } = useToast();\n  const [loading, setLoading] = useState(true);', '  const { toast } = useToast();\n  const currentYear = new Date().getFullYear();\n  const [loading, setLoading] = useState(true);', 1)
s = s.replace(' const [filterTipoLiq, setFilterTipoLiq] = useState("__all__");', '  const [filterTipoLiq, setFilterTipoLiq] = useState("__all__");\n  const [annoConsultazione, setAnnoConsultazione] = useState(currentYear);\n  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);', 1)
s = s.replace('  useEffect(() => {\n    loadData();\n  }, []);', '  useEffect(() => {\n    loadData();\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [annoConsultazione]);', 1)

old_load = '''  const loadScadenze = async (): Promise<LipeRecord[]> => {\n    const { data, error } = await supabase\n      .from("tbscadlipe")\n      .select(`\n        *,\n        professionista:tbutenti!tbscadlipe_utente_professionista_id_fkey(nome, cognome),\n        operatore:tbutenti!tbscadlipe_utente_operatore_id_fkey(nome, cognome)\n      `)\n      .order("nominativo", { ascending: true });\n\n    if (error) throw error;\n\n    return (data || []).map((record) => ({\n      ...record,\n      professionista: record.professionista\n        ? `${record.professionista.nome} ${record.professionista.cognome}`\n        : "-",\n      operatore: record.operatore\n        ? `${record.operatore.nome} ${record.operatore.cognome}`\n        : "-",\n    })) as LipeRecord[];\n  };'''
new_load = '''  const loadScadenze = async (): Promise<LipeRecord[]> => {\n    const { data: anniData, error: anniError } = await supabase\n      .from("tbscadlipe" as any)\n      .select("anno_riferimento")\n      .order("anno_riferimento", { ascending: true });\n\n    if (anniError) throw anniError;\n\n    const anni = Array.from(\n      new Set(\n        (((anniData ?? []) as any[]) || [])\n          .map((r) => r.anno_riferimento)\n          .filter((a): a is number => typeof a === "number")\n      )\n    ).sort((a, b) => a - b);\n\n    setAnniDisponibili(anni);\n\n    const annoDaUsare =\n      anni.length > 0 && !anni.includes(annoConsultazione)\n        ? anni[anni.length - 1]\n        : annoConsultazione;\n\n    if (annoDaUsare !== annoConsultazione) {\n      setAnnoConsultazione(annoDaUsare);\n    }\n\n    const { data, error } = await supabase\n      .from("tbscadlipe" as any)\n      .select(`\n        *,\n        professionista:tbutenti!tbscadlipe_utente_professionista_id_fkey(nome, cognome),\n        operatore:tbutenti!tbscadlipe_utente_operatore_id_fkey(nome, cognome)\n      `)\n      .eq("anno_riferimento", annoDaUsare)\n      .order("nominativo", { ascending: true });\n\n    if (error) throw error;\n\n    return ((data || []) as any[]).map((record) => ({\n      ...record,\n      professionista: record.professionista\n        ? `${record.professionista.nome} ${record.professionista.cognome}`\n        : "-",\n      operatore: record.operatore\n        ? `${record.operatore.nome} ${record.operatore.cognome}`\n        : "-",\n    })) as LipeRecord[];\n  };'''
if old_load not in s:
    raise SystemExit('loadScadenze block not found')
s = s.replace(old_load, new_load, 1)
s = s.replace('.order("cognome", { ascending: true });', '.order("nome", { ascending: true }).order("cognome", { ascending: true });', 1)

# Page / filter layout.
s = s.replace('<div className="space-y-6">', '<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-slate-200/70 px-3 pb-3 pt-2">', 1)
s = s.replace('<div className="flex items-center justify-between">', '<div className="flex shrink-0 items-center justify-between gap-4 flex-wrap">', 1)
s = s.replace('      <Card>\n        <CardHeader>\n          <CardTitle>Filtri e Ricerca</CardTitle>', '      <Card className="shrink-0 border border-sky-200 bg-slate-50 shadow-sm">\n        <CardHeader className="pb-3">\n          <CardTitle>Filtri e Ricerca</CardTitle>', 1)
s = s.replace('<div className="grid grid-cols-1 md:grid-cols-3 gap-4">', '<div className="grid grid-cols-1 gap-4 md:grid-cols-4">', 1)
s = s.replace('className="pl-10"', 'className="h-9 border-slate-300 bg-white pl-10"', 1)
s = s.replace('<SelectTrigger>', '<SelectTrigger className="h-9 border-slate-300 bg-white">', 2)

# Add year filter after Tipo liquidazione.
year_anchor = '''  <div className="space-y-2">\n    <label className="text-sm font-medium">Tipo liquidazione</label>\n    <Select value={filterTipoLiq} onValueChange={setFilterTipoLiq}>\n      <SelectTrigger className="h-9 border-slate-300 bg-white">\n        <SelectValue placeholder="Tutti i tipi" />\n      </SelectTrigger>\n      <SelectContent>\n        <SelectItem value="__all__">Tutti i tipi</SelectItem>\n        <SelectItem value="Mensile">Mensile</SelectItem>\n        <SelectItem value="Trimestrale">Trimestrale</SelectItem>\n        <SelectItem value="Esterna">Esterna</SelectItem>\n      </SelectContent>\n    </Select>\n  </div>'''
year_block = year_anchor + '''\n\n  <div className="space-y-2">\n    <label className="text-sm font-medium">Anno consultazione</label>\n    <Select\n      value={annoConsultazione.toString()}\n      onValueChange={(value) => setAnnoConsultazione(parseInt(value))}\n    >\n      <SelectTrigger className="h-9 border-slate-300 bg-white">\n        <SelectValue placeholder="Seleziona anno" />\n      </SelectTrigger>\n      <SelectContent>\n        {anniDisponibili.map((anno) => (\n          <SelectItem key={anno} value={anno.toString()}>\n            {anno}\n          </SelectItem>\n        ))}\n      </SelectContent>\n    </Select>\n  </div>'''
if year_anchor not in s:
    raise SystemExit('Tipo liquidazione filter block not found')
s = s.replace(year_anchor, year_block, 1)

# Main card and internal scrolling.
s = s.replace('      <Card>\n        <CardContent className="p-0">\n          <div className="relative w-full overflow-auto max-h-[600px]">', '      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-sky-200 bg-slate-50 shadow-sm">\n        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">\n          <div className="h-full w-full overflow-auto">', 1)
s = s.replace('<thead className="sticky top-0 z-30 bg-white">', '<thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm">', 1)
s = s.replace('<tr className="border-b border-gray-300">', '<tr className="border-b border-slate-500">', 1)
s = s.replace('sticky-col-header h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[320px] border-r border-gray-300 bg-white', 'sticky-col-header h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[300px] border-r border-slate-500 !bg-slate-600', 1)
s = s.replace('h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px] border-r border-gray-300 bg-white', 'h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[180px] border-r border-slate-500 bg-slate-600', 1)
s = s.replace('h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[170px] border-r border-gray-300 bg-white', 'h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[170px] border-r border-slate-500 bg-slate-600', 1)

# Compact row / fixed cells.
s = s.replace('className="border-b border-gray-300 hover:bg-green-50/40"', 'className="border-b border-slate-200 hover:bg-slate-100"', 1)
s = s.replace('sticky-col-cell p-2 align-middle font-medium min-w-[320px] border-r border-gray-300 bg-white', 'sticky-col-cell px-2 py-1 align-middle font-medium min-w-[300px] border-r border-slate-200 bg-slate-50', 1)
s = s.replace('className="p-2 align-middle min-w-[180px] border-r border-gray-300"', 'className="px-2 py-1 align-middle min-w-[180px] border-r border-slate-200"', 1)
s = s.replace('className="p-2 align-middle min-w-[170px] border-r border-gray-300"', 'className="px-2 py-1 align-middle min-w-[170px] border-r border-slate-200"', 1)
s = s.replace('className="h-8 text-xs bg-white"', 'className="h-8 border-slate-300 bg-white text-xs"')

# Convert all Checkbox components to the compact BooleanSelect without changing field semantics.
checkbox_rx = re.compile(r'''<Checkbox\s+checked=\{scadenza\.(?P<field>[A-Za-z0-9_]+)\s*\|\|\s*false\}(?:\s+disabled=\{(?P<disabled>[^}]+)\})?\s+onCheckedChange=\{\(\)\s*=>\s*handleToggleField\(\s*scadenza\.id,\s*"(?P<dbfield>[A-Za-z0-9_]+)",\s*scadenza\.(?P<current>[A-Za-z0-9_]+)\s*\|\|\s*false\s*\)\s*\}\s*/>''', re.S)

def convert_checkbox(m):
    field = m.group('field')
    dbfield = m.group('dbfield')
    current = m.group('current')
    disabled = m.group('disabled')
    if field != dbfield or field != current:
        raise SystemExit(f'Unexpected checkbox field mismatch: {field}/{dbfield}/{current}')
    disabled_prop = f'\n                          disabled={{{disabled.strip()}}}' if disabled else ''
    return f'''<BooleanSelect\n                          value={{Boolean(scadenza.{field})}}{disabled_prop}\n                          onChange={{(nextValue) => {{\n                            if (nextValue !== Boolean(scadenza.{field})) {{\n                              handleToggleField(scadenza.id, "{field}", scadenza.{field} || false);\n                            }}\n                          }}}}\n                        />'''

s, converted = checkbox_rx.subn(convert_checkbox, s)
if converted != 17:
    raise SystemExit(f'Expected 17 Checkbox conversions, got {converted}')

# Keep date state colors but use consistent borders.
s = s.replace('"h-8 text-xs bg-red-600 text-white"', '"h-8 border-slate-300 bg-red-600 text-xs text-white"')
s = s.replace('"h-8 text-xs bg-green-500 text-black"', '"h-8 border-slate-300 bg-green-200 text-xs text-slate-900"')
s = s.replace('"h-8 text-xs bg-white"', '"h-8 border-slate-300 bg-white text-xs"')

required = [
    'BooleanSelect',
    'value={annoConsultazione.toString()}',
    '.eq("anno_riferimento", annoDaUsare)',
    'bg-slate-600 text-white',
    'h-full w-full overflow-auto',
    '!bg-slate-600',
    '.order("nome", { ascending: true }).order("cognome", { ascending: true });',
]
for token in required:
    if token not in s:
        raise SystemExit('Verification failed: ' + token)
if '<Checkbox' in s or 'from "@/components/ui/checkbox"' in s:
    raise SystemExit('Checkbox remains in LIPE runtime')
if s == original:
    raise SystemExit('No changes')

p.write_text(s, encoding='utf-8')
print(f'LIPE visual patch applied; converted {converted} boolean controls')
