import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { Search, Loader2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"] & {
  utente_fiscale?: { nome: string; cognome: string } | null;
  utente_payroll?: { nome: string; cognome: string } | null;
  // Estensione opzionale per gestire i flag come stato
  scadenze?: Record<string, boolean | null>;
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
];

export default function ElencoGenerale() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredClienti, setFilteredClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroUtenteFiscale, setFiltroUtenteFiscale] = useState<string>("tutti");
  const [filtroUtentePayroll, setFiltroUtentePayroll] = useState<string>("tutti");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadClienti();
  }, []);

  const renderStatoCell = (active: boolean | null | undefined) => {
    if (active === true) return <span className="text-green-600 font-bold">●</span>;
    if (active === false) return <span className="text-red-300">○</span>;
    return <span className="text-gray-200">-</span>;
  };

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

    if (filtroUtentePayroll && filtroUtentePayroll !== "tutti") {
      filtered = filtered.filter(cliente => {
        const nomeCompleto = cliente.utente_payroll 
          ? `${cliente.utente_payroll.nome} ${cliente.utente_payroll.cognome}`
          : "";
        return nomeCompleto === filtroUtentePayroll;
      });
    }

    setFilteredClienti(filtered);
  }, [searchQuery, filtroUtenteFiscale, filtroUtentePayroll, clienti]);

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

  const utentiPayrollUnici = useMemo(() => {
    const utentiMap = new Map<string, { nome: string; cognome: string }>();
    clienti.forEach(cliente => {
      if (cliente.utente_payroll) {
        const nomeCompleto = `${cliente.utente_payroll.nome} ${cliente.utente_payroll.cognome}`;
        utentiMap.set(nomeCompleto, cliente.utente_payroll);
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

      const { data, error } = await supabase
        .from("tbclienti")
        .select(`
          *,
          utente_fiscale:tbutenti!tbclienti_utente_operatore_id_fkey(nome, cognome),
          utente_payroll:tbutenti!tbclienti_utente_payroll_id_fkey(nome, cognome)
        `)
        .eq("studio_id", userData.studio_id)
        .order("ragione_sociale", { ascending: true });

      if (error) throw error;

      setClienti(data || []);
      setFilteredClienti(data || []);
    } catch (error) {
      console.error("Errore caricamento clienti:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateScadenzario(clienteId: string, field: keyof Cliente, value: boolean) {
    try {
      setUpdating(clienteId);

      const { error } = await supabase
        .from("tbclienti")
        .update({ [field]: value })
        .eq("id", clienteId);

      if (error) throw error;

      setClienti(prev =>
        prev.map(c => (c.id === clienteId ? { ...c, [field]: value } : c))
      );
    } catch (error) {
      console.error("Errore aggiornamento scadenzario:", error);
    } finally {
      setUpdating(null);
    }
  }

  const scadenzari = [
    { label: "LIPE", field: "flag_lipe" as keyof Cliente },
    { label: "Bilancio", field: "flag_bilancio" as keyof Cliente },
    { label: "IVA", field: "flag_iva" as keyof Cliente },
    { label: "CCGG", field: "flag_ccgg" as keyof Cliente },
    { label: "Esterometro", field: "flag_esterometro" as keyof Cliente },
    { label: "770", field: "flag_770" as keyof Cliente },
    { label: "Fiscali", field: "flag_fiscali" as keyof Cliente },
    { label: "IMU", field: "flag_imu" as keyof Cliente }
  ];

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
          <div className="flex items-center justify-between">
            <CardTitle>Riepilogo Generale Scadenze</CardTitle>
            <div className="text-sm text-gray-500">
              {filteredClienti.length} Clienti
            </div>
          </div>
        </CardHeader>
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
                        {renderStatoCell(cliente[tipo.id as keyof Cliente] as boolean)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}