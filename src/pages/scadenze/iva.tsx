import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { IvaFixedPanel } from "@/components/scadenze/iva/IvaFixedPanel";
import { IvaScrollableTable } from "@/components/scadenze/iva/IvaScrollableTable";
import type { ScadenzaIva, UtenteIva } from "@/components/scadenze/iva/types";

export default function ScadenzeIvaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaIva[]>([]);
  const [utenti, setUtenti] = useState<UtenteIva[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterConferma, setFilterConferma] = useState("__all__");
  const [annoConsultazione, setAnnoConsultazione] = useState(currentYear);
  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteTimers, setNoteTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const [stats, setStats] = useState({ totale: 0, confermate: 0, nonConfermate: 0 });

  useEffect(() => {
    checkAuthAndLoad();
  }, [annoConsultazione]);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [scadenzeData, utentiData] = await Promise.all([loadScadenze(), loadUtenti()]);
      setScadenze(scadenzeData);
      setUtenti(utentiData);
      const confermate = scadenzeData.filter((s) => s.conferma_riga).length;
      setStats({ totale: scadenzeData.length, confermate, nonConfermate: scadenzeData.length - confermate });
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({ title: "Errore", description: "Impossibile caricare i dati", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (): Promise<ScadenzaIva[]> => {
    const { data: anniData, error: anniError } = await supabase
      .from("tbscadiva" as any)
      .select("anno_riferimento")
      .order("anno_riferimento", { ascending: true });
    if (anniError) throw anniError;

    const anni = Array.from(new Set((((anniData ?? []) as any[]) || [])
      .map((r) => r.anno_riferimento)
      .filter((a): a is number => typeof a === "number"))).sort((a, b) => a - b);
    setAnniDisponibili(anni);

    const annoDaUsare = anni.length > 0 && !anni.includes(annoConsultazione) ? anni[anni.length - 1] : annoConsultazione;
    if (annoDaUsare !== annoConsultazione) setAnnoConsultazione(annoDaUsare);

    const { data, error } = await supabase
      .from("tbscadiva" as any)
      .select("*")
      .eq("anno_riferimento", annoDaUsare)
      .order("nominativo", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown) as ScadenzaIva[];
  };

  const loadUtenti = async (): Promise<UtenteIva[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("nome", { ascending: true })
      .order("cognome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown) as UtenteIva[];
  };

  const handleSetBooleanField = async (scadenzaId: string, field: keyof ScadenzaIva, newValue: boolean) => {
    try {
      const previous = scadenze.find((s) => s.id === scadenzaId)?.[field];
      setScadenze((prev) => prev.map((s) => s.id === scadenzaId ? { ...s, [field]: newValue } : s));
      if (field === "conferma_riga" && Boolean(previous) !== newValue) {
        setStats((prev) => ({
          ...prev,
          confermate: newValue ? prev.confermate + 1 : prev.confermate - 1,
          nonConfermate: newValue ? prev.nonConfermate - 1 : prev.nonConfermate + 1,
        }));
      }
      const { error } = await supabase.from("tbscadiva" as any).update({ [field]: newValue } as any).eq("id", scadenzaId);
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Errore aggiornamento", description: error.message, variant: "destructive" });
      await loadData();
    }
  };

  const handleUpdateField = async (scadenzaId: string, field: keyof ScadenzaIva, value: any) => {
    try {
      const { error } = await supabase.from("tbscadiva" as any).update({ [field]: value || null } as any).eq("id", scadenzaId);
      if (error) throw error;
      setScadenze((prev) => prev.map((s) => s.id === scadenzaId ? { ...s, [field]: value } : s));
    } catch (error: any) {
      toast({ title: "Errore aggiornamento", description: error.message, variant: "destructive" });
    }
  };

  const handleNoteChange = (scadenzaId: string, value: string) => {
    setLocalNotes((prev) => ({ ...prev, [scadenzaId]: value }));
    if (noteTimers[scadenzaId]) clearTimeout(noteTimers[scadenzaId]);
    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase.from("tbscadiva" as any).update({ note: value || null }).eq("id", scadenzaId);
        if (error) throw error;
        setScadenze((prev) => prev.map((s) => s.id === scadenzaId ? { ...s, note: value } : s));
      } catch (error) {
        console.error("Errore salvataggio nota:", error);
        toast({ title: "Errore", description: "Impossibile salvare la nota", variant: "destructive" });
      }
    }, 1000);
    setNoteTimers((prev) => ({ ...prev, [scadenzaId]: timer }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;
    try {
      const { error } = await supabase.from("tbscadiva" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Successo", description: "Record eliminato" });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({ title: "Errore", description: "Impossibile eliminare il record", variant: "destructive" });
    }
  };

  const filteredScadenze = scadenze.filter((s) => {
    const matchSearch = (s.nominativo || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchOperatore = filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;
    const matchConferma = filterConferma === "__all__" || (filterConferma === "true" ? s.conferma_riga : !s.conferma_riga);
    return matchSearch && matchOperatore && matchConferma;
  });

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find((u) => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

  const handlePrintOperatore = () => {
    if (filterOperatore === "__all__") return;
    const operatoreNome = getUtenteNome(filterOperatore);
    const righeHtml = filteredScadenze.map((scadenza, index) => `
      <tr><td>${index + 1}</td><td>${scadenza.nominativo ?? ""}</td>
      <td style="text-align:center;font-weight:700;">${scadenza.conferma_riga ? "✓" : "X"}</td>
      <td style="text-align:center;">${scadenza.mod_definitivo ? "✓" : ""}</td>
      <td style="text-align:center;">${scadenza.asseverazione ? "✓" : ""}</td>
      <td style="text-align:center;">${scadenza.mod_inviato ? "✓" : ""}</td>
      <td>${scadenza.importo_credito ?? ""}</td></tr>`).join("");
    const printWindow = window.open("", "_blank", "width=1000,height=700");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Stampa Scadenzario IVA</title><style>
      body{font-family:Arial,sans-serif;padding:18px;color:#111;font-size:11px}h1{font-size:18px;margin-bottom:4px}.meta{margin-bottom:12px;color:#444;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}th,td{border:1px solid #999;padding:6px;text-align:left;vertical-align:top;word-wrap:break-word}th{background:#f3f4f6}.count{margin-bottom:10px;font-weight:bold;font-size:12px}.col-num{width:40px;text-align:center}.col-nominativo{width:50%}.col-conferma,.col-small{width:70px;text-align:center}.col-importo{width:120px}@media print{body{padding:0}}
      </style></head><body><h1>Scadenzario IVA</h1><div class="meta">Anno consultazione: ${annoConsultazione}</div><div class="meta">Operatore: ${operatoreNome}</div><div class="count">Totale record stampati: ${filteredScadenze.length}</div>
      <table><thead><tr><th class="col-num">#</th><th class="col-nominativo">Nominativo</th><th class="col-conferma">Conf.</th><th class="col-small">Def.</th><th class="col-small">Ass.</th><th class="col-small">Inv.</th><th class="col-importo">Credito</th></tr></thead><tbody>${righeHtml || `<tr><td colspan="7">Nessun record trovato</td></tr>`}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="text-center"><div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" /><p className="text-gray-600">Caricamento...</p></div></div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-slate-200/70 px-3 pb-3 pt-2">
      <IvaFixedPanel
        stats={stats}
        utenti={utenti}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterOperatore={filterOperatore}
        setFilterOperatore={setFilterOperatore}
        filterConferma={filterConferma}
        setFilterConferma={setFilterConferma}
        annoConsultazione={annoConsultazione}
        setAnnoConsultazione={setAnnoConsultazione}
        anni={anniDisponibili}
        onPrintOperatore={handlePrintOperatore}
      />
      <IvaScrollableTable
        scadenze={filteredScadenze}
        localNotes={localNotes}
        getUtenteNome={getUtenteNome}
        onSetBoolean={handleSetBooleanField}
        onUpdateField={handleUpdateField}
        onNoteChange={handleNoteChange}
        onDelete={handleDelete}
      />
    </div>
  );
}
