import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { authService } from "@/services/authService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Cloud, 
  Mail, 
  Calendar, 
  Users, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Shield,
  RefreshCw,
  Send
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Microsoft365ConfigDB {
  id: string;
  studio_id: string;
  client_id: string | null;
  tenant_id: string | null;
  client_secret: string | null;
  enabled: boolean | null;
  features: any;
  connected_email: string | null;
  last_sync: string | null;
  teams_default_team_id?: string | null;
  teams_default_team_name?: string | null;
  teams_default_channel_id?: string | null;
  teams_default_channel_name?: string | null;
  teams_scadenze_channel_id?: string | null;
  teams_scadenze_channel_name?: string | null;
  teams_alert_channel_id?: string | null;
  teams_alert_channel_name?: string | null;
}

interface Microsoft365Config {
  client_id: string;
  tenant_id: string;
  client_secret: string;
  enabled: boolean;
  features: {
    email: boolean;
    calendar: boolean;
    contacts: boolean;
    teams: boolean;
  };
  connected_email?: string;
  last_sync?: string;
  teams_config?: {
    default_team_id?: string;
    default_team_name?: string;
    default_channel_id?: string;
    default_channel_name?: string;
    scadenze_channel_id?: string;
    scadenze_channel_name?: string;
    alert_channel_id?: string;
    alert_channel_name?: string;
  }
}

interface Team {
  id: string;
  displayName: string;
  description?: string;
  channels: Channel[];
}

interface Channel {
  id: string;
  displayName: string;
  description?: string;
}

