import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import { isValidCF, normalizeCF } from "@/utils/codiceFiscale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormDataType = {
  cognome_nome: string;
  codice_fiscale: string;
  TipoSoggetto: string;
  societa: string;
};

const TIPO_SOGGETTO_OPTIONS = [
  "Professionista",
  "Intermediario bancario e finanziario",
  "Altri operatori finanziari",
  "Altri operatori non finanziari",
];

export default function NuovoResponsabileAVPage() {
  const router = useRouter();
  const { id } = router.query;

  const isEdit = useMemo(() => typeof id === "string" && id.length > 0, [id]);

  const [formData, setFormData] = useState<FormDataType>({
    cognome_nome: "",
    codice_fiscale: "",
    TipoSoggetto: "Professionista",
    societa: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cf = useMemo(() => normalizeCF(formData.codice_fiscale), [formData.codice_fiscale]);

  const cfOk = useMemo(() => {
    return cf.length === 16 ? isValidCF(cf) : false;
  }, [cf]);

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
        .from("tbRespAV")
        .select("*")
        .eq("id", recordId)
        .single();

      if (error) throw new Error(error.message);
      if (!data) return;

      setFormData({
        cognome_nome: data.cognome_nome || "",
        codice_fiscale: data.codice_fiscale || "",
        TipoSoggetto: data.TipoSoggetto || "Professionista",
        societa: data.societa || "",
      });
    } catch (err: any) {
      setError(err?.message || "Errore caricamento responsabile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    if (!id || typeof id !== "string") return;

    void loadRecord(id);
  }, [router.isReady, id]);

  const checkDuplicate = async (studioId: string, codiceFiscale: string, currentId?: string) => {
    const supabase = getSupabaseClient() as any;

    let query = supabase
      .from("tbRespAV")
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

      const cognomeNome = formData.cognome_nome.trim();
      const codiceFiscale = cf;
      const tipoSoggetto = formData.TipoSoggetto;

      if (!cognomeNome) {
        alert("Inserisci cognome e nome.");
        return;
      }

      if (!codiceFiscale) {
        alert("Inserisci il codice fiscale.");
        return;
      }

      if (!cfOk) {
        alert("Il codice fiscale non è valido.");
        return;
      }

      if (!TIPO_SOGGETTO_OPTIONS.includes(tipoSoggetto)) {
        alert("Tipo soggetto non valido.");
        return;
      }

      setSaving(true);

      const duplicate = await checkDuplicate(
        studioId,
        codiceFiscale,
        isEdit && typeof id === "string" ? id : undefined
      );

      if (duplicate) {
        alert("Esiste già un responsabile con questo codice fiscale.");
        return;
      }

      const supabase = getSupabaseClient() as any;

      const payload = {
        studio_id: studioId,
        cognome_nome: cognomeNome,
        codice_fiscale: codiceFiscale,
        TipoSoggetto: tipoSoggetto,
        societa: formData.societa || null,
      };

      if (isEdit && typeof id === "string") {
        const { error } = await supabase
          .from("tbRespAV")
          .update(payload)
          .eq("id", id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("tbRespAV").insert([payload]);

        if (error) throw new Error(error.message);
      }

      void router.push("/antiriciclaggio/responsabili-av");
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio responsabile.");
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
              {isEdit
                ? "Modifica responsabile adeguata verifica"
                : "Nuovo responsabile adeguata verifica"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Inserimento del soggetto incaricato dell’adeguata verifica.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/antiriciclaggio/responsabili-av">
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
                    Cognome e nome
                  </label>
                  <Input
                    type="text"
                    value={formData.cognome_nome}
                    onChange={(e) => updateField("cognome_nome", e.target.value)}
                    placeholder="Es. Mario Rossi"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Codice fiscale
                  </label>
                  <Input
                    type="text"
                    maxLength={16}
                    value={formData.codice_fiscale}
                    onChange={(e) =>
                      updateField("codice_fiscale", e.target.value.toUpperCase())
                    }
                    placeholder="Codice fiscale"
                  />
                  {cf.length === 16 && !cfOk && (
                    <p className="mt-1 text-sm text-red-500">
                      Codice fiscale non valido
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Tipo soggetto
                  </label>
                  <select
                    className="w-full rounded-md border px-3 py-2"
                    value={formData.TipoSoggetto}
                    onChange={(e) => updateField("TipoSoggetto", e.target.value)}
                  >
                    {TIPO_SOGGETTO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                Società
                </label>
                <Input
                  type="text"
                  value={formData.societa}
                onChange={(e) => updateField("societa", e.target.value)}
                  placeholder="Nome società (se presente)"
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
                  <Link href="/antiriciclaggio/responsabili-av">
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
