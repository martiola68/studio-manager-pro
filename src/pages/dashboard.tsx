// src/pages/dashboard.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { clienteService } from "@/services/clienteService";
import { eventoService } from "@/services/eventoService";
import { scadenzaService } from "@/services/scadenzaService";
import {
  scadenzaAlertService,
  type ScadenzaAlert,
} from "@/services/scadenzaAlertService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  MessageSquare,
  Mail,
  BookOpen,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertScadenze } from "@/components/AlertScadenze";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type EventoAgenda = Database["public"]["Tables"]["tbagenda"]["Row"];

export default function DashboardPage() {
  const { toast } = useToast();

  // ✅ SINGLE SOURCE OF TRUTH for auth
  const { ready, session } = useRequireAuth();

  const [loading, setLoading] = useState(true);
  const [scadenzeAlert, setScadenzeAlert] = useState<ScadenzaAlert[]>([]);
  const [stats, setStats] = useState({
    clientiAttivi: 0,
    appuntamentiProssimi: 0,
    scadenzeIvaConfermate: 0,
    scadenzeFiscaliConfermate: 0,
    scadenzeCCGGConfermate: 0,
    scadenze770Confermate: 0,
    scadenzeCUConfermate: 0,
    scadenzeBilanciConfermate: 0,
  });
  const [prossimiAppuntamenti, setProssimiAppuntamenti] = useState<
    EventoAgenda[]
  >([]);
  const [messaggiNonLetti, setMessaggiNonLetti] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPartner, setIsPartner] = useState(false);

  /**
   * ✅ Load profile + alerts + dashboard data ONLY when:
   * - auth check is ready
   * - session exists
   */
  useEffect(() => {
    if (!ready) return;
    if (!session?.user?.email) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const { data: userData, error: userError } = await supabase
          .from("tbutenti")
          .select("id, tipo_utente, studio_id")
          .eq("email", session.user.email)
          .single();

        if (userError || !userData) {
          console.error("Errore recupero utente:", userError);
          // ⚠️ NO redirect here (avoid ping-pong). useRequireAuth already handles missing session.
          return;
        }

        if (cancelled) return;

        const isPartnerUser = userData.tipo_utente === "Admin";
        setCurrentUserId(userData.id);
        setIsPartner(isPartnerUser);

        // Alerts
        if (userData.studio_id) {
          const alerts = await scadenzaAlertService.getScadenzeInArrivo(
            userData.id,
            isPartnerUser,
            userData.studio_id
          );
          if (!cancelled) setScadenzeAlert(alerts);
        }

        // Dashboard data
        await loadDashboardData(userData.id);

        // Unread messages
        try {
          const { messaggioService } = await import("@/services/messaggioService");
          const nonLetti = await messaggioService.getMessaggiNonLettiCount(
            userData.id
          );
          if (!cancelled) setMessaggiNonLetti(nonLetti);
        } catch (e) {
          console.warn("Messaggi service non disponibile:", e);
        }
      } catch (error) {
        console.error("Errore nel caricamento dashboard:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session?.user?.email]);

  /**
   * ✅ Poll messaggi non letti (solo quando abbiamo userId)
   */
  useEffect(() => {
    if (!currentUserId) return;

    const interval = setInterval(async () => {
      try {
        const { messaggioService } = await import("@/services/messaggioService");
        const nonLetti = await messaggioService.getMessaggiNonLettiCount(
          currentUserId
        );
        setMessaggiNonLetti(nonLetti);
      } catch (e) {
        // non bloccare UI se manca
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUserId]);

  /**
   * ✅ Load dashboard stats, clienti, eventi, scadenze
   * (NOT doing auth redirects here)
   */
  const loadDashboardData = async (userIdForMessages?: string) => {
    try {
      const clienti = await clienteService.getClienti();
      const appuntamenti = await eventoService.getEventi();

      const clientiAttivi = clienti.filter((c: any) => c.attivo).length;

      const oggi = new Date();
      const setteDopo = new Date();
      setteDopo.setDate(oggi.getDate() + 7);

      const prossimi = appuntamenti
        .filter((app: any) => {
          const dataApp = new Date(app.data_inizio);
          return dataApp >= oggi && dataApp <= setteDopo;
        })
        .sort(
          (a: any, b: any) =>
            new Date(a.data_inizio).getTime() - new Date(b.data_inizio).getTime()
        );

      setProssimiAppuntamenti(prossimi.slice(0, 5));

      const counts = await scadenzaService.getAllScadenzeCounts();

      // (optional) refresh unread count once here as well
      if (userIdForMessages) {
        try {
          const { messaggioService } = await import("@/services/messaggioService");
          const nonLetti = await messaggioService.getMessaggiNonLettiCount(
            userIdForMessages
          );
          setMessaggiNonLetti(nonLetti);
        } catch {}
      }

      setStats({
        clientiAttivi,
        appuntamentiProssimi: prossimi.length,
        scadenzeIvaConfermate: counts.iva,
        scadenzeFiscaliConfermate: counts.fiscali,
        scadenzeCCGGConfermate: counts.ccgg,
        scadenze770Confermate: counts.sette70,
        scadenzeCUConfermate: counts.cu,
        scadenzeBilanciConfermate: counts.bilanci,
      });
    } catch (error) {
      console.error("Errore nel caricamento dei dati dashboard:", error);
    }
  };

  const handleDismissAlert = (id: string) => {
    scadenzaAlertService.dismissAlert(id);
    setScadenzeAlert((prev) => prev.filter((s) => s.id !== id));
    toast({
      title: "Notifica rimossa",
      description: "La scadenza non verrà più mostrata tra gli alert.",
    });
  };

  const handleNotifyTeams = async (scadenza: ScadenzaAlert) => {
    if (!currentUserId) return;

    const scadenzaServiceType = {
      ...scadenza,
      tabella_origine: scadenza.tabella_origine || "",
    } as import("@/services/scadenzaAlertService").ScadenzaAlert;

    toast({
      title: "Invio in corso...",
      description: "Sto inviando la notifica.",
    });

    const success = await scadenzaAlertService.sendTeamsAlert(
      scadenzaServiceType,
      currentUserId
    );

    if (success) {
      toast({ title: "Inviato!", description: "Notifica inviata con successo." });
    } else {
      toast({
        title: "Errore",
        description:
          "Impossibile inviare notifica (integrazione non configurata o disabilitata).",
        variant: "destructive",
      });
    }
  };

  // ✅ Auth still checking
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  // ✅ Data loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento dashboard...</p>
        </div>
      </div>
    );
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Panoramica generale dello studio</p>
      </div>

      {scadenzeAlert.length > 0 && (
        <div className="mb-8">
          <AlertScadenze
            scadenze={scadenzeAlert}
            isPartner={isPartner}
            onDismiss={handleDismissAlert}
            onViewDetails={(_id, tipo) => {
  const target =
    tipo === "IVA"
      ? "/scadenze/iva"
      : tipo === "Fiscale"
      ? "/scadenze/fiscale"
      : tipo === "Bilancio"
      ? "/scadenze/bilanci"
      : "/scadenze/calendario";

  window.location.assign(target);
}}
            onNotifyTeams={handleNotifyTeams}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Clienti Attivi
            </CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.clientiAttivi}
            </div>
            <Link href="/clienti">
              <Button
                variant="link"
                className="p-0 h-auto text-sm text-blue-600 mt-2"
              >
                Gestisci clienti →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Appuntamenti Prossimi
            </CardTitle>
            <Calendar className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.appuntamentiProssimi}
            </div>
            <p className="text-xs text-gray-500 mt-2">Prossimi 7 giorni</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Scadenze IVA
            </CardTitle>
            <FileText className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.scadenzeIvaConfermate}
            </div>
            <p className="text-xs text-gray-500 mt-2">Confermate</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Scadenze Fiscali
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.scadenzeFiscaliConfermate}
            </div>
            <p className="text-xs text-gray-500 mt-2">Confermate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Stato Scadenze</CardTitle>
            <CardDescription>Scadenze confermate per tipologia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">CCGG</span>
                </div>
                <span className="text-sm font-bold">
                  {stats.scadenzeCCGGConfermate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">CU</span>
                </div>
                <span className="text-sm font-bold">
                  {stats.scadenzeCUConfermate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Bilanci</span>
                </div>
                <span className="text-sm font-bold">
                  {stats.scadenzeBilanciConfermate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">770</span>
                </div>
                <span className="text-sm font-bold">
                  {stats.scadenze770Confermate}
                </span>
              </div>
            </div>
            <Link href="/scadenze/iva">
              <Button variant="outline" className="w-full mt-6">
                Visualizza tutte le scadenze
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prossimi Appuntamenti</CardTitle>
            <CardDescription>Agenda dei prossimi 7 giorni</CardDescription>
          </CardHeader>
          <CardContent>
            {prossimiAppuntamenti.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Nessun appuntamento programmato</p>
              </div>
            ) : (
              <div className="space-y-3">
                {prossimiAppuntamenti.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${
                        app.in_sede ? "bg-green-500" : "bg-red-500"
                      }`}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {app.titolo}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(app.data_inizio)}
                      </p>
                      {app.sala && (
                        <p className="text-xs text-gray-400 mt-1">
                          Sala: {app.sala}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link href="/agenda">
              <Button variant="outline" className="w-full mt-4">
                Apri agenda completa
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accessi Rapidi</CardTitle>
          <CardDescription>Funzioni principali del gestionale</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/messaggi">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col gap-2"
              >
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <span className="text-sm font-medium">
                  Messaggi {messaggiNonLetti > 0 ? `(${messaggiNonLetti})` : ""}
                </span>
              </Button>
            </Link>
            <Link href="/agenda">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col gap-2"
              >
                <Calendar className="h-8 w-8 text-green-600" />
                <span className="text-sm font-medium">Agenda</span>
              </Button>
            </Link>
            <Link href="/contatti">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col gap-2"
              >
                <Users className="h-8 w-8 text-purple-600" />
                <span className="text-sm font-medium">Contatti</span>
              </Button>
            </Link>
            <Link href="/comunicazioni">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col gap-2"
              >
                <Mail className="h-8 w-8 text-orange-600" />
                <span className="text-sm font-medium">Comunicazioni</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-blue-900">📚 Manuale Utente Completo</CardTitle>
              <CardDescription className="text-blue-700">
                Guida completa all'utilizzo di Studio Manager Pro
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 mb-4">
            Scopri tutte le funzionalità del sistema: Agenda, Messaggi, Promemoria,
            Rubrica, Clienti, Accesso Portali, Cassetti Fiscali e Scadenzari.
          </p>
          <a
            href="/guide/MANUALE_UTENTE_COMPLETO.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <BookOpen className="h-5 w-5 mr-2" />
              Apri Manuale Completo
            </Button>
          </a>
        </CardContent>
      </Card>

      <Card className="mt-8 border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 rounded-lg">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-amber-900">
                🔐 Guida Master Password - Gestione Sicura Dati
              </CardTitle>
              <CardDescription className="text-amber-700">
                Impara a configurare e utilizzare la Master Password
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 mb-4">
            Guida completa per configurare, utilizzare e gestire la Master Password
            in modo sicuro e autonomo.
          </p>
          <a
            href="/guide/GUIDA_MASTER_PASSWORD_TEAM.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
              <Lock className="h-5 w-5 mr-2" />
              Apri Guida Master Password
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
