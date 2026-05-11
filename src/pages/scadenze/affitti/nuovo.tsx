import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { X } from "lucide-react";
import { useMasterPasswordGate } from "@/hooks/useMasterPasswordGate";
import { MasterPasswordDialog } from "@/components/security/MasterPasswordDialog";
import { runProtectedSubmit } from "@/lib/security/masterPasswordActions";
import { isEncryptionEnabled } from "@/services/encryptionService";

type ClienteOption = {
  id: string;
  ragione_sociale: string | null;
};

type ContattoOption = {
  id: string;
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
  data_rinnovo_atto: string;
  durata_contratto_anni: string;
  codice_identificativo_registrazione: string;
  importo_registrazione: string;
  canone_iniziale: string;
  perc_imposta: string;
  canone_attuale: string;
 forza_imposta: boolean;
data_invio_f24: string;
tipo_tributo: string;
  codice_tributo: string;
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
  rinnovo: boolean;
  contratto_concluso: boolean;
};

const emptyForm: ContrattoFormData = {
  cliente_id: "",
  utente_operatore_id: "",
  conduttore: "",
  descrizione_immobile_locato: "",
  data_registrazione_atto: "",
  data_rinnovo_atto: "",
  durata_contratto_anni: "",
  codice_identificativo_registrazione: "",
 importo_registrazione: "",
canone_iniziale: "",
perc_imposta: "2",
canone_attuale: "",
forza_imposta: false,
data_invio_f24: "",
tipo_tributo: "F",
codice_tributo: "1501",
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
  rinnovo: false,
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

function getYearFromDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return String(d.getFullYear());
}

function formatEuro(value?: string | null) {
  const n = toNullableNumber(value || "");
  if (n == null) return "";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
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

function formatNumberForInput(value: number) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(2);
}

function calcolaImpostaRegistro(formData: ContrattoFormData) {
  const perc = toNullableNumber(formData.perc_imposta);
  if (perc == null) return "";

  const canoneBase = toNullableNumber(formData.canone_iniziale);
  const canoneAttuale = toNullableNumber(formData.canone_attuale);

  if (canoneBase == null) return "";

  let imponibile = canoneBase;

  if (
    formData.forza_imposta &&
    canoneAttuale != null &&
    canoneAttuale > 0
  ) {
    imponibile = canoneAttuale;
  }

  return ((imponibile * perc) / 100).toFixed(2);
}

function isItalianHoliday(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const fixedHolidays = [
    "1-1",
    "1-6",
    "4-25",
    "5-1",
    "6-2",
    "8-15",
    "11-1",
    "12-8",
    "12-25",
    "12-26",
  ];

  if (fixedHolidays.includes(`${month}-${day}`)) return true;

  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

  const easterMonday = new Date(year, easterMonth - 1, easterDay);
  easterMonday.setDate(easterMonday.getDate() + 1);

  return (
    date.getFullYear() === easterMonday.getFullYear() &&
    date.getMonth() === easterMonday.getMonth() &&
    date.getDate() === easterMonday.getDate()
  );
}

function getNextWorkingDate(value?: string | null) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  d.setHours(0, 0, 0, 0);

  while (
    d.getDay() === 0 ||
    d.getDay() === 6 ||
    isItalianHoliday(d)
  ) {
    d.setDate(d.getDate() + 1);
  }

  return d.toISOString().slice(0, 10);
}

function getDecorrenzaCalcolo(formData: ContrattoFormData) {
  if (formData.rinnovo && formData.data_rinnovo_atto) {
    return formData.data_rinnovo_atto;
  }
  return formData.data_registrazione_atto;
}

