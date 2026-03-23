import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";

type FormDataType = {
  cognome_nome: string;
  codice_fiscale: string;
  TipoSoggetto: string;
};

const TIPO_SOGGETTO_OPTIONS = [
  "Professionista",
  "Intermediario bancario e finanziario",
  "Altri operatori finanziari",
  "Altri operatori non finanziari",
];

function normalizeCF(value: string) {
  return (value || "").toUpperCase().replace(/\s+/g, "");
}

function isValidCodiceFiscale(cf: string) {
  const value = normalizeCF(cf);
  return /^[A-Z0-9]{16}$/.test(value);
}

export default function NuovoResponsabileAVPage() {
  const router = useRouter();
  const { id } = router.query;

  const isEdit = useMemo(() => typeof id === "string" && id.length > 0, [id]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<FormDataType>({
    cognome_nome: "",
    codice_fiscale: "",
    TipoSoggetto: "Professionista",
  });

  async function getStudioId() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("studio_id");
  }

  async function loadRecord(recordId: string) {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("tbRespAV")
        .select("*")
        .eq("id", recordId)
        .single();

      if (error) throw error;
      if (!data) return;

      setFormData({
        cognome_nome: data.cognome_nome || "",
        codice_fiscale: data.codice_fiscale || "",
        TipoSoggetto: data.TipoSoggetto || "Professionista",
      });
    } catch (err) {
      console.error("Errore caricamento responsabile:", err);
      alert("Errore durante il caricamento del responsabile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof id === "string" && id) {
      loadRecord(id);
    }
  }, [id]);

  function updateField<K extends keyof FormDataType>(field: K, value: FormDataType[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function checkDuplicate(studioId: string, codiceFiscale: string, currentId?: string) {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("tbRespAV")
      .select("id")
      .eq("studio_id", studioId)
      .eq("codice_fiscale", codiceFiscale);

    if (currentId) {
      query = query.neq("id", currentId);
    }

    const { data, error } = await query.limit(1);

    if (error) throw error;
    return !!data && data.length > 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);

      const studioId = await getStudioId();
      if (!studioId) {
        alert("Studio non trovato. Effettua nuovamente l'accesso.");
        return;
      }

      const cognomeNome = formData.cognome_nome.trim();
      const codiceFiscale = normalizeCF(formData.codice_fiscale);
      const tipoSoggetto = formData.TipoSoggetto;

      if (!cognomeNome) {
        alert("Inserisci il cognome e nome.");
        return;
      }

      if (!codiceFiscale) {
        alert("Inserisci il codice fiscale.");
        return;
      }

      if (!isValidCodiceFiscale(codiceFiscale)) {
        alert("Il codice fiscale non è valido.");
        return;
      }

      if (!TIPO_SOGGETTO_OPTIONS.includes(tipoSoggetto)) {
        alert("Tipo soggetto non valido.");
        return;
      }

      const duplicate = await checkDuplicate(
        studioId,
        codiceFiscale,
        isEdit && typeof id === "string" ? id : undefined
      );

      if (duplicate) {
        alert("Esiste già un responsabile con questo codice fiscale.");
        return;
      }

      const payload = {
        studio_id: studioId,
        cognome_nome: cognomeNome,
        codice_fiscale: codiceFiscale,
        TipoSoggetto: tipoSoggetto,
      };

      const supabase = getSupabaseClient();

      if (isEdit && typeof id === "string") {
        const { error } = await supabase
          .from("tbRespAV")
          .update(payload)
          .eq("id", id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("tbRespAV").insert(payload);
        if (error) throw error;
      }

      router.push("/antiriciclaggio/responsabili-av");
    } catch (err) {
      console.error("Errore salvataggio responsabile:", err);
      alert("Errore durante il salvataggio del responsabile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isEdit ? "Modifica responsabile adeguata verifica" : "Nuovo responsabile adeguata verifica"}
          </h1>
          <p className="text-sm text-gray-500">
            Inserimento anagrafica del soggetto incaricato dell’adeguata verifica.
          </p>
        </div>

        <Link
          href="/antiriciclaggio/responsabili-av"
          className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
        >
          Torna all’elenco
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {loading ? (
          <div className="text-sm text-gray-500">Caricamento in corso...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Cognome e nome</label>
              <input
                type="text"
                value={formData.cognome_nome}
                onChange={(e) => updateField("cognome_nome", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Es. Mario Rossi"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Codice fiscale</label>
              <input
                type="text"
                value={formData.codice_fiscale}
                onChange={(e) => updateField("codice_fiscale", normalizeCF(e.target.value))}
                maxLength={16}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 uppercase"
                placeholder="Codice fiscale"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tipo soggetto</label>
              <select
                value={formData.TipoSoggetto}
                onChange={(e) => updateField("TipoSoggetto", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {TIPO_SOGGETTO_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Link
                href="/antiriciclaggio/responsabili-av"
                className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
              >
                Annulla
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
