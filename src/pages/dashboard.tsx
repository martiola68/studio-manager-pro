import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getCurrentUser, getClienti, getEventi, getScadenzeByTipo } from "@/lib/db";
import { SCADENZE_KEYS, EventoAgenda } from "@/types";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileText, CheckCircle, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    clientiAttivi: 0,
    appuntamentiProssimi: 0,
    scadenzeIvaConfermate: 0,
    scadenzeFiscaliConfermate: 0,
    scadenzeCCGGConfermate: 0,
    scadenze770Confermate: 0,
    scadenzeCUConfermate: 0,
    scadenzeBilanciConfermate: 0
  });
  const [prossimiAppuntamenti, setProssimiAppuntamenti] = useState<EventoAgenda[]>([]);

  useEffect(() => {
    // Client-side only check
    if (typeof window === "undefined") return;

    const user = getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      // Carica statistiche
      const clienti = getClienti();
      const appuntamenti = getEventi();
      
      const clientiAttivi = clienti.filter(c => c.Attivo).length;
      
      // Appuntamenti prossimi 7 giorni
      const oggi = new Date();
      const setteDopo = new Date();
      setteDopo.setDate(oggi.getDate() + 7);
      
      const prossimi = appuntamenti.filter(app => {
        const dataApp = new Date(app.DataInizio);
        return dataApp >= oggi && dataApp <= setteDopo;
      }).sort((a, b) => new Date(a.DataInizio).getTime() - new Date(b.DataInizio).getTime());

      setProssimiAppuntamenti(prossimi.slice(0, 5));

      // Conta scadenze confermate
      const scadIva = getScadenzeByTipo(SCADENZE_KEYS.IVA);
      const scadFiscali = getScadenzeByTipo(SCADENZE_KEYS.FISCALI);
      const scadCCGG = getScadenzeByTipo(SCADENZE_KEYS.CCGG);
      const scad770 = getScadenzeByTipo(SCADENZE_KEYS["770"]);
      const scadCU = getScadenzeByTipo(SCADENZE_KEYS.CU);
      const scadBilanci = getScadenzeByTipo(SCADENZE_KEYS.BILANCI);

      setStats({
        clientiAttivi,
        appuntamentiProssimi: prossimi.length,
        scadenzeIvaConfermate: scadIva.filter(s => s.ConfermaRiga).length,
        scadenzeFiscaliConfermate: scadFiscali.filter(s => s.ConfermaRiga).length,
        scadenzeCCGGConfermate: scadCCGG.filter(s => s.ConfermaRiga).length,
        scadenze770Confermate: scad770.filter(s => s.ConfermaRiga).length,
        scadenzeCUConfermate: scadCU.filter(s => s.ConfermaRiga).length,
        scadenzeBilanciConfermate: scadBilanci.filter(s => s.ConfermaRiga).length
      });
    } catch (error) {
      console.error("Errore nel caricamento della dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
        minute: "2-digit"
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-500 mt-1">Panoramica generale dello studio</p>
            </div>

            {/* Statistiche principali */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="border-l-4 border-l-blue-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Clienti Attivi</CardTitle>
                  <Users className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.clientiAttivi}</div>
                  <Link href="/clienti">
                    <Button variant="link" className="p-0 h-auto text-sm text-blue-600 mt-2">
                      Gestisci clienti →
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Appuntamenti Prossimi</CardTitle>
                  <Calendar className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.appuntamentiProssimi}</div>
                  <p className="text-xs text-gray-500 mt-2">Prossimi 7 giorni</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Scadenze IVA</CardTitle>
                  <FileText className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.scadenzeIvaConfermate}</div>
                  <p className="text-xs text-gray-500 mt-2">Confermate</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Scadenze Fiscali</CardTitle>
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.scadenzeFiscaliConfermate}</div>
                  <p className="text-xs text-gray-500 mt-2">Confermate</p>
                </CardContent>
              </Card>
            </div>

            {/* Riepilogo Scadenze */}
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
                      <span className="text-sm font-bold">{stats.scadenzeCCGGConfermate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium">CU</span>
                      </div>
                      <span className="text-sm font-bold">{stats.scadenzeCUConfermate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium">Bilanci</span>
                      </div>
                      <span className="text-sm font-bold">{stats.scadenzeBilanciConfermate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium">770</span>
                      </div>
                      <span className="text-sm font-bold">{stats.scadenze770Confermate}</span>
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
                        <div key={app.ID_Evento} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className={`w-2 h-2 rounded-full mt-2 ${app.InSede ? "bg-green-500" : "bg-red-500"}`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{app.Titolo}</p>
                            <p className="text-xs text-gray-500">{formatDateTime(app.DataInizio)}</p>
                            {app.Sala && <p className="text-xs text-gray-400 mt-1">Sala: {app.Sala}</p>}
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

            {/* Accessi rapidi */}
            <Card>
              <CardHeader>
                <CardTitle>Accessi Rapidi</CardTitle>
                <CardDescription>Funzioni principali del gestionale</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link href="/clienti">
                    <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                      <Users className="h-8 w-8 text-blue-600" />
                      <span className="text-sm font-medium">Clienti</span>
                    </Button>
                  </Link>
                  <Link href="/contatti">
                    <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                      <Users className="h-8 w-8 text-green-600" />
                      <span className="text-sm font-medium">Contatti</span>
                    </Button>
                  </Link>
                  <Link href="/agenda">
                    <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                      <Calendar className="h-8 w-8 text-purple-600" />
                      <span className="text-sm font-medium">Agenda</span>
                    </Button>
                  </Link>
                  <Link href="/comunicazioni">
                    <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                      <FileText className="h-8 w-8 text-orange-600" />
                      <span className="text-sm font-medium">Comunicazioni</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}