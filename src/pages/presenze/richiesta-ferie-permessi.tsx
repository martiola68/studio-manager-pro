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

const [calcoloGiorni, setCalcoloGiorni] = useState(false);

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

  useEffect(() => {
  async function aggiornaGiorniFerie() {
    if (
      form.tipo_richiesta !== "ferie" ||
      !form.data_inizio ||
      !form.data_fine
    ) {
      setForm((prev) => ({
        ...prev,
        giorni: "",
      }));
      return;
    }

    const start = parseDateLocale(form.data_inizio);
    const end = parseDateLocale(form.data_fine);

    if (end < start) {
      setForm((prev) => ({
        ...prev,
        giorni: "",
      }));
      return;
    }

    try {
      setCalcoloGiorni(true);

     const { data, error } = await (supabase as any)
  .from("tbfestivita")
  .select("data_festivita")
  .gte("data_festivita", form.data_inizio)
  .lte("data_festivita", form.data_fine)
  .in("tipo", ["nazionale", "locale", "aziendale"]);

      if (error) throw error;

    const giorniFestivi = (data ?? []).map(
  (item: any) => item.data_festivita
);

const giorniEffettivi = calcolaGiorniFerieEffettivi(
  form.data_inizio,
  form.data_fine,
  giorniFestivi
);

      setForm((prev) => ({
        ...prev,
        giorni: String(giorniEffettivi),
      }));
    } catch (error) {
      console.error("Errore calcolo giorni ferie:", error);

      setForm((prev) => ({
        ...prev,
        giorni: "",
      }));
    } finally {
      setCalcoloGiorni(false);
    }
  }

  aggiornaGiorniFerie();
}, [form.tipo_richiesta, form.data_inizio, form.data_fine]);

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

  function parseDateLocale(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calcolaGiorniFerieEffettivi(
  dataInizio: string,
  dataFine: string,
  giorniFestivi: string[]
) {
  if (!dataInizio || !dataFine) return 0;

  const start = parseDateLocale(dataInizio);
  const end = parseDateLocale(dataFine);

  if (end < start) return 0;

  const festivitaSet = new Set(giorniFestivi);

  let totale = 0;
  const corrente = new Date(start);

  while (corrente <= end) {
    const giornoSettimana = corrente.getDay();
    const dataKey = formatDateKey(corrente);

    const sabato = giornoSettimana === 6;
    const domenica = giornoSettimana === 0;
    const festivo = festivitaSet.has(dataKey);

    if (!sabato && !domenica && !festivo) {
      totale++;
    }

    corrente.setDate(corrente.getDate() + 1);
  }

  return totale;
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

   if (form.data_inizio < todayKey) {
  toast({
    title: "Errore",
    description: "Non è possibile inserire una richiesta per una data antecedente a oggi.",
    variant: "destructive",
  });
  return;
}

if (
  form.tipo_richiesta === "ferie" &&
  form.data_fine &&
  form.data_fine < form.data_inizio
) {
  toast({
    title: "Errore",
    description: "La data fine non può essere precedente alla data inizio.",
    variant: "destructive",
  });
  return;
}

   if (
  form.tipo_richiesta === "ferie" &&
  Number(form.giorni || 0) <= 0
) {
  toast({
    title: "Errore",
    description:
      "L'intervallo selezionato non contiene giorni lavorativi di ferie.",
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

const oggi = new Date();
const todayKey = [
  oggi.getFullYear(),
  String(oggi.getMonth() + 1).padStart(2, "0"),
  String(oggi.getDate()).padStart(2, "0"),
].join("-");

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
  min={todayKey}
  value={form.data_inizio}
  onChange={(e) => {
    const nuovaDataInizio = e.target.value;

    setForm((prev) => ({
      ...prev,
      data_inizio: nuovaDataInizio,

      // Per le ferie, se la data fine è vuota o precedente,
      // la portiamo automaticamente alla data iniziale.
      data_fine:
        prev.tipo_richiesta === "ferie" &&
        (!prev.data_fine || prev.data_fine < nuovaDataInizio)
          ? nuovaDataInizio
          : prev.data_fine,
    }));
  }}
  required
/>
              </div>

              <div className="space-y-2">
                <Label>Data fine</Label>
              <Input
  type="date"
  min={form.data_inizio || todayKey}
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
  value={form.giorni}
  readOnly
  disabled={!isFerie}
  className="bg-gray-50 cursor-not-allowed"
/>
              </div>

              <div className="space-y-2">
                <Label>Ore permesso</Label>
               <Input
  type="number"
  step="0.25"
  min="0.25"
  max="8"
  value={form.ore}
  onChange={(e) =>
    setForm({ ...form, ore: e.target.value })
  }
  onKeyDown={(e) => {
    e.preventDefault();
  }}
  onPaste={(e) => {
    e.preventDefault();
  }}
  onWheel={(e) => {
    e.currentTarget.blur();
  }}
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

             <Button type="submit" disabled={saving || calcoloGiorni}>
  {saving
    ? "Invio..."
    : calcoloGiorni
      ? "Calcolo..."
      : "Invia richiesta"}
</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