function calcolaAnnualitaCorrente(
  dataDecorrenza: string,
  durataAnni: number,
  today: Date = new Date()
) {
  if (!dataDecorrenza || !durataAnni || durataAnni < 1) {
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
    const scadenza = addYears(dataDecorrenza, annualita - 1);
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
    data_prossima_scadenza: addYears(dataDecorrenza, durataAnni - 1),
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
  const fullName = `${contatto.cognome || ""} ${contatto.nome || ""}`.trim();
  if (fullName) return fullName;
  return contatto.email || "Contatto";
}

function getClienteLabel(cliente: ClienteOption) {
  return cliente.ragione_sociale?.trim() || "Cliente";
}

export default function NuovoContrattoAffittoPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studioId, setStudioId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [operatoreLabel, setOperatoreLabel] = useState("");
  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [formData, setFormData] = useState<ContrattoFormData>(emptyForm);

  const [encryptionEnabled, setEncryptionEnabled] = useState(false);

const masterPasswordGate = useMasterPasswordGate({
  studioId,
});

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailResults, setEmailResults] = useState<ContattoOption[]>([]);
  const [loadingEmailResults, setLoadingEmailResults] = useState(false);

  const [showConduttoreModal, setShowConduttoreModal] = useState(false);
  const [conduttoreSearch, setConduttoreSearch] = useState("");
  const [conduttoreResults, setConduttoreResults] = useState<ClienteOption[]>([]);
  const [loadingConduttoreResults, setLoadingConduttoreResults] = useState(false);

  const [showInvioF24Modal, setShowInvioF24Modal] = useState(false);
