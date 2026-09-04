from pathlib import Path
import re

p = Path("src/pages/scadenze/imu.tsx")
s = p.read_text(encoding="utf-8")
original = s

state_marker = '  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});\n'
if state_marker not in s:
    raise SystemExit("state marker missing")
if "pendingComunicato" not in s:
    s = s.replace(
        state_marker,
        '  const [pendingComunicato, setPendingComunicato] = useState<{ id: string; tipo: "acconto" | "saldo" } | null>(null);\n\n' + state_marker,
        1,
    )

helper_rx = re.compile(
    r'  const sectionTone = \([\s\S]*?  const rowSideTone = \(rowConfirmed: boolean\) =>\n    rowConfirmed \? "bg-green-200" : "bg-slate-50";'
)
helper_new = '''  const sectionColor = (
    soggetto: boolean | null | undefined,
    dovuto: boolean | null | undefined,
    comunicato: boolean | null | undefined,
    rowConfirmed: boolean
  ) => {
    if (rowConfirmed) return "#bbf7d0";
    if (!soggetto || !dovuto) return "#e2e8f0";
    if (comunicato) return "#bbf7d0";
    return "#fdba74";
  };

  const subjectColor = (
    soggetto: boolean | null | undefined,
    rowConfirmed: boolean
  ) => rowConfirmed ? "#bbf7d0" : soggetto ? "#fdba74" : "#e2e8f0";

  const declarationColor = (
    soggetto: boolean | null | undefined,
    prevista: boolean | null | undefined,
    presentata: boolean | null | undefined,
    rowConfirmed: boolean
  ) => {
    if (rowConfirmed) return "#bbf7d0";
    if (!soggetto || !prevista) return "#e2e8f0";
    if (presentata) return "#bbf7d0";
    return "#fdba74";
  };

  const rowSideTone = (rowConfirmed: boolean) =>
    rowConfirmed ? "bg-green-200" : "bg-slate-50";'''
s, n = helper_rx.subn(helper_new, s, count=1)
if n != 1:
    raise SystemExit("section helper missing")

handler_marker = '  const handleNoteChange = (scadenzaId: string, value: string) => {\n'
if handler_marker not in s:
    raise SystemExit("handler marker missing")

