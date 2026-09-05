import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { Search, Loader2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/hooks/use-toast";

type ServiziCliente = {
  flag_iva?: boolean | null;
  flag_lipe?: boolean | null;
  flag_bilancio?: boolean | null;
  flag_770?: boolean | null;
  flag_imu?: boolean | null;
  flag_cu?: boolean | null;
  flag_fiscali?: boolean | null;
  flag_esterometro?: boolean | null;
  flag_ccgg?: boolean | null;
};

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"] & {
  utente_fiscale?: { nome: string; cognome: string } | null;
  servizi?: ServiziCliente | null;
};

const TIPI_SCADENZE = [
  { id: "flag_iva", label: "IVA" },
  { id: "flag_lipe", label: "LIPE" },
  { id: "flag_bilancio", label: "Bilancio" },
  { id: "flag_770", label: "770" },
  { id: "flag_imu", label: "IMU" },
  { id: "flag_cu", label: "CU" },
  { id: "flag_fiscali", label: "Fiscali" },
  { id: "flag_esterometro", label: "Esterometro" },
  { id: "flag_ccgg", label: "CCGG" },
];

export default function ElencoGenerale() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredClienti, setFilteredClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroUtenteFiscale, setFiltroUtenteFiscale] = useState("tutti");
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [studioId, setStudioId] = useState("");
  const { toast } = useToast();

  useEffect(() => { void loadClienti(); }, []);

  useEffect(() => {
    let filtered = clienti;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((cliente) =>
        cliente.ragione_sociale?.toLowerCase().includes(query) ||
        cliente.codice_fiscale?.toLowerCase().includes(query) ||
        cliente.partita_iva?.toLowerCase().includes(query)
      );
    }
    if (filtroUtenteFiscale !== "tutti") {
      filtered = filtered.filter((cliente) =>
        cliente.utente_fiscale
          ? `${cliente.utente_fiscale.nome} ${cliente.utente_fiscale.cognome}` === filtroUtenteFiscale
          : false
      );
    }
    setFilteredClienti(filtered);
  }, [searchQuery, filtroUtenteFiscale, clienti]);

  const utentiFiscaliUnici = useMemo(() => {
    const utentiMap = new Map<string, { nome: string; cognome: string }>();
    clienti.forEach((cliente) => {
      if (cliente.utente_fiscale) {
        const nomeCompleto = `${cliente.utente_fiscale.nome} ${cliente.utente_fiscale.cognome}`;
        utentiMap.set(nomeCompleto, cliente.utente_fiscale);
      }
    });
    return Array.from(utentiMap.entries())
      .map(([nomeCompleto, utente]) => ({ nomeCompleto, ...utente }))
      .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
  }, [clienti]);

  async function loadClienti() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();
      if (!userData?.studio_id) return;
      setStudioId(userData.studio_id);

      const { data, error } = await supabase
        .from("tbclienti")
        .select(`
          *,
          utente_fiscale:tbutenti!tbclienti_utente_operatore_id_fkey(nome, cognome),
          servizi:tbclienti_servizi(flag_iva,flag_lipe,flag_bilancio,flag_770,flag_imu,flag_cu,flag_fiscali,flag_esterometro,flag_ccgg)
        `)
        .eq("studio_id", userData.studio_id)
        .eq("attivo", true)
        .eq("cliente", true)
        .order("ragione_sociale", { ascending: true });
      if (error) throw error;

      const normalizzati = (data || []).map((cliente: any) => ({
        ...cliente,
        servizi: Array.isArray(cliente.servizi) ? cliente.servizi[0] || null : cliente.servizi || null,
      }));
      setClienti(normalizzati);
      setFilteredClienti(normalizzati);
    } catch (error) {
      console.error("Errore caricamento clienti:", error);
      toast({ title: "Errore", description: "Impossibile caricare i clienti", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFlag(clienteId: string, field: keyof ServiziCliente, value: boolean) {
    const key = `${clienteId}:${String(field)}`;
    const previous = clienti.find((c) => c.id === clienteId)?.servizi?.[field] === true;

    setClienti((prev) => prev.map((c) =>
      c.id === clienteId
        ? { ...c, servizi: { ...(c.servizi || {}), [field]: value } }
        : c
    ));
    setUpdating((prev) => new Set(prev).add(key));

    try {
      if (!studioId) throw new Error("studio_id non disponibile");
      const { error } = await (supabase as any).from("tbclienti_servizi").upsert(
        { studio_id: studioId, cliente_id: clienteId, [field]: value, updated_at: new Date().toISOString() },
        { onConflict: "studio_id,cliente_id" }
      );
      if (error) throw error;
    } catch (error) {
      setClienti((prev) => prev.map((c) =>
        c.id === clienteId
          ? { ...c, servizi: { ...(c.servizi || {}), [field]: previous } }
          : c
      ));
      console.error("Errore aggiornamento flag:", error);
      toast({ title: "Errore", description: "Impossibile aggiornare il flag", variant: "destructive" });
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-slate-100"><Loader2 className="h-8 w-8 animate-spin text-sky-700" /></div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 bg-slate-100 py-3">
      <div className="shrink-0 rounded-lg border border-sky-200 bg-slate-50 px-4 py-3 shadow-sm">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Elenco Generale Scadenzari</h1>
            <p className="mt-0.5 text-sm text-slate-500">Visione completa degli scadenzari per ogni cliente</p>
          </div>
          <div className="rounded-md border border-sky-200 bg-white px-3 py-1.5 text-sm font-semibold text-sky-800">{filteredClienti.length} Clienti</div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Cerca nominativo, codice fiscale o partita IVA" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 border-slate-300 bg-white pl-9" />
          </div>
          <Select value={filtroUtenteFiscale} onValueChange={setFiltroUtenteFiscale}>
            <SelectTrigger className="h-9 border-slate-300 bg-white"><SelectValue placeholder="Utente fiscale" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti gli utenti fiscali</SelectItem>
              {utentiFiscaliUnici.map((utente) => <SelectItem key={utente.nomeCompleto} value={utente.nomeCompleto}>{utente.nomeCompleto}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-sky-200 bg-white shadow-sm">
        <div className="shrink-0 border-b border-sky-200 bg-slate-50 px-4 py-2.5"><div className="text-sm font-semibold text-slate-800">Riepilogo Generale Scadenze</div></div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm">
              <tr>
                <th className="sticky left-0 z-40 w-[280px] min-w-[280px] border-r border-slate-500 bg-slate-600 px-3 py-2 text-left font-semibold">Cliente</th>
                <th className="w-[170px] min-w-[170px] border-r border-slate-500 px-3 py-2 text-left font-semibold">Utente Fiscale</th>
                {TIPI_SCADENZE.map((tipo) => <th key={tipo.id} className="w-[92px] min-w-[92px] border-r border-slate-500 px-2 py-2 text-center font-semibold last:border-r-0">{tipo.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredClienti.length === 0 ? (
                <tr><td colSpan={2 + TIPI_SCADENZE.length} className="px-4 py-10 text-center text-sm text-slate-500">Nessun dato trovato</td></tr>
              ) : filteredClienti.map((cliente, rowIndex) => (
                <tr key={cliente.id} className={`border-b border-slate-200 hover:bg-sky-50 ${rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                  <td className="sticky left-0 z-20 border-r border-slate-200 bg-inherit px-3 py-1.5 font-medium text-slate-900"><div className="truncate" title={cliente.ragione_sociale || ""}>{cliente.ragione_sociale}</div></td>
                  <td className="border-r border-slate-200 px-3 py-1.5 text-slate-600"><div className="truncate">{cliente.utente_fiscale ? `${cliente.utente_fiscale.nome} ${cliente.utente_fiscale.cognome}` : "-"}</div></td>
                  {TIPI_SCADENZE.map((tipo) => {
                    const field = tipo.id as keyof ServiziCliente;
                    const enabled = cliente.servizi?.[field] === true;
                    const cellUpdating = updating.has(`${cliente.id}:${tipo.id}`);
                    return (
                      <td key={tipo.id} className="border-r border-slate-200 px-1.5 py-1 text-center last:border-r-0">
                        <Select value={enabled ? "si" : "no"} onValueChange={(value) => void handleToggleFlag(cliente.id, field, value === "si")}>
                          <SelectTrigger aria-label={`${tipo.label} ${cliente.ragione_sociale}`} className={`mx-auto h-7 w-[64px] justify-center gap-1 border bg-white px-2 text-[11px] font-semibold shadow-none ${enabled ? "border-sky-700 text-sky-800 hover:bg-sky-50" : "border-red-300 text-red-600 hover:bg-red-50"} ${cellUpdating ? "opacity-60" : ""}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent><SelectItem value="si">SI</SelectItem><SelectItem value="no">NO</SelectItem></SelectContent>
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
