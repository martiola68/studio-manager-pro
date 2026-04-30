import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Processo = {
  id: string;
  numero_atto: string | null;
  anno_riferimento: number | null;
  data_ricezione: string | null;
  data_scadenza: string | null;
  descrizione: string | null;
  valore_pratica: number | null;
  esito: string | null;
  tbclienti?: { ragione_sociale: string | null } | null;
  tbcontenzioso_tipi_atto?: { descrizione: string | null } | null;
  tbcontenzioso_tributi_constatazione?: { descrizione: string | null } | null;
};

type Scadenza = {
  id: string;
  modulo: string;
  descrizione: string;
  data_scadenza: string;
  giorni_residui: number | null;
  stato: string;
};

type PvcForm = {
  id?: string;
  processo_id: string;
  data_notifica_pvc: string;
  data_effettiva_osservazioni: string;
  data_incarico_parere: string;
  data_parere: string;
  data_incarico_interpello: string;
  data_interpello: string;
};

type SchemaAttoForm = {
  id?: string;
  processo_id: string;
  data_notifica_schema: string;
  data_effettiva_osservazioni: string;
  data_emissione_atto_definitivo: string;
  note: string;
};

type AdesioneForm = {
  id?: string;
  processo_id: string;
  data_notifica_atto: string;
  data_presentazione_istanza: string;
  data_invito_ufficio: string;
  data_incontro: string;
  data_sottoscrizione_adesione: string;
  esito: string;
  note: string;
};

type InterpelloForm = {
  id?: string;
  processo_id: string;
  tipo_interpello: string;
  data_incarico: string;
  data_presentazione: string;
  data_richiesta_integrazione: string;
  data_invio_integrazione: string;
  data_risposta: string;
  esito: string;
  note: string;
};

type PrimoGradoForm = {
  id?: string;
  processo_id: string;
  data_notifica_atto: string;
  data_notifica_ricorso: string;
  data_costituzione_ricorrente: string;
  data_costituzione_resistente: string;
  data_udienza: string;
  data_deposito_documenti: string;
  data_deposito_memorie: string;
  data_deposito_repliche: string;
  data_sentenza: string;
  note: string;
};

type SecondoGradoForm = {
  id?: string;
  processo_id: string;
  data_notifica_sentenza_primo_grado: string;
  data_deposito_sentenza_primo_grado: string;
  data_notifica_appello: string;
  data_costituzione_appellante: string;
  data_costituzione_appellato: string;
  data_udienza: string;
  data_sentenza_secondo_grado: string;
  note: string;
};

type CassazioneForm = {
  id?: string;
  processo_id: string;
  data_notifica_sentenza_secondo_grado: string;
  data_deposito_sentenza_secondo_grado: string;
  data_notifica_ricorso_cassazione: string;
  data_deposito_ricorso_cassazione: string;
  data_notifica_controricorso: string;
  data_udienza_o_adunanza: string;
  data_sentenza_ordinanza: string;
  esito: string;
  note: string;
};

const initialPvcForm: PvcForm = {
  processo_id: "",
  data_notifica_pvc: "",
  data_effettiva_osservazioni: "",
  data_incarico_parere: "",
  data_parere: "",
  data_incarico_interpello: "",
  data_interpello: "",
};

const initialSchemaAttoForm: SchemaAttoForm = {
  processo_id: "",
  data_notifica_schema: "",
  data_effettiva_osservazioni: "",
  data_emissione_atto_definitivo: "",
  note: "",
};

const initialAdesioneForm: AdesioneForm = {
  processo_id: "",
  data_notifica_atto: "",
  data_presentazione_istanza: "",
  data_invito_ufficio: "",
  data_incontro: "",
  data_sottoscrizione_adesione: "",
  esito: "",
  note: "",
};

const initialInterpelloForm: InterpelloForm = {
  processo_id: "",
  tipo_interpello: "ordinario",
  data_incarico: "",
  data_presentazione: "",
  data_richiesta_integrazione: "",
  data_invio_integrazione: "",
  data_risposta: "",
  esito: "",
  note: "",
};

const initialPrimoGradoForm: PrimoGradoForm = {
  processo_id: "",
  data_notifica_atto: "",
  data_notifica_ricorso: "",
  data_costituzione_ricorrente: "",
  data_costituzione_resistente: "",
  data_udienza: "",
  data_deposito_documenti: "",
  data_deposito_memorie: "",
  data_deposito_repliche: "",
  data_sentenza: "",
  note: "",
};

const initialSecondoGradoForm: SecondoGradoForm = {
  processo_id: "",
  data_notifica_sentenza_primo_grado: "",
  data_deposito_sentenza_primo_grado: "",
  data_notifica_appello: "",
  data_costituzione_appellante: "",
  data_costituzione_appellato: "",
  data_udienza: "",
  data_sentenza_secondo_grado: "",
  note: "",
};

const initialCassazioneForm: CassazioneForm = {
  processo_id: "",
  data_notifica_sentenza_secondo_grado: "",
  data_deposito_sentenza_secondo_grado: "",
  data_notifica_ricorso_cassazione: "",
  data_deposito_ricorso_cassazione: "",
  data_notifica_controricorso: "",
  data_udienza_o_adunanza: "",
  data_sentenza_ordinanza: "",
  esito: "",
  note: "",
};