if "handleSoggettoImuChange" not in s:
    handlers = '''  const handleSoggettoImuChange = async (scadenza: ScadenzaImu, value: boolean) => {
    try {
      const payload = { acconto_imu: value, saldo_imu: value };
      const { error } = await supabase.from("tbscadimu").update(payload).eq("id", scadenza.id);
      if (error) throw error;
      setScadenze((prev) => prev.map((row) => row.id === scadenza.id ? { ...row, ...payload } : row));
    } catch (error: any) {
      toast({ title: "Errore aggiornamento", description: error.message, variant: "destructive" });
    }
  };

  const handleComunicatoChange = async (scadenza: ScadenzaImu, tipo: "acconto" | "saldo", value: boolean) => {
    const dovuto = tipo === "acconto" ? scadenza.acconto_dovuto : scadenza.saldo_dovuto;
    if (!dovuto) return;
    const data = tipo === "acconto" ? scadenza.data_com_acconto : scadenza.data_com_saldo;
    const comunicatoField = tipo === "acconto" ? "acconto_comunicato" : "saldo_comunicato";
    const confermaField = tipo === "acconto" ? "conferma_acconto_imu" : "conferma_saldo_imu";

    if (value && !data) {
      setPendingComunicato({ id: scadenza.id, tipo });
      toast({ title: "Data comunicazione obbligatoria", description: "Inserisci la data di comunicazione prima di completare la sezione.", variant: "destructive" });
      setTimeout(() => document.getElementById("imu-" + tipo + "-data-" + scadenza.id)?.focus(), 0);
      return;
    }

    try {
      const payload = { [comunicatoField]: value, [confermaField]: value };
      const { error } = await supabase.from("tbscadimu").update(payload).eq("id", scadenza.id);
      if (error) throw error;
      setScadenze((prev) => prev.map((row) => row.id === scadenza.id ? { ...row, ...payload } : row));
      if (!value) setPendingComunicato(null);
    } catch (error: any) {
      toast({ title: "Errore aggiornamento", description: error.message, variant: "destructive" });
      await loadScadenze();
    }
  };

  const handleCommunicationDateChange = async (scadenza: ScadenzaImu, tipo: "acconto" | "saldo", value: string) => {
    const dataField = tipo === "acconto" ? "data_com_acconto" : "data_com_saldo";
    await handleUpdateField(scadenza.id, dataField, value);
    if (value && pendingComunicato?.id === scadenza.id && pendingComunicato.tipo === tipo) {
      const comunicatoField = tipo === "acconto" ? "acconto_comunicato" : "saldo_comunicato";
      const confermaField = tipo === "acconto" ? "conferma_acconto_imu" : "conferma_saldo_imu";
      const payload = { [dataField]: value, [comunicatoField]: true, [confermaField]: true };
      const { error } = await supabase.from("tbscadimu").update(payload).eq("id", scadenza.id);
      if (!error) {
        setScadenze((prev) => prev.map((row) => row.id === scadenza.id ? { ...row, ...payload } : row));
        setPendingComunicato(null);
      }
    }
  };

  const handleDichiarazioneImuChange = async (scadenza: ScadenzaImu, value: boolean) => {
    try {
      if (!value) {
        const payload = { dichiarazione_imu: false, data_scad_dichiarazione: null, dichiarazione_presentata: false, conferma_dichiarazione_imu: false };
        const { error } = await supabase.from("tbscadimu").update(payload).eq("id", scadenza.id);
        if (error) throw error;
        setScadenze((prev) => prev.map((row) => row.id === scadenza.id ? { ...row, ...payload } : row));
        return;
      }

      const annoBase = scadenza.anno_riferimento ?? Number(filterAnno);
      const annoScadenza = annoBase + 1;
      const { data, error } = await supabase
        .from("tbtipi_scadenze")
        .select("data_scadenza, nome")
        .eq("tipo_scadenza", "imu")
        .ilike("nome", "%dichiarazione%")
        .gte("data_scadenza", String(annoScadenza) + "-01-01")
        .lte("data_scadenza", String(annoScadenza) + "-12-31")
        .order("data_scadenza", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.data_scadenza) {
        toast({ title: "Scadenza Dichiarazione IMU non configurata", description: "Manca la scadenza IMU dichiarazione per " + annoScadenza + ".", variant: "destructive" });
        return;
      }
      const payload = { dichiarazione_imu: true, data_scad_dichiarazione: data.data_scadenza };
      const { error: updateError } = await supabase.from("tbscadimu").update(payload).eq("id", scadenza.id);
      if (updateError) throw updateError;
      setScadenze((prev) => prev.map((row) => row.id === scadenza.id ? { ...row, ...payload } : row));
    } catch (error: any) {
      toast({ title: "Errore aggiornamento", description: error.message, variant: "destructive" });
    }
  };

  const handleDichiarazionePresentataChange = async (scadenza: ScadenzaImu, value: boolean) => {
    try {
      const payload = { dichiarazione_presentata: value, conferma_dichiarazione_imu: value };
      const { error } = await supabase.from("tbscadimu").update(payload).eq("id", scadenza.id);
      if (error) throw error;
      setScadenze((prev) => prev.map((row) => row.id === scadenza.id ? { ...row, ...payload } : row));
    } catch (error: any) {
      toast({ title: "Errore aggiornamento", description: error.message, variant: "destructive" });
    }
  };

'''
    s = s.replace(handler_marker, handlers + handler_marker, 1)

hs = s.find('    <th className={`${baseHeaderClass} min-w-[120px]`}>Acconto IMU</th>')
he = s.find('    <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[300px]', hs)
if hs < 0 or he < 0:
    raise SystemExit("header block missing")

