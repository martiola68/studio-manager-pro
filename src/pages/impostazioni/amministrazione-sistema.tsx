import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AdminUser = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  studio_id: string | null;
  tipo_utente: string | null;
  attivo: boolean | null;
};

export default function AmministrazioneSistemaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [candidates, setCandidates] = useState<AdminUser[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const loadOverview = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/admin/system-admin-overview", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();

      if (response.status === 403) {
        router.push("/dashboard");
        return;
      }
      if (!response.ok) throw new Error(result.details || result.error || "Errore caricamento amministrazione sistema");

      setCurrentAdmin(result.currentAdmin || null);
      setCandidates(result.candidates || []);
    } catch (error: any) {
      toast({ title: "Errore", description: error?.message || "Impossibile caricare la pagina", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOverview(); }, []);

  const target = candidates.find((u) => u.id === targetUserId) || null;
  const expectedConfirmation = target?.email ? `TRASFERISCI A ${target.email.toLowerCase()}` : "";

  const handleTransfer = async () => {
    if (!targetUserId || !target) return;
    if (confirmation.trim().toLowerCase() !== expectedConfirmation.toLowerCase()) {
      toast({ title: "Conferma non valida", description: `Digita esattamente: ${expectedConfirmation}`, variant: "destructive" });
      return;
    }

    try {
      setTransferring(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessione non valida");

      const response = await fetch("/api/admin/transfer-system-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId, confirmation: confirmation.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || "Trasferimento non riuscito");

      toast({ title: "Amministratore generale trasferito", description: `${result.nuovoUtente?.nome || ""} ${result.nuovoUtente?.cognome || ""}`.trim() });
      setTargetUserId("");
      setConfirmation("");
      router.push("/dashboard");
    } catch (error: any) {
      toast({ title: "Errore", description: error?.message || "Trasferimento non riuscito", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Amministrazione generale di sistema</h1>
        </div>
        <p className="mt-2 text-gray-500">Area riservata all'Amministratore generale di sistema di Studio Manager Pro.</p>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Amministratore generale corrente</CardTitle></CardHeader>
        <CardContent>
          {currentAdmin ? (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div><span className="font-semibold">Nominativo:</span> {currentAdmin.nome} {currentAdmin.cognome}</div>
              <div><span className="font-semibold">Email:</span> {currentAdmin.email}</div>
              <div><span className="font-semibold">Stato:</span> {currentAdmin.attivo === false ? "Non attivo" : "Attivo"}</div>
              <div><span className="font-semibold">Tipo:</span> Amministratore</div>
            </div>
          ) : <p className="text-red-600">Nessun Amministratore generale configurato.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trasferimento privilegio generale</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Il trasferimento è immediato e atomico: il nuovo utente diventa l'unico Amministratore generale e l'utente corrente perde questo privilegio.</p>
          </div>

          <div className="space-y-2">
            <Label>Nuovo Amministratore generale</Label>
            <Select value={targetUserId} onValueChange={(value) => { setTargetUserId(value); setConfirmation(""); }}>
              <SelectTrigger><SelectValue placeholder="Seleziona un amministratore attivo" /></SelectTrigger>
              <SelectContent>
                {candidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.cognome} {u.nome} — {u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {target && (
            <div className="space-y-2">
              <Label htmlFor="confirmation">Conferma di sicurezza</Label>
              <p className="text-sm text-gray-500">Per confermare digita: <span className="font-mono font-semibold text-gray-900">{expectedConfirmation}</span></p>
              <Input id="confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
            </div>
          )}

          <Button
            type="button"
            variant="destructive"
            disabled={!target || transferring || confirmation.trim().toLowerCase() !== expectedConfirmation.toLowerCase()}
            onClick={handleTransfer}
          >
            {transferring ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Trasferimento...</> : "Trasferisci Amministratore generale"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