const [ccF24, setCcF24] = useState("");
const [sendingF24, setSendingF24] = useState(false);

  const isEdit = useMemo(() => typeof id === "string" && !!id, [id]);

  useEffect(() => {
    if (!router.isReady) return;
    initialize();
  }, [router.isReady, id]);

  useEffect(() => {
    const dataDecorrenza = getDecorrenzaCalcolo(formData);

    if (!dataDecorrenza || !formData.durata_contratto_anni) {
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

    const annualita = calcolaAnnualitaCorrente(dataDecorrenza, durata);
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
  }, [
    formData.data_registrazione_atto,
    formData.data_rinnovo_atto,
    formData.durata_contratto_anni,
    formData.rinnovo,
  ]);

useEffect(() => {
  const importoCalcolato = calcolaImpostaRegistro(formData);

  setFormData((prev) => {
    if (prev.importo_registrazione === importoCalcolato) {
      return prev;
    }

    return {
      ...prev,
      importo_registrazione: importoCalcolato,
    };
  });
}, [
  formData.canone_iniziale,
  formData.perc_imposta,
  formData.canone_attuale,
  formData.forza_imposta,
]);

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

setCurrentUserId(user.id);

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

const enabled = await isEncryptionEnabled(currentStudioId);
setEncryptionEnabled(Boolean(enabled));

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
            data_rinnovo_atto: contratto.data_rinnovo_atto || "",
            durata_contratto_anni: String(contratto.durata_contratto_anni ?? ""),
            codice_identificativo_registrazione:
              contratto.codice_identificativo_registrazione || "",
        importo_registrazione:
  contratto.importo_registrazione != null
    ? String(contratto.importo_registrazione)
    : "",
canone_iniziale:
  contratto.canone_iniziale != null ? String(contratto.canone_iniziale) : "",
perc_imposta:
  contratto.perc_imposta != null ? String(contratto.perc_imposta) : "2",
canone_attuale:
  contratto.canone_attuale != null ? String(contratto.canone_attuale) : "",
forza_imposta: !!contratto.forza_imposta,
data_invio_f24: formatDateTimeLocalInput(contratto.data_invio_f24),
tipo_tributo: contratto.tipo_tributo || "F",
codice_tributo: contratto.codice_tributo || "1501",
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
            rinnovo: !!contratto.rinnovo,
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

  const handleRinnovo = () => {
    if (!isEdit) {
      alert("Il rinnovo è disponibile solo su un contratto già salvato.");
      return;
    }

    const conferma = window.confirm(
      "Vuoi attivare il rinnovo del contratto? La data rinnovo diventerà modificabile e la durata dovrà essere reinserita."
    );
    if (!conferma) return;

    const oggi = new Date().toISOString().slice(0, 10);

    setFormData((prev) => ({
      ...prev,
      rinnovo: true,
      data_rinnovo_atto: prev.data_rinnovo_atto || oggi,
      durata_contratto_anni: "",
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
    }));
  };

  const openEmailModal = async () => {
    setShowEmailModal(true);
    await loadEmailResults("");
  };

  const openConduttoreModal = async () => {
    setShowConduttoreModal(true);
    await loadConduttoreResults("");
  };

  const loadEmailResults = async (term: string) => {
    setLoadingEmailResults(true);

    try {
      const supabase = getSupabaseClient();

      let query = supabase
        .from("tbcontatti")
        .select("id, nome, cognome, email")
        .not("email", "is", null)
        .order("cognome", { ascending: true })
        .limit(20);

      const trimmed = term.trim();

      if (trimmed) {
        query = query.or(
          `nome.ilike.%${trimmed}%,cognome.ilike.%${trimmed}%,email.ilike.%${trimmed}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Errore ricerca contatti:", error);
        setEmailResults([]);
        return;
      }

      setEmailResults(((data as unknown) as ContattoOption[]) || []);
    } catch (err) {
      console.error("Errore inatteso ricerca contatti:", err);
      setEmailResults([]);
    } finally {
      setLoadingEmailResults(false);
    }
  };

  const loadConduttoreResults = async (term: string) => {
    if (!studioId) return;

    setLoadingConduttoreResults(true);

    try {
      const supabase = getSupabaseClient();

      let query = supabase
        .from("tbclienti")
        .select("id, ragione_sociale")
        .eq("studio_id", studioId)
        .order("ragione_sociale", { ascending: true })
        .limit(20);

      if (term.trim()) {
        query = query.ilike("ragione_sociale", `%${term}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Errore ricerca conduttori:", error);
        setConduttoreResults([]);
        return;
      }

      setConduttoreResults(((data as unknown) as ClienteOption[]) || []);
    } catch (err) {
      console.error("Errore inatteso ricerca conduttori:", err);
      setConduttoreResults([]);
    } finally {
      setLoadingConduttoreResults(false);
    }
  };

  const handleSelectEmail = (email: string | null) => {
    setFormData((prev) => ({
      ...prev,
      emailperalert: email || "",
    }));
    setShowEmailModal(false);
  };

  const handleSelectConduttore = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      conduttore: value,
    }));
    setShowConduttoreModal(false);
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

    if (formData.rinnovo && !formData.data_rinnovo_atto) {
      alert("La data rinnovo atto è obbligatoria.");
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

  try {
    await runProtectedSubmit({
      encryptionEnabled,
      requireUnlock: masterPasswordGate.requireUnlock,
      action: async () => {
        setSaving(true);

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
          data_rinnovo_atto: formData.data_rinnovo_atto || null,
          durata_contratto_anni: Number(formData.durata_contratto_anni),
          codice_identificativo_registrazione:
            formData.codice_identificativo_registrazione.trim() || null,
        importo_registrazione: toNullableNumber(formData.importo_registrazione),
canone_iniziale: toNullableNumber(formData.canone_iniziale),
perc_imposta: toNullableNumber(formData.perc_imposta),
canone_attuale: toNullableNumber(formData.canone_attuale),
forza_imposta: !!formData.forza_imposta,
data_invio_f24: formData.data_invio_f24 || null,
tipo_tributo: formData.tipo_tributo.trim() || "F",
codice_tributo: formData.codice_tributo.trim() || "1501",
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
          rinnovo: !!formData.rinnovo,
          contratto_concluso: !!formData.contratto_concluso,
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
      },
    });
  } catch (err) {
    console.error("Errore salvataggio contratto:", err);
    alert("Errore inatteso durante il salvataggio.");
  } finally {
    setSaving(false);
  }
};

  const handleInviaF24 = async () => {
  if (!formData.cliente_id) {
    alert("Seleziona prima il locatore.");
    return;
  }

  if (!formData.importo_registrazione) {
    alert("Importo imposta non disponibile.");
    return;
  }

  const locatoreSelezionato = clienti.find(
    (c) => c.id === formData.cliente_id
  );

  const dataPagamento = getNextWorkingDate(formData.data_prossima_scadenza);

if (!formData.emailperalert.trim()) {
  alert("Inserisci prima l'email per alert.");
  return;
}

if (!currentUserId) {
  alert("Utente loggato non disponibile.");
  return;
}
    
 const payload = {
  contratto_id: typeof id === "string" ? id : null,
  studio_id: studioId,
  mittente_user_id: currentUserId,
  destinatario: formData.emailperalert.trim(),
  locatore: locatoreSelezionato?.ragione_sociale || "",
  conduttore: formData.conduttore,
    immobile: formData.descrizione_immobile_locato,
    codice_identificativo_registrazione:
      formData.codice_identificativo_registrazione,
    tipo_tributo: formData.tipo_tributo,
    codice_tributo: formData.codice_tributo,
    anno_riferimento: getYearFromDate(formData.data_prossima_scadenza),
    importo_registrazione: formData.importo_registrazione,
    data_scadenza: formData.data_prossima_scadenza,
    data_pagamento: dataPagamento,
    cc: ccF24,
  };

  try {
    setSendingF24(true);

    const response = await fetch("/api/scadenze/affitti/invia-f24", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      alert(result?.error || "Errore durante l’invio del fac simile F24.");
      return;
    }

    alert("Fac simile F24 inviato correttamente.");
    const nowIso = new Date().toISOString();

setFormData((prev) => ({
  ...prev,
  data_invio_f24: nowIso,
}));

if (typeof id === "string") {
  const supabase = getSupabaseClient();

  await (supabase as any)
    .from("tbscadaffitti")
    .update({
      data_invio_f24: nowIso,
    })
    .eq("id", id)
    .eq("studio_id", studioId);
}
    setShowInvioF24Modal(false);
    setCcF24("");
  } catch (err) {
    console.error("Errore invio F24:", err);
    alert("Errore inatteso durante l’invio.");
  } finally {
    setSendingF24(false);
  }
};

  const handleBack = () => {
    router.push("/scadenze/affitti");
  };

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  return (
    <>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">
            {isEdit ? "Modifica contratto di affitto" : "Nuovo contratto di affitto"}
          </h1>

          <div className="flex gap-2">
  {encryptionEnabled && (
    <button
      type="button"
      onClick={() => masterPasswordGate.setOpen(true)}
      className="rounded border px-4 py-2"
    >
      Sblocca
    </button>
  )}

  <button
    type="button"
    onClick={handleBack}
    className="rounded border px-4 py-2"
  >
    Indietro
  </button>

  <button
    type="button"
    onClick={handleRinnovo}
    className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
  >
    Rinnovo
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
    <div className="flex gap-2">
      <input
        type="text"
        value={formData.conduttore}
        onChange={(e) => handleChange("conduttore", e.target.value)}
        className="w-full rounded border px-3 py-2"
        placeholder="Inserisci manualmente o importa da tbclienti"
      />
      <button
        type="button"
        onClick={openConduttoreModal}
        className="rounded border px-3 py-2 text-blue-600 hover:text-blue-800"
      >
        Cerca
      </button>
    </div>
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

  <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-4">
    <div>
      <label className="mb-1 block text-sm font-medium">
        Canone iniziale
      </label>
      <input
        type="number"
        step="0.01"
        value={formData.canone_iniziale}
        onChange={(e) => handleChange("canone_iniziale", e.target.value)}
        className="w-full rounded border px-3 py-2"
      />
    </div>

    <div>
      <label className="mb-1 block text-sm font-medium">
        Perc. imposta
      </label>
      <input
        type="number"
        step="0.01"
        value={formData.perc_imposta}
        onChange={(e) => handleChange("perc_imposta", e.target.value)}
        className="w-full rounded border px-3 py-2"
      />
    </div>

    <div>
      <label className="mb-1 block text-sm font-medium">
        Canone attuale
      </label>
      <input
        type="number"
        step="0.01"
        value={formData.canone_attuale}
        onChange={(e) => handleChange("canone_attuale", e.target.value)}
        className="w-full rounded border px-3 py-2"
      />
    </div>

    <div>
      <label className="mb-1 block text-sm font-medium">
        Forza imposta
      </label>

      <div
        className={`flex h-[42px] items-center rounded border px-3 ${
          formData.canone_attuale ? "bg-white" : "bg-gray-100"
        }`}
      >
        <input
          type="checkbox"
          checked={formData.forza_imposta}
          disabled={
            !formData.canone_attuale ||
            Number(formData.canone_attuale) <= 0
          }
          onChange={(e) =>
            handleChange("forza_imposta", e.target.checked)
          }
          className="mr-2"
        />

        <span className="text-sm">
          {formData.forza_imposta ? "Sì" : "No"}
        </span>
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Se attivo, l’imposta viene ricalcolata sul canone attuale.
      </p>
    </div>
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

  <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-3">
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
        readOnly={formData.rinnovo}
        className={`w-full rounded border px-3 py-2 ${
          formData.rinnovo ? "bg-gray-100" : ""
        }`}
      />
    </div>

    <div>
      <label className="mb-1 block text-sm font-medium">
        Data rinnovo atto
      </label>
      <input
        type="date"
        value={formData.data_rinnovo_atto}
        onChange={(e) =>
          handleChange("data_rinnovo_atto", e.target.value)
        }
        readOnly={!formData.rinnovo}
        className={`w-full rounded border px-3 py-2 ${
          !formData.rinnovo ? "bg-gray-100" : ""
        }`}
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
  </div>

  <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-4">
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
        Imposta di registro
      </label>
      <input
        type="number"
        step="0.01"
        value={formData.importo_registrazione}
        readOnly
        className="w-full rounded border bg-gray-100 px-3 py-2"
      />
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

  <div className="md:col-span-2 rounded border bg-sky-50 p-4">
    <div className="mb-3 flex items-center justify-between bg-sky-200 px-3 py-2">
      <div className="text-sm font-bold uppercase text-white">
        Sezione Erario ed Altro
      </div>

      <button
        type="button"
        onClick={() => setShowInvioF24Modal(true)}
        className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
      >
        Invia F24 via email
      </button>
    </div>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
      <div className="md:col-span-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Tipo
        </label>
        <input
          type="text"
          value={formData.tipo_tributo}
          readOnly
          className="w-full rounded border bg-gray-100 px-2 py-2 text-center font-semibold"
        />
      </div>

      <div className="md:col-span-4">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Elementi identificativi
        </label>
        <input
          type="text"
          value={formData.codice_identificativo_registrazione}
          readOnly
          className="w-full rounded border bg-gray-100 px-2 py-2 font-semibold"
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Codice
        </label>
        <input
          type="text"
          value={formData.codice_tributo}
          readOnly
          className="w-full rounded border bg-gray-100 px-2 py-2 text-center font-semibold"
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Anno riferimento
        </label>
        <input
          type="text"
          value={getYearFromDate(formData.data_prossima_scadenza)}
          readOnly
          className="w-full rounded border bg-gray-100 px-2 py-2 text-center font-semibold"
        />
      </div>

      <div className="md:col-span-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Importi a debito versati
        </label>
        <input
          type="text"
          value={formatEuro(formData.importo_registrazione)}
          readOnly
          className="w-full rounded border bg-gray-100 px-2 py-2 text-right font-semibold"
        />
      </div>

      <div className="md:col-span-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Data scadenza
        </label>
        <input
          type="text"
          value={formatDate(getNextWorkingDate(formData.data_prossima_scadenza))}
          readOnly
          className="w-full rounded border bg-gray-100 px-2 py-2 font-semibold"
        />
      </div>

      <div className="md:col-span-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Data invio F24
        </label>
        <input
          type="text"
          value={formData.data_invio_f24 ? formatDate(formData.data_invio_f24) : "-"}
          readOnly
          className="w-full rounded border bg-gray-100 px-2 py-2 font-semibold"
        />
      </div>

      <div className="md:col-span-6">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Email per alert
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={formData.emailperalert}
            onChange={(e) => handleChange("emailperalert", e.target.value)}
            className="w-full rounded border bg-white px-2 py-2"
            placeholder="Inserisci manualmente o importa da tbcontatti"
          />
          <button
            type="button"
            onClick={openEmailModal}
            className="rounded border bg-white px-3 py-2 text-blue-600 hover:text-blue-800"
          >
            Cerca
          </button>
        </div>
      </div>
    </div>
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <label className="mb-1 block text-sm font-medium">Rinnovo</label>
              <input
                type="text"
                readOnly
                value={formData.rinnovo ? "Sì" : "No"}
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

      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-lg font-semibold">Selezione email conduttore</h3>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-gray-600 hover:text-black"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-4">
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  placeholder="Cerca per nome, cognome o email"
                  className="w-full rounded border px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => loadEmailResults(emailSearch)}
                  className="rounded border px-4 py-2 text-blue-600 hover:text-blue-800"
                >
                  Cerca
                </button>
              </div>

              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">Nominativo</th>
                      <th className="p-3 text-left">Indirizzo email</th>
                      <th className="p-3 text-left">Seleziona</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEmailResults ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center">
                          Caricamento...
                        </td>
                      </tr>
                    ) : emailResults.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center">
                          Nessun contatto trovato
                        </td>
                      </tr>
                    ) : (
                      emailResults.map((contatto) => (
                        <tr key={contatto.id} className="border-t">
                          <td className="p-3">{getContattoLabel(contatto)}</td>
                          <td className="p-3">{contatto.email || "-"}</td>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              onChange={() => handleSelectEmail(contatto.email)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConduttoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-lg font-semibold">Seleziona conduttore</h3>
              <button
                type="button"
                onClick={() => setShowConduttoreModal(false)}
                className="text-gray-600 hover:text-black"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-4">
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={conduttoreSearch}
                  onChange={(e) => setConduttoreSearch(e.target.value)}
                  placeholder="Cerca per ragione sociale"
                  className="w-full rounded border px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => loadConduttoreResults(conduttoreSearch)}
                  className="rounded border px-4 py-2 text-blue-600 hover:text-blue-800"
                >
                  Cerca
                </button>
              </div>

              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">Nominativo</th>
                      <th className="p-3 text-left">Ragione sociale</th>
                      <th className="p-3 text-left">Seleziona</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingConduttoreResults ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center">
                          Caricamento...
                        </td>
                      </tr>
                    ) : conduttoreResults.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center">
                          Nessun cliente trovato
                        </td>
                      </tr>
                    ) : (
                      conduttoreResults.map((cliente) => (
                        <tr key={cliente.id} className="border-t">
                          <td className="p-3">{getClienteLabel(cliente)}</td>
                          <td className="p-3">{getClienteLabel(cliente)}</td>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              onChange={() =>
                                handleSelectConduttore(getClienteLabel(cliente))
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInvioF24Modal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
    <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-lg font-semibold">Invio fac simile F24 Elide</h3>
        <button
          type="button"
          onClick={() => setShowInvioF24Modal(false)}
          className="text-gray-600 hover:text-black"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4">
        <p className="mb-4 text-sm text-gray-700">
          Il fac simile sarà inviato all’indirizzo indicato nel campo Email per alert:
          <strong> {formData.emailperalert || "-"}</strong>
          Puoi indicare ulteriori destinatari in conoscenza.
        </p>

        <label className="mb-1 block text-sm font-medium">
          Destinatari in conoscenza
        </label>
        <input
          type="text"
          value={ccF24}
          onChange={(e) => setCcF24(e.target.value)}
          placeholder="email1@dominio.it, email2@dominio.it"
          className="mb-4 w-full rounded border px-3 py-2"
        />

        <div className="rounded bg-gray-50 p-3 text-sm">
          <div>
            <strong>Scadenza originaria:</strong>{" "}
            {formatDate(formData.data_prossima_scadenza)}
          </div>
          <div>
            <strong>Data pagamento utile:</strong>{" "}
            {formatDate(getNextWorkingDate(formData.data_prossima_scadenza))}
          </div>
          <div>
            <strong>Importo:</strong>{" "}
            {formatEuro(formData.importo_registrazione)}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowInvioF24Modal(false)}
            className="rounded border px-4 py-2"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={handleInviaF24}
            disabled={sendingF24}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {sendingF24 ? "Invio..." : "Invia email"}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
      
      <MasterPasswordDialog
        open={masterPasswordGate.open}
        onOpenChange={masterPasswordGate.setOpen}
        password={masterPasswordGate.password}
        onPasswordChange={masterPasswordGate.setPassword}
        onUnlock={masterPasswordGate.handleUnlock}
        loading={masterPasswordGate.unlocking}
      />
    </>
  );
}