header = '''    <th className={`${baseHeaderClass} min-w-[120px]`}>Soggetto IMU</th>
    <th className={`${baseHeaderClass} min-w-[120px] print-hide`}>Dovuto</th>
    <th className={`${baseHeaderClass} min-w-[120px]`}>Comunicato</th>
    <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[160px] border-r border-slate-500 bg-slate-600 print-hide">Data comunicazione</th>
    <th className={`${baseHeaderClass} min-w-[140px] print-hide`}>Con dic. IMU</th>
    <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[170px] border-r border-slate-500 bg-slate-600 print-hide">Data scadenza dic.</th>
    <th className={`${baseHeaderClass} min-w-[140px] print-hide`}>Dic. presentata</th>
    <th className={`${baseHeaderClass} min-w-[120px] print-hide`}>Dovuto</th>
    <th className={`${baseHeaderClass} min-w-[120px]`}>Comunicato</th>
    <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[160px] border-r border-slate-500 bg-slate-600 print-hide">Data comunicazione</th>
'''
s = s[:hs] + header + s[he:]
s = s.replace('colSpan={17}', 'colSpan={16}', 1)

bs = s.find('          <td className={`${baseCellClass} text-center min-w-[120px] ${sectionTone(scadenza.acconto_imu')
be = s.find('          <td className={`${baseCellClass} min-w-[300px] print-hide', bs)
if bs < 0 or be < 0:
    raise SystemExit("body block missing")

