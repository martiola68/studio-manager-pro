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
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  Building2,
  UserRoundPlus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertScadenze } from "@/components/AlertScadenze";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import PromemoriaImminentiCard from "@/components/dashboard/PromemoriaImminentiCard";
import { useRouter } from "next/router";

type EventoAgenda = Database["public"]["Tables"]["tbagenda"]["Row"];

export default function DashboardPage() {
  const { toast } = useToast();
const router = useRouter();
  
  // ✅ auth guard: redirects live ONLY inside useRequireAuth
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
  const [prossimiAppuntamenti, setProssimiAppuntamenti] = useState<EventoAgenda[]>(
    []
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPartner, setIsPartner] = useState(false);

    useEffect(() => {
  const checkAuth = async () => {
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      window.location.href = "/login"
    }
      }

  checkAuth()
}, [])
  

  /**
   * ✅ Load profile + alerts + dashboard data ONLY when:
   * - auth check is ready
   * - session exists
   */
 useEffect(() => {
  if (!ready) return;

  const email = session?.user?.email;
  if (!email) return;

  let cancelled = false;

  (async () => {
    try {
      setLoading(true);

      const { data: userData, error: userError } = await supabase
        .from("tbutenti")
        .select("id, tipo_utente, studio_id")
        .eq("email", email)
        .single();

        if (userError || !userData) {
          console.error("Errore recupero utente:", userError);
          // ✅ NO redirect here: useRequireAuth handles auth redirects.
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

      } catch (error) {
        console.error("Errore nel caricamento dashboard:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, session?.user?.email]);

  /**
   * ✅ Load dashboard stats, clienti, eventi, scadenze
   * (NOT doing auth redirects here)
   */
 const loadDashboardData = async (userIdForMessages: string) => {
  try {
    const clienti = await clienteService.getClienti();

    const { data: appuntamentiData, error: appuntamentiError } = await supabase
      .from("tbagenda")
      .select("*")
      .eq("utente_id", userIdForMessages)
      .order("data_inizio", { ascending: true });

    if (appuntamentiError) throw appuntamentiError;

    const appuntamenti = appuntamentiData || [];

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

  const prossimeScadenze = [...scadenzeAlert]
    .sort(
      (a, b) =>
        new Date(a.data_scadenza).getTime() -
        new Date(b.data_scadenza).getTime()
    )
    .slice(0, 5);

  return (
    <div className="-mx-4 min-h-full bg-[#f3f5f7] px-4 py-8 md:-mx-6 md:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-[#071b36]">Dashboard</h1>
        <p className="mt-1 text-[#315f78]">Panoramica generale dello studio</p>
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

              // ⚠️ Not auth redirect. Only navigation from user action.
              window.location.assign(target);
            }}
            onNotifyTeams={handleNotifyTeams}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border border-[#8cddff] border-l-4 border-l-[#0d6f9f] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Clienti Attivi
            </CardTitle>
            <Users className="h-5 w-5 text-[#0d6f9f]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.clientiAttivi}</div>
            <Link href="/clienti">
              <Button variant="link" className="p-0 h-auto text-sm text-[#0d6f9f] hover:text-[#063f66] mt-2">
                Gestisci clienti →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border border-[#8cddff] border-l-4 border-l-[#38bdf8] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Appuntamenti Prossimi
            </CardTitle>
            <Calendar className="h-5 w-5 text-[#0d6f9f]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.appuntamentiProssimi}
            </div>
            <p className="text-xs text-gray-500 mt-2">Prossimi 7 giorni</p>
          </CardContent>
        </Card>

        <Card className="border border-[#8cddff] border-l-4 border-l-[#0b4f7d] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Scadenze IVA
            </CardTitle>
            <FileText className="h-5 w-5 text-[#0d6f9f]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.scadenzeIvaConfermate}
            </div>
            <p className="text-xs text-gray-500 mt-2">Confermate</p>
          </CardContent>
        </Card>

        <Card className="border border-[#8cddff] border-l-4 border-l-[#62cfff] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Scadenze Fiscali
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-[#0d6f9f]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.scadenzeFiscaliConfermate}
            </div>
            <p className="text-xs text-gray-500 mt-2">Confermate</p>
          </CardContent>
        </Card>
      </div>

    <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <Card className="border border-[#8cddff] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#0d6f9f]" />
            Rubrica dello studio
          </CardTitle>
          <CardDescription>Anagrafiche e relazioni sempre a portata di mano</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {[
            { label: "Clienti", href: "/clienti", icon: Users },
            { label: "Nuovo cliente", href: "/clienti/nuovo", icon: UserRoundPlus },
            { label: "Organi sociali", href: "/clienti/organi-sociali", icon: Building2 },
            { label: "Gruppi societari", href: "/anagrafiche/gruppi-societari", icon: BriefcaseBusiness },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className="group rounded-xl border border-[#c7eafb] bg-[#f5fbfe] p-4 transition hover:-translate-y-0.5 hover:border-[#38bdf8] hover:shadow-md">
                <Icon className="mb-3 h-5 w-5 text-[#0d6f9f]" />
                <span className="text-sm font-semibold text-[#071b36] group-hover:text-[#0d6f9f]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border border-[#8cddff] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)]">
        <CardHeader className="pb-3">
          <CardTitle>Scadenze per tipologia</CardTitle>
          <CardDescription>Riepilogo delle confermate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["CCGG", stats.scadenzeCCGGConfermate],
              ["CU", stats.scadenzeCUConfermate],
              ["Bilanci", stats.scadenzeBilanciConfermate],
              ["770", stats.scadenze770Confermate],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-[#c7eafb] bg-[#f5fbfe] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#3f7189]">{label}</p>
                <p className="mt-1 text-2xl font-bold text-[#071b36]">{value}</p>
              </div>
            ))}
          </div>
          <Link href="/scadenze">
            <Button variant="outline" className="mt-4 w-full border-[#8cddff] text-[#0b4f7d] hover:bg-[#e8f7ff]">
              Apri lo scadenzario
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="border border-[#8cddff] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5 text-[#0d6f9f]" />
            Centro operativo
          </CardTitle>
          <CardDescription>Entra subito nelle aree di lavoro più utilizzate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: "Agenda e attività", href: "/agenda", note: "Appuntamenti e pianificazione" },
            { label: "Promemoria", href: "/promemoria", note: "Memo personali e condivisi" },
            { label: "Pratiche professionali", href: "/pratiche", note: "Processi, documenti e avanzamento" },
            { label: "Controllo di gestione", href: "/controllo-gestione", note: "Dati, analisi e controllo" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2.5 transition hover:border-[#bfeeff] hover:bg-[#eef9ff]">
              <div>
                <p className="text-sm font-semibold text-[#071b36]">{item.label}</p>
                <p className="text-xs text-gray-500">{item.note}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#0d6f9f]" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>

    <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
      <Card className="border border-[#8cddff] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)] xl:col-span-5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-[#0d6f9f]" />
                Prossime scadenze operative
              </CardTitle>
              <CardDescription>Le attività che richiedono attenzione per prime</CardDescription>
            </div>
            <Link href="/scadenze">
              <Button variant="ghost" size="sm" className="text-[#0b4f7d]">
                Vedi tutte <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {prossimeScadenze.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#8cddff] bg-[#eef9ff] px-4 py-8 text-center">
              <CheckCircle className="mx-auto mb-2 h-9 w-9 text-emerald-500" />
              <p className="font-medium text-[#071b36]">Nessuna scadenza urgente</p>
              <p className="mt-1 text-sm text-gray-500">Il quadro operativo è sotto controllo.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#d8edf7]">
              {prossimeScadenze.map((scadenza) => (
                <div key={scadenza.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      scadenza.urgenza === "critica"
                        ? "bg-red-500"
                        : scadenza.urgenza === "urgente"
                        ? "bg-amber-500"
                        : "bg-sky-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#071b36]">
                      {scadenza.descrizione}
                    </p>
                    <p className="text-xs text-gray-500">
                      {scadenza.tipo}
                      {scadenza.cliente_nome ? ` · ${scadenza.cliente_nome}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-lg bg-[#e8f7ff] px-2.5 py-1 text-xs font-semibold text-[#0b4f7d]">
                    {new Date(scadenza.data_scadenza).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-[#8cddff] bg-white shadow-[0_12px_30px_rgba(14,78,112,0.12)] xl:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#0d6f9f]" />
            Prossimi appuntamenti
          </CardTitle>
          <CardDescription>Agenda dei prossimi 7 giorni</CardDescription>
        </CardHeader>
        <CardContent>
          {prossimiAppuntamenti.length === 0 ? (
            <div className="rounded-xl bg-[#eef9ff] px-4 py-6 text-center">
              <Clock className="mx-auto mb-2 h-9 w-9 text-[#8db8cc]" />
              <p className="text-sm text-gray-600">Nessun appuntamento programmato</p>
            </div>
          ) : (
            <div className="space-y-2">
              {prossimiAppuntamenti.slice(0, 4).map((app) => (
                <div key={app.id} className="rounded-xl border border-[#bfeeff] bg-[#eef9ff] p-3">
                  <p className="truncate text-sm font-semibold text-[#071b36]">{app.titolo}</p>
                  <p className="mt-1 text-xs text-gray-500">{formatDateTime(app.data_inizio)}</p>
                </div>
              ))}
            </div>
          )}
          <Link href="/agenda">
            <Button variant="outline" className="mt-4 w-full border-[#8cddff] text-[#0b4f7d] hover:bg-[#e8f7ff]">
              Apri agenda
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="xl:col-span-4">
        <PromemoriaImminentiCard
          userId={currentUserId}
          onOpenPromemoriaPage={() => router.push("/promemoria")}
        />
      </div>
    </div>

    </div>
  );
}
