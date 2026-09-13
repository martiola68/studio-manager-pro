import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Edit, Trash2, Search, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Ruolo = {
  id: string;
  ruolo: string;
  studio_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Profilo =
  | "Dipendente"
  | "Professionista collaboratore"
  | "Professionista socio"
  | "Praticante"
  | "Altro";

type Area = "Contabilità e fiscale" | "Consulenza" | "Payroll";

const PROFILI: Profilo[] = [
  "Dipendente",
  "Professionista collaboratore",
  "Professionista socio",
  "Praticante",
  "Altro",
];

const AREE: Area[] = ["Contabilità e fiscale", "Consulenza", "Payroll"];

function ruoloDa(profilo: Profilo, aree: Area[]) {
  if (!profilo || !aree.length) return "";
  return `${profilo} · ${aree.join(" + ")}`;
}

function parseRuolo(value: string): { profilo: Profilo | ""; aree: Area[] } {
  const [profiloRaw, areeRaw] = String(value || "").split("·").map((s) => s.trim());
  const profilo = PROFILI.includes(profiloRaw as Profilo) ? (profiloRaw as Profilo) : "";
  const aree = String(areeRaw || "")
    .split("+")
    .map((s) => s.trim())
    .filter((s): s is Area => AREE.includes(s as Area));
  return { profilo, aree };
}

export default function RuoliPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ruoli, setRuoli] = useState<Ruolo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRuolo, setEditingRuolo] = useState<Ruolo | null>(null);
  const [profilo, setProfilo] = useState<Profilo>("Dipendente");
  const [aree, setAree] = useState<Area[]>(["Contabilità e fiscale"]);

  const ruoloPreview = ruoloDa(profilo, aree);

  useEffect(() => {
    void checkAuthAndLoad();
  }, []);

  async function apiRuoli(method: "GET" | "POST" | "PATCH" | "DELETE", body?: any, id?: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sessione non disponibile");

    const url = id ? `/api/admin/ruoli?id=${encodeURIComponent(id)}` : "/api/admin/ruoli";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body || {}),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error || "Errore gestione ruoli");
    return json;
  }

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        await router.push("/login");
        return;
      }

      const { data: utente, error } = await supabase
        .from("tbutenti")
        .select("tipo_utente,amministratore_sistema_generale")
        .eq("email", session.user.email)
        .maybeSingle();

      if (error || (!utente || (utente.tipo_utente !== "Admin" && utente.amministratore_sistema_generale !== true))) {
        await router.push("/dashboard");
        return;
      }

      await loadRuoli();
    } catch (error) {
      console.error("Errore verifica ruoli:", error);
      await router.push("/login");
    }
  };

  const loadRuoli = async () => {
    try {
      setLoading(true);
      const json = await apiRuoli("GET");
      setRuoli(Array.isArray(json?.data) ? json.data : []);
    } catch (error: any) {
      console.error("Errore caricamento ruoli:", error);
      toast({ title: "Errore", description: error?.message || "Impossibile caricare i ruoli", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  function toggleArea(area: Area) {
    setAree((prev) => prev.includes(area) ? prev.filter((x) => x !== area) : [...prev, area]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilo || aree.length === 0 || !ruoloPreview) {
      toast({ title: "Dati incompleti", description: "Seleziona un profilo professionale e almeno un'area operativa", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      if (editingRuolo) {
        await apiRuoli("PATCH", { id: editingRuolo.id, ruolo: ruoloPreview });
        toast({ title: "Ruolo aggiornato", description: ruoloPreview });
      } else {
        await apiRuoli("POST", { ruolo: ruoloPreview });
        toast({ title: "Ruolo creato", description: ruoloPreview });
      }
      setDialogOpen(false);
      resetForm();
      await loadRuoli();
    } catch (error: any) {
      console.error("Errore salvataggio ruolo:", error);
      toast({ title: "Errore", description: error?.message || "Impossibile salvare il ruolo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ruolo: Ruolo) => {
    const parsed = parseRuolo(ruolo.ruolo);
    setEditingRuolo(ruolo);
    setProfilo(parsed.profilo || "Altro");
    setAree(parsed.aree.length ? parsed.aree : ["Contabilità e fiscale"]);
    setDialogOpen(true);
  };

  const handleDelete = async (ruolo: Ruolo) => {
    if (!confirm(`Eliminare il ruolo "${ruolo.ruolo}"?`)) return;
    try {
      await apiRuoli("DELETE", undefined, ruolo.id);
      toast({ title: "Ruolo eliminato", description: ruolo.ruolo });
      await loadRuoli();
    } catch (error: any) {
      console.error("Errore eliminazione ruolo:", error);
      toast({ title: "Impossibile eliminare", description: error?.message || "Errore eliminazione ruolo", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setEditingRuolo(null);
    setProfilo("Dipendente");
    setAree(["Contabilità e fiscale"]);
  };

  const filteredRuoli = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ruoli;
    return ruoli.filter((r) => String(r.ruolo || "").toLowerCase().includes(q));
  }, [ruoli, searchQuery]);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Caricamento ruoli...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestione Ruoli</h1>
          <p className="mt-1 text-sm text-slate-500">Profili organizzativi utilizzati per utenti, Payroll e Redditività Studio.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-sky-700 hover:bg-sky-800"><Shield className="mr-2 h-4 w-4" />Nuovo Ruolo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[620px]">
            <DialogHeader>
              <DialogTitle>{editingRuolo ? "Modifica Ruolo" : "Nuovo Ruolo"}</DialogTitle>
              <DialogDescription>Definisci profilo professionale e aree operative. Il ruolo sarà assegnabile agli utenti dello studio.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Profilo professionale</Label>
                <select value={profilo} onChange={(e) => setProfilo(e.target.value as Profilo)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  {PROFILI.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Area operativa</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {AREE.map((area) => {
                    const checked = aree.includes(area);
                    return (
                      <button key={area} type="button" onClick={() => toggleArea(area)} className={`flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium ${checked ? "border-sky-400 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700"}`}>
                        <span>{area}</span>{checked && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500">Puoi selezionare più aree per i professionisti che lavorano su più settori.</p>
              </div>

              <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Ruolo risultante</div>
                <div className="mt-1 font-semibold text-slate-900">{ruoloPreview || "Seleziona almeno un'area"}</div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving || !ruoloPreview} className="flex-1 bg-sky-700 hover:bg-sky-800">{saving ? "Salvataggio..." : editingRuolo ? "Aggiorna ruolo" : "Crea ruolo"}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Cerca ruolo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Ruolo</TableHead><TableHead className="w-[130px] text-right">Azioni</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredRuoli.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="py-10 text-center text-slate-500">Nessun ruolo configurato per lo studio.</TableCell></TableRow>
              ) : filteredRuoli.map((ruolo) => (
                <TableRow key={ruolo.id}>
                  <TableCell className="font-medium">{ruolo.ruolo}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(ruolo)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(ruolo)} className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
