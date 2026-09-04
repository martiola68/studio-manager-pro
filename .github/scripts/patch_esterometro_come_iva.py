from pathlib import Path

p = Path('src/pages/scadenze/esterometro.tsx')
s = p.read_text(encoding='utf-8')
original = s

# Remove old Checkbox import: use compact SI/NO selects like the approved scadenzari.
s = s.replace('import { Checkbox } from "@/components/ui/checkbox";\n', '', 1)

# Extend local type with annual archive fields already present in the scadenzario model.
s = s.replace(
    'type ScadenzaEsterometro = ScadenzaEsterometroRow & {\n  professionista?: string;\n  operatore?: string;\n};',
    'type ScadenzaEsterometro = ScadenzaEsterometroRow & {\n  professionista?: string;\n  operatore?: string;\n  anno_riferimento?: number | null;\n  archiviato?: boolean | null;\n};',
    1,
)

# Reusable boolean control.
months_end = '] as const;\n\nexport default function ScadenzeEsterometroPage() {'
helper = ''' ] as const;\n\nfunction BooleanSelect({\n  value,\n  onChange,\n}: {\n  value: boolean;\n  onChange: (value: boolean) => void;\n}) {\n  return (\n    <select\n      value={value ? "SI" : "NO"}\n      onChange={(e) => onChange(e.target.value === "SI")}\n      className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700"\n    >\n      <option value="NO">NO</option>\n      <option value="SI">SI</option>\n    </select>\n  );\n}\n\nexport default function ScadenzeEsterometroPage() {'''
if months_end not in s:
    raise SystemExit('MONTHS end marker not found')
s = s.replace(months_end, helper, 1)

# Annual consultation state.
s = s.replace(
    '  const { toast } = useToast();\n\n  const [loading, setLoading] = useState(true);',
    '  const { toast } = useToast();\n  const currentYear = new Date().getFullYear();\n\n  const [loading, setLoading] = useState(true);',
    1,
)
s = s.replace(
    '  const [filterOperatore, setFilterOperatore] = useState("__all__");',
    '  const [filterOperatore, setFilterOperatore] = useState("__all__");\n  const [annoConsultazione, setAnnoConsultazione] = useState(currentYear);\n  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);',
    1,
)
s = s.replace(
    '  useEffect(() => {\n    checkAuthAndLoad();\n  }, []);',
    '  useEffect(() => {\n    checkAuthAndLoad();\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [annoConsultazione]);',
    1,
)

# Load available years and selected year, matching IVA / 770 / Bilanci behavior.
old_load = '''  const loadScadenze = async (): Promise<ScadenzaEsterometro[]> => {\n    const { data, error } = await supabase\n      .from("tbscadestero")\n      .select(\n        `\n        *,\n        professionista:tbutenti!tbscadestero_utente_professionista_id_fkey(nome, cognome),\n        operatore:tbutenti!tbscadestero_utente_operatore_id_fkey(nome, cognome)\n      `\n      )\n      .order("nominativo", { ascending: true });\n\n    if (error) {\n      console.error("Errore query:", error);\n      throw error;\n    }\n\n    return (data || []).map((record: any) => ({\n      ...record,\n      professionista: record.professionista\n        ? `${record.professionista.nome} ${record.professionista.cognome}`\n        : "-",\n      operatore: record.operatore\n        ? `${record.operatore.nome} ${record.operatore.cognome}`\n        : "-",\n    })) as ScadenzaEsterometro[];\n  };'''
new_load = '''  const loadScadenze = async (): Promise<ScadenzaEsterometro[]> => {\n    const { data: anniData, error: anniError } = await supabase\n      .from("tbscadestero" as any)\n      .select("anno_riferimento")\n      .order("anno_riferimento", { ascending: true });\n\n    if (anniError) throw anniError;\n\n    const anni = Array.from(\n      new Set(\n        (((anniData ?? []) as any[]) || [])\n          .map((r) => r.anno_riferimento)\n          .filter((a): a is number => typeof a === "number")\n      )\n    ).sort((a, b) => a - b);\n\n    setAnniDisponibili(anni);\n\n    const annoDaUsare =\n      anni.length > 0 && !anni.includes(annoConsultazione)\n        ? anni[anni.length - 1]\n        : annoConsultazione;\n\n    if (annoDaUsare !== annoConsultazione) {\n      setAnnoConsultazione(annoDaUsare);\n    }\n\n    const { data, error } = await supabase\n      .from("tbscadestero" as any)\n      .select(\n        `\n        *,\n        professionista:tbutenti!tbscadestero_utente_professionista_id_fkey(nome, cognome),\n        operatore:tbutenti!tbscadestero_utente_operatore_id_fkey(nome, cognome)\n      `\n      )\n      .eq("anno_riferimento", annoDaUsare)\n      .order("nominativo", { ascending: true });\n\n    if (error) {\n      console.error("Errore query:", error);\n      throw error;\n    }\n\n    return ((data || []) as any[]).map((record: any) => ({\n      ...record,\n      professionista: record.professionista\n        ? `${record.professionista.nome} ${record.professionista.cognome}`\n        : "-",\n      operatore: record.operatore\n        ? `${record.operatore.nome} ${record.operatore.cognome}`\n        : "-",\n    })) as ScadenzaEsterometro[];\n  };'''
if old_load not in s:
    raise SystemExit('loadScadenze block not found')
