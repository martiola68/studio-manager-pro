import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const studioId = "f9d3ca10-6134-4061-a2b4-0be74e8c7654";

const getColor = (stato: string) => {
  if (!stato) return "bg-gray-100 text-gray-600";
  if (["INVIATO", "COMUNICATO", "DICHIARAZIONE PRESENTATA", "COMPLETO"].includes(stato)) return "bg-green-100 text-green-700";
  if (stato === "DA FARE") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
};

type RigaRiepilogo = {
  cliente_id: string; nominativo: string; utente_operatore_id?: string | null; stato_generale?: string | null;
  stato_iva?: string | null; stato_fiscali?: string | null; stato_bilanci?: string | null; stato_770?: string | null;
  stato_ccgg?: string | null; stato_cu?: string | null; stato_imu?: string | null; confermata_iva?: boolean | null;
  confermata_fiscali?: boolean | null; confermata_bilanci?: boolean | null; confermata_770?: boolean | null;
  confermata_ccgg?: boolean | null; confermata_cu?: boolean | null; confermata_imu?: boolean | null;
};
type UtenteOption = { id: string; nome: string };

const getProgress = (r: RigaRiepilogo) => {
  const items = [
    { stato: r.stato_iva, confermata: r.confermata_iva }, { stato: r.stato_fiscali, confermata: r.confermata_fiscali },
    { stato: r.stato_bilanci, confermata: r.confermata_bilanci }, { stato: r.stato_770, confermata: r.confermata_770 },
    { stato: r.stato_ccgg, confermata: r.confermata_ccgg }, { stato: r.stato_cu, confermata: r.confermata_cu },
    { stato: r.stato_imu, confermata: r.confermata_imu },
  ].filter((item) => item.stato !== null && item.stato !== undefined && String(item.stato).trim() !== "");
  if (items.length === 0) return 0;
  return Math.round((items.filter((item) => item.confermata === true).length / items.length) * 100);
};

