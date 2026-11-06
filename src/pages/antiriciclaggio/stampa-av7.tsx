import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type AV7 = {
  id: string; data_controllo: string; esito: string;
  verifiche: Record<string, boolean>; fonti: string; note: string;
  prossima_scadenza: string | null; created_at: string;
};
const labels: Record<string, string> = {
  anagrafica: "Dati identificativi del cliente ed esecutore",
  titolare_effettivo: "Titolari effettivi e assetto proprietario",
  ppe: "Persone politicamente esposte",
  prestazione: "Scopo e natura della prestazione",
  operativita: "Coerenza dell'operatività",
  rischio: "Fattori di rischio",
  documenti: "Documenti acquisiti e loro validità",
};
const esiti: Record<string, string> = {
  nessuna_variazione: "Nessuna variazione significativa",
  variazione_titolare_ppe: "Variazione titolare effettivo o PPE",
  variazione_rischio: "Variazione significativa del rischio",
  variazione_entrambi: "Variazione titolare/PPE e rischio",
  aggiornamento_dati: "Aggiornamento dati identificativi",
  approfondimento: "Approfondimenti necessari",
};
const fmt = (v?: string | null) => v ? v.slice(0, 10).split("-").reverse().join("/") : "—";
export default function StampaAV7() {
  const router = useRouter();
  const praticaId = typeof router.query.pratica_id === "string" ? router.query.pratica_id : "";
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [record, setRecord] = useState<AV7 | null>(null);
  const [error, setError] = useState("");
  const [clientName, setClientName] = useState("");
  useEffect(() => {
    if (!praticaId || !id) return;
    let active = true;
    (async () => {
      try {
        const supabase = getSupabaseClient() as any;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Accedi nuovamente");
        const response = await fetch(`/api/antiriciclaggio/controlli-costanti?pratica_id=${encodeURIComponent(praticaId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}`, "x-aml-av7-proof": sessionStorage.getItem("antiriciclaggio_av7_access_proof") || "" },
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Errore caricamento");
        const found = (json.controlli || []).find((r: AV7) => r.id === id);
        if (!found) throw new Error("Controllo non trovato");
        const clienteId = json.pratica?.cliente_id;
        const { data: cliente } = clienteId ? await supabase.from("tbclienti").select("ragione_sociale, cod_cliente").eq("id", clienteId).eq("studio_id", json.pratica.studio_id).maybeSingle() : { data: null };
        if (!active) return;
        setRecord(found);
        setClientName(cliente?.ragione_sociale || cliente?.cod_cliente || "Cliente AML");
      } catch (e: any) { if (active) setError(e?.message || "Errore"); }
    })();
    return () => { active = false; };
  }, [praticaId, id]);

  if (error) return <div className="p-8 text-red-700">{error}</div>;
  if (!record) return <div className="p-8">Caricamento AV7...</div>;

  return <div className="mx-auto max-w-4xl p-8 text-slate-900 print:max-w-none print:p-0">
    <style jsx global>{`@media print {
      @page { size: A4; margin: 18mm; }
      body { background: white !important; }
      .aml-av7-no-print, nav, aside, header, footer { display:none !important; }
      .aml-av7-print { display:block !important; box-shadow:none !important; }
    }`}</style>
    <div className="aml-av7-no-print mb-6 flex gap-3">
      <button onClick={() => window.print()} className="rounded bg-sky-700 px-4 py-2 text-white">Stampa / Salva PDF</button>
      <button onClick={() => router.back()} className="rounded border px-4 py-2">Indietro</button>
    </div>
    <article className="aml-av7-print rounded border bg-white p-8 print:border-0 print:p-0">
      <div className="border-b pb-5"><h1 className="text-2xl font-bold">AV7 · Procedura di controllo costante</h1>
        <p className="mt-2 text-sm">Registrazione documentale dell'adeguata verifica continuativa</p></div>
      <div className="mt-5 grid gap-3 text-sm">
        <div><strong>Cliente:</strong> {clientName}</div>
        <div><strong>Pratica AML:</strong> {praticaId}</div>
        <div><strong>Data controllo:</strong> {fmt(record.data_controllo)}</div>
        <div><strong>Esito:</strong> {esiti[record.esito] || record.esito}</div>
      </div>
      <h2 className="mb-2 mt-7 text-lg font-semibold">Elementi verificati</h2>
      <div className="grid grid-cols-1 gap-2">{Object.entries(labels).map(([key, label]) =>
        <div key={key} className="border-b py-2 text-sm">{record.verifiche?.[key] ? "☑" : "☐"} {label}</div>)}</div>
      <h2 className="mb-2 mt-7 text-lg font-semibold">Fonti e documenti consultati</h2>
      <div className="min-h-12 whitespace-pre-wrap text-sm">{record.fonti}</div>
      <h2 className="mb-2 mt-7 text-lg font-semibold">Osservazioni ed esito del controllo</h2>
      <div className="min-h-20 whitespace-pre-wrap text-sm">{record.note}</div>
      <div className="mt-7 text-sm"><strong>Prossimo controllo:</strong> {fmt(record.prossima_scadenza)}</div>
      <p className="mt-12 border-t pt-3 text-xs text-slate-600">Data archiviazione: {fmt(record.created_at)} · ID controllo: {record.id}</p>
    </article>
  </div>;
}