export default function DettaglioAtto() {
  const router = useRouter();
  const { id } = router.query;

  const [processo, setProcesso] = useState<Processo | null>(null);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");

  const [pvcAttivo, setPvcAttivo] = useState(false);
  const [schemaAttoAttivo, setSchemaAttoAttivo] = useState(false);
  const [adesioneAttivo, setAdesioneAttivo] = useState(false);
  const [interpelloAttivo, setInterpelloAttivo] = useState(false);
  const [primoGradoAttivo, setPrimoGradoAttivo] = useState(false);
  const [secondoGradoAttivo, setSecondoGradoAttivo] = useState(false);
  const [cassazioneAttivo, setCassazioneAttivo] = useState(false);

  const [pvcForm, setPvcForm] = useState<PvcForm>(initialPvcForm);
  const [schemaAttoForm, setSchemaAttoForm] =
    useState<SchemaAttoForm>(initialSchemaAttoForm);
  const [adesioneForm, setAdesioneForm] =
    useState<AdesioneForm>(initialAdesioneForm);
  const [interpelloForm, setInterpelloForm] =
    useState<InterpelloForm>(initialInterpelloForm);
  const [primoGradoForm, setPrimoGradoForm] =
    useState<PrimoGradoForm>(initialPrimoGradoForm);
  const [secondoGradoForm, setSecondoGradoForm] =
    useState<SecondoGradoForm>(initialSecondoGradoForm);
  const [cassazioneForm, setCassazioneForm] =
  useState<CassazioneForm>(initialCassazioneForm);

  const [moduliAttivi, setModuliAttivi] = useState({
    pvc: false,
    schemaAtto: false,
    adesione: false,
    interpello: false,
    primoGrado: false,
    secondoGrado: false,
    cassazione: false,
  });

  const [form, setForm] = useState({
    numero_atto: "",
    anno_riferimento: "",
    data_ricezione: "",
    data_scadenza: "",
    descrizione: "",
    valore_pratica: "",
    esito: "",
  });

  useEffect(() => {
    if (id) {
      loadData(String(id));
    }
  }, [id]);

  const formatDateIT = (date?: string | null) => {
    if (!date) return "-";
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}/${mm}/${yyyy}`;
  };

  const addDays = (dateString: string, days: number) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  const subDays = (dateString: string, days: number) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    date.setDate(date.getDate() - days);
    return date.toISOString().split("T")[0];
  };

  const addMonths = (dateString: string, months: number) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split("T")[0];
  };

  const getColor = (giorni: number | null) => {
    if (giorni === null || giorni === undefined) return "bg-gray-500 text-white";
    if (giorni <= 5) return "bg-red-600 text-white";
    if (giorni <= 10) return "bg-orange-500 text-white";
    return "bg-green-600 text-white";
  };

  const getFaseColor = (attivo: boolean) => {
    return attivo
      ? "border-green-300 bg-green-50 text-green-800"
      : "border-gray-200 bg-gray-50 text-gray-500";
  };

  const dataScadenzaAdesionePvc = pvcForm.data_notifica_pvc
    ? addDays(pvcForm.data_notifica_pvc, 30)
    : "";

  const dataScadenzaOsservazioniPvc = pvcForm.data_notifica_pvc
    ? addDays(pvcForm.data_notifica_pvc, 60)
    : "";

  const dataScadenzaOsservazioniSchemaAtto =
    schemaAttoForm.data_notifica_schema
      ? addDays(schemaAttoForm.data_notifica_schema, 60)
      : "";

  const dataScadenzaRicorsoOrdinaria = adesioneForm.data_notifica_atto
    ? addDays(adesioneForm.data_notifica_atto, 60)
    : "";

  const dataScadenzaSospensioneAdesione =
    adesioneForm.data_presentazione_istanza
      ? addDays(adesioneForm.data_presentazione_istanza, 90)
      : "";

  const dataScadenzaRicorsoConAdesione = adesioneForm.data_notifica_atto
    ? adesioneForm.data_presentazione_istanza
      ? addDays(adesioneForm.data_notifica_atto, 150)
      : addDays(adesioneForm.data_notifica_atto, 60)
    : "";

  const dataScadenzaPagamentoAdesione =
    adesioneForm.data_sottoscrizione_adesione
      ? addDays(adesioneForm.data_sottoscrizione_adesione, 20)
      : "";

  const giorniRispostaInterpello =
    interpelloForm.tipo_interpello === "ordinario" ||
    interpelloForm.tipo_interpello === "qualificatorio"
      ? 90
      : 120;

  const dataScadenzaRispostaInterpello = interpelloForm.data_presentazione
    ? addDays(interpelloForm.data_presentazione, giorniRispostaInterpello)
    : "";

  const dataScadenzaRispostaPostIntegrazione =
    interpelloForm.data_invio_integrazione
      ? addDays(interpelloForm.data_invio_integrazione, 60)
      : "";

  const dataScadenzaRicorsoPrimoGrado = primoGradoForm.data_notifica_atto
    ? addDays(primoGradoForm.data_notifica_atto, 60)
    : "";

  const dataScadenzaCostituzioneRicorrente =
    primoGradoForm.data_notifica_ricorso
      ? addDays(primoGradoForm.data_notifica_ricorso, 30)
      : "";

  const dataScadenzaDocumentiPrimo = primoGradoForm.data_udienza
    ? subDays(primoGradoForm.data_udienza, 20)
    : "";

  const dataScadenzaMemoriePrimo = primoGradoForm.data_udienza
    ? subDays(primoGradoForm.data_udienza, 10)
    : "";

  const dataScadenzaReplichePrimo = primoGradoForm.data_udienza
    ? subDays(primoGradoForm.data_udienza, 5)
    : "";

  const dataScadenzaAppelloBreve =
    secondoGradoForm.data_notifica_sentenza_primo_grado
      ? addDays(secondoGradoForm.data_notifica_sentenza_primo_grado, 60)
      : "";

  const dataScadenzaAppelloLungo =
    secondoGradoForm.data_deposito_sentenza_primo_grado
      ? addMonths(secondoGradoForm.data_deposito_sentenza_primo_grado, 6)
      : "";

  const dataScadenzaCostituzioneAppellante =
    secondoGradoForm.data_notifica_appello
      ? addDays(secondoGradoForm.data_notifica_appello, 30)
      : "";

  const dataScadenzaDocumentiSecondo = secondoGradoForm.data_udienza
    ? subDays(secondoGradoForm.data_udienza, 20)
    : "";

  const dataScadenzaMemorieSecondo = secondoGradoForm.data_udienza
    ? subDays(secondoGradoForm.data_udienza, 10)
    : "";

  const dataScadenzaReplicheSecondo = secondoGradoForm.data_udienza
    ? subDays(secondoGradoForm.data_udienza, 5)
    : "";

  const dataScadenzaRicorsoCassazioneBreve =
  cassazioneForm.data_notifica_sentenza_secondo_grado
    ? addDays(cassazioneForm.data_notifica_sentenza_secondo_grado, 60)
    : "";

const dataScadenzaRicorsoCassazioneLungo =
  cassazioneForm.data_deposito_sentenza_secondo_grado
    ? addMonths(cassazioneForm.data_deposito_sentenza_secondo_grado, 6)
    : "";

const dataMemoriaCassazione = cassazioneForm.data_udienza_o_adunanza
  ? subDays(cassazioneForm.data_udienza_o_adunanza, 10)
  : "";

  const loadData = async (processoId: string) => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");
    setMessaggio("");

    const { data: processoData, error: processoError } = await (supabase as any)
      .from("tbcontenzioso_processo")
      .select(`
        *,
        tbclienti:cliente_id(ragione_sociale),
        tbcontenzioso_tipi_atto:tipo_atto_id(descrizione),
        tbcontenzioso_tributi_constatazione:tributo_constatazione_id(descrizione)
      `)
      .eq("id", processoId)
      .single();

    if (processoError) {
      console.error(processoError);
      setErrore("Errore nel caricamento dell'atto.");
      setLoading(false);
      return;
    }

    const processo = processoData as Processo;

    setProcesso(processo);
    setForm({
      numero_atto: processo.numero_atto || "",
      anno_riferimento: processo.anno_riferimento
        ? String(processo.anno_riferimento)
        : "",
      data_ricezione: processo.data_ricezione || "",
      data_scadenza: processo.data_scadenza || "",
      descrizione: processo.descrizione || "",
      valore_pratica:
        processo.valore_pratica !== null && processo.valore_pratica !== undefined
          ? String(processo.valore_pratica)
          : "",
      esito: processo.esito || "",
    });

    const { data: scadenzeData } = await (supabase as any)
      .from("tbcontenzioso_scadenze_generate")
      .select("*")
      .eq("processo_id", processoId)
      .order("data_scadenza", { ascending: true });

    const { data: pvcData } = await (supabase as any)
      .from("tbcontenzioso_pvc")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    const { data: schemaData } = await (supabase as any)
      .from("tbcontenzioso_schema_atto")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    const { data: adesioneData } = await (supabase as any)
      .from("tbcontenzioso_adesione")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    const { data: interpelloData } = await (supabase as any)
      .from("tbcontenzioso_interpello")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    const { data: primoData } = await (supabase as any)
      .from("tbcontenzioso_ricorso_primo_grado")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

    const { data: secondoData } = await (supabase as any)
      .from("tbcontenzioso_ricorso_secondo_grado")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();

   const { data: cassazioneData } = await (supabase as any)
  .from("tbcontenzioso_cassazione")
  .select("*")
  .eq("processo_id", processoId)
  .maybeSingle();
    
    setPvcAttivo(!!pvcData);
    setPvcForm(
      pvcData
        ? {
            id: pvcData.id,
            processo_id: pvcData.processo_id,
            data_notifica_pvc: pvcData.data_notifica_pvc || "",
            data_effettiva_osservazioni:
              pvcData.data_effettiva_osservazioni || "",
            data_incarico_parere: pvcData.data_incarico_parere || "",
            data_parere: pvcData.data_parere || "",
            data_incarico_interpello:
              pvcData.data_incarico_interpello || "",
            data_interpello: pvcData.data_interpello || "",
          }
        : {
            ...initialPvcForm,
            processo_id: processoId,
            data_notifica_pvc: processo.data_ricezione || "",
          }
    );

    setSchemaAttoAttivo(!!schemaData);
    setSchemaAttoForm(
      schemaData
        ? {
            id: schemaData.id,
            processo_id: schemaData.processo_id,
            data_notifica_schema: schemaData.data_notifica_schema || "",
            data_effettiva_osservazioni:
              schemaData.data_effettiva_osservazioni || "",
            data_emissione_atto_definitivo:
              schemaData.data_emissione_atto_definitivo || "",
            note: schemaData.note || "",
          }
        : {
            ...initialSchemaAttoForm,
            processo_id: processoId,
            data_notifica_schema: processo.data_ricezione || "",
          }
    );

    setAdesioneAttivo(!!adesioneData);
    setAdesioneForm(
      adesioneData
        ? {
            id: adesioneData.id,
            processo_id: adesioneData.processo_id,
            data_notifica_atto: adesioneData.data_notifica_atto || "",
            data_presentazione_istanza:
              adesioneData.data_presentazione_istanza || "",
            data_invito_ufficio: adesioneData.data_invito_ufficio || "",
            data_incontro: adesioneData.data_incontro || "",
            data_sottoscrizione_adesione:
              adesioneData.data_sottoscrizione_adesione || "",
            esito: adesioneData.esito || "",
            note: adesioneData.note || "",
          }
        : {
            ...initialAdesioneForm,
            processo_id: processoId,
            data_notifica_atto: processo.data_ricezione || "",
          }
    );

    setInterpelloAttivo(!!interpelloData);
    setInterpelloForm(
      interpelloData
        ? {
            id: interpelloData.id,
            processo_id: interpelloData.processo_id,
            tipo_interpello: interpelloData.tipo_interpello || "ordinario",
            data_incarico: interpelloData.data_incarico || "",
            data_presentazione: interpelloData.data_presentazione || "",
            data_richiesta_integrazione:
              interpelloData.data_richiesta_integrazione || "",
            data_invio_integrazione:
              interpelloData.data_invio_integrazione || "",
            data_risposta: interpelloData.data_risposta || "",
            esito: interpelloData.esito || "",
            note: interpelloData.note || "",
          }
        : {
            ...initialInterpelloForm,
            processo_id: processoId,
          }
    );

    setPrimoGradoAttivo(!!primoData);
    setPrimoGradoForm(
      primoData
        ? {
            id: primoData.id,
            processo_id: primoData.processo_id,
            data_notifica_atto: primoData.data_notifica_atto || "",
            data_notifica_ricorso: primoData.data_notifica_ricorso || "",
            data_costituzione_ricorrente:
              primoData.data_costituzione_ricorrente || "",
            data_costituzione_resistente:
              primoData.data_costituzione_resistente || "",
            data_udienza: primoData.data_udienza || "",
            data_deposito_documenti: primoData.data_deposito_documenti || "",
            data_deposito_memorie: primoData.data_deposito_memorie || "",
            data_deposito_repliche: primoData.data_deposito_repliche || "",
            data_sentenza: primoData.data_sentenza || "",
            note: primoData.note || "",
          }
        : {
            ...initialPrimoGradoForm,
            processo_id: processoId,
            data_notifica_atto: processo.data_ricezione || "",
          }
    );

    setSecondoGradoAttivo(!!secondoData);
    setSecondoGradoForm(
      secondoData
        ? {
            id: secondoData.id,
            processo_id: secondoData.processo_id,
            data_notifica_sentenza_primo_grado:
              secondoData.data_notifica_sentenza_primo_grado || "",
            data_deposito_sentenza_primo_grado:
              secondoData.data_deposito_sentenza_primo_grado || "",
            data_notifica_appello: secondoData.data_notifica_appello || "",
            data_costituzione_appellante:
              secondoData.data_costituzione_appellante || "",
            data_costituzione_appellato:
              secondoData.data_costituzione_appellato || "",
            data_udienza: secondoData.data_udienza || "",
            data_sentenza_secondo_grado:
              secondoData.data_sentenza_secondo_grado || "",
            note: secondoData.note || "",
          }
        : {
            ...initialSecondoGradoForm,
            processo_id: processoId,
          }
    );

    setCassazioneAttivo(!!cassazioneData);
setCassazioneForm(
  cassazioneData
    ? {
        id: cassazioneData.id,
        processo_id: cassazioneData.processo_id,
        data_notifica_sentenza_secondo_grado:
          cassazioneData.data_notifica_sentenza_secondo_grado || "",
        data_deposito_sentenza_secondo_grado:
          cassazioneData.data_deposito_sentenza_secondo_grado || "",
        data_notifica_ricorso_cassazione:
          cassazioneData.data_notifica_ricorso_cassazione || "",
        data_deposito_ricorso_cassazione:
          cassazioneData.data_deposito_ricorso_cassazione || "",
        data_notifica_controricorso:
          cassazioneData.data_notifica_controricorso || "",
        data_udienza_o_adunanza:
          cassazioneData.data_udienza_o_adunanza || "",
        data_sentenza_ordinanza:
          cassazioneData.data_sentenza_ordinanza || "",
        esito: cassazioneData.esito || "",
        note: cassazioneData.note || "",
      }
    : {
        ...initialCassazioneForm,
        processo_id: processoId,
      }
);

    setModuliAttivi({
      pvc: !!pvcData,
      schemaAtto: !!schemaData,
      adesione: !!adesioneData,
      interpello: !!interpelloData,
      primoGrado: !!primoData,
      secondoGrado: !!secondoData,
      cassazione: !!cassazioneData,
    });

    setScadenze((scadenzeData || []) as Scadenza[]);
    setLoading(false);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveTable = async (
    table: string,
    recordId: string | undefined,
    payload: Record<string, any>,
    successMessage: string
  ) => {
    if (!processo) return;

    const supabase = getSupabaseClient();

    setSaving(true);
    setErrore("");
    setMessaggio("");

    const res = recordId
      ? await (supabase as any).from(table).update(payload).eq("id", recordId)
      : await (supabase as any).from(table).insert(payload).select("id").single();

    if (res.error) {
      console.error(res.error);
      setErrore(res.error.message || "Errore durante il salvataggio.");
      setSaving(false);
      return;
    }

    setMessaggio(successMessage);
    await loadData(processo.id);
    setSaving(false);
  };

  const deletePhase = async (
    table: string,
    recordId: string | undefined,
    modulo: string
  ) => {
    if (!processo || !recordId) return;

    const conferma = window.confirm(
      "Vuoi eliminare questa fase e le relative scadenze?"
    );

    if (!conferma) return;

    const supabase = getSupabaseClient();

    setSaving(true);
    setErrore("");
    setMessaggio("");

    await (supabase as any)
      .from("tbcontenzioso_scadenze_generate")
      .delete()
      .eq("processo_id", processo.id)
      .eq("modulo", modulo);

    const { error } = await (supabase as any)
      .from(table)
      .delete()
      .eq("id", recordId);

    if (error) {
      console.error(error);
      setErrore(error.message || "Errore durante l'eliminazione della fase.");
      setSaving(false);
      return;
    }

    setMessaggio("Fase eliminata correttamente.");
    await loadData(processo.id);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!processo) return;

    await saveTable(
      "tbcontenzioso_processo",
      processo.id,
      {
        numero_atto: form.numero_atto || null,
        anno_riferimento: form.anno_riferimento
          ? Number(form.anno_riferimento)
          : null,
        data_ricezione: form.data_ricezione || null,
        data_scadenza: form.data_scadenza || null,
        descrizione: form.descrizione || null,
        valore_pratica: form.valore_pratica ? Number(form.valore_pratica) : null,
        esito: form.esito || null,
      },
      "Atto salvato correttamente."
    );
  };

  const handleSavePvc = async () => {
    if (!processo) return;

    if (!pvcForm.data_notifica_pvc) {
      setErrore("Inserisci la data notifica PVC.");
      return;
    }

    await saveTable(
      "tbcontenzioso_pvc",
      pvcForm.id,
      {
        processo_id: processo.id,
        data_notifica_pvc: pvcForm.data_notifica_pvc || null,
        data_effettiva_osservazioni:
          pvcForm.data_effettiva_osservazioni || null,
        data_incarico_parere: pvcForm.data_incarico_parere || null,
        data_parere: pvcForm.data_parere || null,
        data_incarico_interpello: pvcForm.data_incarico_interpello || null,
        data_interpello: pvcForm.data_interpello || null,
      },
      "PVC salvato correttamente."
    );
  };

  const handleSaveSchemaAtto = async () => {
    if (!processo) return;

    if (!schemaAttoForm.data_notifica_schema) {
      setErrore("Inserisci la data notifica schema d'atto.");
      return;
    }

    await saveTable(
      "tbcontenzioso_schema_atto",
      schemaAttoForm.id,
      {
        processo_id: processo.id,
        data_notifica_schema: schemaAttoForm.data_notifica_schema || null,
        data_effettiva_osservazioni:
          schemaAttoForm.data_effettiva_osservazioni || null,
        data_emissione_atto_definitivo:
          schemaAttoForm.data_emissione_atto_definitivo || null,
        note: schemaAttoForm.note || null,
      },
      "Schema d'atto salvato correttamente."
    );
  };

  const handleSaveAdesione = async () => {
    if (!processo) return;

    await saveTable(
      "tbcontenzioso_adesione",
      adesioneForm.id,
      {
        processo_id: processo.id,
        data_notifica_atto: adesioneForm.data_notifica_atto || null,
        data_presentazione_istanza:
          adesioneForm.data_presentazione_istanza || null,
        data_invito_ufficio: adesioneForm.data_invito_ufficio || null,
        data_incontro: adesioneForm.data_incontro || null,
        data_sottoscrizione_adesione:
          adesioneForm.data_sottoscrizione_adesione || null,
        esito: adesioneForm.esito || null,
        note: adesioneForm.note || null,
      },
      "Accertamento con adesione salvato correttamente."
    );
  };

  const handleSaveInterpello = async () => {
    if (!processo) return;

    await saveTable(
      "tbcontenzioso_interpello",
      interpelloForm.id,
      {
        processo_id: processo.id,
        tipo_interpello: interpelloForm.tipo_interpello || "ordinario",
        data_incarico: interpelloForm.data_incarico || null,
        data_presentazione: interpelloForm.data_presentazione || null,
        data_richiesta_integrazione:
          interpelloForm.data_richiesta_integrazione || null,
        data_invio_integrazione:
          interpelloForm.data_invio_integrazione || null,
        data_risposta: interpelloForm.data_risposta || null,
        esito: interpelloForm.esito || null,
        note: interpelloForm.note || null,
      },
      "Interpello salvato correttamente."
    );
  };

  const handleSavePrimoGrado = async () => {
    if (!processo) return;

    await saveTable(
      "tbcontenzioso_ricorso_primo_grado",
      primoGradoForm.id,
      {
        processo_id: processo.id,
        data_notifica_atto: primoGradoForm.data_notifica_atto || null,
        data_notifica_ricorso: primoGradoForm.data_notifica_ricorso || null,
        data_costituzione_ricorrente:
          primoGradoForm.data_costituzione_ricorrente || null,
        data_costituzione_resistente:
          primoGradoForm.data_costituzione_resistente || null,
        data_udienza: primoGradoForm.data_udienza || null,
        data_deposito_documenti:
          primoGradoForm.data_deposito_documenti || null,
        data_deposito_memorie: primoGradoForm.data_deposito_memorie || null,
        data_deposito_repliche: primoGradoForm.data_deposito_repliche || null,
        data_sentenza: primoGradoForm.data_sentenza || null,
        note: primoGradoForm.note || null,
      },
      "Ricorso 1° grado salvato correttamente."
    );
  };

  const handleSaveSecondoGrado = async () => {
    if (!processo) return;

    await saveTable(
      "tbcontenzioso_ricorso_secondo_grado",
      secondoGradoForm.id,
      {
        processo_id: processo.id,
        data_notifica_sentenza_primo_grado:
          secondoGradoForm.data_notifica_sentenza_primo_grado || null,
        data_deposito_sentenza_primo_grado:
          secondoGradoForm.data_deposito_sentenza_primo_grado || null,
        data_notifica_appello: secondoGradoForm.data_notifica_appello || null,
        data_costituzione_appellante:
          secondoGradoForm.data_costituzione_appellante || null,
        data_costituzione_appellato:
          secondoGradoForm.data_costituzione_appellato || null,
        data_udienza: secondoGradoForm.data_udienza || null,
        data_sentenza_secondo_grado:
          secondoGradoForm.data_sentenza_secondo_grado || null,
        note: secondoGradoForm.note || null,
      },
      "Ricorso 2° grado salvato correttamente."
    );
  };

  const handleSaveCassazione = async () => {
  if (!processo) return;

  await saveTable(
    "tbcontenzioso_cassazione",
    cassazioneForm.id,
    {
      processo_id: processo.id,
      data_notifica_sentenza_secondo_grado:
        cassazioneForm.data_notifica_sentenza_secondo_grado || null,
      data_deposito_sentenza_secondo_grado:
        cassazioneForm.data_deposito_sentenza_secondo_grado || null,
      data_notifica_ricorso_cassazione:
        cassazioneForm.data_notifica_ricorso_cassazione || null,
      data_deposito_ricorso_cassazione:
        cassazioneForm.data_deposito_ricorso_cassazione || null,
      data_notifica_controricorso:
        cassazioneForm.data_notifica_controricorso || null,
      data_udienza_o_adunanza:
        cassazioneForm.data_udienza_o_adunanza || null,
      data_sentenza_ordinanza:
        cassazioneForm.data_sentenza_ordinanza || null,
      esito: cassazioneForm.esito || null,
      note: cassazioneForm.note || null,
    },
    "Cassazione salvata correttamente."
  );
};

  const canActivatePhase = (fase: string) => {
  if (fase === "schemaAtto" && !moduliAttivi.pvc) {
    alert("Devi prima salvare la fase PVC.");
    return false;
  }

  if (fase === "adesione" && !moduliAttivi.schemaAtto) {
    alert("Devi prima salvare la fase Schema d’atto.");
    return false;
  }

  if (fase === "interpello" && !moduliAttivi.pvc) {
    alert("Devi prima salvare la fase PVC.");
    return false;
  }

  if (fase === "primoGrado" && !moduliAttivi.adesione) {
    alert("Devi prima salvare la fase Accertamento con adesione.");
    return false;
  }

  if (fase === "secondoGrado" && !moduliAttivi.primoGrado) {
    alert("Devi prima salvare la fase Ricorso 1° grado.");
    return false;
  }

  if (fase === "cassazione" && !moduliAttivi.secondoGrado) {
    alert("Devi prima salvare la fase Ricorso 2° grado.");
    return false;
  }

  return true;
};

const handleTogglePhase = (
  checked: boolean,
  hasSavedData: boolean,
  fase: string,
  setAttivo: (value: boolean) => void
) => {
  if (!checked && hasSavedData) {
    alert("Questa fase contiene dati salvati. Usa il pulsante Elimina fase per rimuoverla.");
    return;
  }

  if (checked && !canActivatePhase(fase)) {
    return;
  }

  setAttivo(checked);
};

  if (loading) {
    return <div className="p-6">Caricamento pratica...</div>;
  }

  if (errore && !processo) {
    return <div className="p-6 text-red-600">{errore}</div>;
  }

  if (!processo) {
    return <div className="p-6">Pratica non trovata.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
<div className="mb-6 rounded-xl border border-slate-200 bg-slate-100 p-5">
  <div className="flex items-center justify-between">
    
    <div>
      <h1 className="text-lg font-semibold text-slate-900">
        Modifica atto
      </h1>

      <p className="mt-1 text-sm text-slate-600">
        {processo.tbclienti?.ragione_sociale || "-"}
      </p>
    </div>

    <button
      type="button"
      onClick={() => router.back()}
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      Indietro
    </button>

  </div>
</div>

        {errore && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errore}
          </div>
        )}

        {messaggio && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {messaggio}
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Dati pratica</h2>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">Cliente</div>
              <div className="font-medium">
                {processo.tbclienti?.ragione_sociale || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Tipo atto</div>
              <div className="font-medium">
                {processo.tbcontenzioso_tipi_atto?.descrizione || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Tributo</div>
              <div className="font-medium">
                {processo.tbcontenzioso_tributi_constatazione?.descrizione ||
                  "-"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs text-gray-500">Numero atto</label>
              <input
                name="numero_atto"
                value={form.numero_atto}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Anno</label>
              <input
                name="anno_riferimento"
                type="number"
                value={form.anno_riferimento}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Data ricezione</label>
              <input
                name="data_ricezione"
                type="date"
                value={form.data_ricezione}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Data scadenza</label>
              <input
                name="data_scadenza"
                type="date"
                value={form.data_scadenza}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Valore pratica</label>
              <input
                name="valore_pratica"
                type="number"
                step="0.01"
                value={form.valore_pratica}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Esito</label>
              <select
                name="esito"
                value={form.esito}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">---</option>
                <option value="aperto">Aperto</option>
                <option value="in_lavorazione">In lavorazione</option>
                <option value="chiuso">Chiuso</option>
                <option value="annullato">Annullato</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-gray-500">Descrizione</label>
            <textarea
              name="descrizione"
              value={form.descrizione}
              onChange={handleChange}
              rows={4}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-2 text-lg font-semibold">
            Riepilogo fasi procedimento
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Le fasi sono gestite nella stessa pagina dell’atto.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className={`rounded-lg border px-4 py-3 font-semibold ${getFaseColor(moduliAttivi.pvc)}`}>
              PVC {moduliAttivi.pvc ? "✓" : "✕"}
            </div>
            <div className={`rounded-lg border px-4 py-3 font-semibold ${getFaseColor(moduliAttivi.schemaAtto)}`}>
              Schema d’atto {moduliAttivi.schemaAtto ? "✓" : "✕"}
            </div>
            <div className={`rounded-lg border px-4 py-3 font-semibold ${getFaseColor(moduliAttivi.adesione)}`}>
              Accertamento con adesione {moduliAttivi.adesione ? "✓" : "✕"}
            </div>
            <div className={`rounded-lg border px-4 py-3 font-semibold ${getFaseColor(moduliAttivi.interpello)}`}>
              Interpello {moduliAttivi.interpello ? "✓" : "✕"}
            </div>
            <div className={`rounded-lg border px-4 py-3 font-semibold ${getFaseColor(moduliAttivi.primoGrado)}`}>
              Ricorso 1° grado {moduliAttivi.primoGrado ? "✓" : "✕"}
            </div>
            <div className={`rounded-lg border px-4 py-3 font-semibold ${getFaseColor(moduliAttivi.secondoGrado)}`}>
              Ricorso 2° grado {moduliAttivi.secondoGrado ? "✓" : "✕"}
            </div>
            <div className={`rounded-lg border px-4 py-3 font-semibold ${getFaseColor(moduliAttivi.cassazione)}`}>
              Cassazione {moduliAttivi.cassazione ? "✓" : "✕"}
              <div className="mt-1 text-xs font-normal">
                Solo riepilogo: tabella non ancora integrata
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
       <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
  <div>
    <h2 className="text-lg font-bold uppercase text-blue-900">PVC</h2>
              <p className="text-sm text-gray-500">
                Processo Verbale di Constatazione
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={pvcAttivo}
           onChange={(e) =>
  handleTogglePhase(e.target.checked, !!pvcForm.id, "pvc", setPvcAttivo)
}
              />
              Attiva fase PVC
            </label>
          </div>

          {pvcAttivo && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DateField
                  label="Data notifica PVC"
                  value={pvcForm.data_notifica_pvc}
                  onChange={(value) =>
                    setPvcForm((prev) => ({
                      ...prev,
                      data_notifica_pvc: value,
                    }))
                  }
                />
                <DateField label="Scadenza adesione" value={dataScadenzaAdesionePvc} disabled />
                <DateField label="Scadenza osservazioni" value={dataScadenzaOsservazioniPvc} disabled />
                <DateField
                  label="Data effettiva osservazioni"
                  value={pvcForm.data_effettiva_osservazioni}
                  onChange={(value) =>
                    setPvcForm((prev) => ({
                      ...prev,
                      data_effettiva_osservazioni: value,
                    }))
                  }
                />
                <DateField
                  label="Data incarico parere"
                  value={pvcForm.data_incarico_parere}
                  onChange={(value) =>
                    setPvcForm((prev) => ({
                      ...prev,
                      data_incarico_parere: value,
                    }))
                  }
                />
                <DateField
                  label="Data parere"
                  value={pvcForm.data_parere}
                  onChange={(value) =>
                    setPvcForm((prev) => ({ ...prev, data_parere: value }))
                  }
                />
                <DateField
                  label="Data incarico interpello"
                  value={pvcForm.data_incarico_interpello}
                  onChange={(value) =>
                    setPvcForm((prev) => ({
                      ...prev,
                      data_incarico_interpello: value,
                    }))
                  }
                />
                <DateField
                  label="Data interpello"
                  value={pvcForm.data_interpello}
                  onChange={(value) =>
                    setPvcForm((prev) => ({
                      ...prev,
                      data_interpello: value,
                    }))
                  }
                />
              </div>

              <PhaseActions
                saving={saving}
                saveLabel="Salva PVC"
                onSave={handleSavePvc}
                onDelete={
                  pvcForm.id
                    ? () =>
                        deletePhase(
                          "tbcontenzioso_pvc",
                          pvcForm.id,
                          "PVC"
                        )
                    : undefined
                }
              />
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
       <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
  <div>
    <h2 className="text-lg font-bold uppercase text-blue-900">SCHEMA D’ATTO</h2>
              <p className="text-sm text-gray-500">
                Gestione osservazioni allo schema d’atto
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={schemaAttoAttivo}
    onChange={(e) =>
  handleTogglePhase(
    e.target.checked,
    !!schemaAttoForm.id,
    "schemaAtto",
    setSchemaAttoAttivo
  )
}
              />
              Attiva fase Schema d’atto
            </label>
          </div>

          {schemaAttoAttivo && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DateField
                  label="Data notifica schema"
                  value={schemaAttoForm.data_notifica_schema}
                  onChange={(value) =>
                    setSchemaAttoForm((prev) => ({
                      ...prev,
                      data_notifica_schema: value,
                    }))
                  }
                />
                <DateField label="Scadenza osservazioni" value={dataScadenzaOsservazioniSchemaAtto} disabled />
                <DateField
                  label="Data effettiva osservazioni"
                  value={schemaAttoForm.data_effettiva_osservazioni}
                  onChange={(value) =>
                    setSchemaAttoForm((prev) => ({
                      ...prev,
                      data_effettiva_osservazioni: value,
                    }))
                  }
                />
                <DateField
                  label="Data emissione atto definitivo"
                  value={schemaAttoForm.data_emissione_atto_definitivo}
                  onChange={(value) =>
                    setSchemaAttoForm((prev) => ({
                      ...prev,
                      data_emissione_atto_definitivo: value,
                    }))
                  }
                />
                <TextAreaField
                  label="Note"
                  value={schemaAttoForm.note}
                  onChange={(value) =>
                    setSchemaAttoForm((prev) => ({ ...prev, note: value }))
                  }
                />
              </div>

              <PhaseActions
                saving={saving}
                saveLabel="Salva Schema d’atto"
                onSave={handleSaveSchemaAtto}
                onDelete={
                  schemaAttoForm.id
                    ? () =>
                        deletePhase(
                          "tbcontenzioso_schema_atto",
                          schemaAttoForm.id,
                          "SCHEMA_ATTO"
                        )
                    : undefined
                }
              />
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
  <div>
    <h2 className="text-lg font-bold uppercase text-blue-900">
      ACCERTAMENTO CON ADESIONE
    </h2>
              <p className="text-sm text-gray-500">
                Istanza, sospensione termini e pagamento adesione
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={adesioneAttivo}
  onChange={(e) =>
  handleTogglePhase(
    e.target.checked,
    !!adesioneForm.id,
    "adesione",
    setAdesioneAttivo
  )
}
                />
              Attiva fase Adesione
            </label>
          </div>

          {adesioneAttivo && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DateField
                  label="Data notifica atto"
                  value={adesioneForm.data_notifica_atto}
                  onChange={(value) =>
                    setAdesioneForm((prev) => ({
                      ...prev,
                      data_notifica_atto: value,
                    }))
                  }
                />
                <DateField label="Scadenza ricorso ordinaria" value={dataScadenzaRicorsoOrdinaria} disabled />
                <DateField
                  label="Data presentazione istanza"
                  value={adesioneForm.data_presentazione_istanza}
                  onChange={(value) =>
                    setAdesioneForm((prev) => ({
                      ...prev,
                      data_presentazione_istanza: value,
                    }))
                  }
                />
                <DateField label="Scadenza sospensione adesione" value={dataScadenzaSospensioneAdesione} disabled />
                <DateField label="Scadenza ricorso con adesione" value={dataScadenzaRicorsoConAdesione} disabled />
                <DateField
                  label="Data invito ufficio"
                  value={adesioneForm.data_invito_ufficio}
                  onChange={(value) =>
                    setAdesioneForm((prev) => ({
                      ...prev,
                      data_invito_ufficio: value,
                    }))
                  }
                />
                <DateField
                  label="Data incontro"
                  value={adesioneForm.data_incontro}
                  onChange={(value) =>
                    setAdesioneForm((prev) => ({
                      ...prev,
                      data_incontro: value,
                    }))
                  }
                />
                <DateField
                  label="Data sottoscrizione adesione"
                  value={adesioneForm.data_sottoscrizione_adesione}
                  onChange={(value) =>
                    setAdesioneForm((prev) => ({
                      ...prev,
                      data_sottoscrizione_adesione: value,
                    }))
                  }
                />
                <DateField label="Scadenza pagamento adesione" value={dataScadenzaPagamentoAdesione} disabled />
                <TextField
                  label="Esito"
                  value={adesioneForm.esito}
                  onChange={(value) =>
                    setAdesioneForm((prev) => ({ ...prev, esito: value }))
                  }
                />
                <TextAreaField
                  label="Note"
                  value={adesioneForm.note}
                  onChange={(value) =>
                    setAdesioneForm((prev) => ({ ...prev, note: value }))
                  }
                />
              </div>

              <PhaseActions
                saving={saving}
                saveLabel="Salva Adesione"
                onSave={handleSaveAdesione}
                onDelete={
                  adesioneForm.id
                    ? () =>
                        deletePhase(
                          "tbcontenzioso_adesione",
                          adesioneForm.id,
                          "ADESIONE"
                        )
                    : undefined
                }
              />
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
  <div>
    <h2 className="text-lg font-bold uppercase text-blue-900">INTERPELLO</h2>
              <p className="text-sm text-gray-500">
                Presentazione interpello, integrazioni e risposta
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={interpelloAttivo}
 onChange={(e) =>
  handleTogglePhase(
    e.target.checked,
    !!interpelloForm.id,
    "interpello",
    setInterpelloAttivo
  )
}
              />
              Attiva fase Interpello
            </label>
          </div>

          {interpelloAttivo && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Tipo interpello
                  </label>
                  <select
                    value={interpelloForm.tipo_interpello}
                    onChange={(e) =>
                      setInterpelloForm((prev) => ({
                        ...prev,
                        tipo_interpello: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border p-2"
                  >
                    <option value="ordinario">Ordinario</option>
                    <option value="qualificatorio">Qualificatorio</option>
                    <option value="probatorio">Probatorio</option>
                    <option value="antiabuso">Antiabuso</option>
                    <option value="disapplicativo">Disapplicativo</option>
                    <option value="nuovi_investimenti">
                      Nuovi investimenti
                    </option>
                  </select>
                </div>

                <DateField
                  label="Data incarico"
                  value={interpelloForm.data_incarico}
                  onChange={(value) =>
                    setInterpelloForm((prev) => ({
                      ...prev,
                      data_incarico: value,
                    }))
                  }
                />
                <DateField
                  label="Data presentazione"
                  value={interpelloForm.data_presentazione}
                  onChange={(value) =>
                    setInterpelloForm((prev) => ({
                      ...prev,
                      data_presentazione: value,
                    }))
                  }
                />
                <DateField label="Scadenza risposta" value={dataScadenzaRispostaInterpello} disabled />
                <DateField
                  label="Data richiesta integrazione"
                  value={interpelloForm.data_richiesta_integrazione}
                  onChange={(value) =>
                    setInterpelloForm((prev) => ({
                      ...prev,
                      data_richiesta_integrazione: value,
                    }))
                  }
                />
                <DateField
                  label="Data invio integrazione"
                  value={interpelloForm.data_invio_integrazione}
                  onChange={(value) =>
                    setInterpelloForm((prev) => ({
                      ...prev,
                      data_invio_integrazione: value,
                    }))
                  }
                />
                <DateField
                  label="Scadenza risposta post integrazione"
                  value={dataScadenzaRispostaPostIntegrazione}
                  disabled
                />
                <DateField
                  label="Data risposta"
                  value={interpelloForm.data_risposta}
                  onChange={(value) =>
                    setInterpelloForm((prev) => ({
                      ...prev,
                      data_risposta: value,
                    }))
                  }
                />
                <TextField
                  label="Esito"
                  value={interpelloForm.esito}
                  onChange={(value) =>
                    setInterpelloForm((prev) => ({ ...prev, esito: value }))
                  }
                />
                <TextAreaField
                  label="Note"
                  value={interpelloForm.note}
                  onChange={(value) =>
                    setInterpelloForm((prev) => ({ ...prev, note: value }))
                  }
                />
              </div>

              <PhaseActions
                saving={saving}
                saveLabel="Salva Interpello"
                onSave={handleSaveInterpello}
                onDelete={
                  interpelloForm.id
                    ? () =>
                        deletePhase(
                          "tbcontenzioso_interpello",
                          interpelloForm.id,
                          "INTERPELLO"
                        )
                    : undefined
                }
              />
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
  <div>
    <h2 className="text-lg font-bold uppercase text-blue-900">RICORSO 1° GRADO</h2>
              <p className="text-sm text-gray-500">
                Ricorso, costituzione, udienza, documenti, memorie e repliche
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={primoGradoAttivo}
       onChange={(e) =>
  handleTogglePhase(
    e.target.checked,
    !!primoGradoForm.id,
    "primoGrado",
    setPrimoGradoAttivo
  )
}
              />
              Attiva fase Ricorso 1° grado
            </label>
          </div>

          {primoGradoAttivo && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DateField
                  label="Data notifica atto"
                  value={primoGradoForm.data_notifica_atto}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_notifica_atto: value,
                    }))
                  }
                />
                <DateField label="Scadenza ricorso" value={dataScadenzaRicorsoPrimoGrado} disabled />
                <DateField
                  label="Data notifica ricorso"
                  value={primoGradoForm.data_notifica_ricorso}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_notifica_ricorso: value,
                    }))
                  }
                />
                <DateField label="Scadenza costituzione ricorrente" value={dataScadenzaCostituzioneRicorrente} disabled />
                <DateField
                  label="Data costituzione ricorrente"
                  value={primoGradoForm.data_costituzione_ricorrente}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_costituzione_ricorrente: value,
                    }))
                  }
                />
                <DateField
                  label="Data costituzione resistente"
                  value={primoGradoForm.data_costituzione_resistente}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_costituzione_resistente: value,
                    }))
                  }
                />
                <DateField
                  label="Data udienza"
                  value={primoGradoForm.data_udienza}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_udienza: value,
                    }))
                  }
                />
                <DateField label="Scadenza documenti" value={dataScadenzaDocumentiPrimo} disabled />
                <DateField label="Scadenza memorie" value={dataScadenzaMemoriePrimo} disabled />
                <DateField label="Scadenza repliche" value={dataScadenzaReplichePrimo} disabled />
                <DateField
                  label="Data deposito documenti"
                  value={primoGradoForm.data_deposito_documenti}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_deposito_documenti: value,
                    }))
                  }
                />
                <DateField
                  label="Data deposito memorie"
                  value={primoGradoForm.data_deposito_memorie}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_deposito_memorie: value,
                    }))
                  }
                />
                <DateField
                  label="Data deposito repliche"
                  value={primoGradoForm.data_deposito_repliche}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_deposito_repliche: value,
                    }))
                  }
                />
                <DateField
                  label="Data sentenza"
                  value={primoGradoForm.data_sentenza}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({
                      ...prev,
                      data_sentenza: value,
                    }))
                  }
                />
                <TextAreaField
                  label="Note"
                  value={primoGradoForm.note}
                  onChange={(value) =>
                    setPrimoGradoForm((prev) => ({ ...prev, note: value }))
                  }
                />
              </div>

              <PhaseActions
                saving={saving}
                saveLabel="Salva Ricorso 1° grado"
                onSave={handleSavePrimoGrado}
                onDelete={
                  primoGradoForm.id
                    ? () =>
                        deletePhase(
                          "tbcontenzioso_ricorso_primo_grado",
                          primoGradoForm.id,
                          "RICORSO_PRIMO_GRADO"
                        )
                    : undefined
                }
              />
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
         <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
  <div>
    <h2 className="text-lg font-bold uppercase text-blue-900">RICORSO 2° GRADO</h2>
              <p className="text-sm text-gray-500">
                Appello, costituzione, udienza e sentenza di secondo grado
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
onChange={(e) =>
  handleTogglePhase(
    e.target.checked,
    !!secondoGradoForm.id,
    "secondoGrado",
    setSecondoGradoAttivo
  )
}
              />
              Attiva fase Ricorso 2° grado
            </label>
          </div>

          {secondoGradoAttivo && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DateField
                  label="Data notifica sentenza 1° grado"
                  value={secondoGradoForm.data_notifica_sentenza_primo_grado}
                  onChange={(value) =>
                    setSecondoGradoForm((prev) => ({
                      ...prev,
                      data_notifica_sentenza_primo_grado: value,
                    }))
                  }
                />
                <DateField label="Scadenza appello breve" value={dataScadenzaAppelloBreve} disabled />
                <DateField
                  label="Data deposito sentenza 1° grado"
                  value={secondoGradoForm.data_deposito_sentenza_primo_grado}
                  onChange={(value) =>
                    setSecondoGradoForm((prev) => ({
                      ...prev,
                      data_deposito_sentenza_primo_grado: value,
                    }))
                  }
                />
                <DateField label="Scadenza appello lungo" value={dataScadenzaAppelloLungo} disabled />
                <DateField
                  label="Data notifica appello"
                  value={secondoGradoForm.data_notifica_appello}
                  onChange={(value) =>
                    setSecondoGradoForm((prev) => ({
                      ...prev,
                      data_notifica_appello: value,
                    }))
                  }
                />
                <DateField label="Scadenza costituzione appellante" value={dataScadenzaCostituzioneAppellante} disabled />
                <DateField
                  label="Data costituzione appellante"
                  value={secondoGradoForm.data_costituzione_appellante}
                  onChange={(value) =>
                    setSecondoGradoForm((prev) => ({
                      ...prev,
                      data_costituzione_appellante: value,
                    }))
                  }
                />
                <DateField
                  label="Data costituzione appellato"
                  value={secondoGradoForm.data_costituzione_appellato}
                  onChange={(value) =>
                    setSecondoGradoForm((prev) => ({
                      ...prev,
                      data_costituzione_appellato: value,
                    }))
                  }
                />
                <DateField
                  label="Data udienza"
                  value={secondoGradoForm.data_udienza}
                  onChange={(value) =>
                    setSecondoGradoForm((prev) => ({
                      ...prev,
                      data_udienza: value,
                    }))
                  }
                />
                <DateField label="Scadenza documenti" value={dataScadenzaDocumentiSecondo} disabled />
                <DateField label="Scadenza memorie" value={dataScadenzaMemorieSecondo} disabled />
                <DateField label="Scadenza repliche" value={dataScadenzaReplicheSecondo} disabled />
                <DateField
                  label="Data sentenza 2° grado"
                  value={secondoGradoForm.data_sentenza_secondo_grado}
                  onChange={(value) =>
                    setSecondoGradoForm((prev) => ({
                      ...prev,
                      data_sentenza_secondo_grado: value,
                    }))
                  }
                />
                <TextAreaField
                  label="Note"
                  value={secondoGradoForm.note}
                  onChange={(value) =>
                    setSecondoGradoForm((prev) => ({ ...prev, note: value }))
                  }
                />
              </div>

              <PhaseActions
                saving={saving}
                saveLabel="Salva Ricorso 2° grado"
                onSave={handleSaveSecondoGrado}
                onDelete={
                  secondoGradoForm.id
                    ? () =>
                        deletePhase(
                          "tbcontenzioso_ricorso_secondo_grado",
                          secondoGradoForm.id,
                          "RICORSO_SECONDO_GRADO"
                        )
                    : undefined
                }
              />
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
<div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3"> 
  <div> 
    <h2 className="text-lg font-bold uppercase text-blue-900">CASSAZIONE</h2>
      <p className="text-sm text-gray-500">
        Ricorso per cassazione, controricorso, adunanza e decisione
      </p>
    </div>

    <label className="flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={cassazioneAttivo}
      onChange={(e) =>
  handleTogglePhase(
    e.target.checked,
    !!cassazioneForm.id,
    "cassazione",
    setCassazioneAttivo
  )
}
        
      />
      Attiva fase Cassazione
    </label>
  </div>

  {cassazioneAttivo && (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DateField
          label="Data notifica sentenza 2° grado"
          value={cassazioneForm.data_notifica_sentenza_secondo_grado}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              data_notifica_sentenza_secondo_grado: value,
            }))
          }
        />

        <DateField
          label="Scadenza ricorso breve"
          value={dataScadenzaRicorsoCassazioneBreve}
          disabled
        />

        <DateField
          label="Data deposito sentenza 2° grado"
          value={cassazioneForm.data_deposito_sentenza_secondo_grado}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              data_deposito_sentenza_secondo_grado: value,
            }))
          }
        />

        <DateField
          label="Scadenza ricorso lungo"
          value={dataScadenzaRicorsoCassazioneLungo}
          disabled
        />

        <DateField
          label="Data notifica ricorso cassazione"
          value={cassazioneForm.data_notifica_ricorso_cassazione}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              data_notifica_ricorso_cassazione: value,
            }))
          }
        />

        <DateField
          label="Data deposito ricorso cassazione"
          value={cassazioneForm.data_deposito_ricorso_cassazione}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              data_deposito_ricorso_cassazione: value,
            }))
          }
        />

        <DateField
          label="Data notifica controricorso"
          value={cassazioneForm.data_notifica_controricorso}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              data_notifica_controricorso: value,
            }))
          }
        />

        <DateField
          label="Data udienza / adunanza"
          value={cassazioneForm.data_udienza_o_adunanza}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              data_udienza_o_adunanza: value,
            }))
          }
        />

        <DateField
          label="Data memoria cassazione"
          value={dataMemoriaCassazione}
          disabled
        />

        <DateField
          label="Data sentenza / ordinanza"
          value={cassazioneForm.data_sentenza_ordinanza}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              data_sentenza_ordinanza: value,
            }))
          }
        />

        <TextField
          label="Esito"
          value={cassazioneForm.esito}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              esito: value,
            }))
          }
        />

        <TextAreaField
          label="Note"
          value={cassazioneForm.note}
          onChange={(value) =>
            setCassazioneForm((prev) => ({
              ...prev,
              note: value,
            }))
          }
        />
      </div>

      <PhaseActions
        saving={saving}
        saveLabel="Salva Cassazione"
        onSave={handleSaveCassazione}
        onDelete={
          cassazioneForm.id
            ? () =>
                deletePhase(
                  "tbcontenzioso_cassazione",
                  cassazioneForm.id,
                  "CASSAZIONE"
                )
            : undefined
        }
      />
    </>
  )}
</div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Scadenze collegate</h2>

          {scadenze.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              Nessuna scadenza automatica collegata.
            </div>
          ) : (
            <div className="space-y-3">
              {scadenze.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-semibold">{s.descrizione}</div>
                    <div className="text-sm text-gray-500">
                      {s.modulo} · {formatDateIT(s.data_scadenza)}
                    </div>
                  </div>

                  <div
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${getColor(
                      s.giorni_residui
                    )}`}
                  >
                    {s.giorni_residui ?? "-"} gg
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full rounded-lg border p-2 ${
          disabled ? "bg-gray-100" : ""
        }`}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border p-2"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-lg border p-2"
      />
    </div>
  );
}

function PhaseActions({
  saving,
  saveLabel,
  onSave,
  onDelete,
}: {
  saving: boolean;
  saveLabel: string;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            Elimina fase
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "Salvataggio..." : saveLabel}
      </button>
    </div>
  );
}
