import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Loader2, AlertTriangle, Building2, Users } from "lucide-react";
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

type StudioOverview = {
  id: string;
  ragione_sociale: string | null;
  denominazione_breve: string | null;
  email: string | null;
  utenti_totali: number;
  utenti_attivi: number;
  amministratori_attivi: number;
};

export default function AmministrazioneSistemaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [candidates, setCandidates] = useState<AdminUser[]>([]);
  const [studi, setStudi] = useState<StudioOverview[]>([]);
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
      setStudi(result.studi || []);
    } catch (error: any) {
      toast({ title: "Errore", description: error?.message || "Impossibile caricare la pagina", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOverview(); }, []);

  const target = candidates.find((u) => u.id === targetUserId) || null;
  const expectedConfirmation = target?.email ? `TRASFERISCI A ${target.email.toLowerCase()}` : "";
  const utentiTotali = studi.reduce((totale, studio) => totale + studio.utenti_totali, 0);
  const utentiAttivi = studi.reduce((totale, studio) => totale + studio.utenti_attivi, 0);

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
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-700" /></div>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-700 text-white"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Amministrazione generale di sistema</h1>
              <p className="mt-1 text-sm text-slate-500">Area riservata all'Amministratore generale di sistema di Studio Manager Pro.</p>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <Card className="border border-sky-300 border-l-4 border-l-sky-600 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><Building2 className="h-6 w-6" /></div>
              <div><div className="text-2xl font-extrabold text-slate-900">{studi.length}</div><div className="text-sm text-slate-500">Studi registrati</div></div>
            </CardContent>
          </Card>
          <Card className="border border-sky-300 border-l-4 border-l-sky-600 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><Users className="h-6 w-6" /></div>
              <div><div className="text-2xl font-extrabold text-slate-900">{utentiTotali}</div><div className="text-sm text-slate-500">Utenti totali</div></div>
            </CardContent>
          </Card>
          <Card className="border border-sky-300 border-l-4 border-l-sky-600 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><ShieldCheck className="h-6 w-6" /></div>
              <div><div className="text-2xl font-extrabold text-slate-900">{utentiAttivi}</div><div className="text-sm text-slate-500">Utenti attivi</div></div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-5 overflow-hidden border border-sky-300 bg-white shadow-sm">
          <CardHeader className="border-b border-sky-200 bg-sky-50 px-5 py-4"><CardTitle className="text-base font-bold text-slate-900">Studi registrati</CardTitle></CardHeader>
          <CardContent className="p-5">
            {studi.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuno studio disponibile.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-600 text-white">
                    <tr className="text-left">
                      <th className="px-3 py-2.5 font-semibold">Studio</th>
                      <th className="px-3 py-2.5 font-semibold">Email</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Utenti</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Attivi</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Admin attivi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studi.map((studio) => (
                      <tr key={studio.id} className="border-b border-slate-200 last:border-0 hover:bg-sky-50">
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{studio.denominazione_breve || studio.ragione_sociale || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{studio.email || "—"}</td>
                        <td className="px-3 py-2.5 text-center text-slate-900">{studio.utenti_totali}</td>
                        <td className="px-3 py-2.5 text-center text-slate-900">{studio.utenti_attivi}</td>
                        <td className="px-3 py-2.5 text-center text-slate-900">{studio.amministratori_attivi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-5 overflow-hidden border border-sky-300 bg-white shadow-sm">
          <CardHeader className="border-b border-sky-200 bg-sky-50 px-5 py-4"><CardTitle className="text-base font-bold text-slate-900">Amministratore generale corrente</CardTitle></CardHeader>
          <CardContent className="p-5">
            {currentAdmin ? (
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div><span className="font-semibold text-slate-700">Nominativo:</span> <span className="text-slate-900">{currentAdmin.nome} {currentAdmin.cognome}</span></div>
                <div><span className="font-semibold text-slate-700">Email:</span> <span className="text-slate-900">{currentAdmin.email}</span></div>
                <div><span className="font-semibold text-slate-700">Stato:</span> <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{currentAdmin.attivo === false ? "Non attivo" : "Attivo"}</span></div>
                <div><span className="font-semibold text-slate-700">Tipo:</span> <span className="text-slate-900">Amministratore</span></div>
              </div>
            ) : <p className="text-red-600">Nessun Amministratore generale configurato.</p>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-sky-300 bg-white shadow-sm">
          <CardHeader className="border-b border-sky-200 bg-sky-50 px-5 py-4"><CardTitle className="text-base font-bold text-slate-900">Trasferimento privilegio generale</CardTitle></CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Il trasferimento è immediato e atomico: il nuovo utente diventa l'unico Amministratore generale e l'utente corrente perde questo privilegio.</p>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-700">Nuovo Amministratore generale</Label>
              <Select value={targetUserId} onValueChange={(value) => { setTargetUserId(value); setConfirmation(""); }}>
                <SelectTrigger className="h-10 border-sky-300 bg-white text-slate-900"><SelectValue placeholder="Seleziona un amministratore attivo" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.cognome} {u.nome} — {u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {target && (
              <div className="space-y-2">
                <Label htmlFor="confirmation" className="font-semibold text-slate-700">Conferma di sicurezza</Label>
                <p className="text-sm text-slate-500">Per confermare digita: <span className="font-mono font-semibold text-slate-900">{expectedConfirmation}</span></p>
                <Input id="confirmation" className="h-10 border-sky-300 bg-white focus-visible:ring-sky-500" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
              </div>
            )}

            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 font-semibold text-white hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500"
              disabled={!target || transferring || confirmation.trim().toLowerCase() !== expectedConfirmation.toLowerCase()}
              onClick={handleTransfer}
            >
              {transferring ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Trasferimento...</> : "Trasferisci Amministratore generale"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
