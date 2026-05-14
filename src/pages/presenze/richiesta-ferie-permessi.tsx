import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function RichiestaFeriePermessiPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [utente, setUtente] = useState<any>(null);
  const [studio, setStudio] = useState<any>(null);

  const [form, setForm] = useState({
    tipo_richiesta: "ferie",
    data_inizio: "",
    data_fine: "",
    giorni: "",
    ore: "",
    motivazione: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email;

      if (!email) {
        router.push("/login");
        return;
      }

      const { data: userRow, error: userError } = await supabase
        .from("tbutenti")
        .select("id, studio_id, nome, cognome, email")
        .eq("email", email)
        .single();

      if (userError || !userRow) throw userError;

      setUtente(userRow);

const studioId = userRow.studio_id as string;

const { data: studioRow, error: studioError } = await supabase
  .from("tbstudio")
  .select("id, mail_alert_ferie_permessi")
  .eq("id", studioId)
  .single();

      if (studioError || !studioRow) throw studioError;

      setStudio(studioRow);
    } catch (error) {
      console.error(error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!utente || !studio) return;

    if (!studio.mail_alert_ferie_permessi) {
      toast({
        title: "Errore",
        description: "Email responsabile ferie/permessi non configurata nello studio.",
        variant: "destructive",
      });
      return;
    }

    if (!form.data_inizio) {
      toast({
        title: "Errore",
        description: "Inserisci la data richiesta.",
        variant: "destructive",
      });
      return;
    }

    if (form.tipo_richiesta === "ferie" && !form.giorni) {
      toast({
        title: "Errore",
        description: "Inserisci il numero di giorni di ferie.",
        variant: "destructive",
      });
      return;
    }

    if (form.tipo_richiesta === "permesso" && !form.ore) {
      toast({
        title: "Errore",
        description: "Inserisci il numero di ore di permesso.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

     const {
  data: { session },
} = await supabase.auth.getSession();

const response = await fetch("/api/payroll/ferie-permessi/richieste", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  },
  body: JSON.stringify({
    tipo_richiesta: form.tipo_richiesta,
    data_inizio: form.data_inizio,
    data_fine: form.data_fine,
    giorni: form.giorni,
    ore: form.ore,
    motivazione: form.motivazione,
  }),
});

const result = await response.json();

if (!response.ok || !result.success) {
  throw new Error(result.error || "Errore invio richiesta.");
}

      toast({
        title: "Richiesta inviata",
        description: "La richiesta è stata registrata correttamente.",
      });

      router.push("/presenze");
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Errore",
        description: error?.message || "Impossibile salvare la richiesta.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  const isFerie = form.tipo_richiesta === "ferie";

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Richiesta ferie/permessi</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo richiesta</Label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={form.tipo_richiesta}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo_richiesta: e.target.value,
                    giorni: "",
                    ore: "",
                  })
                }
              >
                <option value="ferie">Ferie</option>
                <option value="permesso">Permesso</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data inizio</Label>
                <Input
                  type="date"
                  value={form.data_inizio}
                  onChange={(e) =>
                    setForm({ ...form, data_inizio: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Data fine</Label>
                <Input
                  type="date"
                  value={form.data_fine}
                  onChange={(e) =>
                    setForm({ ...form, data_fine: e.target.value })
                  }
                  disabled={!isFerie}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Giorni ferie</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.giorni}
                  onChange={(e) =>
                    setForm({ ...form, giorni: e.target.value })
                  }
                  disabled={!isFerie}
                />
              </div>

              <div className="space-y-2">
                <Label>Ore permesso</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={form.ore}
                  onChange={(e) =>
                    setForm({ ...form, ore: e.target.value })
                  }
                  disabled={isFerie}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivazione / note</Label>
              <Textarea
                rows={4}
                value={form.motivazione}
                onChange={(e) =>
                  setForm({ ...form, motivazione: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/presenze")}
              >
                Annulla
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? "Invio..." : "Invia richiesta"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
