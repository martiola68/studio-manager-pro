import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { microsoftGraphService } from "@/services/microsoftGraphService";
import { Calendar, Mail, Video, RefreshCw, CheckCircle, XCircle, LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Microsoft365Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [settings, setSettings] = useState({
    syncCalendar: true,
    autoCreateTeamsMeeting: true,
    sendEmailNotifications: true,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (router.query.success) {
      toast({
        title: "✅ Connessione riuscita!",
        description: "Account Microsoft 365 collegato con successo.",
      });
      router.replace("/impostazioni/microsoft365", undefined, { shallow: true });
      checkConnection();
    }

    if (router.query.error) {
      const errorMessages: { [key: string]: string } = {
        auth_failed: "Autenticazione fallita. Riprova.",
        no_code: "Codice di autorizzazione mancante.",
        config_missing: "Configurazione Microsoft 365 incompleta.",
        token_exchange_failed: "Impossibile ottenere i token di accesso.",
        save_failed: "Errore nel salvataggio delle credenziali.",
        unexpected: "Errore imprevisto durante la connessione.",
      };

      toast({
        variant: "destructive",
        title: "❌ Errore connessione",
        description: errorMessages[router.query.error as string] || "Errore sconosciuto.",
      });
      router.replace("/impostazioni/microsoft365", undefined, { shallow: true });
    }
  }, [router.query]);

  const checkAuth = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      await checkConnection();
    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    if (!userId) return;

    try {
      const connected = await microsoftGraphService.isConnected(userId);
      setIsConnected(connected);

      if (connected) {
        const profile = await microsoftGraphService.getUserProfile(userId);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error("Error checking connection:", error);
      setIsConnected(false);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/auth/microsoft/login";
  };

  const handleDisconnect = async () => {
    if (!userId) return;

    try {
      await microsoftGraphService.disconnectAccount(userId);
      setIsConnected(false);
      setUserProfile(null);
      setDisconnectDialogOpen(false);
      
      toast({
        title: "✅ Account disconnesso",
        description: "Account Microsoft 365 scollegato con successo.",
      });
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast({
        variant: "destructive",
        title: "❌ Errore",
        description: "Impossibile disconnettere l'account.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Integrazione Microsoft 365 | Studio Manager</title>
      </Head>

      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Integrazione Microsoft 365</h1>
          <p className="text-muted-foreground">
            Collega il tuo account Microsoft 365 per sincronizzare calendario, inviare email e creare meeting Teams.
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Stato Connessione
                    {isConnected ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connesso
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        Non connesso
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isConnected
                      ? "Account Microsoft 365 collegato e attivo"
                      : "Collega il tuo account Microsoft 365 per iniziare"}
                  </CardDescription>
                </div>
                {isConnected ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDisconnectDialogOpen(true)}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Disconnetti
                  </Button>
                ) : (
                  <Button onClick={handleConnect}>
                    Connetti Account
                  </Button>
                )}
              </div>
            </CardHeader>

            {isConnected && userProfile && (
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Email:</span>
                    <span className="text-muted-foreground">{userProfile.mail || userProfile.userPrincipalName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Nome:</span>
                    <span className="text-muted-foreground">{userProfile.displayName}</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Funzionalità Disponibili
              </CardTitle>
              <CardDescription>
                Gestisci le integrazioni attive con Microsoft 365
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Sincronizzazione Calendario</Label>
                  <p className="text-sm text-muted-foreground">
                    Sincronizza automaticamente gli appuntamenti con Outlook Calendar
                  </p>
                </div>
                <Switch
                  checked={settings.syncCalendar}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, syncCalendar: checked }))
                  }
                  disabled={!isConnected}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Meeting Teams Automatici
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Crea automaticamente link Teams per gli appuntamenti
                  </p>
                </div>
                <Switch
                  checked={settings.autoCreateTeamsMeeting}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, autoCreateTeamsMeeting: checked }))
                  }
                  disabled={!isConnected}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Notifiche Email Automatiche
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Invia email automatiche per scadenze e promemoria tramite Outlook
                  </p>
                </div>
                <Switch
                  checked={settings.sendEmailNotifications}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, sendEmailNotifications: checked }))
                  }
                  disabled={!isConnected}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informazioni Integrazione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">📅 Calendario Outlook</h4>
                  <p className="text-muted-foreground">
                    Gli appuntamenti creati in Studio Manager vengono automaticamente sincronizzati
                    con il tuo calendario Outlook. Qualsiasi modifica verrà riflessa in entrambi i sistemi.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">📧 Email Outlook</h4>
                  <p className="text-muted-foreground">
                    Le email di notifica, promemoria e comunicazioni ai clienti vengono inviate
                    direttamente tramite il tuo account Outlook, mantenendo la professionalità
                    e l'affidabilità del tuo dominio aziendale.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">🎥 Microsoft Teams</h4>
                  <p className="text-muted-foreground">
                    Quando crei un appuntamento con l'opzione meeting online, viene generato
                    automaticamente un link Microsoft Teams incluso nell'invito calendario.
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">🔒 Sicurezza e Privacy</h4>
                  <p className="text-muted-foreground">
                    Le credenziali Microsoft 365 sono archiviate in modo sicuro e criptato.
                    Studio Manager accede ai tuoi dati Microsoft solo per le funzionalità
                    specificamente autorizzate e mai condivide informazioni con terze parti.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnetti Account Microsoft 365</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler disconnettere il tuo account Microsoft 365?
              La sincronizzazione del calendario, l'invio di email tramite Outlook e la creazione
              di meeting Teams saranno disabilitati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnetti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}