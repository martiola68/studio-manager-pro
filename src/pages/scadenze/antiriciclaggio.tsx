import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileSpreadsheet, Download, RefreshCw, MailWarning } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface Cliente {
  id: string;
  cod_cliente: string;
  ragione_sociale: string;
  tipo_prestazione_a: string | null;
  rischio_ver_a: string | null;
  data_ultima_verifica_antiric: string | null;
  scadenza_antiric: string | null;
  giorni_scad_ver_a: number | null;
  tipo_prestazione_b: string | null;
  rischio_ver_b: string | null;
  data_ultima_verifica_b: string | null;
  scadenza_antiric_b: string | null;
  giorni_scad_ver_b: number | null;
  note_antiriciclaggio: string | null;
  utente_operatore_id: string | null;
  utente_operatore?: {
    nome: string;
    cognome: string;
    email: string;
  } | null;
}

export default function ScadenzeAntiriciclaggio() {
  const [scadenze, setScadenze] = useState<Cliente[]>([]);
  const [filteredScadenze, setFilteredScadenze] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const getScadenzaColor = (giorni: number | null | undefined) => {
    if (giorni === null || giorni === undefined) return "";
    if (giorni < 15) return "bg-red-500 text-white font-bold animate-pulse";
    if (giorni < 30) return "bg-orange-500 text-white";
    return "";
  };

  const calculateDays = (scadenza?: string | null) => {
    if (!scadenza) return null;
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const target = new Date(scadenza);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - oggi.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
    loadScadenze();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredScadenze(scadenze);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = scadenze.filter(
        (c) =>
          c.ragione_sociale?.toLowerCase().includes(term) ||
          c.cod_cliente?.toLowerCase().includes(term)
      );
      setFilteredScadenze(filtered);
    }
  }, [searchTerm, scadenze]);

  useEffect(() => {
    checkAndNotifyUrgent();
  }, [filteredScadenze]);

  const checkAndNotifyUrgent = () => {
    const urgent = filteredScadenze.filter(c => {
      const giorni_a = calculateDays(c.scadenza_antiric);
      const giorni_b = calculateDays(c.scadenza_antiric_b);
      return (giorni_a !== null && giorni_a < 15) || (giorni_b !== null && giorni_b < 15);
    });

    if (urgent.length > 0) {
      toast({
        title: "⚠️ Scadenze Urgenti Rilevate",
        description: `Ci sono ${urgent.length} clienti con scadenze inferiori a 15 giorni.`,
        variant: "destructive",
        duration: 5000
      });
    }
  };

  const sendUrgentEmailViaMailto = () => {
    const urgent = filteredScadenze.filter(c => {
      const giorni_a = calculateDays(c.scadenza_antiric);
      const giorni_b = calculateDays(c.scadenza_antiric_b);
      return (giorni_a !== null && giorni_a < 15) || (giorni_b !== null && giorni_b < 15);
    });

    if (urgent.length === 0) {
      toast({
        title: "Nessuna scadenza urgente",
        description: "Non ci sono clienti con scadenze inferiori a 15 giorni.",
        variant: "default"
      });
      return;
    }

    // Raggruppa clienti per operatore
    const clientsByOperator = urgent.reduce((acc, cliente) => {
      const operatorEmail = cliente.utente_operatore?.email;
      const operatorName = cliente.utente_operatore 
        ? `${cliente.utente_operatore.nome} ${cliente.utente_operatore.cognome}`
        : "Non assegnato";
      
      if (!operatorEmail) return acc;

      if (!acc[operatorEmail]) {
        acc[operatorEmail] = {
          operatorName: operatorName,
          operatorEmail: operatorEmail,
          clients: []
        };
      }

      const giorni_a = calculateDays(cliente.scadenza_antiric);
      const giorni_b = calculateDays(cliente.scadenza_antiric_b);

      const scadenze: string[] = [];
      if (giorni_a !== null && giorni_a < 15) {
        scadenze.push(`Scad. A: ${giorni_a}gg`);
      }
      if (giorni_b !== null && giorni_b < 15) {
        scadenze.push(`Scad. B: ${giorni_b}gg`);
      }

      acc[operatorEmail].clients.push({
        ragione_sociale: cliente.ragione_sociale,
        scadenze: scadenze.join(" • ")
      });

      return acc;
    }, {} as Record<string, { operatorName: string; operatorEmail: string; clients: Array<{ ragione_sociale: string; scadenze: string }> }>);

    // Costruisci email per ogni operatore
    const operators = Object.values(clientsByOperator);
    
    if (operators.length === 0) {
      toast({
        title: "Nessun operatore assegnato",
        description: "I clienti urgenti non hanno operatori fiscali assegnati.",
        variant: "default"
      });
      return;
    }

    // Crea email body con tutti gli operatori e i loro clienti
    const emailBody = operators.map(operator => {
      const clientsList = operator.clients
        .map(c => `- ${c.ragione_sociale}: ${c.scadenze}`)
        .join("\n");

      return `Operatore: ${operator.operatorName} (${operator.operatorEmail})
Clienti urgenti: ${operator.clients.length}

${clientsList}`;
    }).join("\n\n---\n\n");

    const subject = `⚠️ REPORT URGENTE SCADENZE ANTIRICICLAGGIO (${urgent.length})`;
    const body = `Scadenze Antiriciclaggio Urgenti

Attenzione, rilevate scadenze urgenti (< 15 giorni):

${emailBody}

---
Email generata automaticamente dal sistema Studio Manager Pro
Data: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })}`;

    // Crea link mailto
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Apri client email
    window.location.href = mailtoLink;

    // Conferma
    toast({
      title: "Client email aperto",
      description: `Report preparato per ${urgent.length} cliente/i (${operators.length} operatore/i). Completa l'invio dal tuo client email.`,
      variant: "default"
    });
  };

  const loadScadenze = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tbclienti")
        .select(
          `
          id,
          cod_cliente,
          ragione_sociale,
          tipo_prestazione_a,
          rischio_ver_a,
          data_ultima_verifica_antiric,
          scadenza_antiric,
          giorni_scad_ver_a,
          tipo_prestazione_b,
          rischio_ver_b,
          data_ultima_verifica_b,
          scadenza_antiric_b,
          giorni_scad_ver_b,
          note_antiriciclaggio,
          utente_operatore_id,
          tbutenti!tbclienti_utente_operatore_id_fkey (
            nome,
            cognome,
            email
          )
        `
        )
        .eq("gestione_antiriciclaggio", true)
        .order("ragione_sociale", { ascending: true });

      if (error) throw error;

      const clientiWithCalculatedDays = (data || []).map(c => ({
        ...c,
        utente_operatore: c.tbutenti,
        giorni_scad_ver_a: calculateDays(c.scadenza_antiric),
        giorni_scad_ver_b: calculateDays(c.scadenza_antiric_b)
      }));

      setScadenze(clientiWithCalculatedDays);
      setFilteredScadenze(clientiWithCalculatedDays);
    } catch (error) {
      console.error("Error loading scadenze:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle scadenze antiriciclaggio",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const dataToExport = filteredScadenze.map((s) => ({
      Cliente: s.ragione_sociale,
      "Utente Fiscale": s.utente_operatore 
        ? `${s.utente_operatore.nome} ${s.utente_operatore.cognome}`
        : "",
      "Prestazione A": s.tipo_prestazione_a || "",
      "Rischio A": s.rischio_ver_a || "",
      "Data Verifica A": s.data_ultima_verifica_antiric ? format(new Date(s.data_ultima_verifica_antiric), "dd/MM/yyyy") : "",
      "Scadenza A": s.scadenza_antiric ? format(new Date(s.scadenza_antiric), "dd/MM/yyyy") : "",
      "Giorni A": s.giorni_scad_ver_a ?? "",
      "Prestazione B": s.tipo_prestazione_b || "",
      "Rischio B": s.rischio_ver_b || "",
      "Data Verifica B": s.data_ultima_verifica_b ? format(new Date(s.data_ultima_verifica_b), "dd/MM/yyyy") : "",
      "Scadenza B": s.scadenza_antiric_b ? format(new Date(s.scadenza_antiric_b), "dd/MM/yyyy") : "",
      "Giorni B": s.giorni_scad_ver_b ?? "",
      Note: s.note_antiriciclaggio || ""
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scadenze Antiriciclaggio");
    XLSX.writeFile(wb, `Scadenze_Antiriciclaggio_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({
      title: "Export completato",
      description: "File Excel scaricato con successo",
      variant: "default"
    });
  };

  const urgentCount = filteredScadenze.filter(c => {
    const giorni_a = calculateDays(c.scadenza_antiric);
    const giorni_b = calculateDays(c.scadenza_antiric_b);
    return (giorni_a !== null && giorni_a < 15) || (giorni_b !== null && giorni_b < 15);
  }).length;

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Scadenzario Antiriciclaggio
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gestione scadenze verifiche periodiche antiriciclaggio
            </p>
          </div>
          <div className="flex gap-2">
            {urgentCount > 0 && (
              <Button
                onClick={sendUrgentEmailViaMailto}
                variant="destructive"
                className="gap-2"
              >
                <MailWarning className="h-4 w-4" />
                Invia Alert ({urgentCount})
              </Button>
            )}
            <Button onClick={loadScadenze} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Aggiorna
            </Button>
            <Button onClick={exportExcel} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Esporta Excel
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            placeholder="Cerca per ragione sociale, codice cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          {searchTerm && (
            <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}>
              Cancella
            </Button>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Cliente</TableHead>
                  <TableHead>Utente Fiscale</TableHead>
                  <TableHead>Prestazione A</TableHead>
                  <TableHead>Rischio A</TableHead>
                  <TableHead>Data Ver. A</TableHead>
                  <TableHead>Scadenza A</TableHead>
                  <TableHead>Giorni Scad. A</TableHead>
                  <TableHead>Prestazione B</TableHead>
                  <TableHead>Rischio B</TableHead>
                  <TableHead>Data Ver. B</TableHead>
                  <TableHead>Scadenza B</TableHead>
                  <TableHead>Giorni Scad. B</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : filteredScadenze.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                      Nessun cliente con gestione antiriciclaggio attiva
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScadenze.map((cliente) => {
                    const giorni_a = calculateDays(cliente.scadenza_antiric);
                    const giorni_b = calculateDays(cliente.scadenza_antiric_b);
                    
                    return (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">
                          {cliente.ragione_sociale}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {cliente.utente_operatore 
                            ? `${cliente.utente_operatore.nome} ${cliente.utente_operatore.cognome}`
                            : "-"}
                        </TableCell>

                        {/* Blocco A */}
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400 font-semibold">
                          {cliente.tipo_prestazione_a || "-"}
                        </TableCell>
                        <TableCell>
                          {cliente.rischio_ver_a && (
                            <Badge variant="outline">{cliente.rischio_ver_a}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {cliente.data_ultima_verifica_antiric
                            ? format(
                                new Date(cliente.data_ultima_verifica_antiric),
                                "dd/MM/yyyy",
                                { locale: it }
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {cliente.scadenza_antiric ? (
                            <div
                              className={
                                giorni_a !== null && giorni_a < 15
                                  ? "text-red-600 font-bold"
                                  : giorni_a !== null && giorni_a < 30
                                  ? "text-orange-600 font-semibold"
                                  : ""
                              }
                            >
                              {format(new Date(cliente.scadenza_antiric), "dd/MM/yyyy", {
                                locale: it
                              })}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {giorni_a !== null && (
                            <div
                              className={`px-2 py-1 rounded text-center font-semibold ${getScadenzaColor(
                                giorni_a
                              )}`}
                            >
                              {giorni_a} gg
                            </div>
                          )}
                        </TableCell>

                        {/* Blocco B */}
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400 font-semibold">
                          {cliente.tipo_prestazione_b || "-"}
                        </TableCell>
                        <TableCell>
                          {cliente.rischio_ver_b && (
                            <Badge variant="outline">{cliente.rischio_ver_b}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {cliente.data_ultima_verifica_b
                            ? format(
                                new Date(cliente.data_ultima_verifica_b),
                                "dd/MM/yyyy",
                                { locale: it }
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {cliente.scadenza_antiric_b ? (
                            <div
                              className={
                                giorni_b !== null && giorni_b < 15
                                  ? "text-red-600 font-bold"
                                  : giorni_b !== null && giorni_b < 30
                                  ? "text-orange-600 font-semibold"
                                  : ""
                              }
                            >
                              {format(new Date(cliente.scadenza_antiric_b), "dd/MM/yyyy", {
                                locale: it
                              })}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {giorni_b !== null && (
                            <div
                              className={`px-2 py-1 rounded text-center font-semibold ${getScadenzaColor(
                                giorni_b
                              )}`}
                            >
                              {giorni_b} gg
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="max-w-xs truncate text-sm text-gray-600 dark:text-gray-400">
                          {cliente.note_antiriciclaggio || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </main>
  );
}