import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import TitolariEffettiviForm from "@/components/antiriciclaggio/TitolariEffettiviForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FormStickyHeader from "@/components/antiriciclaggio/FormStickyHeader";
import { sendEmailViaMicrosoft } from "@/services/microsoftEmailService";

type FormState = {
  studio_id: string;
  cliente_id: string;
  av1_id: string;
  rapp_legale_id: string;
  microsoft_connection_id: string;
  
  dichiarante_nome_cognome: string;
  dichiarante_codice_fiscale: string;
  dichiarante_luogo_nascita: string;
  dichiarante_data_nascita: string;
  dichiarante_indirizzo_residenza: string;
  dichiarante_citta_residenza: string;
  dichiarante_cap_residenza: string;
  dichiarante_nazionalita: string;

  natura_prestazione: string;

  domanda1: boolean;
  domanda2: boolean;

  domanda3: boolean;
  domanda4: boolean;
  domanda5: boolean;
  spec_domanda5: string;

  domanda6: boolean;
  domanda7: boolean;
  domanda8: boolean;
  domanda9: boolean;

  nome_soc: string;
  sede_legale: string;
  indirizzo_sede: string;
  reg_imprese: string;
  num_reg_imprese: string;
  cod_fiscale_soc: string;

  nome_soc_bis: string;
  sede_legale_bis: string;
  indirizzo_sede_bis: string;
  reg_imprese_bis: string;
  num_reg_imprese_bis: string;
  cod_fiscale_soc_bis: string;
  nome_soc_ter: string;

  domanda10: boolean;
  domanda11: boolean;
  specifica12: string;

  specifica10b: string;
  specifica10c: string;
  specifica11c: string;

  specifica10d: string;
  specifica10e: string;
  specifica10f: string;

  luogo_firma: string;
  data_firma: string;
  luogo_firma_bis: string;
  data_firma_bis: string;

  stato: string;
  versione: number;
};

const initialFormState = (
  studioId = "",
  av1Id = "",
  clienteId = ""
): FormState => ({
  studio_id: studioId,
  cliente_id: clienteId,
  av1_id: av1Id,
  rapp_legale_id: "",
  microsoft_connection_id: "",

  dichiarante_nome_cognome: "",
  dichiarante_codice_fiscale: "",
  dichiarante_luogo_nascita: "",
  dichiarante_data_nascita: "",
  dichiarante_indirizzo_residenza: "",
  dichiarante_citta_residenza: "",
  dichiarante_cap_residenza: "",
  dichiarante_nazionalita: "",

  natura_prestazione: "",

  domanda1: false,
  domanda2: false,

  domanda3: false,
  domanda4: false,
  domanda5: false,
  spec_domanda5: "",

  domanda6: false,
  domanda7: false,
  domanda8: false,
  domanda9: false,

  nome_soc: "",
  sede_legale: "",
  indirizzo_sede: "",
  reg_imprese: "",
  num_reg_imprese: "",
  cod_fiscale_soc: "",

  nome_soc_bis: "",
  sede_legale_bis: "",
  indirizzo_sede_bis: "",
  reg_imprese_bis: "",
  num_reg_imprese_bis: "",
  cod_fiscale_soc_bis: "",
  nome_soc_ter: "",

  domanda10: false,
  domanda11: false,
  specifica12: "",

  specifica10b: "",
  specifica10c: "",
  specifica11c: "",

  specifica10d: "",
  specifica10e: "",
  specifica10f: "",

  luogo_firma: "",
  data_firma: "",
  luogo_firma_bis: "",
  data_firma_bis: "",

  stato: "bozza",
  versione: 1,
});

