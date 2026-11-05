import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Controllo = {
  id: string; data_controllo: string; esito: string; fonti: string;
  note: string; prossima_scadenza: string | null; created_at: string;
};
const controlli = [
  ["anagrafica", "Anagrafica e identificazione del cliente"],
  ["titolare_effettivo", "Titolari effettivi e assetto proprietario"],
  ["ppe", "Qualifica PPE ed eventuali variazioni"],
  ["prestazione", "Prestazione, scopo e natura dell'incarico"],
  ["operativita", "Coerenza dell'operatività rispetto alle informazioni disponibili"],
  ["rischio", "Indicatori e fattori di rischio"],
  ["documenti", "Aggiornamento e validità della documentazione"],
] as const;
const esiti = [
  ["nessuna_variazione", "Nessuna variazione significativa"],
  ["variazione_titolare_ppe", "Variazione del titolare effettivo o PPE"],
  ["variazione_rischio", "Variazione significativa del rischio"],
  ["variazione_entrambi", "Variazioni di titolare/PPE e rischio"],
  ["aggiornamento_dati", "Aggiornamento dei dati identificativi"],
  ["approfondimento", "Necessari approfondimenti"],
] as const;

const formatDate = (date: string | null | undefined) => {
  if (!date) return "—";
  const parts = date.split("T")[0].split("-");
  return parts.length === 3 ? parts.reverse().join("/") : date;
};
export default function ControlloCostanteAML() {
  const router = useRouter();
  const praticaId = typeof router.query.pratica_id === "string" ? router.query.pratica_id : "";
  const [storico, setStorico] = useState<Controllo[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dataControllo, setDataControllo] = useState(() => new Date().toISOString().slice(0, 10));
  const [esito, setEsito] = useState("nessuna_variazione");
  const [fonti, setFonti] = useState("");
  const [note, setNote] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function api(method: "GET" | "POST", payload?: object) {
    const supabase = getSupabaseClient() as any;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Accedi nuovamente per utilizzare AML.");
    const url = method === "GET"
      ? `/api/antiriciclaggio/controlli-costanti?pratica_id=${encodeURIComponent(praticaId)}`
      : "/api/antiriciclaggio/controlli-costanti";
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Errore di comunicazione");
    return json;
  }

  async function load() {
    if (!praticaId) return;
    setLoading(true);
    try {
      const data = await api("GET");
      setStorico(data.controlli || []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Impossibile caricare lo storico");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [praticaId]);

  async function save() {
    if (busy || !praticaId) return;
    if (!controlli.every(([key]) => selected[key])) { setError("Spunta tutte le verifiche effettuate."); return; }
    if (!fonti.trim() || !note.trim()) { setError("Indica fonti consultate e osservazioni sull'esito."); return; }
    if (esito === "nessuna_variazione" && (!scadenza || scadenza <= dataControllo)) {
      setError("Inserisci una prossima scadenza successiva al controllo."); return;
    }
    if (!window.confirm("Confermi il controllo costante? La registrazione sarà archiviata nello storico e non potrà essere modificata.")) return;
    setBusy(true);
    setError("");
    try {
      await api("POST", {
        pratica_id: praticaId, data_controllo: dataControllo, esito, verifiche: selected,
        fonti: fonti.trim(), note: note.trim(),
        prossima_scadenza: esito === "nessuna_variazione" ? scadenza : null,
      });
      await load();
      setSelected({}); setNote(""); setFonti(""); setScadenza("");
      window.alert("Controllo costante registrato. Il fascicolo storico è stato aggiornato.");
    } catch (e: any) { setError(e?.message || "Errore salvataggio"); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-900">AV7 · Controllo costante</h1>
        <p className="text-sm text-slate-500">Rinnovo della verifica, senza duplicare cliente o pratica AML.</p></div>
      <button className="rounded-md border border-sky-500 bg-white px-4 py-2 text-sky-700" onClick={() => router.push("/antiriciclaggio")}>Torna all'elenco</button>
    </div>
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold">Nuovo controllo</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">Data controllo<input type="date" value={dataControllo} max={new Date().toISOString().slice(0,10)} onChange={e=>setDataControllo(e.target.value)} className="mt-1 block w-full rounded border p-2"/></label>
        <label className="text-sm font-medium">Esito<select value={esito} onChange={e=>setEsito(e.target.value)} className="mt-1 block w-full rounded border p-2">
          {esiti.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      <h3 className="mb-2 mt-5 font-semibold">Verifiche effettuate</h3>
      <div className="grid gap-2 md:grid-cols-2">{controlli.map(([key,label])=><label key={key} className="flex items-start gap-2 rounded border p-3 text-sm">
        <input type="checkbox" className="mt-1" checked={!!selected[key]} onChange={e=>setSelected(prev=>({...prev,[key]:e.target.checked}))}/>{label}
      </label>)}</div>
      <label className="mt-5 block text-sm font-medium">Fonti e documenti consultati<textarea value={fonti} onChange={e=>setFonti(e.target.value)} rows={2} className="mt-1 block w-full rounded border p-2" placeholder="Es. Visura camerale aggiornata, documenti identificativi, dichiarazioni del cliente"/></label>
      <label className="mt-4 block text-sm font-medium">Osservazioni ed esito motivato<textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} className="mt-1 block w-full rounded border p-2" placeholder="Riporta le evidenze emerse e le eventuali azioni richieste."/></label>
      {esito === "nessuna_variazione" ?
        <label className="mt-4 block max-w-sm text-sm font-medium">Prossimo controllo<input type="date" value={scadenza} min={dataControllo} onChange={e=>setScadenza(e.target.value)} className="mt-1 block w-full rounded border p-2"/></label>
        : <div className="mt-4 rounded border border-amber-200 p-3 text-sm text-amber-900">
            <p>Sono emerse variazioni: il controllo sarà registrato senza spostare la scadenza. Aggiorna i moduli necessari e conferma la nuova valutazione.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["variazione_rischio", "variazione_entrambi"].includes(esito) &&
                <button type="button" onClick={() => router.push(`/antiriciclaggio/modello-av1?pratica_id=${encodeURIComponent(praticaId)}&nuovo_av1=1`)}
                  className="rounded border border-sky-600 bg-white px-3 py-2 text-sm text-sky-800">Prepara nuovo AV1</button>}
              {["variazione_titolare_ppe", "variazione_entrambi"].includes(esito) &&
                <button type="button" onClick={() => router.push(`/antiriciclaggio/modello-av4?pratica_id=${encodeURIComponent(praticaId)}`)}
                  className="rounded border border-sky-600 bg-white px-3 py-2 text-sm text-sky-800">Aggiorna AV4</button>}
            </div>
            <p className="mt-2 text-xs">Conferma prima il controllo. Ogni nuovo AV1 avrà un ID diverso da quello iniziale.</p>
          </div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end"><button onClick={save} disabled={busy||loading} className="rounded-md bg-sky-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{busy?"Registrazione...":"Conferma e archivia AV7"}</button></div>
    </section>
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">Storico controlli costanti</h2>
      {loading ? <p>Caricamento...</p> : storico.length===0 ? <p className="text-sm text-slate-500">Nessun AV7 ancora registrato. I precedenti moduli AV1 e AV4 restano nel fascicolo documentale.</p> :
        <div className="space-y-3">{storico.map(c=><article key={c.id} className="rounded-md border p-3">
          <div className="flex flex-wrap justify-between gap-2"><strong>AV7 · {formatDate(c.data_controllo)}</strong><span className="text-sm">{esiti.find(x=>x[0]===c.esito)?.[1]||c.esito}</span></div>
          <div className="mt-2 text-sm"><b>Fonti:</b> {c.fonti}</div><div className="mt-2 whitespace-pre-wrap text-sm"><b>Osservazioni:</b> {c.note}</div>
          {c.prossima_scadenza && <div className="mt-2 text-sm"><b>Scadenza successiva:</b> {formatDate(c.prossima_scadenza)}</div>}
          <p className="mt-2 text-xs text-slate-500">Registrazione non modificabile · {formatDate(c.created_at)}</p>
        </article>)}</div>}
    </section>
  </div>;
}