export default function Microsoft365Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  
  const [config, setConfig] = useState<Microsoft365Config>({
    client_id: "",
    tenant_id: "",
    client_secret: "",
    enabled: false,
    features: {
      email: false,
      calendar: false,
      contacts: false,
      teams: false
    }
  });

  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [studioId, setStudioId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userOAuthStatus, setUserOAuthStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");

  // Teams state
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [scadenzeChannelId, setScadenzeChannelId] = useState<string>("");
  const [alertChannelId, setAlertChannelId] = useState<string>("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authUser = await authService.getCurrentUser();
      if (!authUser?.id) {
        router.push("/login");
        return;
      }

      const profile = await authService.getUserProfile(authUser.id);
      const { data: utente } = await supabase
        .from("tbutenti")
        .select("tipo_utente, studio_id")
        .eq("email", authUser.email)
        .single();

      if (utente?.tipo_utente !== "Admin") {
        router.push("/dashboard");
        return;
      }

      if (!utente.studio_id) {
        toast({
          title: "Errore",
          description: "Studio non identificato",
          variant: "destructive"
        });
        return;
      }

      setStudioId(utente.studio_id);
      setCurrentUserId(authUser.id);
      
      await checkUserOAuthStatus(authUser.id);
      await loadConfiguration(utente.studio_id);
      setLoading(false);
    } catch (error) {
      console.error("Errore verifica autenticazione:", error);
      router.push("/login");
    }
  };

  const checkUserOAuthStatus = async (userId: string) => {
    try {
      const { microsoftGraphService } = await import("@/services/microsoftGraphService");
      const isConnected = await microsoftGraphService.isConnected(userId);
      
      console.log("🔍 Check OAuth status per user:", userId, "→", isConnected ? "CONNECTED" : "DISCONNECTED");
      
      if (isConnected) {
        setUserOAuthStatus("connected");
      } else {
        setUserOAuthStatus("disconnected");
      }
    } catch (error) {
      console.error("❌ Errore checkUserOAuthStatus:", error);
      setUserOAuthStatus("disconnected");
    }
  };

  const loadConfiguration = async (studioId: string) => {
    try {
      const { data, error } = await supabase
        .from("microsoft365_config" as any)
        .select("*")
        .eq("studio_id", studioId)
        .maybeSingle();

      if (data) {
        const configData = data as unknown as Microsoft365ConfigDB;
        
        setConfig({
          client_id: configData.client_id || "",
          tenant_id: configData.tenant_id || "",
          client_secret: configData.client_secret || "",
          enabled: configData.enabled || false,
          features: (configData.features as any) || {
            email: false,
            calendar: false,
            contacts: false,
            teams: false
          },
          connected_email: configData.connected_email || undefined,
          last_sync: configData.last_sync || undefined,
          teams_config: {
            default_team_id: configData.teams_default_team_id || undefined,
            default_team_name: configData.teams_default_team_name || undefined,
            default_channel_id: configData.teams_default_channel_id || undefined,
            default_channel_name: configData.teams_default_channel_name || undefined,
            scadenze_channel_id: configData.teams_scadenze_channel_id || undefined,
            scadenze_channel_name: configData.teams_scadenze_channel_name || undefined,
            alert_channel_id: configData.teams_alert_channel_id || undefined,
            alert_channel_name: configData.teams_alert_channel_name || undefined,
          }
        });

        // Imposta valori Teams salvati
        if (configData.teams_default_team_id) {
          setSelectedTeamId(configData.teams_default_team_id);
        }
        if (configData.teams_default_channel_id) {
          setSelectedChannelId(configData.teams_default_channel_id);
        }
        if (configData.teams_scadenze_channel_id) {
          setScadenzeChannelId(configData.teams_scadenze_channel_id);
        }
        if (configData.teams_alert_channel_id) {
          setAlertChannelId(configData.teams_alert_channel_id);
        }
        
        if (configData.client_id && configData.tenant_id && configData.client_secret) {
          setConnectionStatus("connected");
        } else {
          setConnectionStatus("disconnected");
        }
      }
    } catch (error) {
      console.error("Errore caricamento configurazione:", error);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!studioId) return;

    if (!config.client_id || !config.tenant_id || !config.client_secret) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Sessione non valida");
      }

      const response = await fetch("/api/microsoft365/save-config", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          studio_id: studioId,
          client_id: config.client_id,
          tenant_id: config.tenant_id,
          client_secret: config.client_secret,
          enabled: config.enabled,
          features: config.features
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Errore durante il salvataggio");
      }

      toast({
        title: "Successo",
        description: "Configurazione salvata correttamente"
      });

      await loadConfiguration(studioId);
    } catch (error: any) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio della configurazione",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.client_id || !config.tenant_id || !config.client_secret) {
      toast({
        title: "Errore",
        description: "Configura prima le credenziali Microsoft 365",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch("/api/microsoft365/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: config.client_id,
          tenant_id: config.tenant_id,
          client_secret: config.client_secret
        })
      });

      const data = await response.json();

      if (data.success) {
        setConnectionStatus("connected");
        toast({
          title: "Connessione riuscita",
          description: data.organization ? `Connesso a: ${data.organization}` : "Microsoft 365 configurato correttamente"
        });
      } else {
        setConnectionStatus("disconnected");
        toast({
          title: "Connessione fallita",
          description: data.details || data.error || "Verifica le credenziali",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Errore test connessione:", error);
      setConnectionStatus("disconnected");
      toast({
        title: "Errore",
        description: error.message || "Errore durante il test della connessione",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnectMicrosoft = () => {
    if (!currentUserId) {
      toast({
        title: "Errore",
        description: "Utente non identificato",
        variant: "destructive"
      });
      return;
    }

    try {
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        `/api/auth/microsoft/login?user_id=${currentUserId}`,
        "Microsoft OAuth",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        toast({
          title: "Popup bloccato",
          description: "Il browser ha bloccato il popup. Abilita i popup per questo sito.",
          variant: "destructive"
        });
        return;
      }

      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          checkUserOAuthStatus(currentUserId);
        }
      }, 1000);
    } catch (error: any) {
      console.error("Errore connessione Microsoft:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile avviare connessione Microsoft",
        variant: "destructive"
      });
    }
  };

  const handleDisconnectMicrosoft = async () => {
    if (!currentUserId) return;

    try {
      const { microsoftGraphService } = await import("@/services/microsoftGraphService");
      await microsoftGraphService.disconnectAccount(currentUserId);

      setUserOAuthStatus("disconnected");

      toast({
        title: "Successo",
        description: "Account Microsoft disconnesso"
      });
    } catch (error: any) {
      console.error("Errore disconnessione:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile disconnettere account",
        variant: "destructive"
      });
    }
  };

  const loadTeamsAndChannels = async () => {
    if (userOAuthStatus !== "connected") {
      toast({
        title: "Errore",
        description: "Connetti prima il tuo account Microsoft",
        variant: "destructive"
      });
      return;
    }

    setLoadingTeams(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Sessione non valida");
      }

      const response = await fetch("/api/microsoft365/teams-list", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "NOT_CONNECTED") {
          toast({
            title: "Account non connesso",
            description: "Connetti prima il tuo account Microsoft",
            variant: "destructive"
          });
        } else {
          throw new Error(data.error || "Errore recupero team");
        }
        return;
      }

      setTeams(data.teams || []);
      
      if (data.teams.length === 0) {
        toast({
          title: "Nessun team trovato",
          description: "Non sei membro di alcun team Microsoft Teams",
        });
      } else {
        toast({
          title: "Team caricati",
          description: `Trovati ${data.teams.length} team disponibili`
        });
      }
    } catch (error: any) {
      console.error("Errore caricamento team:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare i team",
        variant: "destructive"
      });
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleSaveTeamsConfig = async () => {
    if (!selectedTeamId || !selectedChannelId) {
      toast({
        title: "Errore",
        description: "Seleziona almeno un team e un canale predefinito",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Sessione non valida");
      }

      const selectedTeam = teams.find(t => t.id === selectedTeamId);
      const selectedChannel = selectedTeam?.channels.find(c => c.id === selectedChannelId);
      const scadenzeChannel = selectedTeam?.channels.find(c => c.id === scadenzeChannelId);
      const alertChannel = selectedTeam?.channels.find(c => c.id === alertChannelId);

      const response = await fetch("/api/microsoft365/save-teams-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          default_team_id: selectedTeamId,
          default_team_name: selectedTeam?.displayName,
          default_channel_id: selectedChannelId,
          default_channel_name: selectedChannel?.displayName,
          scadenze_channel_id: scadenzeChannelId || selectedChannelId,
          scadenze_channel_name: scadenzeChannel?.displayName || selectedChannel?.displayName,
          alert_channel_id: alertChannelId || selectedChannelId,
          alert_channel_name: alertChannel?.displayName || selectedChannel?.displayName,
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Errore salvataggio configurazione");
      }

      toast({
        title: "Successo",
        description: "Configurazione Teams salvata correttamente"
      });

      if (studioId) {
        await loadConfiguration(studioId);
      }
    } catch (error: any) {
      console.error("Errore salvataggio Teams:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare configurazione Teams",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!selectedTeamId || !selectedChannelId) {
      toast({
        title: "Errore",
        description: "Seleziona prima un team e un canale",
        variant: "destructive"
      });
      return;
    }

    setSendingTest(true);
    try {
      const { teamsNotificationService } = await import("@/services/teamsNotificationService");
      
      const result = await teamsNotificationService.sendTeamsNotification(
        "🧪 Test Notifica",
        "Questo è un messaggio di test inviato da Studio Manager Pro. Se vedi questo messaggio, l'integrazione Teams funziona correttamente! ✅",
        {
          type: "success",
          channelId: selectedChannelId
        }
      );

      if (result.success) {
        toast({
          title: "Messaggio inviato!",
          description: "Controlla il canale Teams selezionato"
        });
      } else {
        toast({
          title: "Errore invio",
          description: result.error || "Impossibile inviare messaggio",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Errore invio test:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare messaggio di test",
        variant: "destructive"
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Cloud className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Microsoft 365</h1>
          {connectionStatus === "connected" && (
            <Badge className="bg-green-100 text-green-800 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connesso
            </Badge>
          )}
          {connectionStatus === "disconnected" && (
            <Badge className="bg-red-100 text-red-800 border-red-300">
              <XCircle className="h-3 w-3 mr-1" />
              Non connesso
            </Badge>
          )}
        </div>
        <p className="text-gray-500">Integrazione con Outlook, Teams, Calendar e Graph API</p>
      </div>

      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList>
          <TabsTrigger value="configuration">Configurazione</TabsTrigger>
          <TabsTrigger value="teams">Microsoft Teams</TabsTrigger>
          <TabsTrigger value="features">Funzionalità</TabsTrigger>
          <TabsTrigger value="guide">Guida Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connessione Account Microsoft</CardTitle>
              <CardDescription>
                Autorizza il tuo account Microsoft per utilizzare le funzionalità
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${userOAuthStatus === "connected" ? "bg-green-500" : "bg-gray-300"}`} />
                  <div>
                    <p className="font-medium">
                      {userOAuthStatus === "connected" ? "Account Connesso" : "Account Non Connesso"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {userOAuthStatus === "connected" 
                        ? "Il tuo account Microsoft è autorizzato" 
                        : "Devi autorizzare il tuo account Microsoft"}
                    </p>
                  </div>
                </div>
                {userOAuthStatus === "connected" ? (
                  <Button variant="outline" onClick={handleDisconnectMicrosoft}>
                    Disconnetti
                  </Button>
                ) : (
                  <Button onClick={handleConnectMicrosoft}>
                    Connetti Account
                  </Button>
                )}
              </div>

              {userOAuthStatus === "disconnected" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Per utilizzare le funzionalità Microsoft 365 (Teams, Email, Calendario), 
                    devi prima connettere il tuo account Microsoft cliccando su "Connetti Account".
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credenziali Azure AD</CardTitle>
              <CardDescription>
                Inserisci le credenziali ottenute dal portale Azure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client ID (Application ID) *</Label>
                <Input
                  id="client_id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={config.client_id}
                  onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant_id">Tenant ID (Directory ID) *</Label>
                <Input
                  id="tenant_id"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={config.tenant_id}
                  onChange={(e) => setConfig({ ...config, tenant_id: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_secret">Client Secret *</Label>
                <div className="relative">
                  <Input
                    id="client_secret"
                    type={showSecret ? "text" : "password"}
                    placeholder="Inserisci il client secret"
                    value={config.client_secret}
                    onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Le credenziali vengono salvate in modo sicuro e criptato nel database.
                  Non condividere mai questi dati.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleSaveConfiguration} 
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    "Salva Configurazione"
                  )}
                </Button>
                
                <Button 
                  onClick={handleTestConnection} 
                  disabled={testing || !config.client_id || !config.tenant_id || !config.client_secret}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Test...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Verifica Connessione
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {config.connected_email && (
            <Card>
              <CardHeader>
                <CardTitle>Informazioni Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Email configurata:</span>
                  <span className="font-medium">{config.connected_email}</span>
                </div>
                {config.last_sync && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Ultima sincronizzazione:</span>
                    <span className="text-sm">{new Date(config.last_sync).toLocaleString("it-IT")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurazione Microsoft Teams</CardTitle>
              <CardDescription>
                Seleziona team e canali per le notifiche automatiche
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {userOAuthStatus !== "connected" ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Devi prima connettere il tuo account Microsoft nella sezione "Configurazione" per utilizzare Teams.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Account Microsoft Connesso</p>
                        <p className="text-sm text-gray-500">Pronto per configurare Teams</p>
                      </div>
                    </div>
                    <Button
                      onClick={loadTeamsAndChannels}
                      disabled={loadingTeams}
                      variant="outline"
                    >
                      {loadingTeams ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Caricamento...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Carica Team
                        </>
                      )}
                    </Button>
                  </div>

                  {teams.length > 0 && (
                    <>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="team-select">Team Predefinito *</Label>
                          <Select
                            value={selectedTeamId}
                            onValueChange={setSelectedTeamId}
                          >
                            <SelectTrigger id="team-select">
                              <SelectValue placeholder="Seleziona un team..." />
                            </SelectTrigger>
                            <SelectContent>
                              {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500">
                            Il team dove verranno inviate le notifiche
                          </p>
                        </div>

                        {selectedTeam && selectedTeam.channels.length > 0 && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="channel-select">Canale Predefinito *</Label>
                              <Select
                                value={selectedChannelId}
                                onValueChange={setSelectedChannelId}
                              >
                                <SelectTrigger id="channel-select">
                                  <SelectValue placeholder="Seleziona un canale..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedTeam.channels.map((channel) => (
                                    <SelectItem key={channel.id} value={channel.id}>
                                      {channel.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-gray-500">
                                Canale per notifiche generali
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="scadenze-channel-select">Canale Scadenze (Opzionale)</Label>
                              <Select
                                value={scadenzeChannelId}
                                onValueChange={setScadenzeChannelId}
                              >
                                <SelectTrigger id="scadenze-channel-select">
                                  <SelectValue placeholder="Stesso del canale predefinito" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Usa canale predefinito</SelectItem>
                                  {selectedTeam.channels.map((channel) => (
                                    <SelectItem key={channel.id} value={channel.id}>
                                      {channel.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-gray-500">
                                Canale dedicato per notifiche scadenze
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="alert-channel-select">Canale Alert (Opzionale)</Label>
                              <Select
                                value={alertChannelId}
                                onValueChange={setAlertChannelId}
                              >
                                <SelectTrigger id="alert-channel-select">
                                  <SelectValue placeholder="Stesso del canale predefinito" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Usa canale predefinito</SelectItem>
                                  {selectedTeam.channels.map((channel) => (
                                    <SelectItem key={channel.id} value={channel.id}>
                                      {channel.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-gray-500">
                                Canale per alert urgenti
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {selectedTeamId && selectedChannelId && (
                        <div className="pt-4 space-y-3">
                          <Alert className="bg-blue-50 border-blue-200">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                              <strong>Configurazione selezionata:</strong>
                              <br />
                              Team: {selectedTeam?.displayName}
                              <br />
                              Canale: {selectedTeam?.channels.find(c => c.id === selectedChannelId)?.displayName}
                            </AlertDescription>
                          </Alert>

                          <div className="flex gap-3">
                            <Button
                              onClick={handleSendTestMessage}
                              disabled={sendingTest}
                              variant="outline"
                              className="flex-1"
                            >
                              {sendingTest ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Invio...
                                </>
                              ) : (
                                <>
                                  <Send className="mr-2 h-4 w-4" />
                                  Invia Test
                                </>
                              )}
                            </Button>

                            <Button
                              onClick={handleSaveTeamsConfig}
                              disabled={saving}
                              className="flex-1"
                            >
                              {saving ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Salvataggio...
                                </>
                              ) : (
                                "Salva Configurazione"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {teams.length === 0 && !loadingTeams && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Clicca su "Carica Team" per visualizzare i team disponibili.
                        Assicurati di essere membro di almeno un team Microsoft Teams.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {config.teams_config?.default_team_name && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-900">✅ Configurazione Attiva</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Team:</span>
                  <span className="font-medium">{config.teams_config.default_team_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Canale predefinito:</span>
                  <span className="font-medium">{config.teams_config.default_channel_name}</span>
                </div>
                {config.teams_config.scadenze_channel_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Canale scadenze:</span>
                    <span className="font-medium">{config.teams_config.scadenze_channel_name}</span>
                  </div>
                )}
                {config.teams_config.alert_channel_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Canale alert:</span>
                    <span className="font-medium">{config.teams_config.alert_channel_name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Funzionalità Disponibili</CardTitle>
              <CardDescription>
                Attiva o disattiva le funzionalità Microsoft 365
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Invio Email</p>
                    <p className="text-sm text-gray-500">Invia email tramite Outlook</p>
                  </div>
                </div>
                <Switch
                  checked={config.features.email}
                  onCheckedChange={(checked) => 
                    setConfig({ 
                      ...config, 
                      features: { ...config.features, email: checked } 
                    })
                  }
                  disabled={connectionStatus !== "connected"}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Sincronizzazione Calendario</p>
                    <p className="text-sm text-gray-500">Sincronizza eventi con Outlook Calendar</p>
                  </div>
                </div>
                <Switch
                  checked={config.features.calendar}
                  onCheckedChange={(checked) => 
                    setConfig({ 
                      ...config, 
                      features: { ...config.features, calendar: checked } 
                    })
                  }
                  disabled={connectionStatus !== "connected"}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Sincronizzazione Contatti</p>
                    <p className="text-sm text-gray-500">Sincronizza contatti con Outlook</p>
                  </div>
                </div>
                <Switch
                  checked={config.features.contacts}
                  onCheckedChange={(checked) => 
                    setConfig({ 
                      ...config, 
                      features: { ...config.features, contacts: checked } 
                    })
                  }
                  disabled={connectionStatus !== "connected"}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium">Notifiche Teams</p>
                    <p className="text-sm text-gray-500">Invia notifiche su Microsoft Teams</p>
                  </div>
                </div>
                <Switch
                  checked={config.features.teams}
                  onCheckedChange={(checked) => 
                    setConfig({ 
                      ...config, 
                      features: { ...config.features, teams: checked } 
                    })
                  }
                  disabled={connectionStatus !== "connected"}
                />
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  {connectionStatus === "connected" 
                    ? "Configurazione completata. Puoi attivare le funzionalità desiderate."
                    : "Completa prima la configurazione delle credenziali per attivare le funzionalità."}
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleSaveConfiguration} 
                disabled={saving || connectionStatus !== "connected"}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  "Salva Preferenze"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guida Configurazione Azure AD</CardTitle>
              <CardDescription>
                Segui questi passaggi per configurare l'integrazione
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Accedi al Portale Azure</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Vai su <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        portal.azure.com <ExternalLink className="h-3 w-3" />
                      </a> e accedi con l'account amministratore Microsoft 365
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Registra una nuova applicazione</h3>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Vai su "Azure Active Directory" → "Registrazioni app"</li>
                      <li>Clicca "Nuova registrazione"</li>
                      <li>Nome: "Studio Manager Pro"</li>
                      <li>Tipo account supportati: "Solo questa directory"</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Configura i permessi API</h3>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Vai su "Autorizzazioni API" → "Aggiungi autorizzazione"</li>
                      <li>Seleziona "Microsoft Graph" → "Autorizzazioni applicazione"</li>
                      <li>Aggiungi: Mail.Send, Calendars.ReadWrite, User.Read.All</li>
                      <li>Clicca "Concedi consenso amministratore"</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Crea un Client Secret</h3>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Vai su "Certificati e segreti"</li>
                      <li>Clicca "Nuovo segreto client"</li>
                      <li>Descrizione: "Studio Manager Pro Secret"</li>
                      <li>Scadenza: 24 mesi</li>
                      <li><strong>COPIA SUBITO IL VALORE</strong> (non sarà più visibile)</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    5
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Copia le credenziali</h3>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Vai su "Panoramica"</li>
                      <li>Copia il "Client ID" (Application ID)</li>
                      <li>Copia il "Tenant ID" (Directory ID)</li>
                      <li>Incolla tutti i dati nel tab "Configurazione"</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Hai bisogno di aiuto? Contatta il supporto tecnico o consulta la 
                  <a href="https://docs.microsoft.com/en-us/graph/auth-register-app-v2" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                    documentazione ufficiale Microsoft
                  </a>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}