function normalizeDateForInput(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildClienteLabel(row: any): string {
  const parts = [
    row?.ragione_sociale,
    row?.denominazione,
    row?.cognome_nome,
    row?.nome_cognome,
    [row?.cognome, row?.nome].filter(Boolean).join(" ").trim(),
    row?.codice_fiscale,
    row?.email,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  return parts[0] || `Cliente ${row?.id ?? ""}`;
}

function mapDbRowToForm(row: any): FormState {
  return {
    studio_id: row?.studio_id ?? "",
    cliente_id: row?.cliente_id ? String(row.cliente_id) : "",
    av1_id: row?.av1_id != null ? String(row.av1_id) : "",
    rapp_legale_id: row?.rapp_legale_id ? String(row.rapp_legale_id) : "",
    microsoft_connection_id: row?.microsoft_connection_id ? String(row.microsoft_connection_id) : "",

    dichiarante_nome_cognome: row?.dichiarante_nome_cognome ?? "",
    dichiarante_codice_fiscale: row?.dichiarante_codice_fiscale ?? "",
    dichiarante_luogo_nascita: row?.dichiarante_luogo_nascita ?? "",
    dichiarante_data_nascita: normalizeDateForInput(row?.dichiarante_data_nascita),
    dichiarante_indirizzo_residenza: row?.dichiarante_indirizzo_residenza ?? "",
    dichiarante_citta_residenza: row?.dichiarante_citta_residenza ?? "",
    dichiarante_cap_residenza: row?.dichiarante_cap_residenza ?? "",
    dichiarante_nazionalita: row?.dichiarante_nazionalita ?? "",

    natura_prestazione: row?.natura_prestazione ?? "",

    domanda1: !!row?.domanda1,
    domanda2: !!row?.domanda2,
    domanda3: !!row?.domanda3,
    domanda4: !!row?.domanda4,
    domanda5: !!row?.domanda5,
    spec_domanda5: row?.spec_domanda5 ?? "",

    domanda6: !!row?.domanda6,
    domanda7: !!row?.domanda7,
    domanda8: !!row?.domanda8,
    domanda9: !!row?.domanda9,

    nome_soc: row?.nome_soc ?? "",
    sede_legale: row?.sede_legale ?? "",
    indirizzo_sede: row?.indirizzo_sede ?? "",
    reg_imprese: row?.reg_imprese ?? "",
    num_reg_imprese: row?.num_reg_imprese ?? "",
    cod_fiscale_soc: row?.cod_fiscale_soc ?? "",

    nome_soc_bis: row?.nome_soc_bis ?? "",
    sede_legale_bis: row?.sede_legale_bis ?? "",
    indirizzo_sede_bis: row?.indirizzo_sede_bis ?? "",
    reg_imprese_bis: row?.reg_imprese_bis ?? "",
    num_reg_imprese_bis: row?.num_reg_imprese_bis ?? "",
    cod_fiscale_soc_bis: row?.cod_fiscale_soc_bis ?? "",
    nome_soc_ter: row?.nome_soc_ter ?? "",

    domanda10: !!row?.domanda10,
    domanda11: !!row?.domanda11,
    specifica12: row?.specifica12 ?? "",

    specifica10b: row?.specifica10b ?? "",
    specifica10c: row?.specifica10c ?? "",
    specifica11c: row?.specifica11c ?? "",

    specifica10d: row?.specifica10d ?? "",
    specifica10e: row?.specifica10e ?? "",
    specifica10f: row?.specifica10f ?? "",

    luogo_firma: row?.luogo_firma ?? "",
    data_firma: normalizeDateForInput(row?.data_firma),
    luogo_firma_bis: row?.luogo_firma_bis ?? "",
    data_firma_bis: normalizeDateForInput(row?.data_firma_bis),

    stato: row?.stato ?? "bozza",
    versione: Number(row?.versione ?? 1),
  };
}

function normalizeId(value?: string | null): string {
  return value ? String(value).trim() : "";
}

function pickString(...values: any[]): string {
  for (const v of values) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export default function ModelloAV4() {
  const router = useRouter();

  const studioIdFromQuery =
    typeof router.query.studio_id === "string" ? router.query.studio_id : "";
  const av1IdFromQuery =
    typeof router.query.av1_id === "string" ? router.query.av1_id : "";
  const clienteIdFromQuery =
    typeof router.query.cliente_id === "string" ? router.query.cliente_id : "";
  const av4IdFromQuery =
    typeof router.query.id === "string" ? router.query.id : "";

  const [clienteLabel, setClienteLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRappresentante, setLoadingRappresentante] = useState(false);
  const [av4Id, setAv4Id] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [publicUrl, setPublicUrl] = useState("");

  const [form, setForm] = useState<FormState>(initialFormState());

  function clearRappresentanteFields() {
    setForm((prev) => ({
      ...prev,
      rapp_legale_id: "",
      microsoft_connection_id: "",
      dichiarante_nome_cognome: "",
      dichiarante_codice_fiscale: "",
      dichiarante_luogo_nascita: "",
      dichiarante_data_nascita: "",
      dichiarante_indirizzo_residenza: "",
      dichiarante_citta_residenza: "",
      dichiarante_cap_residenza: "",
      dichiarante_nazionalita: "",
    }));
  }

  async function hydrateClienteAndRappresentante(clienteId: string) {
    if (!clienteId) {
      setClienteLabel("");
      clearRappresentanteFields();
      return;
    }

    const supabase = getSupabaseClient() as any;
    setLoadingRappresentante(true);

    try {
      const { data: clienteRow, error: clienteError } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("id", clienteId)
        .single();

      if (clienteError || !clienteRow) {
        console.error("Errore caricamento cliente:", clienteError);
        setClienteLabel("");
        clearRappresentanteFields();
        return;
      }

      setClienteLabel(buildClienteLabel(clienteRow));

      const rappLegaleId =
        clienteRow?.rapp_legale_id != null
          ? String(clienteRow.rapp_legale_id).trim()
          : "";

      if (!rappLegaleId) {
        clearRappresentanteFields();
        return;
      }

      const { data: rappRow, error: rappError } = await supabase
        .from("rapp_legali")
        .select("*")
        .eq("id", rappLegaleId)
        .single();

      if (rappError || !rappRow) {
        console.error("Errore caricamento rappresentante:", rappError);
        clearRappresentanteFields();
        return;
      }

      setForm((prev) => ({
        ...prev,
        cliente_id: String(clienteId),
        rapp_legale_id: String(rappRow.id),
          microsoft_connection_id: rappRow?.microsoft_connection_id
          ? String(rappRow.microsoft_connection_id)
            : "",
        dichiarante_nome_cognome: rappRow?.nome_cognome ?? "",
        dichiarante_codice_fiscale: rappRow?.codice_fiscale ?? "",
        dichiarante_luogo_nascita: rappRow?.luogo_nascita ?? "",
        dichiarante_data_nascita: normalizeDateForInput(rappRow?.data_nascita),
        dichiarante_indirizzo_residenza: rappRow?.indirizzo_residenza ?? "",
        dichiarante_citta_residenza: rappRow?.citta_residenza ?? "",
        dichiarante_cap_residenza: rappRow?.CAP ?? "",
        dichiarante_nazionalita: rappRow?.nazionalita ?? "",
      }));
    } catch (error) {
      console.error("Errore imprevisto caricamento cliente/rappresentante:", error);
      setClienteLabel("");
      clearRappresentanteFields();
    } finally {
      setLoadingRappresentante(false);
    }
  }

  async function importaAmministratoreDaCliente() {
    if (!form.cliente_id) {
      alert("Cliente non valorizzato.");
      return;
    }

    await hydrateClienteAndRappresentante(form.cliente_id);

    const supabase = getSupabaseClient() as any;
    const { data: clienteRow } = await supabase
      .from("tbclienti")
      .select("id, rapp_legale_id")
      .eq("id", form.cliente_id)
      .single();

    const rappLegaleId =
      clienteRow?.rapp_legale_id != null
        ? String(clienteRow.rapp_legale_id).trim()
        : "";

    if (!rappLegaleId) {
      alert("Per questo cliente non risulta alcun rappresentante legale collegato.");
      return;
    }

    alert("Amministratore importato correttamente.");
  }

  async function prefillFromAV1(
    studioIdValue: string,
    av1IdValue: string,
    clienteIdValue: string
  ) {
    const supabase = getSupabaseClient() as any;

    let resolvedStudioId = studioIdValue || "";
    let resolvedClienteId = clienteIdValue || "";
    let naturaPrestazione = "";

    if (av1IdValue) {
      const { data: av1Row, error: av1Error } = await supabase
        .from("tbAV1")
        .select("*")
        .eq("id", av1IdValue)
        .single();

      if (av1Error) {
        console.error("Errore caricamento AV1:", av1Error);
      }

      if (av1Row) {
        resolvedStudioId = pickString(
          av1Row?.studio_id,
          av1Row?.StudioID,
          av1Row?.studioId,
          resolvedStudioId
        );

        resolvedClienteId = pickString(
          av1Row?.cliente_id,
          av1Row?.ClienteID,
          av1Row?.clienteId,
          clienteIdValue
        );

        naturaPrestazione = pickString(
          av1Row?.Prestazione,
          av1Row?.prestazione,
          av1Row?.natura_prestazione
        );
      }
    }

    setForm((prev) => ({
      ...prev,
      ...initialFormState(resolvedStudioId, av1IdValue, resolvedClienteId),
      studio_id: resolvedStudioId || prev.studio_id || "",
      av1_id: av1IdValue || prev.av1_id || "",
      cliente_id: resolvedClienteId || prev.cliente_id || "",
      natura_prestazione: naturaPrestazione || prev.natura_prestazione || "",
    }));

    if (resolvedClienteId) {
      await hydrateClienteAndRappresentante(resolvedClienteId);
    } else {
      setClienteLabel("");
      clearRappresentanteFields();
    }
  }

  useEffect(() => {
    if (!router.isReady || initialized) return;

    const init = async () => {
      setLoading(true);

      try {
        const supabase = getSupabaseClient() as any;
        let existingRow: any = null;

        if (av4IdFromQuery) {
          const av4IdValue = normalizeId(av4IdFromQuery);

          if (av4IdValue) {
            const { data, error } = await supabase
              .from("tbAV4")
              .select("*")
              .eq("id", av4IdValue)
              .maybeSingle();

            if (error) {
              console.error("Errore caricamento AV4 da id:", error);
            } else {
              existingRow = data || null;
            }
          }
        }

        if (!existingRow && av1IdFromQuery) {
          const { data, error } = await supabase
            .from("tbAV4")
            .select("*")
            .eq("av1_id", av1IdFromQuery)
            .maybeSingle();

          if (error) {
            console.error("Errore caricamento AV4 da av1_id:", error);
          } else {
            existingRow = data || null;
          }
        }

        if (existingRow) {
          setAv4Id(String(existingRow.id));

          const mapped = mapDbRowToForm(existingRow);
          setForm(mapped);

          if (mapped.cliente_id) {
            await hydrateClienteAndRappresentante(mapped.cliente_id);
          } else {
            setClienteLabel("");
            clearRappresentanteFields();
          }
        } else {
          await prefillFromAV1(
            studioIdFromQuery,
            av1IdFromQuery,
            clienteIdFromQuery
          );
        }
      } catch (err) {
        console.error("Errore inizializzazione AV4:", err);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    void init();
  }, [
    router.isReady,
    initialized,
    studioIdFromQuery,
    av1IdFromQuery,
    clienteIdFromQuery,
    av4IdFromQuery,
  ]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.rapp_saved === "1" && form.cliente_id) {
      void hydrateClienteAndRappresentante(form.cliente_id);
    }
  }, [router.isReady, router.query.rapp_saved, form.cliente_id]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (type === "checkbox" && name === "domanda1" && checked) {
        next.domanda2 = false;
      }
      if (type === "checkbox" && name === "domanda2" && checked) {
        next.domanda1 = false;
      }

      if (type === "checkbox" && name === "domanda3" && checked) {
        next.domanda4 = false;
        next.domanda5 = false;
        next.spec_domanda5 = "";
      }

      if (type === "checkbox" && name === "domanda4" && checked) {
        next.domanda3 = false;
        next.domanda5 = false;
        next.spec_domanda5 = "";
      }

      if (type === "checkbox" && name === "domanda5" && checked) {
        next.domanda3 = false;
        next.domanda4 = false;
      }

      if (name === "domanda5" && type === "checkbox" && !checked) {
        next.spec_domanda5 = "";
      }

      if (type === "checkbox" && name === "domanda6" && checked) {
        next.domanda7 = false;
        next.domanda8 = false;
        next.domanda9 = false;

        next.nome_soc = "";
        next.sede_legale = "";
        next.indirizzo_sede = "";
        next.reg_imprese = "";
        next.num_reg_imprese = "";
        next.cod_fiscale_soc = "";

        next.nome_soc_bis = "";
        next.sede_legale_bis = "";
        next.indirizzo_sede_bis = "";
        next.reg_imprese_bis = "";
        next.num_reg_imprese_bis = "";
        next.cod_fiscale_soc_bis = "";
        next.nome_soc_ter = "";
      }

      if (type === "checkbox" && name === "domanda7" && checked) {
        next.domanda6 = false;
        next.domanda8 = false;
        next.domanda9 = false;

        next.nome_soc = "";
        next.sede_legale = "";
        next.indirizzo_sede = "";
        next.reg_imprese = "";
        next.num_reg_imprese = "";
        next.cod_fiscale_soc = "";

        next.nome_soc_bis = "";
        next.sede_legale_bis = "";
        next.indirizzo_sede_bis = "";
        next.reg_imprese_bis = "";
        next.num_reg_imprese_bis = "";
        next.cod_fiscale_soc_bis = "";
        next.nome_soc_ter = "";
      }

      if (type === "checkbox" && name === "domanda8" && checked) {
        next.domanda6 = false;
        next.domanda7 = false;
        next.domanda9 = false;

        next.nome_soc_bis = "";
        next.sede_legale_bis = "";
        next.indirizzo_sede_bis = "";
        next.reg_imprese_bis = "";
        next.num_reg_imprese_bis = "";
        next.cod_fiscale_soc_bis = "";
        next.nome_soc_ter = "";
      }

      if (type === "checkbox" && name === "domanda9" && checked) {
        next.domanda6 = false;
        next.domanda7 = false;
        next.domanda8 = false;

        next.nome_soc = "";
        next.sede_legale = "";
        next.indirizzo_sede = "";
        next.reg_imprese = "";
        next.num_reg_imprese = "";
        next.cod_fiscale_soc = "";
      }

      if (name === "domanda8" && type === "checkbox" && !checked) {
        next.nome_soc = "";
        next.sede_legale = "";
        next.indirizzo_sede = "";
        next.reg_imprese = "";
        next.num_reg_imprese = "";
        next.cod_fiscale_soc = "";
      }

      if (name === "domanda9" && type === "checkbox" && !checked) {
        next.nome_soc_bis = "";
        next.sede_legale_bis = "";
        next.indirizzo_sede_bis = "";
        next.reg_imprese_bis = "";
        next.num_reg_imprese_bis = "";
        next.cod_fiscale_soc_bis = "";
        next.nome_soc_ter = "";
      }

      if (type === "checkbox" && name === "domanda10" && checked) {
        next.domanda11 = false;
        next.specifica12 = "";
      }

      if (type === "checkbox" && name === "domanda11" && checked) {
        next.domanda10 = false;
      }

      if (name === "domanda11" && type === "checkbox" && !checked) {
        next.specifica12 = "";
      }

      return next;
    });
  }

  function validateBeforeSave() {
    if (!form.av1_id) {
      alert("Manca av1_id.");
      return false;
    }

    if (!form.studio_id) {
      alert("Studio non valorizzato: impossibile salvare AV4.");
      return false;
    }

    if (!form.cliente_id) {
      alert("Cliente non valorizzato.");
      return false;
    }

    if (!form.rapp_legale_id) {
      alert("Per il cliente selezionato non risulta un rappresentante collegato.");
      return false;
    }

    return true;
  }

  function handleChiudiModello() {
    router.push("/antiriciclaggio");
  }

  function handlePrint() {
    if (!av4Id) {
      alert("Salva prima l'AV4, poi potrai stamparlo.");
      return;
    }
    router.push(`/antiriciclaggio/stampa-av4?id=${av4Id}`);
  }

async function handleInvioPubblico() {
  if (!av4Id) {
    alert("Salva prima l'AV4.");
    return;
  }

  if (!form.studio_id) {
    alert("Studio non valorizzato.");
    return;
  }

if (!form.rapp_legale_id) {
  alert("Rappresentante legale non valorizzato.");
  return;
}

if (!form.microsoft_connection_id) {
  alert("Connessione Microsoft non valorizzata per il rappresentante selezionato.");
  return;
}

  const supabase = getSupabaseClient() as any;

  let token = "";
  let url = "";
  let destinatario = "";
  let nomeDestinatario = "Cliente";
  let userId: string | null = null;
  const subject = "Compilazione Modello AV4";

  try {
    setLoading(true);

    token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const updatePayload: any = {
      public_token: token,
      public_enabled: true,
      public_sent_at: new Date().toISOString(),
      compilato_da_cliente: false,
    };

    // Riattiva questa riga SOLO se il nome colonna è esatto nel DB
    // updatePayload.av4_inviato_cl = true;

    const { error: updateError } = await supabase
      .from("tbAV4")
      .update(updatePayload)
      .eq("id", av4Id);

    if (updateError) {
      console.error("Errore aggiornamento AV4 pubblico:", updateError);
      alert(
        `Errore durante la generazione del link pubblico: ${updateError.message || "update tbAV4 fallito"}`
      );
      return;
    }

    url = `${window.location.origin}/public/av4/${token}`;
    setPublicUrl(url);

    const { data: rappRow, error: rappError } = await supabase
      .from("rapp_legali")
      .select("email, nome_cognome")
      .eq("id", form.rapp_legale_id)
      .single();

    if (rappError) {
      console.error("Errore recupero email rappresentante:", rappError);
      alert(
        `Link pubblico generato, ma non è stato possibile recuperare l'email del rappresentante legale: ${rappError.message}\n${url}`
      );
      return;
    }

    destinatario = rappRow?.email?.trim() || "";
    nomeDestinatario = rappRow?.nome_cognome?.trim() || "Cliente";

    if (!destinatario) {
      alert(
        `Link pubblico generato, ma il rappresentante legale non ha un indirizzo email valorizzato.\n${url}`
      );
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    userId = session?.user?.id ?? null;

    if (!userId) {
      alert(
        `Link pubblico generato, ma non è stato possibile identificare l'utente mittente.\n${url}`
      );
      return;
    }

 await sendEmailViaMicrosoft(userId, {
  microsoftConnectionId: form.microsoft_connection_id,
  to: destinatario,
  subject,
  html: `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.6;">
      <p>Gentile ${nomeDestinatario},</p>

          <p>può compilare il <strong>Modello AV4</strong> tramite il seguente collegamento riservato:</p>

          <p>
            <a href="${url}" target="_blank">${url}</a>
          </p>

          <p><strong>Istruzioni rapide:</strong></p>
          <ol style="padding-left: 18px;">
            <li>apra il link;</li>
            <li>compili i dati richiesti;</li>
            <li>salvi o stampi il PDF;</li>
            <li>firmi il documento;</li>
            <li>ricarichi il PDF firmato;</li>
            <li>clicchi su "Salva e chiudi".</li>
          </ol>

          <p>⚠️ Il link sarà disattivato dopo l’invio.</p>

          <p>Cordiali saluti,<br/>Studio Manager Pro</p>
        </div>
      `,
    });

    const { error: logError } = await supabase.from("tbAMLComunicazioni").insert({
      studio_id: form.studio_id,
      tipo_comunicazione: "invio_av4",
      cliente_id: form.cliente_id || null,
      rapp_legale_id: form.rapp_legale_id || null,
      av4_id: av4Id,
      destinatario_email: destinatario,
      oggetto: subject,
      body_preview: `Invio AV4 a ${destinatario}. Link pubblico: ${url}`,
      stato_invio: "inviata",
      data_invio: new Date().toISOString(),
      utente_id: userId,
      public_token: token,
      note: "Invio AV4 al cliente da modello AV4",
    });

    if (logError) {
      console.error("Errore salvataggio log tbAMLComunicazioni AV4:", logError);
      alert(
        `Email AV4 inviata a ${destinatario}, ma il log comunicazioni non è stato salvato: ${logError.message}`
      );
      return;
    }

    alert(`Link pubblico generato e email inviata correttamente a ${destinatario}.`);
  } catch (error: any) {
    console.error("Errore invio pubblico AV4:", error);

    try {
      if (form.studio_id && av4Id) {
        await supabase.from("tbAMLComunicazioni").insert({
          studio_id: form.studio_id,
          tipo_comunicazione: "invio_av4",
          cliente_id: form.cliente_id || null,
          rapp_legale_id: form.rapp_legale_id || null,
          av4_id: av4Id,
          destinatario_email: destinatario || null,
          oggetto: subject,
          body_preview: `Errore invio AV4 a ${destinatario || "-"}.`,
          stato_invio: "errore",
          data_invio: new Date().toISOString(),
          utente_id: userId,
          public_token: token || null,
          note: error?.message || "Errore durante invio pubblico AV4",
        });
      }
    } catch (logError) {
      console.error("Errore salvataggio log errore tbAMLComunicazioni AV4:", logError);
    }

    alert(
      `Errore durante la generazione del link pubblico: ${error?.message || "errore sconosciuto"}`
    );
  } finally {
    setLoading(false);
  }
}

function normalizeCf(value: string) {
  return (value || "").trim().toUpperCase();
}

function normalizeText(value: string) {
  return (value || "").trim().toUpperCase();
}

function validaCodiceFiscale(cf: string) {
  const value = (cf || "").trim().toUpperCase();
  if (!value) return false;

  return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(value);
}

async function caricaTitolariSezione(sezione: "domanda7" | "domanda8" | "domanda9") {
  if (!av4Id) return [];

  const supabase = getSupabaseClient() as any;

  const { data, error } = await supabase
    .from("tbAV4_titolari")
    .select("*")
    .eq("av4_id", av4Id)
    .eq("sezione", sezione);

  if (error) {
    throw new Error(`Errore caricamento titolari ${sezione}.`);
  }

  return data || [];
}

async function validaTitolariPrimaDelSalvataggio() {
  const sezioniDaControllare: Array<"domanda7" | "domanda8" | "domanda9"> = [];

  if (form.domanda7) sezioniDaControllare.push("domanda7");
  if (form.domanda8) sezioniDaControllare.push("domanda8");
  if (form.domanda9) sezioniDaControllare.push("domanda9");

  for (const sezione of sezioniDaControllare) {
    const titolari = await caricaTitolariSezione(sezione);

    for (let i = 0; i < titolari.length; i++) {
      const titolare = titolari[i];

      if (!titolare?.codice_fiscale || !String(titolare.codice_fiscale).trim()) {
        throw new Error(
          `Codice fiscale obbligatorio per il titolare effettivo #${i + 1} della sezione ${sezione}.`
        );
      }

      if (!validaCodiceFiscale(String(titolare.codice_fiscale))) {
        throw new Error(
          `Codice fiscale non valido per il titolare effettivo "${titolare.nome_cognome || `#${i + 1}`}" della sezione ${sezione}.`
        );
      }

      if (isDuplicateTitolare(titolari, titolare, i)) {
        throw new Error(
          `Titolare effettivo duplicato nella sezione ${sezione}: "${titolare.nome_cognome || titolare.codice_fiscale}".`
        );
      }
    }
  }
}
  
function isDuplicateTitolare(
  titolari: any[],
  candidato: any,
  currentIndex?: number
) {
  const cf = normalizeCf(candidato.codice_fiscale);

  // 🔴 BLOCCO CF OBBLIGATORIO
  if (!cf) {
    throw new Error("Il codice fiscale è obbligatorio per il titolare effettivo.");
  }

  return titolari.some((t, index) => {
    if (currentIndex !== undefined && index === currentIndex) return false;

    const cfT = normalizeCf(t.codice_fiscale);

    return cfT && cfT === cf;
  });
}
  
 async function salvaAV4() {
  if (!validateBeforeSave()) return;

  const supabase = getSupabaseClient() as any;

  try {
    setLoading(true);

    await validaTitolariPrimaDelSalvataggio();

      const payload = {
        studio_id: form.studio_id,
        cliente_id: form.cliente_id,
        av1_id: Number(form.av1_id),
        rapp_legale_id: form.rapp_legale_id || null,
        // microsoft_connection_id: form.microsoft_connection_id || null,

        dichiarante_nome_cognome: form.dichiarante_nome_cognome || null,
        dichiarante_codice_fiscale: form.dichiarante_codice_fiscale || null,
        dichiarante_luogo_nascita: form.dichiarante_luogo_nascita || null,
        dichiarante_data_nascita: form.dichiarante_data_nascita || null,
        dichiarante_indirizzo_residenza: form.dichiarante_indirizzo_residenza || null,
        dichiarante_citta_residenza: form.dichiarante_citta_residenza || null,
        dichiarante_cap_residenza: form.dichiarante_cap_residenza || null,
        dichiarante_nazionalita: form.dichiarante_nazionalita || null,

        natura_prestazione: form.natura_prestazione || null,

        domanda1: !!form.domanda1,
        domanda2: !!form.domanda2,
        domanda3: !!form.domanda3,
        domanda4: !!form.domanda4,
        domanda5: !!form.domanda5,
        spec_domanda5: form.spec_domanda5 || null,

        domanda6: !!form.domanda6,
        domanda7: !!form.domanda7,
        domanda8: !!form.domanda8,
        domanda9: !!form.domanda9,

        nome_soc: form.nome_soc || null,
        sede_legale: form.sede_legale || null,
        indirizzo_sede: form.indirizzo_sede || null,
        reg_imprese: form.reg_imprese || null,
        num_reg_imprese: form.num_reg_imprese || null,
        cod_fiscale_soc: form.cod_fiscale_soc || null,

        nome_soc_bis: form.nome_soc_bis || null,
        sede_legale_bis: form.sede_legale_bis || null,
        indirizzo_sede_bis: form.indirizzo_sede_bis || null,
        reg_imprese_bis: form.reg_imprese_bis || null,
        num_reg_imprese_bis: form.num_reg_imprese_bis || null,
        cod_fiscale_soc_bis: form.cod_fiscale_soc_bis || null,
        nome_soc_ter: form.nome_soc_ter || null,

        domanda10: !!form.domanda10,
        domanda11: !!form.domanda11,
        specifica12: form.specifica12 || null,

        specifica10b: form.specifica10b || null,
        specifica10c: form.specifica10c || null,
        specifica11c: form.specifica11c || null,

        specifica10d: form.specifica10d || null,
        specifica10e: form.specifica10e || null,
        specifica10f: form.specifica10f || null,

        luogo_firma: form.luogo_firma || null,
        data_firma: form.data_firma || null,
        luogo_firma_bis: form.luogo_firma_bis || null,
        data_firma_bis: form.data_firma_bis || null,

        stato: form.stato,
        versione: form.versione,
      };

      let savedId: string | null = av4Id;

      if (av4Id) {
        const { error } = await supabase
          .from("tbAV4")
          .update(payload)
          .eq("id", av4Id);

        if (error) {
          console.error("Errore aggiornamento AV4:", error);
          alert("Errore durante l'aggiornamento AV4.");
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("tbAV4")
          .insert([payload])
          .select("id")
          .single();

        if (error) {
          console.error("Errore salvataggio AV4:", error);
          alert("Errore durante il salvataggio AV4.");
          return;
        }

        savedId = String(data.id);
        setAv4Id(savedId);
      }

      alert("AV4 salvato correttamente.");

      if (savedId) {
        await router.replace(
          `/antiriciclaggio/modello-av4?studio_id=${form.studio_id}&av1_id=${form.av1_id}&cliente_id=${form.cliente_id}&id=${savedId}`
        );
      }
    } catch (error) {
      console.error("Errore imprevisto salvataggio AV4:", error);
      alert("Errore durante il salvataggio AV4.");
    } finally {
      setLoading(false);
    }
  }

const noteAllegato = `Allegato alla Dichiarazione del Cliente

(Nota 1)
Per “riciclaggio” (art. 2, co. 4 e 5, d.lgs. 231/2007) si intende:
a) la conversione o il trasferimento di beni, effettuati essendo a conoscenza che essi provengono da un’attività criminosa o da una partecipazione a tale attività, allo scopo di occultare o dissimulare l’origine illecita dei beni medesimi o di aiutare chiunque sia coinvolto in tale attività a sottrarsi alle conseguenze giuridiche delle proprie azioni;
b) l’occultamento o la dissimulazione della reale natura, provenienza, ubicazione, disposizione, movimento, proprietà dei beni o dei diritti sugli stessi, effettuati essendo a conoscenza che tali beni provengono da un’attività criminosa o da una partecipazione a tale attività;
c) l’acquisto, la detenzione o l’utilizzazione di beni essendo a conoscenza, al momento della loro ricezione, che tali beni provengono da un’attività criminosa o da una partecipazione a tale attività;
d) la partecipazione ad uno degli atti di cui alle lettere a), b) e c), l’associazione per commettere tale atto, il tentativo di perpetrarlo, il fatto di aiutare, istigare o consigliare qualcuno a commetterlo o il fatto di agevolarne l’esecuzione.

Il riciclaggio è considerato tale anche se le attività che hanno generato i beni da riciclare si sono svolte fuori dai confini nazionali. La conoscenza, l’intenzione o la finalità possono essere dedotte da circostanze di fatto obiettive.

Per “finanziamento al terrorismo” si intende qualsiasi attività diretta, con ogni mezzo, alla fornitura, alla raccolta, alla provvista, all'intermediazione, al deposito, alla custodia o all'erogazione di fondi e risorse economiche utilizzabili per finalità di terrorismo (art. 2, co. 6, d.lgs. 231/2007).

Per “finanziamento dei programmi di proliferazione delle armi di distruzione di massa” si intende la fornitura o raccolta di fondi e risorse economiche finalizzate allo sviluppo di armi nucleari, chimiche o biologiche (art. 1, lett. e), d.lgs. 109/2007).

(Nota 2)
Ai sensi dell’art. 55, co. 3, del d.lgs. 231/2007, chi fornisce dati falsi o informazioni non veritiere è punito con reclusione da sei mesi a tre anni e multa da 10.000 a 30.000 euro.

(Nota 3)
Per “persone politicamente esposte” si intendono soggetti con importanti cariche pubbliche, i loro familiari e soggetti con legami stretti (art. 1, co. 2, lett. dd, d.lgs. 231/2007).

(Nota 4)
Per “titolare effettivo” si intende la persona fisica cui è attribuibile in ultima istanza la proprietà o il controllo del cliente (art. 1, co. 2, lett. pp, d.lgs. 231/2007).

Art. 20 d.lgs. 231/2007:
Il titolare effettivo è individuato sulla base di proprietà (>25%), controllo o, in ultima istanza, poteri di rappresentanza/amministrazione.
1. Il titolare effettivo di clienti diversi dalle persone fisiche coincide con la persona fisica o le persone fisiche cui, in ultima istanza, è attribuibile la proprietà diretta o indiretta dell'ente ovvero il relativo controllo.
2. Nel caso in cui il cliente sia una società di capitali: a) costituisce indicazione di proprietà diretta la titolarità di una partecipazione superiore al 25 per cento del capitale del cliente, detenuta da una persona fisica; b) costituisce indicazione di proprietà indiretta la titolarità di una percentuale di partecipazioni superiore al 25 per cento del capitale del cliente, posseduto per il tramite di società controllate, società fiduciarie o per interposta persona.
3. Nelle ipotesi in cui l’esame dell'assetto proprietario non consenta di individuare in maniera univoca la persona fisica o le persone fisiche cui è attribuibile la proprietà diretta o indiretta dell’ente, il titolare effettivo coincide con la persona fisica o le persone fisiche cui, in ultima istanza, è attribuibile il controllo del medesimo in forza: a) del controllo della maggioranza dei voti esercitabili in assemblea ordinaria; b) del controllo di voti sufficienti per esercitare un'influenza dominante in assemblea ordinaria; c) dell'esistenza di particolari vincoli contrattuali che consentano di esercitare un’influenza dominante.
4. Nel caso in cui il cliente sia una persona giuridica privata, di cui al decreto del Presidente della Repubblica 10 febbraio 2000, n. 361, sono cumulativamente individuati, come titolari effettivi: a) i fondatori, ove in vita; b) i beneficiari, quando individuati o facilmente individuabili; c) i titolari di funzioni di rappresentanza legale, direzione e amministrazione.
5. Qualora l’applicazione dei criteri di cui ai precedenti commi non consenta di individuare univocamente uno o più titolari effettivi, il titolare effettivo coincide con la persona fisica o le persone fisiche titolari conformemente ai rispettivi assetti organizzativi o statutari, di poteri di rappresentanza legale, amministrazione o direzione della società o del cliente comunque diverso dalla persona fisica.
6. I soggetti obbligati conservano traccia delle verifiche effettuate ai fini dell'individuazione del titolare effettivo nonché, con specifico riferimento al titolare effettivo individuato ai sensi del comma 5, delle ragioni che non hanno consentito di individuare il titolare effettivo ai sensi dei commi 1, 2, 3 e 4 del presente articolo.
`;
  
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background">
<FormStickyHeader
  title="Modello AV4"
  subtitle="Dichiarazione del Cliente"
  onSave={salvaAV4}
  onPrint={handlePrint}
  onClose={handleChiudiModello}
  onSendToClient={handleInvioPubblico}
  showSendToClient
  sendToClientDisabled={!av4Id || loading}
  saving={loading}
/>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 pb-32 pt-4 md:px-8 md:pb-40 md:pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Dati principali</CardTitle>
              </CardHeader>

              <CardContent>
                <p className="mb-6 text-sm leading-6 text-gray-700">
                  In ottemperanza alle disposizioni dell’art. 22 del D.Lgs. 231/2007
                  (obblighi del cliente in materia di prevenzione e contrasto al
                  riciclaggio/FDT come da Nota 1 e 2 dell’Allegato alla presente
                  Dichiarazione) e successive modifiche e integrazioni, fornisco le
                  sottostanti informazioni, assumendomi tutte le responsabilità di natura
                  civile, amministrativa e penale per dichiarazioni non veritiere.
                </p>

                <div className="space-y-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Cliente</label>
                    <input
                      value={clienteLabel || "Cliente non valorizzato da AV1"}
                      className="w-full rounded-md border bg-gray-50 px-3 py-2"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Rappresentante collegato al cliente
                    </label>
                    <input
                      value={
                        loadingRappresentante
                          ? "Caricamento rappresentante..."
                          : form.dichiarante_nome_cognome || "Nessun rappresentante collegato"
                      }
                      className="w-full rounded-md border bg-gray-50 px-3 py-2"
                      readOnly
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Il rappresentante viene recuperato automaticamente da
                      <strong> tbclienti.rapp_legale_id </strong>
                      e caricato dalla tabella
                      <strong> rapp_legali</strong>.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={importaAmministratoreDaCliente}
                      disabled={!form.cliente_id || loadingRappresentante}
                      className="rounded bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {loadingRappresentante
                        ? "Importazione..."
                        : "Importa amministratore"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!form.cliente_id) {
                          alert("Cliente non valorizzato.");
                          return;
                        }

                        const query = new URLSearchParams({
                          from: "av4",
                          cliente_id: form.cliente_id,
                          av1_id: form.av1_id,
                          av4_id: av4Id || "",
                          returnTo: `/antiriciclaggio/modello-av4?studio_id=${form.studio_id}&av1_id=${form.av1_id}&cliente_id=${form.cliente_id}&id=${av4Id || ""}`,
                        });

                        router.push(`/antiriciclaggio/rappresentanti/nuovo?${query.toString()}`);
                      }}
                      className="rounded bg-green-600 px-4 py-2 text-white shadow hover:bg-green-700"
                    >
                      Nuovo rappresentante
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Cognome e nome</label>
                      <input
                        name="dichiarante_nome_cognome"
                        value={form.dichiarante_nome_cognome}
                        onChange={handleChange}
                        className="w-full rounded-md border bg-gray-50 px-3 py-2"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Codice fiscale</label>
                      <input
                        name="dichiarante_codice_fiscale"
                        value={form.dichiarante_codice_fiscale}
                        onChange={handleChange}
                        className="w-full rounded-md border bg-gray-50 px-3 py-2"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Luogo di nascita</label>
                      <input
                        name="dichiarante_luogo_nascita"
                        value={form.dichiarante_luogo_nascita}
                        onChange={handleChange}
                        className="w-full rounded-md border bg-gray-50 px-3 py-2"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Data di nascita</label>
                      <input
                        value={
                          form.dichiarante_data_nascita
                            ? new Date(form.dichiarante_data_nascita).toLocaleDateString("it-IT")
                            : ""
                        }
                        className="w-full rounded-md border bg-gray-50 px-3 py-2"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Indirizzo residenza</label>
                      <input
                        name="dichiarante_indirizzo_residenza"
                        value={form.dichiarante_indirizzo_residenza}
                        onChange={handleChange}
                        className="w-full rounded-md border bg-gray-50 px-3 py-2"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Città residenza</label>
                      <input
                        name="dichiarante_citta_residenza"
                        value={form.dichiarante_citta_residenza}
                        onChange={handleChange}
                        className="w-full rounded-md border bg-gray-50 px-3 py-2"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">CAP residenza</label>
                      <input
                        name="dichiarante_cap_residenza"
                        value={form.dichiarante_cap_residenza}
                        onChange={handleChange}
                        className="w-full rounded-md border bg-gray-50 px-3 py-2"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Nazionalità</label>
                      <input
                        name="dichiarante_nazionalita"
                        value={form.dichiarante_nazionalita}
                        onChange={handleChange}
                        className="w-full rounded-md border bg-gray-50 px-3 py-2"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Dichiarazioni del cliente</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-6">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="domanda1"
                        checked={form.domanda1}
                        onChange={handleChange}
                      />
                      Dati di nascita e residenza come da documento di identificazione allegato
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="domanda2"
                        checked={form.domanda2}
                        onChange={handleChange}
                      />
                      Domicilio diverso rispetto al documento di identificazione allegato
                    </label>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Che, ai sensi dell’art.18, comma 1, lettera c), D.Lgs. 231/2007, lo scopo e la natura
                      della prestazione professionale richiesta sono
                    </label>
                    <textarea
                      name="natura_prestazione"
                      value={form.natura_prestazione}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2"
                      rows={4}
                    />
                  </div>

                  <div className="font-semibold">Persona politicamente esposta</div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="domanda3"
                        checked={form.domanda3}
                        onChange={handleChange}
                      />
                      di non costituire persona politicamente esposta (estera o nazionale), ai sensi
                      dell’art. 1, comma 2, lettera dd), del D.Lgs. 231/2007 oppure
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="domanda4"
                        checked={form.domanda4}
                        onChange={handleChange}
                      />
                      di non rivestire lo status di PPE da più di un anno
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="domanda5"
                        checked={form.domanda5}
                        onChange={handleChange}
                      />
                      di costituire persona politicamente esposta estera o nazionale, ai sensi
                      dell’art. 1, comma 2, lettera dd), del D.Lgs. 231/2007
                    </label>
                  </div>

                  {form.domanda5 && (
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Specificare carica pubblica, nome e legame con il titolare della carica pubblica
                      </label>
                      <textarea
                        name="spec_domanda5"
                        value={form.spec_domanda5}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        rows={3}
                      />
                    </div>
                  )}

                  <div className="text-sm leading-6 text-gray-700">
                    - ai fini dell’identificazione del Titolare Effettivo di cui all’art. 1, comma 2,
                    lettera pp) e ai criteri per la determinazione della titolarità effettiva di clienti
                    diversi dalle persone fisiche di cui all’art. 20 del D.Lgs. 231/2007, consapevole
                    delle sanzioni penali previste dall’art. 55 del D.Lgs. 231/2007 nel caso di falsa
                    indicazione delle generalità del soggetto per conto del quale eventualmente viene
                    eseguita l’operazione, dichiara:
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="domanda6"
                        checked={form.domanda6}
                        onChange={handleChange}
                      />
                      di agire in proprio e, quindi, l’inesistenza di un diverso titolare effettivo così
                      come previsto e definito dal D.Lgs. 231/2007
                    </label>
                  </div>

               <div>
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      name="domanda7"
      checked={form.domanda7}
      onChange={handleChange}
    />
    di agire per conto dei seguenti titolari effettivi
  </label>