const getProgressColor = (percent: number) => {
  if (percent === 100) return "bg-green-100 text-green-700";
  if (percent >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

export default function ScadenzarioRiepilogo() {
  const [rows, setRows] = useState<RigaRiepilogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState("TUTTI");
  const [operatore, setOperatore] = useState("TUTTI");
  const [utentiMap, setUtentiMap] = useState<Record<string, string>>({});
  const [utentiNomeMap, setUtentiNomeMap] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase as any).from("vw_scadenzario_riepilogativo_societa").select("*").eq("studio_id", studioId).order("nominativo", { ascending: true });
      if (error) { console.error("Errore caricamento riepilogo:", error); setRows([]); return; }
      const loadedRows: RigaRiepilogo[] = data || [];
      setRows(loadedRows);
      const operatoreIds = [...new Set(loadedRows.map((r) => r.utente_operatore_id).filter((v): v is string => !!v))];
      if (operatoreIds.length > 0) {
        const { data: utentiData, error: utentiError } = await (supabase as any).from("tbutenti").select("id, nome, cognome").in("id", operatoreIds);
        if (utentiError) console.error("Errore caricamento utenti:", utentiError);
        else {
          const map: Record<string, string> = {};
          const nomeMap: Record<string, string> = {};
          (utentiData || []).forEach((u: any) => {
            const displayName = [u.cognome, u.nome].filter(Boolean).join(" ").trim();
            map[u.id] = displayName || u.nome || u.cognome || u.id;
            nomeMap[u.id] = [u.nome, u.cognome].filter(Boolean).join(" ").trim() || displayName || u.id;
          });
          setUtentiMap(map); setUtentiNomeMap(nomeMap);
        }
      } else { setUtentiMap({}); setUtentiNomeMap({}); }
    } catch (err) {
      console.error("Errore caricamento riepilogo:", err); setRows([]); setUtentiMap({}); setUtentiNomeMap({});
    } finally { setLoading(false); }
  }

  const operatori = useMemo<UtenteOption[]>(() => {
    const ids = [...new Set(rows.map((r) => r.utente_operatore_id).filter((v): v is string => !!v))];
    return ids.map((id) => ({ id, nome: utentiNomeMap[id] || utentiMap[id] || id })).sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));
  }, [rows, utentiMap, utentiNomeMap]);

  const filteredRows = useMemo(() => {
    const getStatoGenerale = (r: RigaRiepilogo) => {
      const stati = [r.stato_iva, r.stato_fiscali, r.stato_bilanci, r.stato_770, r.stato_ccgg, r.stato_cu, r.stato_imu].filter(Boolean).map((s) => String(s).toUpperCase());
      if (stati.length === 0) return "";
      if (stati.includes("DA FARE")) return "DA FARE";
      const statiVerdi = ["INVIATO", "COMUNICATO", "DICHIARAZIONE PRESENTATA", "COMPLETO", "DEFINITIVO", "APPROVATO", "GENERATO", "CALCOLATO", "INSERITO", "AUTONOMI"];
      return stati.every((s) => statiVerdi.includes(s)) ? "COMPLETO" : "IN CORSO";
    };
    return rows.filter((r) => {
      const statoGenerale = getStatoGenerale(r);
      return (r.nominativo || "").toLowerCase().includes(search.trim().toLowerCase()) &&
        (statoFilter === "TUTTI" || statoGenerale.toUpperCase() === statoFilter) &&
        (operatore === "TUTTI" || r.utente_operatore_id === operatore);
    });
  }, [rows, search, statoFilter, operatore]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 bg-slate-100 py-3">
      <div className="shrink-0 rounded-lg border border-sky-200 bg-slate-50 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div><h1 className="text-2xl font-bold text-slate-900">Scadenzario Riepilogativo</h1><p className="mt-0.5 text-sm text-slate-500">Totale risultati: {filteredRows.length}</p></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex flex-col"><label className="mb-1 text-xs font-semibold text-slate-700">Cerca nominativo</label><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Scrivi il nominativo..." className="h-9 min-w-[240px] rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500" /></div>
            <div className="flex flex-col"><label className="mb-1 text-xs font-semibold text-slate-700">Stato generale</label><select value={statoFilter} onChange={(e) => setStatoFilter(e.target.value)} className="h-9 min-w-[180px] rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"><option value="TUTTI">Tutti</option><option value="COMPLETO">Completo</option><option value="IN CORSO">In corso</option><option value="DA FARE">Da fare</option></select></div>
            <div className="flex flex-col"><label className="mb-1 text-xs font-semibold text-slate-700">Filtra Operatore</label><select value={operatore} onChange={(e) => setOperatore(e.target.value)} className="h-9 min-w-[220px] rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"><option value="TUTTI">Tutti</option>{operatori.map((op) => <option key={op.id} value={op.id}>{op.nome}</option>)}</select></div>
          </div>
        </div>
      </div>

      {loading ? <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-sky-200 bg-white text-sm text-slate-500">Caricamento...</div> : filteredRows.length === 0 ? <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-sky-200 bg-white text-sm text-slate-500">Nessun risultato trovato.</div> : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-sky-200 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>{Array.from({ length: 10 }).map((_, i) => <col key={i} style={{ width: "10%" }} />)}</colgroup>
            <thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm"><tr>
              {['Nominativo','Operatore','Avanz.','IVA','Fiscali','Bilanci','770','CCGG','CU','IMU'].map((h, i) => <th key={h} className={`${i === 0 ? "sticky left-0 z-40 bg-slate-600 text-left" : i === 1 ? "text-left" : "text-center"} border-r border-slate-500 px-2 py-2 font-semibold last:border-r-0`}>{h}</th>)}
            </tr></thead>
            <tbody>{filteredRows.map((r, rowIndex) => {
              const progress = getProgress(r);
              const statusCells = [r.stato_iva, r.stato_fiscali, r.stato_bilanci, r.stato_770, r.stato_ccgg, r.stato_cu, r.stato_imu];
              const rowBase = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-200/70";
              return <tr key={`${r.cliente_id}-${r.nominativo}`} className={`border-b border-slate-300 ${rowBase} hover:bg-sky-100`}>
                <td className={`sticky left-0 z-20 border-r border-slate-300 px-2 py-2 font-medium text-slate-900 ${rowIndex % 2 === 0 ? "bg-white" : "bg-slate-200"}`}><div className="truncate" title={r.nominativo}>{r.nominativo}</div></td>
                <td className="border-r border-slate-300 px-2 py-2 text-slate-700"><div className="truncate">{r.utente_operatore_id ? utentiMap[r.utente_operatore_id] || r.utente_operatore_id : ""}</div></td>
                <td className="border-r border-slate-300 px-2 py-1.5 text-center"><div className="flex flex-col items-center gap-1"><span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${getProgressColor(progress)}`}>{progress}%</span><div className="h-1.5 w-16 max-w-full overflow-hidden rounded bg-slate-300"><div className={`h-1.5 ${progress === 100 ? "bg-green-500" : progress >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${progress}%` }} /></div></div></td>
                {statusCells.map((stato, i) => <td key={i} className={`border-r border-slate-300 px-2 py-2 text-center font-medium last:border-r-0 ${getColor(stato || "")}`}>{stato || ""}</td>)}
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
