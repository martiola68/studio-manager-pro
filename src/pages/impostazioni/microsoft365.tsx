import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { z } from "zod";

// Shared Zod Schema (can be imported, but defining here for client-side use)
const M365ConfigSchema = z.object({
  client_id: z.string(),
  tenant_id: z.string(),
  organizer_email: z.string().nullable().optional(),
  enabled: z.boolean(),
});

type M365Config = z.infer<typeof M365ConfigSchema>;

interface TestResult {
  success: boolean;
  message?: string;
  organization?: string;
  error?: string;
}

export default function Microsoft365Settings() {
  const router = useRouter();
  const [studioId, setStudioId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Form fields
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [organizerEmail, setOrganizerEmail] = useState("");
  
  // Status
  const [config, setConfig] = useState<M365Config | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndConfig();
  }, []);

  async function loadUserAndConfig() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: user } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", session.user.id)
        .single();

      if (!user?.studio_id) {
        setError("Studio non trovato");
        setLoading(false);
        return;
      }

      setStudioId(user.studio_id);

      // Load existing config using Supabase with manual cast bypass + Zod validation
      const { data: rawData } = await supabase
        .from("tbmicrosoft365_config" as any)
        .select("client_id, tenant_id, organizer_email, enabled")
        .eq("studio_id", user.studio_id)
        .maybeSingle();

      if (rawData) {
        // Validate with Zod
        const parsed = M365ConfigSchema.safeParse(rawData);
        if (parsed.success) {
          const validConfig = parsed.data;
          setConfig(validConfig);
          setClientId(validConfig.client_id);
          setTenantId(validConfig.tenant_id);
          setOrganizerEmail(validConfig.organizer_email || "");
        } else {
          console.error("Invalid config data in DB:", parsed.error);
          setError("Configurazione nel database corrotta o non valida");
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading config:", err);
      setError("Errore nel caricamento della configurazione");
      setLoading(false);
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

    try {
      const response = await fetch("/api/microsoft365/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId,
          clientId,
          clientSecret: clientSecret || undefined,
          tenantId,
          organizerEmail: organizerEmail || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Errore nel salvataggio");
      }

      // Result config is already validated by API
      setConfig(result.config);
      setClientSecret(""); 
      
      // Auto-test after save
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Impostazioni Microsoft 365" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            
            {/* Info Card */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Configurazione App-Only (Client Credentials):</strong> Inserisci le credenziali dell&apos;applicazione Azure AD registrata per il tuo studio. 
                Il Client Secret viene cifrato con AES-256-GCM prima di essere salvato.
              </AlertDescription>
            </Alert>

            {/* Status Card */}
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

            {/* Test Result */}
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

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Configuration Form */}
            <Card>
              <CardHeader>
                <CardTitle>Credenziali Azure AD</CardTitle>
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizerEmail">Email Organizer (Opzionale)</Label>
                  <Input
                    id="organizerEmail"
                    type="email"
                    placeholder="agenda@tuostudio.com"
                    value={organizerEmail}
                    onChange={(e) => setOrganizerEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Email usata come organizzatore per eventi e meeting Teams
                  </p>
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

            {/* Setup Guide Link */}
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
        </main>
      </div>
    </div>
  );
}