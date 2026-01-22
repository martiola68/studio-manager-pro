import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Mail, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

interface ClienteWithOperatore extends Cliente {
  utente_operatore?: Utente | null;
}

export default function Antiriciclaggio() {
  const { toast } = useToast();
  const [clienti, setClienti] = useState<ClienteWithOperatore[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroUrgenza, setFiltroUrgenza] = useState<"tutti" | "urgenti" | "urgentissimi">("tutti");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchClienti();
  }, []);

  async function fetchClienti() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("tbclienti")
        .select(`
          *,
          utente_operatore:tbutenti!tbclienti_utente_operatore_id_fkey(*)
        `)
        .order("ragione_sociale");

      if (error) throw error;
      setClienti(data || []);
    } catch (error) {
      console.error("Errore caricamento clienti:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function calcolaGiorniRimanenti(dataScadenza: string | null): number | null {
    if (!dataScadenza) return null;
    const oggi = new Date();
    const scadenza = new Date(dataScadenza);
    const diffTime = scadenza.getTime() - oggi.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function getUrgenzaBadge(giorni: number | null) {
    if (giorni === null) return null;
    if (giorni < 0) return <Badge variant="outline" className="bg-gray-100">Scaduto</Badge>;
    if (giorni <= 7) return <Badge variant="destructive" className="bg-red-600">Urgentissimo</Badge>;
    if (giorni <= 14) return <Badge variant="default" className="bg-orange-600">Urgente</Badge>;
    return <Badge variant="outline" className="bg-green-100 text-green-800">OK</Badge>;
  }

  function sendUrgentEmailViaMailto() {
    try {
      setSending(true);

      const oggi = new Date();
      const clientiUrgenti: Array<{
        cliente: ClienteWithOperatore;
        urgentDeadlines: Array<{ tipo: string; giorni: number }>;
      }> = [];

      for (const cliente of clienti) {
        const urgentDeadlines: Array<{ tipo: string; giorni: number }> = [];

        if (cliente.scadenza_antiric) {
          const giorniA = calcolaGiorniRimanenti(cliente.scadenza_antiric);
          if (giorniA !== null && giorniA >= 0 && giorniA < 15) {
            urgentDeadlines.push({ tipo: "A", giorni: giorniA });
          }
        }

        if (cliente.scadenza_antiric_b) {
          const giorniB = calcolaGiorniRimanenti(cliente.scadenza_antiric_b);
          if (giorniB !== null && giorniB >= 0 && giorniB < 15) {
            urgentDeadlines.push({ tipo: "B", giorni: giorniB });
          }
        }

        if (urgentDeadlines.length > 0) {
          clientiUrgenti.push({ cliente, urgentDeadlines });
        }
      }

      if (clientiUrgenti.length === 0) {
        toast({
          title: "Nessuna urgenza",
          description: "Non ci sono clienti con scadenze urgenti (<15 giorni)",
        });
        setSending(false);
        return;
      }

      const clientiPerOperatore = new Map<string, typeof clientiUrgenti>();

      for (const item of clientiUrgenti) {
        const operatore = item.cliente.utente_operatore;
        if (!operatore || !operatore.email) continue;

        const key = operatore.email;
        if (!clientiPerOperatore.has(key)) {
          clientiPerOperatore.set(key, []);
        }
        clientiPerOperatore.get(key)!.push(item);
      }

      if (clientiPerOperatore.size === 0) {
        toast({
          title: "Nessun operatore assegnato",
          description: "I clienti urgenti non hanno operatori fiscali assegnati.",
          variant: "destructive",
        });
        setSending(false);
        return;
      }

      let emailsSent = 0;
      const operatoriEmails: string[] = [];

      for (const [operatoreEmail, clientiOperatore] of clientiPerOperatore.entries()) {
        const operatore = clientiOperatore[0].cliente.utente_operatore!;
        operatoriEmails.push(operatoreEmail);

        const clientsList = clientiOperatore
          .map((item) => {
            const deadlines = item.urgentDeadlines
              .map((d) => `Scad. ${d.tipo}: ${d.giorni}gg`)
              .join(" • ");
            return `- ${item.cliente.ragione_sociale}: ${deadlines}`;
          })
          .join("\n");

        const subject = `⚠️ SCADENZE ANTIRICICLAGGIO URGENTI - ${clientiOperatore.length} Cliente/i`;

        const body = `Gentile ${operatore.nome} ${operatore.cognome},

Sono state rilevate scadenze antiriciclaggio urgenti (< 15 giorni) per i seguenti tuoi clienti:

${clientsList}

Ti invitiamo a verificare e completare gli adempimenti entro le scadenze indicate.

---
Email generata automaticamente dal sistema Studio Manager Pro
Data: ${new Date().toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })} - ${new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;

        const mailtoLink = `mailto:${operatoreEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, "_blank");
        emailsSent++;
      }

      toast({
        title: "✓ Client email aperti",
        description: `${emailsSent} finestre email aperte per ${clientiUrgenti.length} cliente/i urgenti. Destinatari: ${operatoriEmails.join(", ")}`,
      });
    } catch (error) {
      console.error("Errore invio alert:", error);
      toast({
        title: "Errore",
        description: "Impossibile aprire client email",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  function esportaExcel() {
    const dataExport = clientiFiltrati.map((c) => {
      const giorniA = calcolaGiorniRimanenti(c.scadenza_antiric);
      const giorniB = calcolaGiorniRimanenti(c.scadenza_antiric_b);

      return {
        "Ragione Sociale": c.ragione_sociale || "",
        "Codice Fiscale": c.codice_fiscale || "",
        "Partita IVA": c.partita_iva || "",
        "Operatore Fiscale": c.utente_operatore
          ? `${c.utente_operatore.nome} ${c.utente_operatore.cognome}`
          : "Non assegnato",
        "Scadenza A": c.scadenza_antiric
          ? new Date(c.scadenza_antiric).toLocaleDateString("it-IT")
          : "",
        "Giorni Rimanenti A": giorniA !== null ? giorniA : "",
        "Urgenza A": giorniA !== null
          ? giorniA < 0
            ? "Scaduto"
            : giorniA <= 7
            ? "Urgentissimo"
            : giorniA <= 14
            ? "Urgente"
            : "OK"
          : "",
        "Scadenza B": c.scadenza_antiric_b
          ? new Date(c.scadenza_antiric_b).toLocaleDateString("it-IT")
          : "",
        "Giorni Rimanenti B": giorniB !== null ? giorniB : "",
        "Urgenza B": giorniB !== null
          ? giorniB < 0
            ? "Scaduto"
            : giorniB <= 7
            ? "Urgentissimo"
            : giorniB <= 14
            ? "Urgente"
            : "OK"
          : "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Antiriciclaggio");

    const oggi = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `scadenze_antiriciclaggio_${oggi}.xlsx`);

    toast({
      title: "✓ Export completato",
      description: `File Excel generato con ${dataExport.length} clienti`,
    });
  }

  const clientiFiltrati = clienti.filter((c) => {
    const giorniA = calcolaGiorniRimanenti(c.scadenza_antiric);
    const giorniB = calcolaGiorniRimanenti(c.scadenza_antiric_b);

    const giorniMin = [giorniA, giorniB]
      .filter((g): g is number => g !== null && g >= 0)
      .sort((a, b) => a - b)[0];

    if (filtroUrgenza === "urgentissimi") {
      return giorniMin !== undefined && giorniMin <= 7;
    }
    if (filtroUrgenza === "urgenti") {
      return giorniMin !== undefined && giorniMin > 7 && giorniMin <= 14;
    }
    return true;
  });

  const urgentissimi = clienti.filter((c) => {
    const giorniA = calcolaGiorniRimanenti(c.scadenza_antiric);
    const giorniB = calcolaGiorniRimanenti(c.scadenza_antiric_b);
    const giorniMin = [giorniA, giorniB]
      .filter((g): g is number => g !== null && g >= 0)
      .sort((a, b) => a - b)[0];
    return giorniMin !== undefined && giorniMin <= 7;
  }).length;

  const urgenti = clienti.filter((c) => {
    const giorniA = calcolaGiorniRimanenti(c.scadenza_antiric);
    const giorniB = calcolaGiorniRimanenti(c.scadenza_antiric_b);
    const giorniMin = [giorniA, giorniB]
      .filter((g): g is number => g !== null && g >= 0)
      .sort((a, b) => a - b)[0];
    return giorniMin !== undefined && giorniMin > 7 && giorniMin <= 14;
  }).length;

  const totaleUrgenze = urgentissimi + urgenti;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Scadenze Antiriciclaggio
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitoraggio adempimenti antiriciclaggio per tutti i clienti
            </p>
          </div>

          <div className="flex gap-2">
            {totaleUrgenze > 0 && (
              <Button
                onClick={sendUrgentEmailViaMailto}
                disabled={sending || loading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                {sending ? "Apertura..." : `Invia Alert (${totaleUrgenze})`}
              </Button>
            )}
            <Button
              onClick={esportaExcel}
              variant="outline"
              disabled={loading || clientiFiltrati.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Esporta Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            className={`cursor-pointer transition-all ${
              filtroUrgenza === "urgentissimi"
                ? "ring-2 ring-red-500 border-red-200 dark:border-red-900"
                : "border-red-200 dark:border-red-900"
            }`}
            onClick={() =>
              setFiltroUrgenza(
                filtroUrgenza === "urgentissimi" ? "tutti" : "urgentissimi"
              )
            }
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Urgentissimi (≤7gg)
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {urgentissimi}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Clienti con scadenze immediate
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              filtroUrgenza === "urgenti"
                ? "ring-2 ring-orange-500 border-orange-200 dark:border-orange-900"
                : "border-orange-200 dark:border-orange-900"
            }`}
            onClick={() =>
              setFiltroUrgenza(filtroUrgenza === "urgenti" ? "tutti" : "urgenti")
            }
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Urgenti (8-14gg)
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{urgenti}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Clienti da monitorare
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              filtroUrgenza === "tutti"
                ? "ring-2 ring-blue-500 border-blue-200 dark:border-blue-900"
                : "border-blue-200 dark:border-blue-900"
            }`}
            onClick={() => setFiltroUrgenza("tutti")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Totale Clienti
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {clienti.length}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Tutti i clienti monitorati
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Elenco Clienti {filtroUrgenza !== "tutti" && `- ${filtroUrgenza === "urgentissimi" ? "Urgentissimi" : "Urgenti"}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Caricamento...
              </div>
            ) : clientiFiltrati.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nessun cliente trovato
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ragione Sociale</TableHead>
                      <TableHead>Operatore Fiscale</TableHead>
                      <TableHead>Scadenza A</TableHead>
                      <TableHead>Tipo Prest. A</TableHead>
                      <TableHead>Giorni Rim. A</TableHead>
                      <TableHead>Urgenza A</TableHead>
                      <TableHead>Scadenza B</TableHead>
                      <TableHead>Tipo Prest. B</TableHead>
                      <TableHead>Giorni Rim. B</TableHead>
                      <TableHead>Urgenza B</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientiFiltrati.map((cliente) => {
                      const giorniA = calcolaGiorniRimanenti(
                        cliente.scadenza_antiric
                      );
                      const giorniB = calcolaGiorniRimanenti(
                        cliente.scadenza_antiric_b
                      );

                      return (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-medium">
                            {cliente.ragione_sociale}
                          </TableCell>
                          <TableCell>
                            {cliente.utente_operatore ? (
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {cliente.utente_operatore.nome}{" "}
                                  {cliente.utente_operatore.cognome}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {cliente.utente_operatore.email}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                Non assegnato
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {cliente.scadenza_antiric
                              ? new Date(
                                  cliente.scadenza_antiric
                                ).toLocaleDateString("it-IT")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {cliente.tipo_prestazione_a || "-"}
                          </TableCell>
                          <TableCell>
                            {giorniA !== null ? (
                              <span
                                className={
                                  giorniA < 0
                                    ? "text-gray-500"
                                    : giorniA <= 7
                                    ? "text-red-600 font-bold"
                                    : giorniA <= 14
                                    ? "text-orange-600 font-semibold"
                                    : "text-green-600"
                                }
                              >
                                {giorniA} giorni
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{getUrgenzaBadge(giorniA)}</TableCell>
                          <TableCell>
                            {cliente.scadenza_antiric_b
                              ? new Date(
                                  cliente.scadenza_antiric_b
                                ).toLocaleDateString("it-IT")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {cliente.tipo_prestazione_b || "-"}
                          </TableCell>
                          <TableCell>
                            {giorniB !== null ? (
                              <span
                                className={
                                  giorniB < 0
                                    ? "text-gray-500"
                                    : giorniB <= 7
                                    ? "text-red-600 font-bold"
                                    : giorniB <= 14
                                    ? "text-orange-600 font-semibold"
                                    : "text-green-600"
                                }
                              >
                                {giorniB} giorni
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{getUrgenzaBadge(giorniB)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}