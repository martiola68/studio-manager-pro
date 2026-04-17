import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type ClienteOption = {
  id: string;
  ragione_sociale: string | null;
};

type ContrattoFormData = {
  cliente_id: string;
  utente_operatore_id: string;
  descrizione_immobile_locato: string;
  data_registrazione_atto: string;
  durata_contratto_anni: string;
  codice_identificativo_registrazione: string;
  importo_registrazione: string;
  contatore_anni: string;
  data_prossima_scadenza: string;
  emailperalert: string;
  alert1_inviato: boolean;
  alert1_inviato_at: string;
  alert2_inviato: boolean;
  alert2_inviato_at: string;
  alert3_inviato: boolean;
  alert3_inviato_at: string;
  attivo: boolean;
  contratto_concluso: boolean;
};

const emptyForm: ContrattoFormData = {
  cliente_id: "",
  utente_operatore_id: "",
  descrizione_immobile_locato: "",
  data_registrazione_atto: "",
  durata_contratto_anni: "",
  codice_identificativo_registrazione: "",
  importo_registrazione: "",
  contatore_anni: "1",
  data_prossima_scadenza: "",
  emailperalert: "",
  alert1_inviato: false,
  alert1_inviato_at: "",
  alert2_inviato: false,
  alert2_inviato_at: "",
  alert3_inviato: false,
  alert3_inviato_at: "",
  attivo: true,
  contratto_concluso: false,
};