body = '''          <td className={baseCellClass + " text-center min-w-[120px]"} style={{ backgroundColor: subjectColor(scadenza.acconto_imu, isGreenRow) }}>
            <select value={scadenza.acconto_imu ? "SI" : "NO"} onChange={(e) => void handleSoggettoImuChange(scadenza, e.target.value === "SI")} className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700"><option value="NO">NO</option><option value="SI">SI</option></select>
          </td>
          <td className={baseCellClass + " text-center min-w-[120px] print-hide"} style={{ backgroundColor: sectionColor(scadenza.acconto_imu, scadenza.acconto_dovuto, scadenza.acconto_comunicato, isGreenRow) }}>
            <select disabled={!scadenza.acconto_imu} value={scadenza.acconto_dovuto ? "SI" : "NO"} onChange={(e) => { const v = e.target.value === "SI"; if (v !== Boolean(scadenza.acconto_dovuto)) handleToggleField(scadenza.id, "acconto_dovuto", scadenza.acconto_dovuto); }} className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"><option value="NO">NO</option><option value="SI">SI</option></select>
          </td>
          <td className={baseCellClass + " text-center min-w-[120px]"} style={{ backgroundColor: sectionColor(scadenza.acconto_imu, scadenza.acconto_dovuto, scadenza.acconto_comunicato || (pendingComunicato?.id === scadenza.id && pendingComunicato.tipo === "acconto"), isGreenRow) }}>
            <select disabled={!scadenza.acconto_imu || !scadenza.acconto_dovuto} value={pendingComunicato?.id === scadenza.id && pendingComunicato.tipo === "acconto" ? "SI" : scadenza.acconto_comunicato ? "SI" : "NO"} onChange={(e) => void handleComunicatoChange(scadenza, "acconto", e.target.value === "SI")} className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"><option value="NO">NO</option><option value="SI">SI</option></select>
          </td>
          <td className={baseCellClass + " min-w-[160px] print-hide"} style={{ backgroundColor: sectionColor(scadenza.acconto_imu, scadenza.acconto_dovuto, scadenza.acconto_comunicato || (pendingComunicato?.id === scadenza.id && pendingComunicato.tipo === "acconto"), isGreenRow) }}>
            <Input id={"imu-acconto-data-" + scadenza.id} type="date" disabled={!scadenza.acconto_imu || !scadenza.acconto_dovuto} value={scadenza.data_com_acconto || ""} onChange={(e) => void handleCommunicationDateChange(scadenza, "acconto", e.target.value)} className="h-8 w-full border-slate-300 bg-white text-xs disabled:bg-slate-100 disabled:text-slate-400" />
          </td>
          <td className={baseCellClass + " text-center min-w-[140px] print-hide"} style={{ backgroundColor: declarationColor(scadenza.acconto_imu, scadenza.dichiarazione_imu, scadenza.dichiarazione_presentata, isGreenRow) }}>
            <select disabled={!scadenza.acconto_imu} value={scadenza.dichiarazione_imu ? "SI" : "NO"} onChange={(e) => void handleDichiarazioneImuChange(scadenza, e.target.value === "SI")} className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"><option value="NO">NO</option><option value="SI">SI</option></select>
          </td>
          <td className={baseCellClass + " min-w-[170px] print-hide"} style={{ backgroundColor: declarationColor(scadenza.acconto_imu, scadenza.dichiarazione_imu, scadenza.dichiarazione_presentata, isGreenRow) }}>
            <Input type="date" disabled value={scadenza.data_scad_dichiarazione || ""} className="h-8 w-full border-slate-300 bg-white text-xs disabled:bg-slate-100 disabled:text-slate-500" />
          </td>
          <td className={baseCellClass + " text-center min-w-[140px] print-hide"} style={{ backgroundColor: declarationColor(scadenza.acconto_imu, scadenza.dichiarazione_imu, scadenza.dichiarazione_presentata, isGreenRow) }}>
            <select disabled={!scadenza.acconto_imu || !scadenza.dichiarazione_imu} value={scadenza.dichiarazione_presentata ? "SI" : "NO"} onChange={(e) => void handleDichiarazionePresentataChange(scadenza, e.target.value === "SI")} className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"><option value="NO">NO</option><option value="SI">SI</option></select>
          </td>
          <td className={baseCellClass + " text-center min-w-[120px] print-hide"} style={{ backgroundColor: sectionColor(scadenza.acconto_imu, scadenza.saldo_dovuto, scadenza.saldo_comunicato, isGreenRow) }}>
            <select disabled={!scadenza.acconto_imu} value={scadenza.saldo_dovuto ? "SI" : "NO"} onChange={(e) => { const v = e.target.value === "SI"; if (v !== Boolean(scadenza.saldo_dovuto)) handleToggleField(scadenza.id, "saldo_dovuto", scadenza.saldo_dovuto); }} className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"><option value="NO">NO</option><option value="SI">SI</option></select>
          </td>
          <td className={baseCellClass + " text-center min-w-[120px]"} style={{ backgroundColor: sectionColor(scadenza.acconto_imu, scadenza.saldo_dovuto, scadenza.saldo_comunicato || (pendingComunicato?.id === scadenza.id && pendingComunicato.tipo === "saldo"), isGreenRow) }}>
            <select disabled={!scadenza.acconto_imu || !scadenza.saldo_dovuto} value={pendingComunicato?.id === scadenza.id && pendingComunicato.tipo === "saldo" ? "SI" : scadenza.saldo_comunicato ? "SI" : "NO"} onChange={(e) => void handleComunicatoChange(scadenza, "saldo", e.target.value === "SI")} className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"><option value="NO">NO</option><option value="SI">SI</option></select>
          </td>
          <td className={baseCellClass + " min-w-[160px] print-hide"} style={{ backgroundColor: sectionColor(scadenza.acconto_imu, scadenza.saldo_dovuto, scadenza.saldo_comunicato || (pendingComunicato?.id === scadenza.id && pendingComunicato.tipo === "saldo"), isGreenRow) }}>
            <Input id={"imu-saldo-data-" + scadenza.id} type="date" disabled={!scadenza.acconto_imu || !scadenza.saldo_dovuto} value={scadenza.data_com_saldo || ""} onChange={(e) => void handleCommunicationDateChange(scadenza, "saldo", e.target.value)} className="h-8 w-full border-slate-300 bg-white text-xs disabled:bg-slate-100 disabled:text-slate-400" />
          </td>
'''
s = s[:bs] + body + s[be:]
s = s.replace('<th>Acconto IMU</th>', '<th>Soggetto IMU</th>', 1)

required = [
    '>Soggetto IMU</th>',
    'handleSoggettoImuChange',
    'handleDichiarazioneImuChange',
    '.from("tbtipi_scadenze")',
    'value={scadenza.dichiarazione_presentata ? "SI" : "NO"}',
    'value={scadenza.conferma_riga ? "SI" : "NO"}',
]
for token in required:
    if token not in s:
        raise SystemExit("missing " + token)
if '>Saldo IMU</th>' in s:
    raise SystemExit("Saldo IMU header still present")
if 'sectionTone(' in s:
    raise SystemExit("old sectionTone still present")
if s == original:
    raise SystemExit("no changes")

p.write_text(s, encoding="utf-8")
print("IMU runtime patched")
