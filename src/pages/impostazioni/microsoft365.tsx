import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Info, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { z } from "zod";

const M365ConfigSchema = z.object({
  client_id: z.string(),
  tenant_id: z.string(),
  enabled: z.boolean(),
});

type M365Config = z.infer<typeof M365ConfigSchema>;

interface TestResult {
  success: boolean;
  message?: string;
  organization?: string;
  error?: string;
}

interface UserConnectionStatus {
  isConnected: boolean;
  lastConnection?: Date;
}

export default function Microsoft365Settings() {
  const router = useRouter();
  const [studioId, setStudioId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  
  const [config, setConfig] = useState<M365Config | null>(null);
  const [userConnection, setUserConnection] = useState<UserConnectionStatus>({ isConnected: false });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndConfig();
  }, []);

  useEffect(() => {
    if (router.query.success === "true") {
      setSuccessMessage("✅ Microsoft 365 connesso con successo!");
      loadUserConnectionStatus();
      router.replace("/impostazioni/microsoft365", undefined, { shallow: true });
    }
    
    if (router.query.error) {
      const errorMsg = router.query.message 
        ? decodeURIComponent(router.query.message as string)
        : "Errore durante la connessione";
      setError(`❌ ${errorMsg}`);
      router.replace("/impostazioni/microsoft365", undefined, { shallow: true });
    }
  }, [router.query]);

  async function loadUserAndConfig() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const currentUserId = session.user.id;
      setUserId(currentUserId);

      const { data: user } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", currentUserId)
        .single();

      if (!user?.studio_id) {
        setError("Studio non trovato");
        setLoading(false);
        return;
      }

      setStudioId(user.studio_id);

      const { data: rawData } = await supabase
        .from("microsoft365_config")
        .select("client_id, tenant_id, enabled")
        .eq("studio_id", user.studio_id)
        .maybeSingle();

      if (rawData) {
        const parsed = M365ConfigSchema.safeParse(rawData);
        if (parsed.success) {
          const validConfig = parsed.data;
          setConfig(validConfig);
          setClientId(validConfig.client_id);
          setTenantId(validConfig.tenant_id);
        } else {
          console.error("Invalid config data in DB:", parsed.error);
          setError("Configurazione nel database corrotta o non valida");
        }
      }

      await loadUserConnectionStatus();

      setLoading(false);
    } catch (err) {
      console.error("Error loading config:", err);
      setError("Errore nel caricamento della configurazione");
      setLoading(false);
    }
  }

  async function loadUserConnectionStatus() {
    if (!userId) return;
    
    try {
      const { data: tokenData } = await supabase
        .from("tbmicrosoft_tokens")
        .select("created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (tokenData) {
        setUserConnection({
          isConnected: true,
          lastConnection: new Date(tokenData.updated_at || tokenData.created_at),
        });
      } else {
        setUserConnection({ isConnected: false });
      }
    } catch (err) {
      console.error("Error loading user connection status:", err);
      setUserConnection({ isConnected: false });
    }
  }

  async function handleSave() {
    if (!studioId) {
      setError("Studio ID non trovato");
      return;
    }

    if (!clientId || !tenantId) {
      setError("Inserisci almeno Client ID e Tenant ID");
      return;
    }

    if (config && !clientSecret) {
      const confirmed = window.confirm(
        "Non hai inserito un nuovo Client Secret. Vuoi mantenere quello esistente?"
      );
      if (!confirmed) return;
    }

    if (!config && !clientSecret) {
      setError("Client Secret è obbligatorio per nuove configurazioni");
      return;
    }

    setSaving(true);
    setError(null);
    setTestResult(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/microsoft365/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId,
          clientId,
          clientSecret: clientSecret || undefined,
          tenantId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Errore nel salvataggio");
      }

      setConfig(result.config);
      setClientSecret(""); 
      setSuccessMessage("✅ Configurazione salvata con successo!");
      
      await handleTest();
      
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!studioId) {
      setError("Studio ID non trovato");
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const response = await fetch("/api/microsoft365/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestResult({
          success: true,
          message: result.message,
          organization: result.organization,
        });
      } else {
        setTestResult({
          success: false,
          error: result.error || "Test fallito",
        });
      }
    } catch (err) {
      console.error("Test error:", err);
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Errore nel test",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleConnect() {
    if (!config) {
      setError("Configura prima l'app Azure AD (Client ID, Tenant ID, Secret)");
      return;
    }

    if (!config.enabled) {
      setError("Microsoft 365 è disabilitato per questo studio. Contatta l'amministratore.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    
    window.location.href = "/api/auth/microsoft/login";
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      "Sei sicuro di voler disconnettere il tuo account Microsoft 365?\n\n" +
      "Perderai l'accesso a Teams, Mail e Calendar finché non ti riconnetti."
    );

    if (!confirmed) return;

    setDisconnecting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/microsoft365/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Errore durante la disconnessione");
      }

      setUserConnection({ isConnected: false });
      setSuccessMessage("✅ Account Microsoft 365 disconnesso con successo");
      
    } catch (err) {
      console.error("Disconnect error:", err);
      setError(err instanceof Error ? err.message : "Errore durante la disconnessione");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Impostazioni Microsoft 365</h1>
        <p className="text-muted-foreground">Configura l&apos;integrazione con Microsoft 365 per il tuo studio</p>
      </div>

      {successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Configurazione App-Only (Client Credentials):</strong> Inserisci le credenziali dell&apos;applicazione Azure AD registrata per il tuo studio. 
          Il Client Secret viene cifrato con AES-256-GCM prima di essere salvato.
        </AlertDescription>
      </Alert>

      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {config.enabled ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Microsoft 365 Connesso
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Microsoft 365 Disabilitato
                </>
              )}
            </CardTitle>
            <CardDescription>
              Configurazione attiva per questo studio
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {userConnection.isConnected ? (
              <>
                <UserCheck className="h-5 w-5 text-green-500" />
                Account Connesso
              </>
            ) : (
              <>
                <UserX className="h-5 w-5 text-gray-400" />
                Account Non Connesso
              </>
            )}
          </CardTitle>
          <CardDescription>
            Stato della tua connessione personale a Microsoft 365
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userConnection.isConnected ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">✅ Connesso</span>
                </div>
                {userConnection.lastConnection && (
                  <p className="text-sm text-muted-foreground">
                    Ultima connessione: {userConnection.lastConnection.toLocaleString("it-IT", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                )}
              </div>
              
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Disconnetti Account
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">⚠️ Non connesso</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connetti il tuo account Microsoft per accedere a Teams, Mail e Calendar
                </p>
              </div>
              
              <div className="pt-2">
                <Button
                  onClick={handleConnect}
                  disabled={!config || !config.enabled}
                >
                  Connetti Microsoft 365
                </Button>
                {!config && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ⚠️ Prima configura l&apos;app Azure AD nella sezione sottostante
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {testResult.success ? (
              <>
                <strong>✅ Connessione riuscita!</strong>
                {testResult.organization && (
                  <div className="mt-1">Organizzazione: {testResult.organization}</div>
                )}
              </>
            ) : (
              <>
                <strong>❌ Connessione fallita</strong>
                <div className="mt-1">{testResult.error}</div>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Credenziali Azure AD (Configurazione Studio)</CardTitle>
          <CardDescription>
            Configura l&apos;applicazione Microsoft 365 per il tuo studio.
            <a 
              href="/guide/MICROSOFT_365_SETUP_GUIDE.md" 
              target="_blank"
              className="ml-2 text-blue-600 hover:underline"
            >
              Guida completa →
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID *</Label>
            <Input
              id="clientId"
              placeholder="12345678-1234-1234-1234-123456789abc"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">
              Client Secret {config ? "(Lascia vuoto per mantenere quello esistente)" : "*"}
            </Label>
            <Input
              id="clientSecret"
              type="password"
              placeholder={config ? "••••••••••••••••" : "Client Secret"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Il secret viene cifrato con AES-256-GCM prima del salvataggio.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenantId">Tenant ID *</Label>
            <Input
              id="tenantId"
              placeholder="12345678-1234-1234-1234-123456789abc"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving || !clientId || !tenantId}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {config ? "Aggiorna Configurazione" : "Salva Configurazione"}
            </Button>

            {config && (
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing}
              >
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Testa Connessione
              </Button>
            )}
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guida alla Configurazione</CardTitle>
          <CardDescription>
            Segui la guida passo-passo per configurare l&apos;applicazione Azure AD
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => window.open("/guide/MICROSOFT_365_SETUP_GUIDE.md", "_blank")}
          >
            Apri Guida Completa
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}