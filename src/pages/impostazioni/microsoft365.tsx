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
  RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
}

export default function Microsoft365Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  
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

      setStudioId(utente.studio_id);
      await loadConfiguration(utente.studio_id);
      setLoading(false);
    } catch (error) {
      console.error("Errore verifica autenticazione:", error);
      router.push("/login");
    }
  };

  const loadConfiguration = async (studioId: string) => {
    try {
      const { data, error } = await supabase
        .from("microsoft365_config")
        .select("*")
        .eq("studio_id", studioId)
        .single();

      if (data) {
        setConfig({
          client_id: data.client_id || "",
          tenant_id: data.tenant_id || "",
          client_secret: data.client_secret || "",
          enabled: data.enabled || false,
          features: data.features || {
            email: false,
            calendar: false,
            contacts: false,
            teams: false
          },
          connected_email: data.connected_email,
          last_sync: data.last_sync
        });
        
        if (data.enabled && data.client_id && data.tenant_id && data.client_secret) {
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
      const { error } = await supabase
        .from("microsoft365_config")
        .upsert({
          studio_id: studioId,
          client_id: config.client_id,
          tenant_id: config.tenant_id,
          client_secret: config.client_secret,
          enabled: config.enabled,
          features: config.features,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Configurazione salvata correttamente"
      });

      await loadConfiguration(studioId);
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Errore durante il salvataggio della configurazione",
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
      const response = await fetch("/api/auth/microsoft/test-connection", {
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
          description: "Microsoft 365 configurato correttamente"
        });
      } else {
        setConnectionStatus("disconnected");
        toast({
          title: "Connessione fallita",
          description: data.error || "Verifica le credenziali",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Errore test connessione:", error);
      setConnectionStatus("disconnected");
      toast({
        title: "Errore",
        description: "Errore durante il test della connessione",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

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
          <TabsTrigger value="features">Funzionalità</TabsTrigger>
          <TabsTrigger value="guide">Guida Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
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
                      <li>Seleziona "Microsoft Graph" → "Autorizzazioni delegate"</li>
                      <li>Aggiungi: Mail.Send, Mail.ReadWrite, Calendars.ReadWrite, Contacts.ReadWrite</li>
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