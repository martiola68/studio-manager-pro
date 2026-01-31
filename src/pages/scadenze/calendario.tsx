import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar, AlertTriangle, Clock, CheckCircle2, FileText, Plus, Bell, ClipboardList } from "lucide-react";
import { authService } from "@/services/authService";
import { tipoScadenzaService } from "@/services/tipoScadenzaService";
import { studioService } from "@/services/studioService";
import { promemoriaService } from "@/services/promemoriaService";
import { utenteService } from "@/services/utenteService";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/hooks/use-toast";

type TipoScadenza = Database["public"]["Tables"]["tbtipi_scadenze"]["Row"];

interface ScadenzaConUrgenza extends TipoScadenza {
  urgenza: "scaduta" | "7giorni" | "30giorni" | "oltre30";
  giorniRimanenti: number;
}

const TIPI_SCADENZA_OPTIONS = [
  { value: "tutti", label: "Tutte le scadenze" },
  { value: "iva", label: "IVA" },
  { value: "fiscale", label: "Fiscali" },
  { value: "bilancio", label: "Bilanci" },
  { value: "770", label: "770" },
  { value: "lipe", label: "LIPE" },
  { value: "esterometro", label: "Esterometro" },
  { value: "ccgg", label: "CCGG" },
  { value: "cu", label: "CU" },
  { value: "proforma", label: "Proforma" },
  { value: "antiriciclaggio", label: "Antiriciclaggio" },
  { value: "lavoro", label: "Lavoro" },
];

