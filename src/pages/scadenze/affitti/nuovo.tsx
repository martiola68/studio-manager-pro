import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Search } from "lucide-react";

type ClienteOption = {
  id: string;
  ragione_sociale: string | null;
};

type ContattoOption = {
  id: string;
  denominazione: string | null;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

type ContrattoFormData = {
  cliente_id: string;
  utente_operatore_id: string;
  conduttore: string;
  descrizione_immobile_locato: string;
  data_registrazione_atto: string;
  durata_contratto_anni: string;
  codice_identificativo_registrazione: string;
  importo_registrazione: string;
  emailperalert: string;
  contatore_anni: string;
  data_prossima_scadenza: string;
  alert1_data: string;
  alert2_data: string;
  alert3_data: string;
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
  conduttore: "",
  descrizione_immobile_locato: "",
  data_registrazione_atto: "",
  durata_contratto_anni: "",
  codice_identificativo_registrazione: "",
  importo_registrazione: "",
  emailperalert: "",
  contatore_anni: "",
  data_prossima_scadenza: "",
  alert1_data: "",
  alert2_data: "",
  alert3_data: "",
  alert1_inviato: false,
  alert1_inviato_at: "",
  alert2_inviato: false,
  alert2_inviato_at: "",
  alert3_inviato: false,
  alert3_inviato_at: "",
  attivo: true,
  contratto_concluso: false,
};

function addYears(dateString: string, yearsToAdd: number) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + yearsToAdd);
  return d.toISOString().slice(0, 10);
}

function subtractDays(dateString: string, days: number) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("it-IT");
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
  if (!value) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function calcolaAnnualitaCorrente(
  dataRegistrazione: string,
  durataAnni: number,
  today: Date = new Date()
) {
  if (!dataRegistrazione || !durataAnni || durataAnni < 1) {
    return {
      contatore_anni: "",
      data_prossima_scadenza: "",
      contratto_concluso: false,
      attivo: true,
    };
  }

  const oggi = new Date(today);
  oggi.setHours(0, 0, 0, 0);

  for (let annualita = 1; annualita <= durataAnni; annualita++) {
    const scadenza = addYears(dataRegistrazione, annualita - 1);
    const dataScadenza = new Date(scadenza);
    dataScadenza.setHours(0, 0, 0, 0);

    if (dataScadenza >= oggi) {
      return {
        contatore_anni: String(annualita),
        data_prossima_scadenza: scadenza,
        contratto_concluso: false,
        attivo: true,
      };
    }
  }

  return {
    contatore_anni: String(durataAnni),
    data_prossima_scadenza: addYears(dataRegistrazione, durataAnni - 1),
    contratto_concluso: true,
    attivo: false,
  };
}

function calcolaDateAlert(dataScadenza: string) {
  if (!dataScadenza) {
    return {
      alert1_data: "",
      alert2_data: "",
      alert3_data: "",
    };
  }

  return {
    alert1_data: subtractDays(dataScadenza, 30),
    alert2_data: subtractDays(dataScadenza, 15),
    alert3_data: dataScadenza,
  };
}

function getContattoLabel(contatto: ContattoOption) {
  const denominazione = contatto.denominazione?.trim();
  if (denominazione) return denominazione;

  const nominativo = `${contatto.cognome || ""} ${contatto.nome || ""}`.trim();
  if (nominativo) return nominativo;

  return contatto.email || "Contatto";
}

export default function NuovoContrattoAffittoPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studioId, setStudioId] = useState("");
  const [operatoreLabel, setOperatoreLabel] = useState("");
  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [formData, setFormData] = useState<ContrattoFormData>(emptyForm);

  const [contattiSearch, setContattiSearch] = useState("");
  const [contattiResults, setContattiResults] = useState<ContattoOption[]>([]);
  const [showContattiPicker, setShowContattiPicker] = useState(false);
  const [loadingContatti, setLoadingContatti] = useState(false);

  const isEdit = useMemo(() => typeof id === "string" && !!id, [id]);

  useEffect(() => {
    if (!router.isReady) return;
    initialize();
  }, [router.isReady, id]);

  useEffect(() => {
    if (!formData.data_registrazione_atto || !formData.durata_contratto_anni) {
      setFormData((prev) => ({
        ...prev,
        contatore_anni: "",
        data_prossima_scadenza: "",
        alert1_data: "",
        alert2_data: "",
        alert3_data: "",
      }));
      return;
    }

    const durata = Number(formData.durata_contratto_anni);
    if (!durata || Number.isNaN(durata) || durata < 1) return;

    const annualita = calcolaAnnualitaCorrente(
      formData.data_registrazione_atto,
      durata
    );

    const alerts = calcolaDateAlert(annualita.data_prossima_scadenza);

    setFormData((prev) => ({
      ...prev,
      contatore_anni: annualita.contatore_anni,
      data_prossima_scadenza: annualita.data_prossima_scadenza,
      alert1_data: alerts.alert1_data,
      alert2_data: alerts.alert2_data,
      alert3_data: alerts.alert3_data,
      attivo: annualita.attivo,
      contratto_concluso: annualita.contratto_concluso,
    }));
  }, [formData.data_registrazione_atto, formData.durata_contratto_anni]);

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
        .select("id, studio_id, nome, cognome, email")
        .eq("id", user.id)
        .single();

      if (utenteError || !utenteDb?.studio_id) {
        console.error("Errore recupero dati utente:", utenteError);
        setLoading(false);
        return;
      }

      const currentStudioId = utenteDb.studio_id as string;
      setStudioId(currentStudioId);

      const fullName = `${utenteDb.cognome || ""} ${utenteDb.nome || ""}`.trim();
      setOperatoreLabel(fullName || utenteDb.email || user.email || "");

      const { data: clientiData, error: clientiError } = await supabase
        .from("tbclienti")
        .select("id, ragione_sociale")
        .eq("studio_id", currentStudioId)
        .order("ragione_sociale", { ascending: true });

      if (clientiError) {
        console.error("Errore caricamento locatori:", clientiError);
        setClienti([]);
      } else {
        setClienti(((clientiData as unknown) as ClienteOption[]) || []);
      }

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
          const alerts = calcolaDateAlert(contratto.data_prossima_scadenza || "");

          setFormData({
            cliente_id: contratto.cliente_id || "",
            utente_operatore_id: contratto.utente_operatore_id || user.id,
            conduttore: contratto.conduttore || "",
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
            emailperalert: contratto.emailperalert || "",
            contatore_anni: String(contratto.contatore_anni ?? ""),
            data_prossima_scadenza: contratto.data_prossima_scadenza || "",
            alert1_data: alerts.alert1_data,
            alert2_data: alerts.alert2_data,
            alert3_data: alerts.alert3_data,
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
            attivo:
              typeof contratto.attivo === "boolean" ? contratto.attivo : true,
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
      console.error("Errore inizializzazione pagina:", err);
    } finally {
      setLoading(false);
    }
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

  const searchContatti = async () => {
    if (!studioId) return;

    setLoadingContatti(true);
    setShowContattiPicker(true);

    try {
      const supabase = getSupabaseClient();

      let query = supabase
        .from("tbcontatti")
        .select("id, denominazione, nome, cognome, email")
        .eq("studio_id", studioId)
        .not("email", "is", null)
        .order("denominazione", { ascending: true })
        .limit(20);

      const term = contattiSearch.trim();

      if (term) {
        query = query.or(
          `denominazione.ilike.%${term}%,nome.ilike.%${term}%,cognome.ilike.%${term}%,email.ilike.%${term}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Errore ricerca contatti:", error);
        setContattiResults([]);
        return;
      }

      setContattiResults(((data as unknown) as ContattoOption[]) || []);
    } catch (err) {
      console.error("Errore inatteso ricerca contatti:", err);
      setContattiResults([]);
    } finally {
      setLoadingContatti(false);
    }
  };

  const handleSelectContattoEmail = (email: string | null) => {
    setFormData((prev) => ({
      ...prev,
      emailperalert: email || "",
    }));
    setShowContattiPicker(false);
  };

  const validateForm = () => {
    if (!studioId) {
      alert("Studio non disponibile.");
      return false;
    }

    if (!formData.cliente_id) {
      alert("Seleziona il locatore.");
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

    if (!formData.data_prossima_scadenza) {
      alert("Impossibile determinare la prossima scadenza.");
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

      const locatoreSelezionato = clienti.find(
        (c) => c.id === formData.cliente_id
      );

      const payload = {
        studio_id: studioId,
        cliente_id: formData.cliente_id,
        utente_operatore_id: formData.utente_operatore_id || null,
        conduttore: formData.conduttore.trim() || null,
        descrizione_immobile_locato:
          formData.descrizione_immobile_locato.trim() || null,
        data_registrazione_atto: formData.data_registrazione_atto,
        durata_contratto_anni: Number(formData.durata_contratto_anni),
        codice_identificativo_registrazione:
          formData.codice_identificativo_registrazione.trim() || null,
        importo_registrazione: toNullableNumber(formData.importo_registrazione),
        emailperalert: formData.emailperalert.trim() || null,
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

        // legacy temporaneo
        nominativo: locatoreSelezionato?.ragione_sociale?.trim() || null,
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
          <label className="mb-1 block text-sm font-medium">Locatore *</label>
          <select
            value={formData.cliente_id}
            onChange={(e) => handleChange("cliente_id", e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Seleziona locatore</option>
            {clienti.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.ragione_sociale?.trim() || "Senza nome"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Conduttore</label>
          <input
            type="text"
            value={formData.conduttore}
            onChange={(e) => handleChange("conduttore", e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Operatore creatore
          </label>
          <input
            type="text"
            value={operatoreLabel}
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

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Email per alert</label>

          <div className="flex gap-2">
            <input
              type="email"
              value={formData.emailperalert}
              onChange={(e) => handleChange("emailperalert", e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Inserisci email manualmente o importa da contatti"
            />

            <button
              type="button"
              onClick={searchContatti}
              className="flex items-center gap-2 rounded border px-3 py-2"
              title="Cerca in rubrica"
            >
              <Search size={16} />
              Cerca
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={contattiSearch}
              onChange={(e) => setContattiSearch(e.target.value)}
              placeholder="Cerca contatto per nome, denominazione o email"
              className="w-full rounded border px-3 py-2"
            />

            <button
              type="button"
              onClick={searchContatti}
              className="rounded border px-3 py-2"
            >
              Trova
            </button>
          </div>

          {showContattiPicker && (
            <div className="mt-3 rounded border bg-gray-50 p-3">
              <div className="mb-2 text-sm font-medium">
                Seleziona un'email da tbcontatti
              </div>

              {loadingContatti ? (
                <div className="text-sm text-gray-600">Ricerca in corso...</div>
              ) : contattiResults.length === 0 ? (
                <div className="text-sm text-gray-600">Nessun contatto trovato</div>
              ) : (
                <div className="max-h-56 overflow-auto rounded border bg-white">
                  {contattiResults.map((contatto) => (
                    <button
                      key={contatto.id}
                      type="button"
                      onClick={() => handleSelectContattoEmail(contatto.email)}
                      className="flex w-full items-start justify-between gap-4 border-b px-3 py-2 text-left hover:bg-gray-100"
                    >
                      <div>
                        <div className="font-medium">{getContattoLabel(contatto)}</div>
                        <div className="text-sm text-gray-600">
                          {contatto.email || "-"}
                        </div>
                      </div>
                      <div className="text-xs text-blue-600">Seleziona</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Annualità corrente
          </label>
          <input
            type="text"
            value={
              formData.contatore_anni && formData.durata_contratto_anni
                ? `${formData.contatore_anni}/${formData.durata_contratto_anni}`
                : ""
            }
            readOnly
            className="w-full rounded border bg-gray-100 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Prossima scadenza
          </label>
          <input
            type="text"
            value={formatDate(formData.data_prossima_scadenza)}
            readOnly
            className="w-full rounded border bg-gray-100 px-3 py-2"
          />
        </div>
      </div>

      <div className="mt-6 rounded border bg-white p-4">
        <h2 className="mb-4 text-lg font-semibold">Alert annuali automatici</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-medium">Alert 1</div>
            <div className="text-sm text-gray-700">
              30 giorni prima: <strong>{formatDate(formData.alert1_data)}</strong>
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-medium">Alert 2</div>
            <div className="text-sm text-gray-700">
              15 giorni prima: <strong>{formatDate(formData.alert2_data)}</strong>
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-medium">Alert 3</div>
            <div className="text-sm text-gray-700">
              Giorno della scadenza:{" "}
              <strong>{formatDate(formData.alert3_data)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded border bg-white p-4">
        <h2 className="mb-4 text-lg font-semibold">Stato contratto</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Attivo</label>
            <input
              type="text"
              readOnly
              value={formData.attivo ? "Sì" : "No"}
              className="w-full rounded border bg-gray-100 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Contratto concluso
            </label>
            <input
              type="text"
              readOnly
              value={formData.contratto_concluso ? "Sì" : "No"}
              className="w-full rounded border bg-gray-100 px-3 py-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