s = s.replace(old_load, new_load, 1)
s = s.replace('.order("cognome", { ascending: true });', '.order("nome", { ascending: true }).order("cognome", { ascending: true });', 1)

# Approved bounded page layout.
s = s.replace(
    '<div className="w-full max-w-none px-4 py-8 space-y-6">',
    '<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-slate-200/70 px-3 pb-3 pt-2">',
    1,
)
s = s.replace(
    '<div className="flex items-center justify-between">',
    '<div className="flex shrink-0 items-center justify-between gap-4 flex-wrap">',
    1,
)
s = s.replace(
    '<div className="grid grid-cols-1 md:grid-cols-2 gap-4">\n        <Card>\n          <CardContent className="pt-6">',
    '<div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-2">\n        <Card className="border border-sky-200 bg-slate-50 shadow-sm">\n          <CardContent className="pt-5">',
    1,
)
s = s.replace(
    '      <Card>\n        <CardHeader>\n          <CardTitle>Filtri e Ricerca</CardTitle>',
    '      <Card className="shrink-0 border border-sky-200 bg-slate-50 shadow-sm">\n        <CardHeader className="pb-3">\n          <CardTitle>Filtri e Ricerca</CardTitle>',
    1,
)
s = s.replace(
    '<div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
    '<div className="grid grid-cols-1 gap-4 md:grid-cols-3">',
    1,
)
s = s.replace('className="pl-10"', 'className="h-9 border-slate-300 bg-white pl-10"', 1)
s = s.replace('<SelectTrigger>', '<SelectTrigger className="h-9 border-slate-300 bg-white">', 1)

# Add year consultation filter after operator filter.
operator_block = '''            <div>\n              <Select value={filterOperatore} onValueChange={setFilterOperatore}>\n                <SelectTrigger className="h-9 border-slate-300 bg-white">\n                  <SelectValue placeholder="Utente Operatore" />\n                </SelectTrigger>\n                <SelectContent>\n                  <SelectItem value="__all__">Tutti gli operatori</SelectItem>\n                  {utenti.map((u) => (\n                    <SelectItem key={u.id} value={u.id}>\n                      {u.nome} {u.cognome}\n                    </SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>'''
year_block = operator_block + '''\n\n            <div>\n              <Select\n                value={annoConsultazione.toString()}\n                onValueChange={(value) => setAnnoConsultazione(parseInt(value))}\n              >\n                <SelectTrigger className="h-9 border-slate-300 bg-white">\n                  <SelectValue placeholder="Anno consultazione" />\n                </SelectTrigger>\n                <SelectContent>\n                  {anniDisponibili.map((anno) => (\n                    <SelectItem key={anno} value={anno.toString()}>\n                      {anno}\n                    </SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>'''
if operator_block not in s:
    raise SystemExit('operator filter block not found')
s = s.replace(operator_block, year_block, 1)

# Main table card with internal scrolling.
s = s.replace(
    '      <Card>\n        <CardContent className="p-0">\n          <div className="relative w-full overflow-auto max-h-[600px]">',
    '      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-sky-200 bg-slate-50 shadow-sm">\n        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">\n          <div className="h-full w-full overflow-auto">',
    1,
)

# Dark sticky two-level header.
s = s.replace(
    '<thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">',
    '<thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm [&_tr]:border-b [&_tr]:border-slate-500">',
    1,
)
s = s.replace(
    '<tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">',
    '<tr className="border-b border-slate-500">',
    1,
)
s = s.replace(
    'h-12 px-2 text-left align-middle font-medium text-muted-foreground sticky left-0 z-40 min-w-[200px] bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]',
    'h-9 px-2 text-left align-middle font-semibold text-slate-50 sticky left-0 z-40 min-w-[260px] !bg-slate-600 border-r border-slate-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]',
    1,
)
s = s.replace(
    'h-12 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px] border-r',
    'h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[170px] border-r border-slate-500 bg-slate-600',
    1,
)
s = s.replace(
    'h-12 px-2 text-center align-middle font-medium text-muted-foreground border-r border-l border-gray-200 bg-gray-50/50',
    'h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-l border-slate-500 bg-slate-600',
)
s = s.replace(
    'h-12 px-2 text-center align-middle font-bold text-gray-900 min-w-[80px] bg-gray-100',
    'h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[80px] bg-slate-600 border-r border-slate-500',
    1,
)
s = s.replace(
    'h-12 px-2 text-center align-middle font-medium text-muted-foreground min-w-[90px] bg-white',
    'h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[90px] bg-slate-600',
    1,
)
s = s.replace(
    '<tr className="border-b text-xs text-gray-500 bg-gray-50">',
    '<tr className="border-b border-slate-500 bg-slate-700 text-xs text-slate-100">',
    1,
)
s = s.replace('className="bg-white sticky left-0 z-40 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"', 'className="sticky left-0 z-40 border-r border-slate-500 !bg-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"', 1)
s = s.replace('className="bg-white border-r"', 'className="border-r border-slate-500 bg-slate-700"', 1)
s = s.replace('className="px-1 py-1 text-center font-normal border-l"', 'className="px-1 py-1 text-center font-medium border-l border-slate-500"')
s = s.replace('className="px-1 py-1 text-center font-normal"', 'className="px-1 py-1 text-center font-medium"')
s = s.replace('className="px-1 py-1 text-center font-normal border-r"', 'className="px-1 py-1 text-center font-medium border-r border-slate-500"')
s = s.replace('<th className="bg-gray-100"></th>', '<th className="bg-slate-700 border-r border-slate-500"></th>', 1)
s = s.replace('<th className="bg-white"></th>', '<th className="bg-slate-700"></th>', 1)

