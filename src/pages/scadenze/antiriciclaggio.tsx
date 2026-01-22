import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Mail, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["clienti"]["Row"];
type Utente = Database["public"]["Tables"]["utenti"]["Row"];

interface ClienteWithDetails extends Cliente {
  utente_operatore?: Utente | null;
  urgentDeadlines: Array<{
    tipo: string;
    giorni: number;
  }>;
}

export default function Antiriciclaggio() {
  const { toast } = useToast();
  const [clienti, setClienti] = useState<ClienteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchClientiConScadenzeUrgenti();
  }, []);

  async function fetchClientiConScadenzeUrgenti() {
    try {
      setLoading(true);

      const { data: clientiData, error: clientiError } = await supabase
        .from("clienti")
        .select(`
          *,
          utente_operatore:utenti!clienti_utente_operatore_id_fkey(*)
        `)
        .order("ragione_sociale");

      if (clientiError) throw clientiError;

      const oggi = new Date();
      const clientiConScadenzeUrgenti: ClienteWithDetails[] = [];

      for (const cliente of clientiData || []) {
        const urgentDeadlines: Array<{ tipo: string; giorni: number }> = [];

        // Scadenza A
        if (cliente.data_scadenza_a) {
          const dataScadenzaA = new Date(cliente.data_scadenza_a);
          const giorniRimanentiA = Math.ceil((dataScadenzaA.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
          if (giorniRimanentiA >= 0 && giorniRimanentiA < 15) {
            urgentDeadlines.push({ tipo: "A", giorni: giorniRimanentiA });
          }
        }

        // Scadenza B
        if (cliente.data_scadenza_b) {
          const dataScadenzaB = new Date(cliente.data_scadenza_b);
          const giorniRimanentiB = Math.ceil((dataScadenzaB.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
          if (giorniRimanentiB >= 0 && giorniRimanentiB < 15) {
            urgentDeadlines.push({ tipo: "B", giorni: giorniRimanentiB });
          }
        }

        if (urgentDeadlines.length > 0) {
          clientiConScadenzeUrgenti.push({
            ...cliente,
            urgentDeadlines,
          });
        }
      }

      setClienti(clientiConScadenzeUrgenti);
    } catch (error) {
      console.error("Errore caricamento clienti:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti con scadenze urgenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function sendUrgentEmailViaMailto() {
    try {
      setSending(true);

      // Raggruppa clienti per operatore
      const clientiPerOperatore = new Map<string, ClienteWithDetails[]>();

      for (const cliente of clienti) {
        const operatore = cliente.utente_operatore;
        if (!operatore || !operatore.email) continue;

        const key = operatore.email;
        if (!clientiPerOperatore.has(key)) {
          clientiPerOperatore.set(key, []);
        }
        clientiPerOperatore.get(key)!.push(cliente);
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

      // Crea mailto per ogni operatore
      let emailsSent = 0;
      const operatoriEmails: string[] = [];

      for (const [operatoreEmail, clientiOperatore] of clientiPerOperatore.entries()) {
        const operatore = clientiOperatore[0].utente_operatore!;
        operatoriEmails.push(operatoreEmail);

        const clientsList = clientiOperatore
          .map((c) => {
            const deadlines = c.urgentDeadlines
              .map((d) => `Scad. ${d.tipo}: ${d.giorni}gg`)
              .join(" • ");
            return `- ${c.ragione_sociale}: ${deadlines}`;
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

        // Apri mailto
        window.open(mailtoLink, "_blank");
        emailsSent++;
      }

      toast({
        title: "✓ Client email aperti",
        description: `${emailsSent} finestre email aperte per ${clienti.length} cliente/i urgenti. Destinatari: ${operatoriEmails.join(", ")}`,
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

  const clientiUrgentissimi = clienti.filter((c) =>
    c.urgentDeadlines.some((d) => d.giorni <= 7)
  );

  const clientiUrgenti = clienti.filter(
    (c) =>
      c.urgentDeadlines.some((d) => d.giorni > 7 && d.giorni < 15) &&
      !clientiUrgentissimi.includes(c)
  );

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Scadenze Antiriciclaggio
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitoraggio scadenze urgenti (&lt; 15 giorni)
            </p>
          </div>

          {clienti.length > 0 && (
            <Button
              onClick={sendUrgentEmailViaMailto}
              disabled={sending || loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Mail className="w-4 h-4 mr-2" />
              {sending ? "Apertura..." : `Invia Alert (${clienti.length})`}
            </Button>
          )}
        </div>

        {/* Cards statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Urgentissimi (≤7gg)
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {clientiUrgentissimi.length}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Clienti con scadenze immediate
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Urgenti (8-14gg)
              </CardTitle>
              <Calendar className="w-5 h-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {clientiUrgenti.length}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Clienti da monitorare
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Totale Urgenze
              </CardTitle>
              <Users className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {clienti.length}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Clienti con scadenze &lt; 15gg
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabella clienti urgenti */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Clienti con Scadenze Urgenti
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Caricamento...
              </div>
            ) : clienti.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ✓ Nessuna scadenza urgente rilevata
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Operatore Fiscale</TableHead>
                      <TableHead>Scadenza A</TableHead>
                      <TableHead>Scadenza B</TableHead>
                      <TableHead>Urgenza</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clienti.map((cliente) => {
                      const scadenzaA = cliente.urgentDeadlines.find(
                        (d) => d.tipo === "A"
                      );
                      const scadenzaB = cliente.urgentDeadlines.find(
                        (d) => d.tipo === "B"
                      );
                      const giorniMin = Math.min(
                        ...(cliente.urgentDeadlines.map((d) => d.giorni))
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
                            {scadenzaA ? (
                              <Badge
                                variant={
                                  scadenzaA.giorni <= 7
                                    ? "destructive"
                                    : "default"
                                }
                                className={
                                  scadenzaA.giorni <= 7
                                    ? "bg-red-600"
                                    : "bg-orange-600"
                                }
                              >
                                {scadenzaA.giorni} giorni
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {scadenzaB ? (
                              <Badge
                                variant={
                                  scadenzaB.giorni <= 7
                                    ? "destructive"
                                    : "default"
                                }
                                className={
                                  scadenzaB.giorni <= 7
                                    ? "bg-red-600"
                                    : "bg-orange-600"
                                }
                              >
                                {scadenzaB.giorni} giorni
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                giorniMin <= 7 ? "destructive" : "default"
                              }
                              className={
                                giorniMin <= 7
                                  ? "bg-red-600"
                                  : "bg-orange-600"
                              }
                            >
                              {giorniMin <= 7 ? "URGENTISSIMO" : "URGENTE"}
                            </Badge>
                          </TableCell>
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