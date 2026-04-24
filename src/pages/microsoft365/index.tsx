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

import type { MicrosoftConnection } from "@/types/microsoftConnection";
import {
  createMicrosoftConnection,
  getMicrosoftConnections,
  setDefaultMicrosoftConnection,
} from "@/services/microsoftConnectionsService";

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
  Plus,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

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
const [userMicrosoftConnectionId, setUserMicrosoftConnectionId] = useState("");
const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creatingConnection, setCreatingConnection] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");

  const [config, setConfig] = useState<M365Config | null>(null);
  const [userConnection, setUserConnection] = useState<UserConnectionStatus>({
    isConnected: false,
  });

  const [connections, setConnections] = useState<MicrosoftConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedClientSecret, setSelectedClientSecret] = useState("");

  const selectedConnection = useMemo(
  () => connections.find((c) => c.id === selectedConnectionId) ?? null,
  [connections, selectedConnectionId]
);

const maxConnectionsReached = connections.length >= 2;

  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showNewConnectionForm, setShowNewConnectionForm] = useState(false);
  const [newConnectionName, setNewConnectionName] = useState("");
  const [newConnectionTenantId, setNewConnectionTenantId] = useState("");
  const [newConnectionClientId, setNewConnectionClientId] = useState("");
  const [newConnectionClientSecret, setNewConnectionClientSecret] = useState("");
  const [newConnectionEnabled, setNewConnectionEnabled] = useState(true);
  const [newConnectionIsDefault, setNewConnectionIsDefault] = useState(false);