export default function CalendarioScadenzePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaConUrgenza[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("tutti");
  const [studioId, setStudioId] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [alertsInviati, setAlertsInviati] = useState<Record<string, boolean>>({});

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Carico i dati dell'utente corrente per verificare se è Responsabile/Amministratore
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data: utente } = await supabase
          .from("tbutenti")
          .select("*")
          .eq("email", session.user.email)
          .single();
        if (utente) {
          setCurrentUser(utente);
        }
      }

      const studio = await studioService.getStudio();
      if (!studio) {
        toast({
          title: "Attenzione",
          description: "Nessuno studio configurato. Contatta l'amministratore.",
          variant: "destructive",
        });
        return;
      }

      setStudioId(studio.id);
      await loadScadenze(studio.id);
      await loadAlertsInviati();
    } catch (error) {
      console.error("Errore autenticazione:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (studioId: string) => {
    try {
      const data = await tipoScadenzaService.getAll(studioId);
      
      // Calcola urgenza e giorni rimanenti per ogni scadenza
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);

      const scadenzeConUrgenza: ScadenzaConUrgenza[] = data
        .filter((s) => s.attivo !== false)
        .map((scadenza) => {
          const dataScadenza = new Date(scadenza.data_scadenza);
          dataScadenza.setHours(0, 0, 0, 0);
          
          const diffTime = dataScadenza.getTime() - oggi.getTime();
          const giorniRimanenti = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let urgenza: "scaduta" | "7giorni" | "30giorni" | "oltre30";
          if (giorniRimanenti < 0) {
            urgenza = "scaduta";
          } else if (giorniRimanenti <= 7) {
            urgenza = "7giorni";
          } else if (giorniRimanenti <= 30) {
            urgenza = "30giorni";
          } else {
            urgenza = "oltre30";
          }

          return {
            ...scadenza,
            urgenza,
            giorniRimanenti,
          };
        })
        .sort((a, b) => a.giorniRimanenti - b.giorniRimanenti);

      setScadenze(scadenzeConUrgenza);
    } catch (error) {
      console.error("Errore caricamento scadenze:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le scadenze",
        variant: "destructive",
      });
    }
  };

  const loadAlertsInviati = async () => {
    try {
      const annoCorrente = new Date().getFullYear();
      const { data, error } = await supabase
        .from("tbtipi_scadenze_alert")
        .select("tipo_scadenza_id, anno_invio")
        .eq("anno_invio", annoCorrente);

      if (error) throw error;

      const alerts: Record<string, boolean> = {};
      data?.forEach((alert) => {
        alerts[alert.tipo_scadenza_id] = true;
      });
      setAlertsInviati(alerts);
    } catch (error) {
      console.error("Errore caricamento alerts:", error);
    }
  };

  const handleInviaAlert = async (tipoScadenza: ScadenzaConUrgenza) => {
    try {
      if (!currentUser) {
        toast({
          title: "Errore",
          description: "Utente non trovato",
          variant: "destructive",
        });
        return;
      }

      if (!currentUser.responsabile && currentUser.tipo_utente !== "amministratore") {
        toast({
          title: "Accesso negato",
          description: "Solo Responsabili e Amministratori possono inviare alert",
          variant: "destructive",
        });
        return;
      }

      // Determina i settori attivi
      const settori: string[] = [];
      if (tipoScadenza.settore_fiscale) settori.push("Fiscale");
      if (tipoScadenza.settore_lavoro) settori.push("Lavoro");
      if (tipoScadenza.settore_consulenza) settori.push("Consulenza");

      console.log("🔍 DEBUG - Settori selezionati nella scadenza:", {
        settore_fiscale: tipoScadenza.settore_fiscale,
        settore_lavoro: tipoScadenza.settore_lavoro,
        settore_consulenza: tipoScadenza.settore_consulenza,
        settori_array: settori,
      });

      if (settori.length === 0) {
        toast({
          title: "Nessun settore",
          description: "Questa scadenza non ha settori assegnati. Vai in Impostazioni > Tipi Scadenze e spunta almeno una checkbox (Fiscale, Lavoro o Consulenza).",
          variant: "destructive",
        });
        return;
      }

      const settoreDisplay = settori.join(" & ");

      console.log("🔔 Invio alert per scadenza:", {
        nome: tipoScadenza.nome,
        settori: settori,
        responsabile: `${currentUser.nome} ${currentUser.cognome}`,
      });

      // Query con log dettagliati
      console.log("🔍 DEBUG - Query Supabase:", {
        table: "tbutenti",
        filter: `settore IN [${settori.join(", ")}]`,
        where: "attivo = true",
      });

      const { data: utenti, error: utentiError } = await supabase
        .from("tbutenti")
        .select("id, email, nome, cognome, settore")
        .eq("attivo", true)
        .in("settore", settori);

      console.log("🔍 DEBUG - Risultato query:", {
        error: utentiError,
        utenti_trovati: utenti?.length || 0,
        utenti: utenti,
      });

      if (utentiError) {
        console.error("❌ Errore query utenti:", utentiError);
        throw utentiError;
      }

      if (!utenti || utenti.length === 0) {
        console.warn("⚠️ Nessun utente trovato per i settori:", settori);
        toast({
          title: "Nessun utente trovato",
          description: `Nessun utente attivo trovato per i settori: ${settoreDisplay}. Verifica in Impostazioni > Utenti che ci siano utenti con questi settori.`,
          variant: "destructive",
        });
        return;
      }

      console.log(`✅ Trovati ${utenti.length} utenti:`, utenti.map(u => `${u.nome} ${u.cognome} (${u.settore})`));
      console.log(`📧 Invio alert a ${utenti.length} utenti dei settori: ${settoreDisplay}`);

      const { data: result, error: functionError } = await supabase.functions.invoke(
        "send-scadenza-alert",
        {
          body: {
            tipoScadenzaId: tipoScadenza.id,
            settori: settori,
            responsabileEmail: currentUser.email,
            responsabileNome: `${currentUser.nome} ${currentUser.cognome}`,
            scadenzaNome: tipoScadenza.nome,
            scadenzaData: tipoScadenza.data_scadenza,
            scadenzaDescrizione: tipoScadenza.descrizione,
            giorniRimanenti: tipoScadenza.giorniRimanenti,
          },
        }
      );

      console.log("📬 Risposta Edge Function RAW:", { result, error: functionError });
      console.log("📊 Dettagli result:", JSON.stringify(result, null, 2));
      
      if (result) {
        console.log("✅ Result.success:", result.success);
        console.log("📧 Email inviate (sent):", result.sent);
        console.log("❌ Email fallite (failed):", result.failed);
        console.log("📊 Totale (total):", result.total);
        console.log("💬 Messaggio:", result.message);
        console.log("🔍 Dettagli errori:", result.details);
      }

      if (functionError) {
        console.error("❌ Errore Edge Function:", functionError);
        throw functionError;
      }

      if (!result) {
        throw new Error("Nessuna risposta dalla Edge Function");
      }

      if (!result.success) {
        throw new Error(result.message || result.error || "Errore sconosciuto nell'invio");
      }

      const annoCorrente = new Date().getFullYear();
      await supabase.from("tbtipi_scadenze_alert").insert({
        tipo_scadenza_id: tipoScadenza.id,
        anno_invio: annoCorrente,
        data_invio: new Date().toISOString(),
      });

      toast({
        title: "✅ Alert inviato con successo!",
        description: `${result.sent || 0} email inviate agli utenti dei settori: ${settoreDisplay}`,
      });

      await loadAlertsInviati();
    } catch (error) {
      console.error("❌ Errore completo invio alert:", error);
      toast({
        title: "Errore invio alert",
        description: error instanceof Error ? error.message : "Impossibile inviare l'alert. Controlla i logs della console.",
        variant: "destructive",
      });
    }
  };

  const handleCreaPromemoria = async (tipoScadenza: ScadenzaConUrgenza) => {
    try {
      // Verifica che l'utente corrente sia Responsabile o Amministratore
      if (!currentUser) {
        toast({
          title: "Errore",
          description: "Utente non trovato",
          variant: "destructive",
        });
        return;
      }

      if (!currentUser.responsabile && currentUser.tipo_utente !== "amministratore") {
        toast({
          title: "Accesso negato",
          description: "Solo Responsabili e Amministratori possono creare promemoria per il team",
          variant: "destructive",
        });
        return;
      }

      // Determina i settori attivi
      const settori: string[] = [];
      if (tipoScadenza.settore_fiscale) settori.push("Fiscale");
      if (tipoScadenza.settore_lavoro) settori.push("Lavoro");
      if (tipoScadenza.settore_consulenza) settori.push("Consulenza");

      if (settori.length === 0) {
        toast({
          title: "Nessun settore",
          description: "Questa scadenza non ha settori assegnati",
          variant: "destructive",
        });
        return;
      }

      // Recupera utenti dei settori specificati
      const { data: utenti, error: utentiError } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome, email, settore")
        .eq("attivo", true)
        .in("settore", settori);

      if (utentiError) throw utentiError;

      if (!utenti || utenti.length === 0) {
        toast({
          title: "Nessun utente",
          description: `Nessun utente attivo trovato per i settori: ${settori.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      console.log(`Creazione promemoria per ${utenti.length} utenti dei settori ${settori.join(", ")}`);

      // Crea un promemoria per ogni utente del settore
      const dataInserimento = new Date().toISOString().split("T")[0];
      const dataScadenza = tipoScadenza.data_scadenza;
      const oggi = new Date();
      const scadenza = new Date(dataScadenza);
      const giorniScadenza = Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));

      let promemoriaCreati = 0;
      for (const utente of utenti) {
        try {
          await promemoriaService.createPromemoria({
            tipo_promemoria_id: "059347f7-f02f-4d93-89ec-b3af410e5766",
            titolo: tipoScadenza.nome,
            descrizione: tipoScadenza.descrizione || `Scadenza: ${tipoScadenza.nome}`,
            data_inserimento: new Date().toISOString().split("T")[0],
            data_scadenza: tipoScadenza.data_scadenza,
            giorni_scadenza: Math.ceil(
              (new Date(tipoScadenza.data_scadenza).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24)
            ),
            stato: "Aperto",
            priorita: "Alta",
            operatore_id: currentUser?.id || "",
            destinatario_id: utente.id,
            settore: utente.settore || "Lavoro",
          });
          promemoriaCreati++;
        } catch (err) {
          console.error(`Errore creazione promemoria per ${utente.nome} ${utente.cognome}:`, err);
        }
      }

      toast({
        title: "Promemoria creati",
        description: `${promemoriaCreati} promemoria creati con successo per i settori: ${settori.join(", ")}`,
      });

    } catch (error) {
      console.error("Errore creazione promemoria:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare i promemoria",
        variant: "destructive",
      });
    }
  };

  const scadenzeFiltrate = scadenze.filter((s) => {
    if (filtroTipo === "tutti") return true;
    return s.tipo_scadenza === filtroTipo;
  });

  const scadenzeScadute = scadenzeFiltrate.filter((s) => s.urgenza === "scaduta");
  const scadenze7Giorni = scadenzeFiltrate.filter((s) => s.urgenza === "7giorni");
  const scadenze30Giorni = scadenzeFiltrate.filter((s) => s.urgenza === "30giorni");
  const scadenzeOltre30 = scadenzeFiltrate.filter((s) => s.urgenza === "oltre30");

  const getTipoLabel = (tipo: string) => {
    return TIPI_SCADENZA_OPTIONS.find((t) => t.value === tipo)?.label || tipo;
  };

  const getUrgenzaBadgeColor = (urgenza: string) => {
    switch (urgenza) {
      case "scaduta":
        return "destructive";
      case "7giorni":
        return "default";
      case "30giorni":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatGiorniRimanenti = (giorni: number) => {
    if (giorni < 0) return `Scaduta da ${Math.abs(giorni)} giorni`;
    if (giorni === 0) return "Scade oggi";
    if (giorni === 1) return "Scade domani";
    return `Tra ${giorni} giorni`;
  };

  const ScadenzaCard = ({ scadenza }: { scadenza: ScadenzaConUrgenza }) => (
    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {scadenza.nome}
            </h3>
            <Badge variant="outline">{getTipoLabel(scadenza.tipo_scadenza)}</Badge>
          </div>
          
          {scadenza.descrizione && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {scadenza.descrizione}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300">
                {new Date(scadenza.data_scadenza).toLocaleDateString("it-IT")}
              </span>
            </div>
            
            {scadenza.ricorrente && (
              <Badge variant="secondary" className="text-xs">
                Ricorrente
              </Badge>
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Preavvisi: {scadenza.giorni_preavviso_1} e {scadenza.giorni_preavviso_2} giorni
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={getUrgenzaBadgeColor(scadenza.urgenza)}>
            {formatGiorniRimanenti(scadenza.giorniRimanenti)}
          </Badge>
          <Button
            variant="ghost"
            className="p-2"
            onClick={() => handleInviaAlert(scadenza)}
            title={alertsInviati[scadenza.id] ? "Alert già inviato quest'anno" : "Invia alert email"}
          >
            <Bell className={alertsInviati[scadenza.id] ? "w-8 h-8 text-green-600" : "w-8 h-8 text-red-600"} />
          </Button>
          <Button
            variant="ghost"
            className="p-2"
            onClick={() => handleCreaPromemoria(scadenza)}
            title={alertsInviati[scadenza.id] ? "Promemoria già creato quest'anno" : "Crea promemoria per tutti gli utenti del settore"}
          >
            <ClipboardList className={alertsInviati[scadenza.id] ? "w-8 h-8 text-green-600" : "w-8 h-8 text-blue-600"} />
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Calendario Scadenze - Studio Manager Pro</title>
      </Head>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Calendario Scadenze</h1>
            <p className="text-gray-500 mt-1">Gestione scadenze personalizzate e varie</p>
          </div>
          <Button onClick={() => router.push("/impostazioni/tipi-scadenze")} variant="outline">
            Gestisci Tipi Scadenze
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Totale Scadenze
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scadenzeFiltrate.length}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Scadute
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {scadenzeScadute.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Prossimi 7 giorni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {scadenze7Giorni.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Prossimi 30 giorni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {scadenze30Giorni.length}
            </div>
          </CardContent>
        </Card>

        <div className="mb-6">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtra per tipo" />
            </SelectTrigger>
            <SelectContent>
              {TIPI_SCADENZA_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scadenzeFiltrate.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nessuna scadenza trovata
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filtroTipo === "tutti"
                ? "Vai in Impostazioni > Tipi Scadenze per configurare le prime scadenze"
                : "Nessuna scadenza configurata per questo tipo"}
            </p>
            {filtroTipo === "tutti" && (
              <Button
                className="mt-4"
                onClick={() => router.push("/impostazioni/tipi-scadenze")}
              >
                Configura Scadenze
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Scadute */}
            {scadenzeScadute.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h2 className="text-xl font-bold text-red-600">
                    Scadute ({scadenzeScadute.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {scadenzeScadute.map((scadenza) => (
                    <ScadenzaCard key={scadenza.id} scadenza={scadenza} />
                  ))}
                </div>
              </div>
            )}

            {/* Prossimi 7 giorni */}
            {scadenze7Giorni.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <h2 className="text-xl font-bold text-orange-600">
                    Prossimi 7 giorni ({scadenze7Giorni.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {scadenze7Giorni.map((scadenza) => (
                    <ScadenzaCard key={scadenza.id} scadenza={scadenza} />
                  ))}
                </div>
              </div>
            )}

            {/* Prossimi 30 giorni */}
            {scadenze30Giorni.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-yellow-600" />
                  <h2 className="text-xl font-bold text-yellow-600">
                    Prossimi 30 giorni ({scadenze30Giorni.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {scadenze30Giorni.map((scadenza) => (
                    <ScadenzaCard key={scadenza.id} scadenza={scadenza} />
                  ))}
                </div>
              </div>
            )}

            {/* Oltre 30 giorni */}
            {scadenzeOltre30.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <h2 className="text-xl font-bold text-green-600">
                    Oltre 30 giorni ({scadenzeOltre30.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {scadenzeOltre30.map((scadenza) => (
                    <ScadenzaCard key={scadenza.id} scadenza={scadenza} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}