import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// 🔹 Validazione codice fiscale soggetto giuridico (11 cifre)
function validateCodiceFiscaleGiuridico(value: string): boolean {
  const cf = (value || "").replace(/\s+/g, "");

  if (!/^\d{11}$/.test(cf)) return false;

  let sum = 0;

  for (let i = 0; i < 11; i++) {
    let n = parseInt(cf.charAt(i), 10);

    if (i % 2 === 0) {
      // posizione pari
      n = n;
    } else {
      // posizione dispari
      n = n * 2;
      if (n > 9) n -= 9;
    }

    sum += n;
  }

  return sum % 10 === 0;
}

export default function NuovaSocietaRespAV() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const { id } = router.query;

  const [studioId, setStudioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    Denominazione: "",
    codice_fiscale: "",
  });

  // 🔹 Recupero studio_id
  const loadStudio = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from("tb_studi") // ⚠️ se hai nome diverso, cambialo
      .select("id")
      .eq("user_id", userId)
      .single();

    if (data) {
      setStudioId(data.id);

      if (id) {
        loadRecord(data.id, id as string);
      }
    }
  };

  // 🔹 Carica record in modifica
  const loadRecord = async (studio_id: string, recordId: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("tbRespAVSocieta")
      .select("*")
      .eq("id", recordId)
      .eq("studio_id", studio_id)
      .single();

    if (error) {
      toast.error("Errore caricamento record");
      console.error(error);
    } else if (data) {
      setFormData({
        Denominazione: data.Denominazione || "",
        codice_fiscale: data.codice_fiscale || "",
      });
    }

    setLoading(false);
  };

  // 🔹 Salvataggio
  const handleSave = async () => {
    if (!studioId) return;

    const payload = {
      studio_id: studioId,
      Denominazione: formData.Denominazione.trim(),
      codice_fiscale: formData.codice_fiscale.replace(/\s+/g, ""),
    };

    // VALIDAZIONI
    if (!payload.Denominazione) {
      toast.error("Inserire la denominazione");
      return;
    }

    if (!validateCodiceFiscaleGiuridico(payload.codice_fiscale)) {
      toast.error("Codice fiscale non valido");
      return;
    }

    setLoading(true);

    // 🔹 Controllo duplicato
    const { data: existing } = await supabase
      .from("tbRespAVSocieta")
      .select("id")
      .eq("studio_id", studioId)
      .eq("codice_fiscale", payload.codice_fiscale)
      .neq("id", id || "")
      .maybeSingle();

    if (existing) {
      toast.error("Esiste già una società con questo codice fiscale");
      setLoading(false);
      return;
    }

    let error;

    if (id) {
      // UPDATE
      const res = await supabase
        .from("tbRespAVSocieta")
        .update(payload)
        .eq("id", id);

      error = res.error;
    } else {
      // INSERT
      const res = await supabase
        .from("tbRespAVSocieta")
        .insert(payload);

      error = res.error;
    }

    if (error) {
      toast.error("Errore salvataggio");
      console.error(error);
    } else {
      toast.success("Salvato correttamente");
      router.push("/antiriciclaggio/responsabili-av-societa");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (router.isReady) {
      loadStudio();
    }
  }, [router.isReady]);

  return (
    <div className="p-6 max-w-2xl">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          {id ? "Modifica società" : "Nuova società"}
        </h1>
      </div>

      {/* FORM */}
      <div className="bg-white p-6 rounded-xl shadow border space-y-4">
        <div>
          <label className="text-sm font-medium">
            Denominazione
          </label>
          <Input
            value={formData.Denominazione}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                Denominazione: e.target.value,
              }))
            }
            placeholder="Es. Studio Rossi SRL"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Codice fiscale (11 cifre)
          </label>
          <Input
            value={formData.codice_fiscale}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                codice_fiscale: e.target.value,
              }))
            }
            placeholder="Es. 01234567890"
          />
        </div>

        {/* BOTTONI */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvataggio..." : "Salva"}
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              router.push("/antiriciclaggio/responsabili-av-societa")
            }
          >
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}