</div>

{form.domanda7 && (
  <div className="rounded-lg border p-4">
    <TitolariEffettiviForm
      sezione="domanda7"
      av4_id={av4Id || ""}
      studio_id={form.studio_id}
      cliente_id={form.cliente_id}
    />
  </div>
)}

<div>
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      name="domanda8"
      checked={form.domanda8}
      onChange={handleChange}
    />
    di agire per conto della società/ente
  </label>
</div>

{form.domanda8 && (
  <div className="space-y-4 rounded-lg border p-4">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium">Nome società / ente</label>
        <input
          name="nome_soc"
          value={form.nome_soc}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Sede legale</label>
        <input
          name="sede_legale"
          value={form.sede_legale}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Indirizzo sede</label>
        <input
          name="indirizzo_sede"
          value={form.indirizzo_sede}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Registro imprese</label>
        <input
          name="reg_imprese"
          value={form.reg_imprese}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Numero registro imprese</label>
        <input
          name="num_reg_imprese"
          value={form.num_reg_imprese}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Codice fiscale società</label>
        <input
          name="cod_fiscale_soc"
          value={form.cod_fiscale_soc}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
    </div>

    <div className="text-sm">
      in qualità di legale rappresentante, munito dei necessari poteri, e attesta che il/i titolare/i effettivi sono:
    </div>

    {av4Id && (
      <div className="rounded-lg border p-4">
        <TitolariEffettiviForm
          sezione="domanda8"
          av4_id={av4Id}
          studio_id={form.studio_id}
          cliente_id={form.cliente_id}
        />
      </div>
    )}
  </div>
)}