# Compact rows / sticky nominativo.
s = s.replace(
    'className="border-b transition-colors hover:bg-green-50 data-[state=selected]:bg-muted group"',
    'className="group border-b border-slate-200 hover:bg-slate-100"',
    1,
)
s = s.replace(
    'p-2 align-middle sticky left-0 z-20 border-r font-medium min-w-[200px] bg-white group-hover:bg-green-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]',
    'px-2 py-1 align-middle sticky left-0 z-20 border-r border-slate-200 font-medium min-w-[260px] bg-slate-50 group-hover:bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]',
    1,
)
s = s.replace('className="p-2 align-middle min-w-[150px] border-r text-xs"', 'className="px-2 py-1 align-middle min-w-[170px] border-r border-slate-200 text-xs"', 1)
s = s.replace('className="h-8 w-full text-center px-1"', 'className="h-8 w-full border-slate-300 bg-white px-1 text-center"', 1)

# Replace dynamic monthly Checkbox controls with SI/NO selects while preserving exact field logic.
prev_old = '''                              <Checkbox\n                                checked={\n                                  (scadenza as any)[`${month.prefix}_previsto`] ||\n                                  false\n                                }\n                                onCheckedChange={() =>\n                                  handleToggleField(\n                                    scadenza.id,\n                                    `${month.prefix}_previsto` as keyof ScadenzaEsterometro,\n                                    (scadenza as any)[`${month.prefix}_previsto`]\n                                  )\n                                }\n                              />'''
prev_new = '''                              <BooleanSelect\n                                value={Boolean(\n                                  (scadenza as any)[`${month.prefix}_previsto`]\n                                )}\n                                onChange={(nextValue) => {\n                                  const currentValue = Boolean(\n                                    (scadenza as any)[`${month.prefix}_previsto`]\n                                  );\n                                  if (nextValue !== currentValue) {\n                                    handleToggleField(\n                                      scadenza.id,\n                                      `${month.prefix}_previsto` as keyof ScadenzaEsterometro,\n                                      currentValue\n                                    );\n                                  }\n                                }}\n                              />'''
inv_old = '''                              <Checkbox\n                                checked={\n                                  (scadenza as any)[`${month.prefix}_invio`] || false\n                                }\n                                onCheckedChange={() =>\n                                  handleToggleField(\n                                    scadenza.id,\n                                    `${month.prefix}_invio` as keyof ScadenzaEsterometro,\n                                    (scadenza as any)[`${month.prefix}_invio`]\n                                  )\n                                }\n                              />'''
inv_new = '''                              <BooleanSelect\n                                value={Boolean(\n                                  (scadenza as any)[`${month.prefix}_invio`]\n                                )}\n                                onChange={(nextValue) => {\n                                  const currentValue = Boolean(\n                                    (scadenza as any)[`${month.prefix}_invio`]\n                                  );\n                                  if (nextValue !== currentValue) {\n                                    handleToggleField(\n                                      scadenza.id,\n                                      `${month.prefix}_invio` as keyof ScadenzaEsterometro,\n                                      currentValue\n                                    );\n                                  }\n                                }}\n                              />'''
if prev_old not in s:
    raise SystemExit('Prev Checkbox block not found')
if inv_old not in s:
    raise SystemExit('Inv Checkbox block not found')
s = s.replace(prev_old, prev_new, 1)
s = s.replace(inv_old, inv_new, 1)

# Softer row indication once sent, without overriding controls.
s = s.replace('? "bg-green-100"\n                          : "bg-gray-50/30";', '? "bg-green-100"\n                          : "bg-slate-50";', 1)

required = [
    'function BooleanSelect',
    'value={annoConsultazione.toString()}',
    '.eq("anno_riferimento", annoDaUsare)',
    'bg-slate-600 text-white',
    'h-full w-full overflow-auto',
    '!bg-slate-600',
    '.order("nome", { ascending: true }).order("cognome", { ascending: true });',
    '`${month.prefix}_previsto`',
    '`${month.prefix}_invio`',
]
for token in required:
    if token not in s:
        raise SystemExit('Verification failed: ' + token)
if '<Checkbox' in s or 'from "@/components/ui/checkbox"' in s:
    raise SystemExit('Checkbox remains in Esterometro runtime')
if s == original:
    raise SystemExit('No changes')

p.write_text(s, encoding='utf-8')
print('Esterometro visual patch applied')
