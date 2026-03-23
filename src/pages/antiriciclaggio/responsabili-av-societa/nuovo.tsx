import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormDataType = {
  Denominazione: string;
  codice_fiscale: string;
};

function validateCodiceFiscaleGiuridico(value: string): boolean {
  const cf = (value || "").replace(/\s+/g, "");

  if (!/^\d{11}$/.test(cf)) return false;

  let sum = 0;

  for (let i = 0; i < 11; i++) {
    let n = parseInt(cf.charAt(i), 10);

    if (i % 2 === 0) {
      n = n;
    } else {
      n = n * 2;
      if (n > 9) n -= 9;
    }

    sum += n;
  }

  return sum % 10 === 0;
}

export default function NuovaSocietaRespAVPage() {
  const router = useRouter();
  const { id } = router.query;

  const [formData, setFormData] = useState<FormDataType>({
    Denominazione: "",
    codice_fiscale: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = typeof id === "string" && id.length > 0;

  const updateField = <K extends keyof FormDataType>(field: K, value: FormDataType[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const loadRecord = async (recordId: string) => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase
        .from("tbRespAVSocieta")
        .select("*")
        .eq("id", recordId)
        .single();

      if (error) throw new Error(error.message);
      if (!data) return;

      setFormData({
        Denominazione: data.Denominazione || "",
        codice_fiscale: data.codice_fiscale || "",
      });
    } catch (err: any) {
      setError(err?.message || "Errore caricamento società.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    if (!id || typeof id !== "string") return;

    void loadRecord(id);
  }, [router.isReady, id]);

  const checkDuplicate = async (
    studioId: string,
    codiceFiscale: string,
    currentId?: string
  ) => {
    const supabase = getSupabaseClient() as any;

    let query = supabase
      .from("tbRespAVSocieta")
      .select("id")
      .eq("studio_id", studioId)
      .eq("codice_fiscale", codiceFiscale);

    if (currentId) {
      query = query.neq("id", currentId);
    }

    const { data, error } = await query.limit(1);

    if (error) throw new Error(error.message);

    return !!data && data.length > 0;
  };

  const handleSave = async () => {
    setError(null);

    try {
      const studioId = await getStudioId();

      if (!studioId) {
        alert("Studio non disponibile.");
        return;
      }

      const denominazione = formData.Denominazione.trim();
      const codiceFiscale = formData.codice_fiscale.replace(/\s+/g, "");

      if (!denominazione) {
        alert("Inserisci la denominazione.");
        return;
      }

      if (!codiceFiscale) {
        alert("Inserisci il codice fiscale.");
        return;
      }

      if (!validateCodiceFiscaleGiuridico(codiceFiscale)) {
        alert("Il codice fiscale della società non è valido.");
        return;
      }

      setSaving(true);

      const duplicate = await checkDuplicate(
        studioId,
        codiceFiscale,
        isEdit ? (id as string) : undefined
      );

      if (duplicate) {
        alert("Esiste già una società con questo codice fiscale.");
        return;
      }

      const supabase = getSupabaseClient() as any;

      const payload = {
        studio_id: studioId,
        Denominazione: denominazione,
        codice_fiscale: codiceFiscale,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("tbRespAVSocieta")
          .update(payload)
          .eq("id", id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("tbRespAVSocieta")
          .insert([payload]);

        if (error) throw new Error(error.message);
      }

      void router.push("/antiriciclaggio/responsabili-av-societa");
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio società.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>
              {isEdit ? "Modifica società" : "Nuova società"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Inserimento della società collegata ai responsabili dell’adeguata verifica.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/antiriciclaggio/responsabili-av-societa">
              Torna all’elenco
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="space-y-5">
          {loading ? (
            <p>Caricamento...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Denominazione
                  </label>
                  <Input
                    type="text"
                    value={formData.Denominazione}
                    onChange={(e) => updateField("Denominazione", e.target.value)}
                    placeholder="Es. Studio Rossi SRL"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Codice fiscale
                  </label>
                  <Input
                    type="text"
                    maxLength={11}
                    value={formData.codice_fiscale}
                    onChange={(e) => updateField("codice_fiscale", e.target.value)}
                    placeholder="Codice fiscale società"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600">
                  Errore: {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button asChild type="button" variant="outline">
                  <Link href="/antiriciclaggio/responsabili-av-societa">
                    Annulla
                  </Link>
                </Button>

                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Salvataggio..." : "Salva"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
