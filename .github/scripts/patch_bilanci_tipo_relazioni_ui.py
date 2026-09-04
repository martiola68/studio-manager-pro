from pathlib import Path
import re

p = Path('src/pages/scadenze/bilanci.tsx')
s = p.read_text(encoding='utf-8')
original = s

# Type: override old boolean relation fields locally so build is safe before regenerated Supabase types.
old_type = '''type ScadenzaBilancioExt = ScadenzaBilancio & {
  consorzio?: boolean | null;
  anno_riferimento?: number | null;
  archiviato?: boolean | null;
};'''
new_type = '''type ScadenzaBilancioExt = Omit<
  ScadenzaBilancio,
  "relazione_gest" | "relazione_sindaci" | "relazione_revisore"
> & {
  consorzio?: boolean | null;
  anno_riferimento?: number | null;
  archiviato?: boolean | null;
  tipo_bilancio?: "micro" | "abbreviato" | "ordinario" | null;
  relazione_gest?: "SI" | "NO" | "NP" | null;
  relazione_sindaci?: "SI" | "NO" | "NP" | null;
  relazione_revisore?: "SI" | "NO" | "NP" | null;
};'''
if old_type not in s:
    raise SystemExit('ScadenzaBilancioExt marker not found')
s = s.replace(old_type, new_type, 1)

# Handlers before generic update handler.
marker = '  const handleUpdateField = async (\n'
if marker not in s:
    raise SystemExit('handleUpdateField marker not found')
if 'handleTipoBilancioChange' not in s:
    handlers = '''  const handleTipoBilancioChange = async (
    scadenza: ScadenzaBilancioExt,
    value: "micro" | "abbreviato" | "ordinario"
  ) => {
    try {
      const payload: any = { tipo_bilancio: value };

      if (value === "micro") {
        payload.relazione_gest = "NP";
        payload.relazione_sindaci = "NP";
        payload.relazione_revisore = "NP";
      }

      const { error } = await supabase
        .from("tbscadbilanci" as any)
        .update(payload)
        .eq("id", scadenza.id);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((row) =>
          row.id === scadenza.id ? { ...row, ...payload } : row
        )
      );
    } catch (error) {
      console.error("Errore aggiornamento tipo bilancio:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il tipo bilancio",
        variant: "destructive",
      });
      await loadData();
    }
  };

  const handleRelazioneChange = async (
    scadenzaId: string,
    field: "relazione_gest" | "relazione_sindaci" | "relazione_revisore",
    value: "SI" | "NO" | "NP"
  ) => {
    try {
      const { error } = await supabase
        .from("tbscadbilanci" as any)
        .update({ [field]: value })
        .eq("id", scadenzaId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((row) =>
          row.id === scadenzaId ? { ...row, [field]: value } : row
        )
      );
    } catch (error) {
      console.error("Errore aggiornamento relazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la relazione",
        variant: "destructive",
      });
      await loadData();
    }
  };

'''
    s = s.replace(marker, handlers + marker, 1)

# Widen sticky nominativo header and force dark background.
s = s.replace('sticky-col-header border-r border-slate-500 min-w-[200px] !bg-slate-600', 'sticky-col-header border-r border-slate-500 min-w-[300px] !bg-slate-600', 1)
s = s.replace('sticky-col-header border-r border-slate-500 min-w-[200px]', 'sticky-col-header border-r border-slate-500 min-w-[300px] !bg-slate-600', 1)

# Widen sticky nominativo cells.
s = s.replace('font-medium min-w-[200px]', 'font-medium min-w-[300px]', 1)

# Insert Tipo bilancio header before Consorzio.
cons_header = '''                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 text-center min-w-[120px]">
                    Consorzio
                  </th>'''
if cons_header not in s:
    # tolerate slightly different class order/current runtime
    m = re.search(r'\s*<th className="[^"]*min-w-\[120px\][^"]*">\s*Consorzio\s*</th>', s)
    if not m:
        raise SystemExit('Consorzio header marker not found')
    cons_header = m.group(0)

tipo_header = '''                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-slate-500 bg-slate-600 min-w-[135px]">
                    Tipo bilancio
                  </th>
'''
s = s.replace(cons_header, tipo_header + cons_header, 1)