const studioConfigValid = useMemo(() => {
  return Boolean(
    selectedConnectionId &&
      selectedClientId.trim() &&
      selectedTenantId.trim()
  );
}, [selectedConnectionId, selectedClientId, selectedTenantId]);

  useEffect(() => {
    if (!router.isReady) return;
    setActiveTab(getTabFromQuery(router.query.tab));
  }, [router.isReady, router.query.tab]);

  useEffect(() => {
    void loadUserAndConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!studioId) return;
    void loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId, userMicrosoftConnectionId]);

  useEffect(() => {
    if (!selectedConnectionId || !userId) {
      setUserConnection({ isConnected: false });
      return;
    }
    void loadUserConnectionStatus(userId, selectedConnectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnectionId, userId]);

  useEffect(() => {
    if (!selectedConnection) {
      setSelectedClientId(clientId || "");
      setSelectedTenantId(tenantId || "");
      setSelectedClientSecret("");
      return;
    }

    setSelectedClientId(selectedConnection.client_id || "");
    setSelectedTenantId(selectedConnection.tenant_id || "");
    setSelectedClientSecret("");
  }, [selectedConnection, clientId, tenantId]);

  useEffect(() => {
    if (!router.isReady) return;

    if (router.query.m365 === "connected") {
      setSuccessMessage("✅ Microsoft 365 connesso con successo!");
      if (userId && selectedConnectionId) {
        void loadUserConnectionStatus(userId, selectedConnectionId);
      }
      router.replace("/microsoft365?tab=connessioni", undefined, { shallow: true });
      return;
    }

    if (router.query.success === "true") {
      setSuccessMessage("✅ Microsoft 365 connesso con successo!");
      if (userId && selectedConnectionId) {
        void loadUserConnectionStatus(userId, selectedConnectionId);
      }
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
  }, [router.isReady, router.query, userId, selectedConnectionId, router]);

  async function getSupabaseBearer(): Promise<string | null> {
    const { data, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) return null;
    return data?.session?.access_token ?? null;
  }

  async function loadConnections() {
    if (!studioId) return;

    const data = await getMicrosoftConnections(studioId);
    setConnections(data);

    setSelectedConnectionId((prev) => {
      if (prev && data.some((c) => c.id === prev)) return prev;

      if (
        userMicrosoftConnectionId &&
        data.some((c) => c.id === userMicrosoftConnectionId)
      ) {
        return userMicrosoftConnectionId;
      }

      const def = data.find((c) => c.is_default);
      return def?.id ?? data[0]?.id ?? "";
    });
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

     const { data: user, error: userErr } = await supabase
  .from("tbutenti")
  .select("studio_id, microsoft_connection_id, tipo_utente")
  .eq("id", currentUserId)
  .single();

      if (userErr) throw userErr;

      if (!user?.studio_id) {
        setError("Studio non trovato");
        return;
      }

      setStudioId(user.studio_id);
setUserMicrosoftConnectionId(user.microsoft_connection_id || "");
setIsAdmin(user.tipo_utente === "Admin");

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
    } catch (err) {
      console.error("Error loading config:", err);
      setError(
        err instanceof Error ? err.message : "Errore nel caricamento della configurazione"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadUserConnectionStatus(uid: string, connectionId: string) {
    if (!uid || !connectionId) return;

    try {
      const { data: tokenData, error: tokenErr } = await supabase
        .from("tbmicrosoft365_user_tokens")
        .select("connected_at, updated_at, revoked_at")
        .eq("user_id", uid)
        .eq("microsoft_connection_id", connectionId)
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
  if (!isAdmin) {
    setError("Solo l'amministratore può modificare le credenziali Microsoft 365.");
    return;
  }

  if (!studioId) {
      setError("Studio ID non trovato");
      return;
    }

    if (!selectedConnectionId) {
      setError("Seleziona una connessione Microsoft 365.");
      return;
    }

    if (!selectedClientId || !selectedTenantId) {
      setError("Inserisci almeno Client ID e Tenant ID");
      return;
    }

    if (selectedConnection && !selectedClientSecret) {
      const confirmed = window.confirm(
        "Non hai inserito un nuovo Client Secret. Vuoi mantenere quello esistente?"
      );
      if (!confirmed) return;
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
          connectionId: selectedConnectionId,
          clientId: selectedClientId,
          clientSecret: selectedClientSecret || undefined,
          tenantId: selectedTenantId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Errore nel salvataggio");
      }

      setClientId(selectedClientId);
      setTenantId(selectedTenantId);

      const parsed = M365ConfigSchema.safeParse({
        client_id: selectedClientId,
        tenant_id: selectedTenantId,
        enabled: selectedConnection?.enabled ?? true,
      });

      if (parsed.success) {
        setConfig(parsed.data);
      }

      setSelectedClientSecret("");
      setClientSecret("");
      setSuccessMessage("✅ Configurazione salvata con successo!");

      await loadConnections();
      
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

async function handleCreateConnection() {
  if (!isAdmin) {
    setError("Solo l'amministratore può creare connessioni Microsoft 365.");
    return;
  }

  if (!studioId) {
    setError("Studio ID non trovato");
    return;
  }

  if (connections.length >= 2) {
    setError("Limite massimo di 2 connessioni Microsoft raggiunto per questo studio");
    return;
  }

  if (
    !newConnectionName.trim() ||
    !newConnectionTenantId.trim() ||
    !newConnectionClientId.trim() ||
    !newConnectionClientSecret.trim()
  ) {
    setError("Compila tutti i campi della nuova connessione");
    return;
  }

    setCreatingConnection(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const nextSortOrder =
        connections.length > 0
          ? Math.max(...connections.map((c: any) => Number(c.sort_order ?? 0))) + 1
          : 1;

      const created = await createMicrosoftConnection({
        studio_id: studioId,
        nome_connessione: newConnectionName.trim(),
        tenant_id: newConnectionTenantId.trim(),
        client_id: newConnectionClientId.trim(),
        client_secret: newConnectionClientSecret.trim(),
        enabled: newConnectionEnabled,
        is_default: newConnectionIsDefault,
        sort_order: nextSortOrder,
      });

      await loadConnections();

      setSelectedConnectionId(created.id);
      setSuccessMessage("✅ Nuova connessione Microsoft 365 creata con successo");

      setNewConnectionName("");
      setNewConnectionTenantId("");
      setNewConnectionClientId("");
      setNewConnectionClientSecret("");
      setNewConnectionEnabled(true);
      setNewConnectionIsDefault(false);
      setShowNewConnectionForm(false);
    } catch (err) {
      console.error("Create connection error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Errore durante la creazione della connessione"
      );
    } finally {
      setCreatingConnection(false);
    }
  }

  async function handleTest() {
    if (!studioId) {
      setError("Studio ID non trovato");
      return;
    }

    if (!selectedConnectionId) {
      setError("Seleziona una connessione Microsoft 365.");
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
        body: JSON.stringify({
          connectionId: selectedConnectionId,
        }),
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

  async function handleConnect() {
  if (!selectedConnectionId) {
    setError("Seleziona una connessione Microsoft 365.");
    return;
  }

  if (!selectedClientId.trim() || !selectedTenantId.trim()) {
    setError("Inserisci e salva prima Client ID, Tenant ID e Client Secret della connessione selezionata.");
    return;
  }

  if (!selectedConnection) {
    setError("Connessione Microsoft 365 non trovata.");
    return;
  }

  if (!selectedConnection.enabled) {
    setError("La connessione Microsoft 365 selezionata è disabilitata.");
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

      window.location.href =
        `/api/microsoft365/connect?token=${encodeURIComponent(bearer)}` +
        `&microsoft_connection_id=${encodeURIComponent(selectedConnectionId)}`;
    } catch (e) {
      console.error("M365 connect fatal", e);
      setError(e instanceof Error ? e.message : "Errore imprevisto");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      `Sei sicuro di voler disconnettere la connessione "${
        selectedConnection?.nome_connessione || ""
      }"?`
    );
    if (!confirmed) return;

    if (!selectedConnectionId) {
      setError("Seleziona una connessione Microsoft 365.");
      return;
    }

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
        body: JSON.stringify({
          microsoft_connection_id: selectedConnectionId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Errore durante la disconnessione");
      }

      setUserConnection({ isConnected: false });
      setSuccessMessage("✅ Account Microsoft 365 disconnesso con successo");
      await loadConnections();
    } catch (err) {
      console.error("Disconnect error:", err);
      setError(err instanceof Error ? err.message : "Errore durante la disconnessione");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSyncAgenda() {
    if (!selectedConnectionId) {
      setSyncError("Seleziona una connessione Microsoft 365.");
      return;
    }

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
        body: JSON.stringify({
          connectionId: selectedConnectionId,
        }),
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-tight">Microsoft 365</h1>
        <p className="text-muted-foreground">
          Connessioni e sincronizzazione (Teams, Mail, Calendar)
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Selezione tenant / connessione</CardTitle>
          <CardDescription>
            Seleziona la connessione Microsoft 365 su cui vuoi operare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="selectedConnection">Connessione attiva</Label>
            <select
              id="selectedConnection"
              value={selectedConnectionId}
              onChange={(e) => {
                setSelectedConnectionId(e.target.value);
                setError(null);
                setSuccessMessage(null);
                setTestResult(null);
                setSyncMessage(null);
                setSyncError(null);
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleziona una connessione</option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.nome_connessione}
                  {conn.is_default ? " • predefinita" : ""}
                  {conn.id === userMicrosoftConnectionId ? " • assegnata utente" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedConnection && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              <div>
                <strong>Connessione:</strong> {selectedConnection.nome_connessione}
              </div>
              <div>
                <strong>Tenant:</strong> {selectedConnection.tenant_id || "-"}
              </div>
              <div>
                <strong>Email:</strong>{" "}
                {selectedConnection.connected_email ||
                  selectedConnection.organizer_email ||
                  "-"}
              </div>
              <div>
                <strong>Stato:</strong>{" "}
                {selectedConnection.enabled ? "Attiva" : "Disattiva"}
              </div>
              <div>
                <strong>Predefinita:</strong> {selectedConnection.is_default ? "Sì" : "No"}
              </div>
              <div>
                <strong>Assegnata all&apos;utente:</strong>{" "}
                {selectedConnection.id === userMicrosoftConnectionId ? "Sì" : "No"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Nuova connessione Microsoft 365</CardTitle>
              <CardDescription>
                Crea una nuova connessione tenant direttamente da questa pagina
              </CardDescription>
            </div>

            <Button
  type="button"
  variant={showNewConnectionForm ? "outline" : "default"}
  onClick={() => {
   onClick={() => {
  if (!isAdmin) {
    setError("Solo l'amministratore può creare o modificare connessioni Microsoft 365.");
    return;
  }

  if (maxConnectionsReached) {
    setError("Limite massimo di 2 connessioni Microsoft raggiunto per questo studio");
    return;
  }

  setShowNewConnectionForm((prev) => !prev);
}}
  className="gap-2"
  disabled={!isAdmin || (!showNewConnectionForm && maxConnectionsReached)}
>
  <Plus className="h-4 w-4" />
  {showNewConnectionForm
    ? "Chiudi"
    : maxConnectionsReached
    ? "Limite raggiunto (max 2)"
    : "Nuova connessione"}
</Button>

            {maxConnectionsReached && (
  <p className="text-sm text-red-600">
    Hai già 2 connessioni Microsoft registrate. Non è possibile crearne altre.
  </p>
)}
          </div>
        </CardHeader>

        {showNewConnectionForm && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newConnectionName">Nome connessione *</Label>
              <Input
                id="newConnectionName"
                placeholder="Es. Tenant Eius Advisory"
                value={newConnectionName}
                onChange={(e) => setNewConnectionName(e.target.value)}
                 disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newConnectionTenantId">Tenant ID *</Label>
              <Input
                id="newConnectionTenantId"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={newConnectionTenantId}
                onChange={(e) => setNewConnectionTenantId(e.target.value)}
                autoComplete="off"
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newConnectionClientId">Client ID *</Label>
              <Input
                id="newConnectionClientId"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={newConnectionClientId}
                onChange={(e) => setNewConnectionClientId(e.target.value)}
                autoComplete="off"
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newConnectionClientSecret">Client Secret *</Label>
              <Input
                id="newConnectionClientSecret"
                type="password"
                placeholder="Inserisci il client secret"
                value={newConnectionClientSecret}
                onChange={(e) => setNewConnectionClientSecret(e.target.value)}
                autoComplete="new-password"
                disabled={!isAdmin}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-md border p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newConnectionEnabled}
                  onChange={(e) => setNewConnectionEnabled(e.target.checked)}
                  disabled={!isAdmin}
                />
                Connessione attiva
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newConnectionIsDefault}
                  onChange={(e) => setNewConnectionIsDefault(e.target.checked)}
                  disabled={!isAdmin}
                />
                Imposta come connessione predefinita dello studio
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={handleCreateConnection}
                disabled={
                  creatingConnection ||
                  !newConnectionName ||
                  !newConnectionTenantId ||
                  !newConnectionClientId ||
                  !newConnectionClientSecret
                }
              >
                {creatingConnection && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salva nuova connessione
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewConnectionForm(false);
                  setNewConnectionName("");
                  setNewConnectionTenantId("");
                  setNewConnectionClientId("");
                  setNewConnectionClientSecret("");
                  setNewConnectionEnabled(true);
                  setNewConnectionIsDefault(false);
                }}
                disabled={creatingConnection}
              >
                Annulla
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

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

      {activeTab === "connessioni" && (
        <>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Configurazione connessione (Client Credentials):</strong> Il Client Secret
              viene cifrato prima del salvataggio. La connessione personale usa OAuth delegato
              sulla connessione selezionata.
            </AlertDescription>
          </Alert>

          {selectedConnection && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {selectedConnection.enabled ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Connessione Microsoft 365 attiva
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      Connessione Microsoft 365 disabilitata
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  Configurazione attiva sulla connessione selezionata
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
                    Account connesso
                  </>
                ) : (
                  <>
                    <UserX className="h-5 w-5 text-gray-400" />
                    Account non connesso
                  </>
                )}
              </CardTitle>
              <CardDescription>
                Connessione personale a Microsoft 365 sulla connessione selezionata
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
                      disabled={disconnecting || !selectedConnectionId}
                    >
                      {disconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                      sulla connessione selezionata.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={handleConnect}
                      disabled={!studioConfigValid || connecting || !selectedConnectionId}
                    >
                      {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Connetti Microsoft 365
                    </Button>

                    {!studioConfigValid && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        ⚠️ Prima configura l&apos;app Azure AD della connessione selezionata
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

          {!isAdmin && (
          <Alert>
            <Info className="h-4 w-4" />
                  <AlertDescription>
              Le credenziali Microsoft 365 possono essere inserite o modificate solo dall'amministratore.
                Gli altri utenti possono solo selezionare la connessione e collegare il proprio account.
                </AlertDescription>
              </Alert>
                  )}
          <Card>
            <CardHeader>
              <CardTitle>Credenziali Azure AD (Connessione selezionata)</CardTitle>
              <CardDescription>
                Configura l&apos;applicazione Microsoft 365 per il tenant selezionato.
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
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  autoComplete="off"
                  disabled={!isAdmin || !selectedConnectionId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">
                  Client Secret{" "}
                  {selectedConnection
                    ? "(Lascia vuoto per mantenere quello esistente)"
                    : "*"}
                </Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder={
                    selectedConnection
                      ? "Lascia vuoto per mantenere quello esistente"
                      : "Client Secret"
                  }
                  value={selectedClientSecret}
                  onChange={(e) => setSelectedClientSecret(e.target.value)}
                  autoComplete="new-password"
                  disabled={!isAdmin || !selectedConnectionId}
                />
                <p className="text-xs text-muted-foreground">
                  Il secret viene cifrato prima del salvataggio.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantId">Tenant ID *</Label>
                <Input
                  id="tenantId"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  autoComplete="off"
                  disabled={!isAdmin || !selectedConnectionId}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSave}
                 disabled={
  !isAdmin ||
  saving ||
  !selectedConnectionId ||
  !selectedClientId ||
  !selectedTenantId
}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salva configurazione
                </Button>

                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || !selectedConnectionId}
                >
                  {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Testa connessione
                </Button>
              </div>
            </CardContent>
          </Card>

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
                  Devi prima connettere il tuo account Microsoft 365 sulla connessione selezionata.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Button onClick={handleSyncAgenda} disabled={syncing || !selectedConnectionId}>
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Connessioni Microsoft 365</CardTitle>
          <CardDescription>
            Clicca una connessione per selezionarla e lavorarci sopra
          </CardDescription>
        </CardHeader>

        <CardContent>
          {connections.length === 0 ? (
            <p>Nessuna connessione presente.</p>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className={`rounded border p-3 ${
                    conn.id === selectedConnectionId ? "border-primary bg-accent/20" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedConnectionId(conn.id)}
                    className="w-full text-left"
                  >
                    <div className="font-semibold">{conn.nome_connessione}</div>
                    <div>Tenant: {conn.tenant_id || "-"}</div>
                    <div>Email: {conn.connected_email || conn.organizer_email || "-"}</div>
                    <div>Stato: {conn.enabled ? "Attiva" : "Disattiva"}</div>
                    <div>Default: {conn.is_default ? "Sì" : "No"}</div>
                    <div>
                      Assegnata utente: {conn.id === userMicrosoftConnectionId ? "Sì" : "No"}
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!conn.is_default && (
                     <Button
  type="button"
  variant="outline"
  disabled={!isAdmin}
  onClick={async () => {
                          await setDefaultMicrosoftConnection(studioId, conn.id);
                          await loadConnections();
                          setSelectedConnectionId(conn.id);
                          setSuccessMessage("✅ Connessione predefinita aggiornata");
                        }}
                      >
                        Imposta come predefinita
                      </Button>
                    )}

                    {conn.id !== selectedConnectionId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedConnectionId(conn.id)}
                      >
                        Seleziona
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