function addYearsToDate(dateString: string, years: number) {
  if (!dateString || !years || Number.isNaN(years)) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function formatDateTimeLocalInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toNullableNumber(value: string) {
  if (value === "" || value == null) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export default function NuovoContrattoAffittoPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studioId, setStudioId] = useState<string>("");
  const [operatoreEmail, setOperatoreEmail] = useState<string>("");
  const [formData, setFormData] = useState<ContrattoFormData>(emptyForm);
  const [clienti, setClienti] = useState<ClienteOption[]>([]);

  const isEdit = useMemo(() => typeof id === "string" && !!id, [id]);

  useEffect(() => {
    if (!router.isReady) return;
    initialize();
  }, [router.isReady, id]);

  const initialize = async () => {
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("Utente non autenticato");
        setLoading(false);
        return;
      }

      const { data: utenteDb, error: utenteError } = await supabase
        .from("tbutenti")
        .select("id, studio_id, email")
        .eq("id", user.id)
        .single();

      if (utenteError || !utenteDb?.studio_id) {
        console.error("Errore recupero dati utente:", utenteError);
        setLoading(false);
        return;
      }

      const currentStudioId = utenteDb.studio_id as string;
      setStudioId(currentStudioId);
      setOperatoreEmail(utenteDb.email || user.email || "");

      await loadClienti(currentStudioId);

      if (typeof id === "string" && id) {
        const { data: contratto, error: contrattoError } = await supabaseAny
          .from("tbscadaffitti")
          .select("*")
          .eq("id", id)
          .eq("studio_id", currentStudioId)
          .single();

        if (contrattoError || !contratto) {
          console.error("Errore caricamento contratto:", contrattoError);
        } else {
          setFormData({
            cliente_id: contratto.cliente_id || "",
            utente_operatore_id: contratto.utente_operatore_id || user.id,
            descrizione_immobile_locato:
              contratto.descrizione_immobile_locato || "",
            data_registrazione_atto: contratto.data_registrazione_atto || "",
            durata_contratto_anni: String(contratto.durata_contratto_anni ?? ""),
            codice_identificativo_registrazione:
              contratto.codice_identificativo_registrazione || "",
            importo_registrazione:
              contratto.importo_registrazione != null
                ? String(contratto.importo_registrazione)
                : "",
            contatore_anni: String(contratto.contatore_anni ?? 1),
            data_prossima_scadenza: contratto.data_prossima_scadenza || "",
            emailperalert: contratto.emailperalert || "",
            alert1_inviato: !!contratto.alert1_inviato,
            alert1_inviato_at: formatDateTimeLocalInput(
              contratto.alert1_inviato_at
            ),
            alert2_inviato: !!contratto.alert2_inviato,
            alert2_inviato_at: formatDateTimeLocalInput(
              contratto.alert2_inviato_at
            ),
            alert3_inviato: !!contratto.alert3_inviato,
            alert3_inviato_at: formatDateTimeLocalInput(
              contratto.alert3_inviato_at
            ),
            attivo: !!contratto.attivo,
            contratto_concluso: !!contratto.contratto_concluso,
          });
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          utente_operatore_id: user.id,
        }));
      }
    } catch (err) {
      console.error("Errore inizializzazione pagina affitti:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadClienti = async (currentStudioId: string) => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale")
      .eq("studio_id", currentStudioId)
      .order("ragione_sociale", { ascending: true });

    if (error) {
      console.error("Errore caricamento clienti:", error);
      setClienti([]);
      return;
    }

    setClienti(((data as unknown) as ClienteOption[]) || []);
  };

  const handleChange = (
    field: keyof ContrattoFormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCalcolaScadenza = () => {
    const data = formData.data_registrazione_atto;
    const anni = Number(formData.contatore_anni || "1");

    if (!data || !anni || Number.isNaN(anni)) return;

    const nuovaData = addYearsToDate(data, anni);
    handleChange("data_prossima_scadenza", nuovaData);
  };

  const validateForm = () => {
    if (!studioId) {
      alert("Studio non disponibile.");
      return false;
    }

    if (!formData.cliente_id) {
      alert("Seleziona il cliente.");
      return false;
    }

    if (!formData.data_registrazione_atto) {
      alert("La data di registrazione atto è obbligatoria.");
      return false;
    }

    if (
      !formData.durata_contratto_anni ||
      Number(formData.durata_contratto_anni) < 1
    ) {
      alert("La durata contratto deve essere almeno 1 anno.");
      return false;
    }

    if (!formData.contatore_anni || Number(formData.contatore_anni) < 1) {
      alert("Il contatore anni deve essere almeno 1.");
      return false;
    }

    if (!formData.data_prossima_scadenza) {
      alert("La data prossima scadenza è obbligatoria.");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);

    try {
      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const clienteSelezionato = clienti.find(
        (c) => c.id === formData.cliente_id
      );

      const ragioneSocialeLegacy =
        clienteSelezionato?.ragione_sociale?.trim() || null;

      const payload = {
        studio_id: studioId,
        cliente_id: formData.cliente_id,
        utente_operatore_id: formData.utente_operatore_id || null,
        descrizione_immobile_locato:
          formData.descrizione_immobile_locato.trim() || null,
        data_registrazione_atto: formData.data_registrazione_atto,
        durata_contratto_anni: Number(formData.durata_contratto_anni),
        codice_identificativo_registrazione:
          formData.codice_identificativo_registrazione.trim() || null,
        importo_registrazione: toNullableNumber(formData.importo_registrazione),
        contatore_anni: Number(formData.contatore_anni),
        data_prossima_scadenza: formData.data_prossima_scadenza,
        emailperalert: formData.emailperalert.trim() || null,
        alert1_inviato: !!formData.alert1_inviato,
        alert1_inviato_at: formData.alert1_inviato
          ? formData.alert1_inviato_at || new Date().toISOString()
          : null,
        alert2_inviato: !!formData.alert2_inviato,
        alert2_inviato_at: formData.alert2_inviato
          ? formData.alert2_inviato_at || new Date().toISOString()
          : null,
        alert3_inviato: !!formData.alert3_inviato,
        alert3_inviato_at: formData.alert3_inviato
          ? formData.alert3_inviato_at || new Date().toISOString()
          : null,
        attivo: !!formData.attivo,
        contratto_concluso: !!formData.contratto_concluso,

        // legacy temporaneo: tienilo finché la colonna esiste nel DB
        nominativo: ragioneSocialeLegacy,
      };

      if (isEdit && typeof id === "string") {
        const { error } = await supabaseAny
          .from("tbscadaffitti")
          .update(payload)
          .eq("id", id)
          .eq("studio_id", studioId);

        if (error) {
          console.error("Errore aggiornamento contratto:", error);
          alert("Errore durante il salvataggio.");
          return;
        }

        alert("Contratto aggiornato correttamente.");
      } else {
        const { error } = await supabaseAny
          .from("tbscadaffitti")
          .insert(payload);

        if (error) {
          console.error("Errore inserimento contratto:", error);
          alert("Errore durante il salvataggio.");
          return;
        }

        alert("Contratto creato correttamente.");
      }

      router.push("/scadenze/affitti");
    } catch (err) {
      console.error("Errore salvataggio contratto:", err);
      alert("Errore inatteso durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.push("/scadenze/affitti");
  };

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {isEdit ? "Modifica contratto di affitto" : "Nuovo contratto di affitto"}
        </h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="rounded border px-4 py-2"
          >
            Indietro
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded border bg-white p-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Cliente *</label>
          <select
            value={formData.cliente_id}
            onChange={(e) => handleChange("cliente_id", e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Seleziona cliente</option>
            {clienti.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.ragione_sociale?.trim() || "Senza nome"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Email operatore creatore
          </label>
          <input
            type="text"
            value={operatoreEmail}
            readOnly
            className="w-full rounded border bg-gray-100 px-3 py-2"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">
            Descrizione immobile locato
          </label>
          <input
            type="text"
            value={formData.descrizione_immobile_locato}
            onChange={(e) =>
              handleChange("descrizione_immobile_locato", e.target.value)
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Data registrazione atto *
          </label>
          <input
            type="date"
            value={formData.data_registrazione_atto}
            onChange={(e) =>
              handleChange("data_registrazione_atto", e.target.value)
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Durata contratto anni *
          </label>
          <input
            type="number"
            min={1}
            value={formData.durata_contratto_anni}
            onChange={(e) =>
              handleChange("durata_contratto_anni", e.target.value)
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Codice identificativo registrazione
          </label>
          <input
            type="text"
            value={formData.codice_identificativo_registrazione}
            onChange={(e) =>
              handleChange("codice_identificativo_registrazione", e.target.value)
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Importo registrazione
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.importo_registrazione}
            onChange={(e) =>
              handleChange("importo_registrazione", e.target.value)
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Contatore anni *</label>
          <input
            type="number"
            min={1}
            value={formData.contatore_anni}
            onChange={(e) => handleChange("contatore_anni", e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Data prossima scadenza *
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={formData.data_prossima_scadenza}
              onChange={(e) =>
                handleChange("data_prossima_scadenza", e.target.value)
              }
              className="w-full rounded border px-3 py-2"
            />
            <button
              type="button"
              onClick={handleCalcolaScadenza}
              className="whitespace-nowrap rounded border px-3 py-2"
            >
              Calcola
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Email per alert</label>
          <input
            type="email"
            value={formData.emailperalert}
            onChange={(e) => handleChange("emailperalert", e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="Inserisci email manualmente"
          />
        </div>
      </div>

      <div className="mt-6 rounded border bg-white p-4">
        <h2 className="mb-4 text-lg font-semibold">Alert annuali</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border p-3">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={formData.alert1_inviato}
                onChange={(e) => handleChange("alert1_inviato", e.target.checked)}
              />
              Alert 1 inviato
            </label>

            <input
              type="datetime-local"
              value={formData.alert1_inviato_at}
              onChange={(e) => handleChange("alert1_inviato_at", e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="rounded border p-3">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={formData.alert2_inviato}
                onChange={(e) => handleChange("alert2_inviato", e.target.checked)}
              />
              Alert 2 inviato
            </label>

            <input
              type="datetime-local"
              value={formData.alert2_inviato_at}
              onChange={(e) => handleChange("alert2_inviato_at", e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="rounded border p-3">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={formData.alert3_inviato}
                onChange={(e) => handleChange("alert3_inviato", e.target.checked)}
              />
              Alert 3 inviato
            </label>

            <input
              type="datetime-local"
              value={formData.alert3_inviato_at}
              onChange={(e) => handleChange("alert3_inviato_at", e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded border bg-white p-4">
        <h2 className="mb-4 text-lg font-semibold">Stato contratto</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={formData.attivo}
              onChange={(e) => handleChange("attivo", e.target.checked)}
            />
            Contratto attivo
          </label>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={formData.contratto_concluso}
              onChange={(e) =>
                handleChange("contratto_concluso", e.target.checked)
              }
            />
            Contratto concluso
          </label>
        </div>
      </div>
    </div>
  );
}
