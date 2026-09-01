import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  utente_fiscale?: {
    nome: string;
    cognome: string;
  } | null;
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
  const [filtroUtenteFiscale, setFiltroUtenteFiscale] = useState<string>("tutti");
const [updating, setUpdating] = useState<string | null>(null);
const [studioId, setStudioId] = useState<string>("");
const { toast } = useToast();
  
  useEffect(() => {
    loadClienti();
  }, []);

  useEffect(() => {
    let filtered = clienti;

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cliente =>
        cliente.ragione_sociale?.toLowerCase().includes(query) ||
        cliente.codice_fiscale?.toLowerCase().includes(query) ||
        cliente.partita_iva?.toLowerCase().includes(query)
      );
    }

    if (filtroUtenteFiscale && filtroUtenteFiscale !== "tutti") {
      filtered = filtered.filter(cliente => {
        const nomeCompleto = cliente.utente_fiscale 
          ? `${cliente.utente_fiscale.nome} ${cliente.utente_fiscale.cognome}`
          : "";
        return nomeCompleto === filtroUtenteFiscale;
      });
    }

    setFilteredClienti(filtered);
  }, [searchQuery, filtroUtenteFiscale, clienti]);

  const utentiFiscaliUnici = useMemo(() => {
    const utentiMap = new Map<string, { nome: string; cognome: string }>();
    clienti.forEach(cliente => {
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
    servizi:tbclienti_servizi(
      flag_iva,
      flag_lipe,
      flag_bilancio,
      flag_770,
      flag_imu,
      flag_cu,
      flag_fiscali,
      flag_esterometro,
      flag_ccgg
    )
  `)
  .eq("studio_id", userData.studio_id)
  .eq("attivo", true)
  .eq("cliente", true)
  .order("ragione_sociale", { ascending: true });

if (error) throw error;

const clientiNormalizzati = (data || []).map((cliente: any) => ({
  ...cliente,
  servizi: Array.isArray(cliente.servizi)
    ? cliente.servizi[0] || null
    : cliente.servizi || null,
}));

setClienti(clientiNormalizzati);
setFilteredClienti(clientiNormalizzati);
    } catch (error) {
      console.error("Errore caricamento clienti:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

async function handleToggleFlag(
  clienteId: string,
  field: keyof ServiziCliente,
  checked: boolean | "indeterminate"
) {
 try {
  setUpdating(clienteId);

  if (!studioId) {
    throw new Error("studio_id non disponibile");
  }

  const value = checked === true;

    const { error } = await (supabase as any)
      .from("tbclienti_servizi")
      .upsert(
        {
         studio_id: studioId,
cliente_id: clienteId,
          [field]: value,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "studio_id,cliente_id",
        }
      );

    if (error) throw error;

    setClienti(prev =>
      prev.map(c =>
        c.id === clienteId
          ? {
              ...c,
              servizi: {
                ...(c.servizi || {}),
                [field]: value,
              },
            }
          : c
      )
    );

    toast({
      title: "Aggiornato",
      description: `Flag ${String(field)
        .replace("flag_", "")
        .toUpperCase()} aggiornato con successo`,
    });
  } catch (error) {
    console.error("Errore aggiornamento flag:", error);

    toast({
      title: "Errore",
      description: "Impossibile aggiornare il flag",
      variant: "destructive",
    });
  } finally {
    setUpdating(null);
  }
}

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Elenco Generale Scadenzari</h1>
          <p className="text-gray-500 mt-1">Visione completa degli scadenzari per ogni cliente</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cerca Nominativo"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filtroUtenteFiscale} onValueChange={setFiltroUtenteFiscale}>
              <SelectTrigger>
                <SelectValue placeholder="Utente Operatore" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti</SelectItem>
                {utentiFiscaliUnici.map(utente => (
                  <SelectItem key={utente.nomeCompleto} value={utente.nomeCompleto}>
                    {utente.nomeCompleto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Riepilogo Generale Scadenze</CardTitle>
            <div className="text-sm text-gray-500">
              {filteredClienti.length} Clienti
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] sticky-col-header border-r min-w-[200px]">Cliente</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] min-w-[150px]">Utente Fiscale</th>
                  {TIPI_SCADENZE.map(tipo => (
                    <th key={tipo.id} className="h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center min-w-[100px] border-l">
                      {tipo.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {filteredClienti.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td colSpan={2 + TIPI_SCADENZE.length} className="p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center py-8 text-gray-500">
                      Nessun dato trovato
                    </td>
                  </tr>
                ) : (
                  filteredClienti.map((cliente) => (
                    <tr key={cliente.id} className="border-b transition-colors hover:bg-green-50 data-[state=selected]:bg-muted">
                      <td className="p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] sticky-col-cell border-r font-medium min-w-[200px]">
                        {cliente.ragione_sociale}
                      </td>
                      <td className="p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-sm text-gray-600 min-w-[150px]">
                        {cliente.utente_fiscale ? `${cliente.utente_fiscale.nome} ${cliente.utente_fiscale.cognome}` : "-"}
                      </td>
                      {TIPI_SCADENZE.map(tipo => (
                        <td key={tipo.id} className="p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center min-w-[100px] border-l">
                          <div className="flex items-center justify-center">
                            <Checkbox
  checked={
    cliente.servizi?.[
      tipo.id as keyof ServiziCliente
    ] === true
  }
  onCheckedChange={(checked) =>
    handleToggleFlag(
      cliente.id,
      tipo.id as keyof ServiziCliente,
      checked
    )
  }
  disabled={updating === cliente.id}
/>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