<div>
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      name="domanda9"
      checked={form.domanda9}
      onChange={handleChange}
    />
    (caso residuale, in assenza di controllo o partecipazioni rilevanti) di agire per conto della società/ente
  </label>
</div>

{form.domanda9 && (
  <div className="space-y-4 rounded-lg border p-4">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium">Nome società / ente</label>
        <input
          name="nome_soc_bis"
          value={form.nome_soc_bis}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Sede legale</label>
        <input
          name="sede_legale_bis"
          value={form.sede_legale_bis}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Indirizzo sede</label>
        <input
          name="indirizzo_sede_bis"
          value={form.indirizzo_sede_bis}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Registro imprese</label>
        <input
          name="reg_imprese_bis"
          value={form.reg_imprese_bis}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Numero registro imprese</label>
        <input
          name="num_reg_imprese_bis"
          value={form.num_reg_imprese_bis}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Codice fiscale società</label>
        <input
          name="cod_fiscale_soc_bis"
          value={form.cod_fiscale_soc_bis}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-sm font-medium">
          Denominazione società per art. 20, comma 4
        </label>
        <input
          name="nome_soc_ter"
          value={form.nome_soc_ter}
          onChange={handleChange}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
    </div>

    <div className="text-sm">
      in qualità di legale rappresentante, munito dei necessari poteri, e attesta che ai sensi dell’articolo 20, comma 4, D.Lgs. 231/2007, i titolari effettivi sono:
    </div>

    {av4Id && (
      <div className="rounded-lg border p-4">
        <TitolariEffettiviForm
          sezione="domanda9"
          av4_id={av4Id}
          studio_id={form.studio_id}
          cliente_id={form.cliente_id}
        />
      </div>
    )}
  </div>
)}
                  <div className="font-semibold">PPE titolari effettivi</div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="domanda10"
                        checked={form.domanda10}
                        onChange={handleChange}
                      />
                      che il/i titolare/i effettivo/i non costituisce/costituiscono persona/e politicamente esposta/e
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="domanda11"
                        checked={form.domanda11}
                        onChange={handleChange}
                      />
                      che il/i titolari effettivi costituisce/costituiscono persona/e politicamente esposte estere o nazionali
                    </label>
                  </div>

                  {form.domanda11 && (
                    <div>
                      <label className="mb-1 block text-sm font-medium">Specifica PPE titolari effettivi</label>
                      <textarea
                        name="specifica12"
                        value={form.specifica12}
                        onChange={handleChange}
                        className="w-full rounded-md border px-3 py-2"
                        rows={3}
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Che le relazioni intercorrenti tra il Cliente e il titolare effettivo nonché, ove rilevi, l’esecutore sono
                    </label>
                    <textarea
                      name="specifica10b"
                      value={form.specifica10b}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Che la provenienza dei fondi utilizzati nell’operazione è
                    </label>
                    <textarea
                      name="specifica10c"
                      value={form.specifica10c}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Che i mezzi di pagamento forniti dal Cliente al professionista sono
                    </label>
                    <textarea
                      name="specifica11c"
                      value={form.specifica11c}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2"
                      rows={3}
                    />
                  </div>

                  <div className="text-sm leading-6 text-gray-700">
                    Che i medesimi fondi e le risorse economiche eventualmente utilizzati non provengono né sono destinati a un’attività criminosa o al finanziamento del terrorismo di cui all’art. 2, co. 6, del D.Lgs. 231/2007.
                  </div>

                  <div className="font-semibold">Professione / attività del cliente</div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Che la professione/attività del cliente è la seguente
                    </label>
                    <input
                      name="specifica10d"
                      value={form.specifica10d}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Esercitata / svolta dal</label>
                    <input
                      name="specifica10e"
                      value={form.specifica10e}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Nell’ambito territoriale</label>
                    <input
                      name="specifica10f"
                      value={form.specifica10f}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Firma</CardTitle>
              </CardHeader>

              <CardContent>
               <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>
    <label className="mb-1 block text-sm font-medium">Luogo</label>
    <input
      name="luogo_firma"
      value={form.luogo_firma}
      onChange={handleChange}
      className="w-full rounded-md border px-3 py-2"
    />
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium">Data</label>
    <input
      type="date"
      name="data_firma"
      value={form.data_firma}
      onChange={handleChange}
      className="w-full rounded-md border px-3 py-2"
    />
  </div>

  <div className="md:col-span-2 mt-2">
    <div className="mx-auto max-w-md pt-8 text-center">
      <div className="mx-auto mb-2 h-px w-full bg-black" />
      <div className="text-sm italic">Firma Cliente o Esecutore</div>
    </div>
  </div>

 <div className="md:col-span-2 mt-4 whitespace-pre-line text-xs leading-5 text-gray-700">
  {noteAllegato}
</div>
                 
  <div>
    <label className="mb-1 block text-sm font-medium">Luogo</label>
    <input
      name="luogo_firma_bis"
      value={form.luogo_firma_bis}
      onChange={handleChange}
      className="w-full rounded-md border px-3 py-2"
    />
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium">Data</label>
    <input
      type="date"
      name="data_firma_bis"
      value={form.data_firma_bis}
      onChange={handleChange}
      className="w-full rounded-md border px-3 py-2"
    />
  </div>

  <div className="md:col-span-2 mt-2">
    <div className="mx-auto max-w-md pt-8 text-center">
      <div className="mx-auto mb-2 h-px w-full bg-black" />
      <div className="text-sm italic">Firma Cliente o Esecutore</div>
    </div>
  </div>

  {av4Id && (
    <div className="md:col-span-2">
      <p className="text-sm text-green-700">
        AV4 salvato. ID pratica: {av4Id}
      </p>
    </div>
  )}

  {publicUrl && (
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-medium">Link pubblico AV4</label>
      <input
        value={publicUrl}
        readOnly
        className="w-full rounded-md border bg-gray-50 px-3 py-2 text-sm"
      />
    </div>
  )}

  <div className="md:col-span-2">
    <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-700">
      Usa i pulsanti in alto a destra per <strong>salvare</strong>,{" "}
      <strong>stampare</strong> o <strong>chiudere</strong> il modello.
    </div>
  </div>
</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
