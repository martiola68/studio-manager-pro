import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  UserCheck,
  UserX,
  Link2,
  RefreshCcw,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

const [m365Connected, setM365Connected] = useState<boolean | null>(null)
const [m365Loading, setM365Loading] = useState(true)

async function loadM365Status() {
  setM365Loading(true)

  try {
    const res = await fetch("/api/m365/status")
    const json = await res.json()

    setM365Connected(json.connected === true)
  } catch (e) {
    // se qualcosa va storto → consideriamo NON connesso
    setM365Connected(false)
  }

  setM365Loading(false)
}

const M365ConfigSchema = z.object({
  client_id: z.string().min(1),
  tenant_id: z.string().min(1),
  enabled: z.boolean(),
});

type M365Config = z.infer<typeof M365ConfigSchema>;

type TestResult =
  | { success: true; message?: string; organization?: string }
  | { success: false; error: string };

type UserConnectionStatus = {
  isConnected: boolean;
  lastConnection?: Date;
};

type ActiveTab = "connessioni" | "sync";

function getTabFromQuery(q: unknown): ActiveTab {
  const t = typeof q === "string" ? q : "";
  return t === "sync" ? "sync" : "connessioni";
}

export default function Microsoft365Page() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("connessioni");

  const [studioId, setStudioId] = useState("");
  const [userId, setUserId] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");

  const [config, setConfig] = useState<M365Config | null>(null);
  const [userConnection, setUserConnection] = useState<UserConnectionStatus>({
    isConnected: false,
  });

  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const studioConfigValid = useMemo(() => {
    if (!config) return false;
    return Boolean(config.client_id && config.tenant_id && config.enabled === true);
  }, [config]);

  useEffect(() => {
    if (!router.isReady) return;
    setActiveTab(getTabFromQuery(router.query.tab));
  }, [router.isReady, router.query.tab]);

  useEffect(() => {
    loadUserAndConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // query params da callback: /microsoft365?m365=connected oppure error=true&message=...
  useEffect(() => {
    if (!router.isReady) return;

    if (router.query.m365 === "connected") {
      setSuccessMessage("✅ Microsoft 365 connesso con successo!");
      if (userId) loadUserConnectionStatus(userId);
      router.replace("/microsoft365?tab=connessioni", undefined, { shallow: true });
      return;
    }

    // compat: success=true
    if (router.query.success === "true") {
      setSuccessMessage("✅ Microsoft 365 connesso con successo!");
      if (userId) loadUserConnectionStatus(userId);
      router.replace("/microsoft365?tab=connessioni", undefined, { shallow: true });
      return;
    }

    if (router.query.error) {
      const msg =
        typeof router.query.message === "string"
          ? decodeURIComponent(router.query.message)
          : "Errore durante la connessione";
      setError(`❌ ${msg}`);
      router.replace("/microsoft365?tab=connessioni", undefined, { shallow: true });
    }
  }, [router.isReady, router.query, userId, router]);

  async function getSupabaseBearer(): Promise<string | null> {
    const { data, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) return null;
    return data?.session?.access_token ?? null;
  }

  async function loadUserAndConfig() {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const session = sessionRes?.session;
      if (!session) {
        router.push("/login");
        return;
      }

      const currentUserId = session.user.id;
      setUserId(currentUserId);

      // studio_id dell'utente
      const { data: user, error: userErr } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", currentUserId)
        .single();

      if (userErr) throw userErr;

      if (!user?.studio_id) {
        setError("Studio non trovato");
        return;
      }

      setStudioId(user.studio_id);

      // config studio
      const { data: rawData, error: cfgErr } = await supabase
        .from("microsoft365_config")
        .select("client_id, tenant_id, enabled")
        .eq("studio_id", user.studio_id)
        .maybeSingle();

      if (cfgErr) throw cfgErr;

      if (rawData) {
        const parsed = M365ConfigSchema.safeParse(rawData);
        if (!parsed.success) {
          console.error("Invalid config data in DB:", parsed.error);
          setConfig(null);
          setError("Configurazione nel database corrotta o non valida");
        } else {
          setConfig(parsed.data);
          setClientId(parsed.data.client_id);
          setTenantId(parsed.data.tenant_id);
        }
      } else {
        setConfig(null);
      }

      await loadUserConnectionStatus(currentUserId);
    } catch (err) {
      console.error("Error loading config:", err);
      setError(
        err instanceof Error ? err.message : "Errore nel caricamento della configurazione"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadUserConnectionStatus(uid: string) {
    if (!uid) return;

    try {
      const { data: tokenData, error: tokenErr } = await supabase
        .from("tbmicrosoft365_user_tokens")
        .select("connected_at, updated_at, revoked_at")
        .eq("user_id", uid)
        .maybeSingle();

      if (tokenErr) throw tokenErr;

      const connected = !!tokenData?.connected_at && !tokenData?.revoked_at;

      setUserConnection({
        isConnected: connected,
        lastConnection: tokenData?.updated_at ? new Date(tokenData.updated_at) : undefined,
      });
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

    // se config esiste, secret opzionale
    if (config && !clientSecret) {
      const confirmed = window.confirm(
        "Non hai inserito un nuovo Client Secret. Vuoi mantenere quello esistente?"
      );
      if (!confirmed) return;
    }

    // se config non esiste, secret obbligatorio
    if (!config && !clientSecret) {
      setError("Client Secret è obbligatorio per nuove configurazioni");
      return;
    }

    setSaving(true);
    setError(null);
    setTestResult(null);
    setSuccessMessage(null);

    try {
      const bearer = await getSupabaseBearer();

      const response = await fetch("/api/microsoft365/save-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({
          studioId,
          clientId,
          clientSecret: clientSecret || undefined,
          tenantId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Errore nel salvataggio");
      }

      const parsed = M365ConfigSchema.safeParse(result.config);
      if (!parsed.success) {
        console.error("save-config returned invalid config:", parsed.error, result.config);
        throw new Error("Risposta salvataggio non valida");
      }

      setConfig(parsed.data);
      setClientSecret("");
      setSuccessMessage("✅ Configurazione salvata con successo!");

      // opzionale: test automatico
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
      const bearer = await getSupabaseBearer();

      const response = await fetch("/api/microsoft365/test-delegated", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({}),
      });

      const result = await response.json().catch(() => ({}));

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

  // ✅ FLOW: POST /api/microsoft365/connect -> { url } -> redirect browser
  async function handleConnect() {
    if (!config) {
      setError(
        "Configura prima l'app Azure AD (Client ID e Tenant ID) e salva la configurazione studio."
      );
      return;
    }

    if (!config.enabled) {
      setError("Microsoft 365 è disabilitato per questo studio. Contatta l'amministratore.");
      return;
    }

    setConnecting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const bearer = await getSupabaseBearer();
      if (!bearer) {
        setError("Sessione non valida. Rifai login.");
        return;
      }

      const r = await fetch("/api/microsoft365/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({}),
        credentials: "include",
      });

      const data = await r.json().catch(() => null);

      if (!r.ok || !data?.url) {
        console.error("m365 connect error", data);
        setError(data?.error || "Errore connessione Microsoft 365");
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      console.error("M365 connect fatal", e);
      setError(e instanceof Error ? e.message : "Errore imprevisto");
    } finally {
      setConnecting(false);
    }
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
      const bearer = await getSupabaseBearer();
      if (!bearer) throw new Error("Sessione non valida. Rifai login.");

      const response = await fetch("/api/microsoft365/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({}),
      });

      const result = await response.json().catch(() => ({}));

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

  async function handleSyncAgenda() {
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      const bearer = await getSupabaseBearer();
      if (!bearer) throw new Error("Sessione non valida. Rifai login.");

      const r = await fetch("/api/microsoft365/calendar/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({}),
        credentials: "include",
      });

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        setSyncError(data?.error || "Errore sync agenda");
        return;
      }

      setSyncMessage(`Sync completata: ${data?.synced ?? 0} eventi aggiornati`);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Errore imprevisto");
    } finally {
      setSyncing(false);
    }
  }

  function goTab(tab: ActiveTab) {
    setActiveTab(tab);
    router.push(`/microsoft365?tab=${tab}`, undefined, { shallow: true });
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* HEADER */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-tight">Microsoft 365</h1>
        <p className="text-muted-foreground">
          Connessioni e sincronizzazione (Teams, Mail, Calendar)
        </p>
      </div>

      {/* TABS */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "connessioni" ? "default" : "outline"}
          onClick={() => goTab("connessioni")}
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          Connessioni
        </Button>
        <Button
          variant={activeTab === "sync" ? "default" : "outline"}
          onClick={() => goTab("sync")}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Sync
        </Button>
      </div>

      {successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {!studioConfigValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Config studio non valida</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* TAB CONNESSIONI */}
      {activeTab === "connessioni" && (
        <>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Configurazione Studio (Client Credentials):</strong> Il Client Secret viene
              cifrato (AES-256-GCM) prima del salvataggio. La connessione personale usa OAuth
              delegato.
            </AlertDescription>
          </Alert>

          {/* STATO CONFIG STUDIO */}
          {config && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {config.enabled ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Microsoft 365 configurato
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      Microsoft 365 disabilitato
                    </>
                  )}
                </CardTitle>
                <CardDescription>Configurazione attiva per questo studio</CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* STATO CONNESSIONE UTENTE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {userConnection.isConnected ? (
                  <>
                    <UserCheck className="h-5 w-5 text-green-500" />
                    Account connesso
                  </>
                ) : (
                  <>
                    <UserX className="h-5 w-5 text-gray-400" />
                    Account non connesso
                  </>
                )}
              </CardTitle>
              <CardDescription>Connessione personale a Microsoft 365</CardDescription>
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
                        Ultima connessione:{" "}
                        {userConnection.lastConnection.toLocaleString("it-IT", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
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
                      {disconnecting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Disconnetti account
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
                    <Button onClick={handleConnect} disabled={!studioConfigValid || connecting}>
                      {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Connetti Microsoft 365
                    </Button>

                    {!studioConfigValid && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        ⚠️ Prima configura l&apos;app Azure AD nella sezione sottostante
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* RISULTATO TEST */}
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
                    {testResult.message && <div className="mt-1">{testResult.message}</div>}
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

          {/* CONFIG STUDIO */}
          <Card>
            <CardHeader>
              <CardTitle>Credenziali Azure AD (Configurazione Studio)</CardTitle>
              <CardDescription>
                Configura l&apos;applicazione Microsoft 365 per lo studio.
                <a
                  href="/guide/MICROSOFT_365_SETUP_GUIDE.md"
                  target="_blank"
                  rel="noreferrer"
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
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
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
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSave} disabled={saving || !clientId || !tenantId}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {config ? "Aggiorna configurazione" : "Salva configurazione"}
                </Button>

                {config && (
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Testa connessione
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* GUIDA */}
          <Card>
            <CardHeader>
              <CardTitle>Guida alla configurazione</CardTitle>
              <CardDescription>
                Segui la guida passo-passo per configurare l&apos;app Azure AD
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => window.open("/guide/MICROSOFT_365_SETUP_GUIDE.md", "_blank")}
              >
                Apri guida completa
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* TAB SYNC */}
      {activeTab === "sync" && (
        <Card>
          <CardHeader>
            <CardTitle>Sincronizzazione Agenda</CardTitle>
            <CardDescription>Importa/Aggiorna eventi da Microsoft 365 in Agenda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!userConnection.isConnected ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Devi prima connettere il tuo account Microsoft 365 nella tab “Connessioni”.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Button onClick={handleSyncAgenda} disabled={syncing}>
                  {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sincronizza adesso
                </Button>

                {syncMessage && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>{syncMessage}</AlertDescription>
                  </Alert>
                )}

                {syncError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{syncError}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
