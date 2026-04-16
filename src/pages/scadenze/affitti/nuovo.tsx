import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type ClienteOption = {
  id: string;
  ragione_sociale: string | null;
  nome?: string | null;
  cognome?: string | null;
};

type ContrattoFormData = {
  cliente_id: string;
  utente_operatore_id: string;
  nominativo: string;
  descrizione_immobile_locato: string;
  data_registrazione_atto: string;
  durata_contratto_anni: string;
  codice_identificativo_registrazione: string;
  importo_registrazione: string;
  contatore_anni: string;
  data_prossima_scadenza: string;
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
  nominativo: "",
  descrizione_immobile_locato: "",
  data_registrazione_atto: "",
  durata_contratto_anni: "",
  codice_identificativo_registrazione: "",
  importo_registrazione: "",
  contatore_anni: "1",
  data_prossima_scadenza: "",
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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("Utente non autenticato");
        setLoading(false);
        return;
      }

      const { data: studioUser, error: studioError } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (studioError || !studioUser?.studio_id) {
        console.error("Errore recupero studio_id:", studioError);
        setLoading(false);
        return;
      }

      const currentStudioId = studioUser.studio_id as string;
      setStudioId(currentStudioId);

      await loadClienti(currentStudioId);

      if (typeof id === "string" && id) {
        await loadContratto(currentStudioId, id);
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
      .select("id, ragione_sociale, nome, cognome")
      .eq("studio_id", currentStudioId)
      .order("ragione_sociale", { ascending: true });

    if (error) {
      console.error("Errore caricamento clienti:", error);
      setClienti([]);
      return;
    }

    setClienti((data as ClienteOption[]) || []);
  };

  const loadContratto = async (currentStudioId: string, recordId: string) => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tbscadaffitti")
      .select("*")
      .eq("id", recordId)
      .eq("studio_id", currentStudioId)
      .single();

    if (error || !data) {
      console.error("Errore caricamento contratto:", error);
      return;
    }

    setFormData({
      cliente_id: data.cliente_id || "",
      utente_operatore_id: data.utente_operatore_id || "",
      nominativo: data.nominativo || "",
      descrizione_immobile_locato: data.descrizione_immobile_locato || "",
      data_registrazione_atto: data.data_registrazione_atto || "",
      durata_contratto_anni: String(data.durata_contratto_anni ?? ""),
      codice_identificativo_registrazione:
        data.codice_identificativo_registrazione || "",
      importo_registrazione:
        data.importo_registrazione != null
          ? String(data.importo_registrazione)
          : "",
      contatore_anni: String(data.contatore_anni ?? 1),
      data_prossima_scadenza: data.data_prossima_scadenza || "",
      alert1_inviato: !!data.alert1_inviato,
      alert1_inviato_at: formatDateTimeLocalInput(data.alert1_inviato_at),
      alert2_inviato: !!data.alert2_inviato,
      alert2_inviato_at: formatDateTimeLocalInput(data.alert2_inviato_at),
      alert3_inviato: !!data.alert3_inviato,
      alert3_inviato_at: formatDateTimeLocalInput(data.alert3_inviato_at),
      attivo: !!data.attivo,
      contratto_concluso: !!data.contratto_concluso,
    });
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

  const handleClienteChange = async (clienteId: string) => {
    handleChange("cliente_id", clienteId);

    const clienteSelezionato = clienti.find((c) => c.id === clienteId);

    if (!clienteSelezionato) {
      setFormData((prev) => ({
        ...prev,
        cliente_id: clienteId,
        nominativo: "",
      }));
      return;
    }

    const nominativo =
      clienteSelezionato.ragione_sociale?.trim() ||
      `${clienteSelezionato.cognome || ""} ${clienteSelezionato.nome || ""}`.trim();

    setFormData((prev) => ({
      ...prev,
      cliente_id: clienteId,
      nominativo,
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

    if (!formData.nominativo.trim()) {
      alert("Il campo nominativo è obbligatorio.");
      return false;
    }

    if (!formData.data_registrazione_atto) {
      alert("La data di registrazione atto è obbligatoria.");
      return false;
    }

    if (!formData.durata_contratto_anni || Number(formData.durata_contratto_anni) < 1) {
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

      const payload = {
        studio_id: studioId,
        cliente_id: formData.cliente_id,
        utente_operatore_id: formData.utente_operatore_id || null,
        nominativo: formData.nominativo.trim(),
        descrizione_immobile_locato:
          formData.descrizione_immobile_locato.trim() || null,
        data_registrazione_atto: formData.data_registrazione_atto,
        durata_contratto_anni: Number(formData.durata_contratto_anni),
        codice_identificativo_registrazione:
          formData.codice_identificativo_registrazione.trim() || null,
        importo_registrazione: toNullableNumber(formData.importo_registrazione),
        contatore_anni: Number(formData.contatore_anni),
        data_prossima_scadenza: formData.data_prossima_scadenza,
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
      };

      if (isEdit && typeof id === "string") {
        const { error } = await supabase
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
        const { error } = await supabase.from("tbscadaffitti").insert(payload);

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
            onChange={(e) => handleClienteChange(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Seleziona cliente</option>
            {clienti.map((cliente) => {
              const label =
                cliente.ragione_sociale?.trim() ||
                `${cliente.cognome || ""} ${cliente.nome || ""}`.trim() ||
                "Senza nome";

              return (
                <option key={cliente.id} value={cliente.id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Nominativo *</label>
          <input
            type="text"
            value={formData.nominativo}
            onChange={(e) => handleChange("nominativo", e.target.value)}
            className="w-full rounded border px-3 py-2"
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