# Insert Tipo bilancio cell before Consorzio cell.
cons_cell_marker = '''                      <td className="px-2 py-1 align-middle text-center min-w-[120px]">
                        <select
                          value={scadenza.consorzio ? "SI" : "NO"}'''
if cons_cell_marker not in s:
    raise SystemExit('Consorzio cell marker not found')
tipo_cell = '''                      <td className="px-2 py-1 align-middle text-center min-w-[135px]">
                        <select
                          value={scadenza.tipo_bilancio || "ordinario"}
                          onChange={(e) =>
                            void handleTipoBilancioChange(
                              scadenza,
                              e.target.value as "micro" | "abbreviato" | "ordinario"
                            )
                          }
                          className="h-8 w-[110px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700"
                        >
                          <option value="micro">Micro</option>
                          <option value="abbreviato">Abbreviato</option>
                          <option value="ordinario">Ordinario</option>
                        </select>
                      </td>

'''
s = s.replace(cons_cell_marker, tipo_cell + cons_cell_marker, 1)

# Replace the three boolean relation selects with SI/NO/NP selects.
relation_fields = [
    ('relazione_gest', 'Rel. gestione'),
    ('relazione_sindaci', 'Rel. Sindaci'),
    ('relazione_revisore', 'Rel. Revisore'),
]
for field, label in relation_fields:
    rx = re.compile(
        rf'''<td className="px-2 py-1 align-middle text-center min-w-\[120px\]">\s*<select\s+value=\{{scadenza\.{field} \? "SI" : "NO"\}}[\s\S]*?</select>\s*</td>'''
    )
    m = rx.search(s)
    if not m:
        raise SystemExit(f'{field} boolean select marker not found')
    replacement = f'''<td className="px-2 py-1 align-middle text-center min-w-[120px]">
                        <select
                          disabled={{scadenza.tipo_bilancio === "micro"}}
                          value={{
                            scadenza.tipo_bilancio === "micro"
                              ? "NP"
                              : scadenza.{field} || "NO"
                          }}
                          onChange={{(e) =>
                            void handleRelazioneChange(
                              scadenza.id,
                              "{field}",
                              e.target.value as "SI" | "NO" | "NP"
                            )
                          }}
                          className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="NO">NO</option>
                          <option value="SI">SI</option>
                          <option value="NP">NP</option>
                        </select>
                      </td>'''
    s = s[:m.start()] + replacement + s[m.end():]

# Empty-table colspan increases by one.
s = s.replace('colSpan={17}', 'colSpan={18}', 1)

# Excel: include tipo bilancio and preserve NP values.
s = s.replace('{ header: "Operatore", key: "operatore", width: 25 },', '{ header: "Operatore", key: "operatore", width: 25 },\n    { header: "Tipo bilancio", key: "tipo_bilancio", width: 16 },', 1)
s = s.replace('operatore: operatoreNome,\n      confermato:', 'operatore: operatoreNome,\n      tipo_bilancio: s.tipo_bilancio || "ordinario",\n      confermato:', 1)
s = s.replace('rel_gestione: s.relazione_gest ? "SI" : "NO",', 'rel_gestione: s.relazione_gest || "NO",', 1)
s = s.replace('rel_sindaci: s.relazione_sindaci ? "SI" : "NO",', 'rel_sindaci: s.relazione_sindaci || "NO",', 1)
s = s.replace('rel_revisore: s.relazione_revisore ? "SI" : "NO",', 'rel_revisore: s.relazione_revisore || "NO",', 1)

# Verification.
required = [
    'Tipo bilancio',
    'value={scadenza.tipo_bilancio || "ordinario"}',
    'disabled={scadenza.tipo_bilancio === "micro"}',
    '<option value="NP">NP</option>',
    'handleTipoBilancioChange',
    'handleRelazioneChange',
    'min-w-[300px]',
    'colSpan={18}',
]
for token in required:
    if token not in s:
        raise SystemExit('Verification failed: ' + token)

if s == original:
    raise SystemExit('No changes')

p.write_text(s, encoding='utf-8')
print('Bilanci tipo/relazioni UI patch applied')
