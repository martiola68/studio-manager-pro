import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "../../lib/supabaseClient";

type Cliente = {
  id: string;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
};

type Controllo = {
  id: string;
  cliente_id: string;
  cadenza_controllo: string | null;
  data_esecuzione: string | null;
};

type VoceCdG = {
  id: string;
  codice: string;
  descrizione: string;
  sezione: string;
  macrovoce: string | null;
  natura: string;
  ordine: number;
};

type ContoDaMappare = {
  codice_conto: string;
  descrizione_conto: string;
  importo: number;
  sezione: string;
  codice_padre: string | null;
};

type ImportResult = {
  success: boolean;

  import_id: string;

  file: {
    nome: string | null;
    societa: string;
    codice_azienda: string;
    periodo_dal: string | null;
    periodo_al: string | null;
  };

  quadratura: {
    statoPatrimoniale: boolean;
    contoEconomico: boolean;
    differenzaSP: number;
    differenzaCE: number;
  };

  riepilogo: {
    righe_lette: number;
    conti_importati: number;
    conti_mappati: number;
    conti_da_mappare: number;
    conti_esclusi: number;
    anomalie: number;
  };

  stato: string;
  anomalie: string[];

  da_mappare: ContoDaMappare[];
};

type IntegrazioniForm = {
  debiti_finanziari_bt: string;
  debiti_finanziari_mlt: string;
  rate_finanziarie_12_mesi: string;
  cash_flow_operativo_previsionale: string;
  note: string;
};

const integrazioniVuote: IntegrazioniForm = {
  debiti_finanziari_bt: "",
  debiti_finanziari_mlt: "",
  rate_finanziarie_12_mesi: "",
  cash_flow_operativo_previsionale: "",
  note: "",
};

type ElaborazioneResult = {
  success: boolean;

  import_id: string;
  controllo_id: string | null;
  data_riferimento: string | null;
  
  conto_economico: {
    ricavi: number;
    costi_operativi: number;
    ebitda: number;
    ammortamenti: number;
    accantonamenti: number;
    ebit: number;
    proventi_finanziari: number;
    oneri_finanziari_lordi: number;
    oneri_finanziari_netti: number;
    ebt: number;
    imposte: number;
    risultato_conto_economico: number;
    risultato_provvisorio: number;
    differenza_risultato: number;
  };

  stato_patrimoniale: {
    totale_attivo: number;
    attivo_corrente: number;
    disponibilita_liquide: number;
    patrimonio_netto_contabile: number;
    risultato_provvisorio: number;
    patrimonio_netto: number;
    debiti_finanziari_contabili: number;
    debiti_finanziari_bt: number;
    debiti_finanziari_mlt: number;
    debiti_totali: number;
    passivo_corrente: number;
    capitale_investito: number;
  };

  indicatori: {
    roi: number;
    roe: number;
    ros: number;
    roa: number;
    indebitamento: number;
    liquidita: number;
    dscr: number | null;
  };
};

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dataIt(value: string | null | undefined) {
  if (!value) return "-";

  const [anno, mese, giorno] = value.split("-");

  if (!anno || !mese || !giorno) return value;

  return `${giorno}/${mese}/${anno}`;
}

function labelSezione(sezione: string) {
  switch (sezione) {
    case "SP_ATTIVO":
      return "Stato patrimoniale - Attivo";

    case "SP_PASSIVO":
      return "Stato patrimoniale - Passivo";

    case "CE_COSTI":
      return "Conto economico - Costi";

    case "CE_RICAVI":
      return "Conto economico - Ricavi";

    default:
      return sezione || "-";
  }
}

async function leggiCsvDatev(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  return new TextDecoder("windows-1252").decode(buffer);
}

function isContoBancario(conto: ContoDaMappare) {
  const descrizione = String(
    conto.descrizione_conto || ""
  ).toLowerCase();

  return (
    descrizione.includes("banca") ||
    descrizione.includes("banco")
  );
}

function parseImportoInput(value: string): number {
  const testo = String(value || "")
    .trim()
    .replace(/\s/g, "");

  if (!testo) {
    return 0;
  }

  /*
   * Formato italiano:
   * 120.000,50 → 120000.50
   */
  if (testo.includes(",")) {
    return Number(
      testo
        .replace(/\./g, "")
        .replace(",", ".")
    );
  }

  /*
   * 120.000 → interpretiamo il punto come separatore migliaia.
   */
  if (/^-?\d{1,3}(\.\d{3})+$/.test(testo)) {
    return Number(
      testo.replace(/\./g, "")
    );
  }

  return Number(testo);
}

export default function ImportContabilitaPage() {
  const router = useRouter();

  const origineRevisione =
    router.isReady &&
    router.query.origine === "revisione";

  const revisioneControlloId =
    origineRevisione &&
    typeof router.query.controllo_id === "string"
      ? router.query.controllo_id
      : "";

  const annoRevisione =
    origineRevisione &&
    typeof router.query.anno === "string"
      ? router.query.anno
      : "";

  const trimestreRevisione =
    origineRevisione &&
    typeof router.query.trimestre === "string"
      ? router.query.trimestre
      : "";

  const returnTo =
    typeof router.query.return_to === "string"
      ? router.query.return_to
      : "";

  const [studioId, setStudioId] = useState("");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");

  const [controllo, setControllo] =
    useState<Controllo | null>(null);

  const [voci, setVoci] = useState<VoceCdG[]>([]);

  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingCliente, setLoadingCliente] =
    useState(false);

  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");

const [risultato, setRisultato] =
  useState<ImportResult | null>(null);

const [integrazioni, setIntegrazioni] =
  useState<IntegrazioniForm>(integrazioniVuote);

const [loadingIntegrazioni, setLoadingIntegrazioni] =
  useState(false);

const [salvataggioIntegrazioni, setSalvataggioIntegrazioni] =
  useState(false);

  const [
  debitiFinanziariContabili,
  setDebitiFinanziariContabili,
] = useState(0);

const [elaborazione, setElaborazione] =
  useState<ElaborazioneResult | null>(null);

const [loadingElaborazione, setLoadingElaborazione] =
  useState(false);

  /*
   * codice conto -> voce_id
   */
  const [mappature, setMappature] = useState<
    Record<string, string>
  >({});

  const [mappatureNegative, setMappatureNegative] = useState<
  Record<string, string>
>({});

  /*
   * codice conto -> escluso
   */
  const [esclusi, setEsclusi] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    void inizializza();
  }, []);

  /*
   * Se arriviamo dalla scheda di un controllo possiamo
   * passare cliente_id nella query string.
   */
  useEffect(() => {
  if (
    !router.isReady ||
    clienti.length === 0
  ) {
    return;
  }

  const queryClienteId =
    typeof router.query.cliente_id === "string"
      ? router.query.cliente_id
      : "";

  if (
    queryClienteId &&
    clienti.some(
      (cliente) => cliente.id === queryClienteId
    ) &&
    queryClienteId !== clienteId
  ) {
    setClienteId(queryClienteId);
  }
}, [
  router.isReady,
  router.query.cliente_id,
  clienti,
  clienteId,
]);

const controlloIdQuery =
  router.isReady &&
  !origineRevisione &&
  typeof router.query.controllo_id === "string"
    ? router.query.controllo_id
    : "";

useEffect(() => {
  if (!studioId || !clienteId) {
    setControllo(null);
    return;
  }

  /*
   * In Revisione non serve un record
   * tbcontrollo_gestione.
   */
  if (origineRevisione) {
    setControllo(null);
    setLoadingCliente(false);
    return;
  }

  void caricaControlloAttivo();
}, [
  studioId,
  clienteId,
  controlloIdQuery,
  origineRevisione,
]);

  useEffect(() => {
    if (
      !studioId ||
      !clienteId ||
      !controllo?.id ||
      !risultato?.import_id
    ) {
      return;
    }

    void caricaIntegrazioni();
  }, [
    studioId,
    clienteId,
    controllo?.id,
    risultato?.import_id,
  ]);

  async function inizializza() {
    try {
      setErrore("");

      const supabase = getSupabaseClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setErrore("Utente non autenticato.");
        return;
      }

      const {
        data: utente,
        error: utenteError,
      } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (
        utenteError ||
        !utente?.studio_id
      ) {
        setErrore(
          "Impossibile determinare lo studio dell'utente."
        );
        return;
      }

      const sid = utente.studio_id;

      setStudioId(sid);

      const [
        clientiResponse,
        vociResponse,
      ] = await Promise.all([
        supabase
          .from("tbclienti")
          .select(`
            id,
            ragione_sociale,
            codice_fiscale
          `)
          .eq("studio_id", sid)
          .order("ragione_sociale", {
            ascending: true,
          }),

        fetch(
          "/api/controllo-gestione/voci"
        ).then(async (response) => {
          const json = await response.json();

          if (!response.ok) {
            throw new Error(
              json?.error ||
                "Errore caricamento voci di riclassificazione"
            );
          }

          return json;
        }),
      ]);

      if (clientiResponse.error) {
        throw clientiResponse.error;
      }

      setClienti(
        (clientiResponse.data || []) as Cliente[]
      );

      if (vociResponse?.success) {
        setVoci(vociResponse.data || []);
      }
    } catch (error: any) {
      console.error(
        "Errore inizializzazione import contabilità:",
        error
      );

      setErrore(
        error?.message ||
          "Errore inizializzazione pagina"
      );
    }
  }

  async function caricaControlloAttivo() {
    try {
      setLoadingCliente(true);
      setErrore("");
      setMessaggio("");

setFile(null);
setRisultato(null);
setMappature({});
setMappatureNegative({});
setEsclusi({});
setIntegrazioni(integrazioniVuote);
setElaborazione(null);
      setDebitiFinanziariContabili(0);

      const supabase = getSupabaseClient();

   let query = (supabase as any)
  .from("tbcontrollo_gestione")
  .select(`
    id,
    cliente_id,
    cadenza_controllo,
    data_esecuzione
  `)
  .eq("studio_id", studioId)
  .eq("cliente_id", clienteId);

if (controlloIdQuery) {
  /*
   * Se arriviamo dalla checklist utilizziamo
   * ESATTAMENTE il controllo richiesto.
   */
  query = query.eq("id", controlloIdQuery);
} else {
  /*
   * Accesso diretto alla pagina:
   * fallback sul controllo attivo corrente.
   */
  query = query
    .eq("archiviato", false)
    .order("data_esecuzione", {
      ascending: false,
    })
    .limit(1);
}

const {
  data,
  error,
} = await query.maybeSingle();

      if (error) {
        throw error;
      }

      setControllo(
        data
          ? (data as Controllo)
          : null
      );
    } catch (error: any) {
      console.error(
        "Errore caricamento controllo:",
        error
      );

      setControllo(null);

      setErrore(
        error?.message ||
          "Errore caricamento controllo di gestione"
      );
    } finally {
      setLoadingCliente(false);
    }
  }

  async function handleImport() {
    try {
      setErrore("");
      setMessaggio("");

      if (!studioId) {
        setErrore("Studio non disponibile.");
        return;
      }

      if (!clienteId) {
        setErrore(
          "Seleziona prima una società."
        );
        return;
      }

   if (
  !origineRevisione &&
  !controllo?.id
) {
  setErrore(
    "Per questa società non esiste un controllo di gestione attivo."
  );
  return;
}

if (
  origineRevisione &&
  !revisioneControlloId
) {
  setErrore(
    "Controllo trimestrale di revisione non disponibile."
  );
  return;
}

      if (!file) {
        setErrore(
          "Seleziona il file CSV esportato da DATEV KOINOS."
        );
        return;
      }

      setLoading(true);

      const contenutoCsv =
        await leggiCsvDatev(file);

      const response = await fetch(
        "/api/controllo-gestione/import-contabilita",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

        body: JSON.stringify({
  studio_id: studioId,
  cliente_id: clienteId,

  origine_modulo:
    origineRevisione
      ? "REVISIONE"
      : "CONTROLLO_GESTIONE",

  controllo_id:
    origineRevisione
      ? null
      : controllo?.id || null,

  revisione_controllo_id:
    origineRevisione
      ? revisioneControlloId
      : null,

  software_contabile:
    "datev_koinos",

  nome_file: file.name,

  contenuto_csv: contenutoCsv,
}),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore durante l'importazione"
        );
      }

     setRisultato(json);

      if (
  origineRevisione &&
  revisioneControlloId &&
  json?.import_id
) {
  const collegaResponse =
    await fetch(
      "/api/revisione-controllo/controlli",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          id:
            revisioneControlloId,

          controllo_gestione_import_id:
            json.import_id,
        }),
      }
    );

  const collegaJson =
    await collegaResponse.json();

  if (
    !collegaResponse.ok ||
    !collegaJson.success
  ) {
    throw new Error(
      collegaJson.error ||
        "Import eseguito, ma non è stato possibile collegare automaticamente la situazione al controllo di revisione."
    );
  }
}
      
setMappature({});
setMappatureNegative({});
setEsclusi({});
      setElaborazione(null);

    if (
  json?.riepilogo?.conti_da_mappare === 0
) {
  setMessaggio(
    origineRevisione
      ? "Importazione completata e situazione collegata automaticamente al controllo di revisione. Tutti i conti risultano classificati."
      : "Importazione completata. Tutti i conti risultano già classificati."
  );
} else {
  setMessaggio(
    origineRevisione
      ? `Importazione completata e situazione collegata al controllo di revisione. ${json.riepilogo.conti_da_mappare} conti devono essere classificati.`
      : `Importazione completata. ${json.riepilogo.conti_da_mappare} conti devono essere classificati.`
  );
}
    } catch (error: any) {
      console.error(
        "Errore import contabilità:",
        error
      );

      setErrore(
        error?.message ||
          "Errore durante l'importazione"
      );
    } finally {
      setLoading(false);
    }
  }

  async function caricaIntegrazioni() {
  if (
    !studioId ||
    !clienteId ||
    !controllo?.id ||
    !risultato?.import_id
  ) {
    return;
  }

  try {
    setLoadingIntegrazioni(true);

    const params = new URLSearchParams({
      studio_id: studioId,
      cliente_id: clienteId,
      controllo_id: controllo.id,
      import_id: risultato.import_id,
    });

    const response = await fetch(
      `/api/controllo-gestione/integrazioni?${params.toString()}`
    );

    const json = await response.json();

    if (!response.ok) {
      throw new Error(
        json?.error ||
          "Errore caricamento integrazioni"
      );
    }

    setDebitiFinanziariContabili(
  Number(
    json?.debiti_finanziari_contabili || 0
  )
);

    const data = json?.data;

    if (!data) {
      setIntegrazioni(integrazioniVuote);
      return;
    }

    setIntegrazioni({
      debiti_finanziari_bt:
        data.debiti_finanziari_bt != null
          ? String(data.debiti_finanziari_bt)
          : "",

      debiti_finanziari_mlt:
        data.debiti_finanziari_mlt != null
          ? String(data.debiti_finanziari_mlt)
          : "",

      rate_finanziarie_12_mesi:
        data.rate_finanziarie_12_mesi != null
          ? String(data.rate_finanziarie_12_mesi)
          : "",

      cash_flow_operativo_previsionale:
        data.cash_flow_operativo_previsionale != null
          ? String(
              data.cash_flow_operativo_previsionale
            )
          : "",

      note:
        data.note || "",
    });
  } catch (error: any) {
    console.error(
      "Errore caricamento integrazioni:",
      error
    );

    setErrore(
      error?.message ||
        "Errore caricamento integrazioni"
    );
  } finally {
    setLoadingIntegrazioni(false);
  }
}

async function salvaIntegrazioni() {
  if (
    !studioId ||
    !clienteId ||
    !controllo?.id ||
    !risultato?.import_id
  ) {
    setErrore(
      "Import o controllo non disponibile."
    );
    return;
  }

  try {
    setErrore("");
    setMessaggio("");
    setSalvataggioIntegrazioni(true);

  const mlt = parseImportoInput(
  integrazioni.debiti_finanziari_mlt
);

const bt =
  Math.round(
    (
      debitiFinanziariContabili -
      mlt +
      Number.EPSILON
    ) * 100
  ) / 100;
    
    const rate = parseImportoInput(
      integrazioni.rate_finanziarie_12_mesi
    );

    const cashFlowTesto =
      integrazioni.cash_flow_operativo_previsionale.trim();

    const cashFlow =
      cashFlowTesto === ""
        ? null
        : parseImportoInput(cashFlowTesto);

    if (
      !Number.isFinite(mlt) ||
      !Number.isFinite(rate) ||
      (
        cashFlow !== null &&
        !Number.isFinite(cashFlow)
      )
    ) {
      setErrore(
        "Uno o più importi inseriti non sono validi."
      );
      return;
    }

 if (
  mlt < 0 ||
  rate < 0
) {
  setErrore(
    "Debiti finanziari e rate devono essere indicati come valori positivi."
  );
  return;
}

if (mlt > debitiFinanziariContabili) {
  setErrore(
    "I debiti finanziari oltre 12 mesi non possono superare il totale dei debiti finanziari risultante dalla contabilità."
  );
  return;
}

const response = await fetch(
      "/api/controllo-gestione/integrazioni",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          studio_id: studioId,
          cliente_id: clienteId,
          controllo_id: controllo.id,
          import_id: risultato.import_id,

          debiti_finanziari_mlt: mlt,
          rate_finanziarie_12_mesi: rate,
        cash_flow_operativo_previsionale:
            cashFlow,

          note:
            integrazioni.note,
        }),
      }
    );

    const json = await response.json();

    if (!response.ok) {
      throw new Error(
        json?.error ||
          "Errore salvataggio integrazioni"
      );
    }

    setMessaggio(
      "Integrazioni gestionali salvate correttamente."
    );

    await caricaIntegrazioni();
  } catch (error: any) {
    console.error(
      "Errore salvataggio integrazioni:",
      error
    );

    setErrore(
      error?.message ||
        "Errore salvataggio integrazioni"
    );
  } finally {
    setSalvataggioIntegrazioni(false);
  }
}

  async function elaboraControllo() {
  if (!risultato?.import_id) {
    setErrore(
      "Import non disponibile per l'elaborazione."
    );
    return;
  }

  try {
    setErrore("");
    setMessaggio("");
    setLoadingElaborazione(true);

    const response = await fetch(
      "/api/controllo-gestione/elabora-import",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

       body: JSON.stringify({
  import_id: risultato.import_id,

  modulo:
    origineRevisione
      ? "REVISIONE"
      : "CONTROLLO_GESTIONE",

  controllo_id:
    origineRevisione
      ? null
      : controllo?.id || null,

  revisione_controllo_id:
    origineRevisione
      ? revisioneControlloId
      : null,
}),
      }
    );

    const json = await response.json();

    if (!response.ok) {
      /*
       * Se l'API restituisce anche il dettaglio
       * della discordanza BT/MLT, lo mostriamo.
       */
      if (json?.dettaglio) {
        const dettaglio = json.dettaglio;

        throw new Error(
          `${json.error || "Errore elaborazione"} ` +
            `Contabilità: ${euro(
              dettaglio.debiti_finanziari_contabili
            )} · ` +
            `Ripartizione inserita: ${euro(
              dettaglio.totale_manuale
            )} · ` +
            `Differenza: ${euro(
              dettaglio.differenza
            )}`
        );
      }

      throw new Error(
        json?.error ||
          "Errore elaborazione controllo di gestione"
      );
    }

    setElaborazione(
      json as ElaborazioneResult
    );

setMessaggio(
  origineRevisione
    ? "Situazione contabile elaborata correttamente e disponibile per il controllo di revisione."
    : "Controllo di gestione elaborato correttamente."
);
  } catch (error: any) {
    console.error(
      "Errore elaborazione controllo:",
      error
    );

    setErrore(
      error?.message ||
        "Errore elaborazione controllo di gestione"
    );
  } finally {
    setLoadingElaborazione(false);
  }
}

  async function salvaMappatura(
    conto: ContoDaMappare
  ) {
    try {
      setErrore("");
      setMessaggio("");

      const escluso =
        Boolean(esclusi[conto.codice_conto]);

   const voceId =
  mappature[conto.codice_conto] || "";

const voceIdNegativo =
  mappatureNegative[conto.codice_conto] || "";

if (!escluso && !voceId) {
        setErrore(
          `Seleziona una voce per il conto ${conto.codice_conto} oppure impostalo come escluso.`
        );
        return;
      }

      const response = await fetch(
        "/api/controllo-gestione/mappatura-conti",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            studio_id: studioId,
            cliente_id: clienteId,

            software_contabile:
              "datev_koinos",

            codice_conto:
              conto.codice_conto,

            descrizione_conto:
              conto.descrizione_conto,

voce_id:
  escluso
    ? null
    : voceId,

voce_id_negativo:
  escluso || !isContoBancario(conto)
    ? null
    : voceIdNegativo || null,

moltiplicatore: 1,

ambito: "template",

            escluso,
            confermato: true,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore salvataggio mappatura"
        );
      }

    /*
 * La mappatura è stata salvata.
 *
 * Rilanciamo immediatamente l'import del CSV già
 * selezionato, così il nuovo mapping viene applicato
 * anche alle righe staging dell'import corrente.
 *
 * In questo modo UI e database rimangono sempre
 * sincronizzati e "Elabora controllo" può essere
 * eseguito senza refresh manuale.
 */
if (file) {
  await handleImport();
} else {
  /*
   * Fallback prudenziale:
   * se per qualche motivo il file non fosse più
   * disponibile, aggiorniamo almeno la UI locale.
   */
  setRisultato((prev) => {
    if (!prev) return prev;

    const nuoveRighe =
      prev.da_mappare.filter(
        (riga) =>
          riga.codice_conto !==
          conto.codice_conto
      );

    return {
      ...prev,

      riepilogo: {
        ...prev.riepilogo,

        conti_da_mappare:
          Math.max(
            0,
            prev.riepilogo
              .conti_da_mappare - 1
          ),

        conti_mappati:
          escluso
            ? prev.riepilogo
                .conti_mappati
            : prev.riepilogo
                .conti_mappati + 1,

        conti_esclusi:
          escluso
            ? prev.riepilogo
                .conti_esclusi + 1
            : prev.riepilogo
                .conti_esclusi,
      },

      da_mappare: nuoveRighe,
    };
  });
}
      setMessaggio(
        escluso
          ? `Conto ${conto.codice_conto} escluso.`
          : `Conto ${conto.codice_conto} classificato.`
      );
    } catch (error: any) {
      console.error(
        "Errore salvataggio mappatura:",
        error
      );

      setErrore(
        error?.message ||
          "Errore salvataggio mappatura"
      );
    }
  }

  const clienteSelezionato =
    useMemo(
      () =>
        clienti.find(
          (cliente) =>
            cliente.id === clienteId
        ) || null,
      [clienti, clienteId]
    );

  const vociRaggruppate =
    useMemo(() => {
      const result: Record<
        string,
        VoceCdG[]
      > = {};

      for (const voce of voci) {
        const sezione =
          voce.sezione || "altro";

        if (!result[sezione]) {
          result[sezione] = [];
        }

        result[sezione].push(voce);
      }

      return result;
    }, [voci]);

  const contestoImportValido =
    origineRevisione
      ? Boolean(
          revisioneControlloId
        )
      : Boolean(
          controllo?.id
        );

  return (
    <main
      style={{
        maxWidth: 1500,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Importazione contabilità
          </h1>

          <div
  style={{
    marginTop: 6,
    color: "#64748b",
  }}
>
  {origineRevisione
    ? "Revisione e Controllo · DATEV KOINOS"
    : "Controllo di gestione · DATEV KOINOS"}
</div>
        </div>

        <button
  type="button"
  onClick={() => {
    if (
      origineRevisione &&
      returnTo
    ) {
      router.push(returnTo);
      return;
    }

    if (origineRevisione) {
      router.push(
        "/revisione-controllo/controlli"
      );
      return;
    }

    router.push(
      "/controllo-gestione"
    );
  }}
  style={secondaryButtonStyle}
>
  {origineRevisione
    ? "Torna ai controlli di revisione"
    : "Torna al controllo di gestione"}
</button>
      </div>

      {errore && (
        <div style={errorStyle}>
          {errore}
        </div>
      )}

      {messaggio && (
        <div style={successStyle}>
          {messaggio}
        </div>
      )}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          1. Società e controllo
        </h2>

        <div style={grid2Style}>
          <div>
            <label style={labelStyle}>
              Società
            </label>

            <select
              value={clienteId}
              onChange={(e) =>
                setClienteId(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Seleziona società
              </option>

              {clienti.map((cliente) => (
                <option
                  key={cliente.id}
                  value={cliente.id}
                >
                  {cliente.ragione_sociale ||
                    cliente.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              Software contabile
            </label>

            <input
              value="DATEV KOINOS"
              disabled
              style={{
                ...inputStyle,
                background: "#f8fafc",
              }}
            />
          </div>
        </div>

        {loadingCliente && (
          <div style={infoStyle}>
            Caricamento controllo...
          </div>
        )}

      {!origineRevisione &&
  !loadingCliente &&
  clienteId &&
  !controllo && (
    <div style={warningStyle}>
      Per questa società non
      risulta un controllo di
      gestione attivo.
    </div>
)}
        {origineRevisione &&
  clienteId &&
  revisioneControlloId && (
    <div
      style={{
        ...infoStyle,
        marginTop: 16,
      }}
    >
      <strong>
        Controllo di revisione:
      </strong>{" "}
      {trimestreRevisione
        ? `${trimestreRevisione}° trimestre`
        : "Controllo trimestrale"}

      {annoRevisione
        ? ` ${annoRevisione}`
        : ""}

      {clienteSelezionato
        ?.codice_fiscale && (
        <>
          {" · "}
          CF{" "}
          {
            clienteSelezionato
              .codice_fiscale
          }
        </>
      )}
    </div>
)}

        {controllo && (
          <div
            style={{
              ...infoStyle,
              marginTop: 16,
            }}
          >
            <strong>
              Controllo attivo:
            </strong>{" "}
            {dataIt(
              controllo.data_esecuzione
            )}
            {" · "}
            {controllo.cadenza_controllo ||
              "Cadenza non indicata"}

            {clienteSelezionato
              ?.codice_fiscale && (
              <>
                {" · "}
                CF{" "}
                {
                  clienteSelezionato.codice_fiscale
                }
              </>
            )}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          2. Situazione contabile
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 500px",
            }}
          >
            <label style={labelStyle}>
              File CSV DATEV KOINOS
            </label>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(
                  e.target.files?.[0] ||
                    null
                );

                setRisultato(null);
                setErrore("");
                setMessaggio("");
              }}
              style={inputStyle}
            />
          </div>

           <button
            type="button"
            onClick={handleImport}
            disabled={
              loading ||
              !file ||
              !clienteId ||
              !contestoImportValido
            }
            style={{
              ...primaryButtonStyle,

              opacity:
                loading ||
                !file ||
                !clienteId ||
                !contestoImportValido
                  ? 0.5
                  : 1,

              cursor:
                loading ||
                !file ||
                !clienteId ||
                !contestoImportValido
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {loading
              ? "Analisi in corso..."
              : "Analizza e importa"}
          </button>
        </div>
      </section>

      {risultato && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              3. Esito importazione
            </h2>

            <div style={grid4Style}>
              <Stat
                label="Conti importati"
                value={
                  risultato.riepilogo
                    .conti_importati
                }
              />

              <Stat
                label="Già mappati"
                value={
                  risultato.riepilogo
                    .conti_mappati
                }
              />

              <Stat
                label="Da classificare"
                value={
                  risultato.riepilogo
                    .conti_da_mappare
                }
              />

              <Stat
                label="Esclusi"
                value={
                  risultato.riepilogo
                    .conti_esclusi
                }
              />
            </div>

            <div
              style={{
                ...grid2Style,
                marginTop: 20,
              }}
            >
              <div style={subCardStyle}>
                <div style={smallLabelStyle}>
                  Azienda DATEV
                </div>

                <strong>
                  {risultato.file
                    .societa || "-"}
                </strong>

                <div
                  style={{
                    marginTop: 4,
                    color: "#64748b",
                  }}
                >
                  Codice azienda:{" "}
                  {risultato.file
                    .codice_azienda || "-"}
                </div>
              </div>

              <div style={subCardStyle}>
                <div style={smallLabelStyle}>
                  Periodo contabile
                </div>

                <strong>
                  {dataIt(
                    risultato.file
                      .periodo_dal
                  )}
                  {" → "}
                  {dataIt(
                    risultato.file
                      .periodo_al
                  )}
                </strong>
              </div>
            </div>

            <div
              style={{
                ...grid2Style,
                marginTop: 16,
              }}
            >
              <Quadratura
                titolo="Stato patrimoniale"
                ok={
                  risultato.quadratura
                    .statoPatrimoniale
                }
                differenza={
                  risultato.quadratura
                    .differenzaSP
                }
              />

              <Quadratura
                titolo="Conto economico"
                ok={
                  risultato.quadratura
                    .contoEconomico
                }
                differenza={
                  risultato.quadratura
                    .differenzaCE
                }
              />
            </div>

            {risultato.anomalie?.length >
              0 && (
              <div
                style={{
                  ...warningStyle,
                  marginTop: 16,
                }}
              >
                <strong>
                  Anomalie rilevate
                </strong>

                <ul
                  style={{
                    marginBottom: 0,
                  }}
                >
                  {risultato.anomalie.map(
                    (anomalia, index) => (
                      <li key={index}>
                        {anomalia}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              4. Mappatura conti
            </h2>

            {risultato.da_mappare
              .length === 0 ? (
              <div style={successStyle}>
                Tutti i conti risultano
                classificati. La
                mappatura della società
                è completa.
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: 16,
                    color: "#64748b",
                  }}
                >
                  Classifica soltanto i
                  conti nuovi. La scelta
                  verrà memorizzata per
                  questa società e
                  riutilizzata nei
                  controlli successivi.
                </div>

                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>
                          Codice
                        </th>

                        <th style={thStyle}>
                          Descrizione
                        </th>

                        <th style={thStyle}>
                          Sezione
                        </th>

                        <th
                          style={{
                            ...thStyle,
                            textAlign:
                              "right",
                          }}
                        >
                          Importo
                        </th>

                        <th style={thStyle}>
                          Riclassificazione
                        </th>

                        <th
                          style={{
                            ...thStyle,
                            textAlign:
                              "center",
                          }}
                        >
                          Escludi
                        </th>

                        <th style={thStyle}>
                          Azione
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {risultato.da_mappare.map(
                        (conto) => {
                          const escluso =
                            Boolean(
                              esclusi[
                                conto
                                  .codice_conto
                              ]
                            );

                          return (
                            <tr
                              key={
                                conto.codice_conto
                              }
                            >
                              <td style={tdStyle}>
                                <strong>
                                  {
                                    conto.codice_conto
                                  }
                                </strong>
                              </td>

                              <td style={tdStyle}>
                                {
                                  conto.descrizione_conto
                                }

                                {conto.codice_padre && (
                                  <div
                                    style={{
                                      marginTop: 3,
                                      fontSize: 11,
                                      color:
                                        "#94a3b8",
                                    }}
                                  >
                                    Gruppo DATEV:{" "}
                                    {
                                      conto.codice_padre
                                    }
                                  </div>
                                )}
                              </td>

                              <td style={tdStyle}>
                                {labelSezione(
                                  conto.sezione
                                )}
                              </td>

                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign:
                                    "right",
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {euro(
                                  conto.importo
                                )}
                              </td>

                              <td
                                style={{
                                  ...tdStyle,
                                  minWidth: 330,
                                }}
                              >
                                <select
                                  value={
                                    mappature[
                                      conto
                                        .codice_conto
                                    ] || ""
                                  }
                                  disabled={
                                    escluso
                                  }
                                  onChange={(e) =>
                                    setMappature(
                                      (prev) => ({
                                        ...prev,
                                        [conto.codice_conto]:
                                          e.target
                                            .value,
                                      })
                                    )
                                  }
                                  style={
                                    inputStyle
                                  }
                                >
                                  <option value="">
                                    Seleziona voce...
                                  </option>

                                  {Object.entries(
                                    vociRaggruppate
                                  ).map(
                                    ([
                                      sezione,
                                      elenco,
                                    ]) => (
                                      <optgroup
                                        key={
                                          sezione
                                        }
                                        label={
                                          sezione
                                        }
                                      >
                                        {elenco.map(
                                          (
                                            voce
                                          ) => (
                                            <option
                                              key={
                                                voce.id
                                              }
                                              value={
                                                voce.id
                                              }
                                            >
                                              {
                                                voce.descrizione
                                              }
                                            </option>
                                          )
                                        )}
                                      </optgroup>
                                    )
                                  )}
                                </select>
                                {isContoBancario(conto) && !escluso && (
  <div
    style={{
      marginTop: 8,
      paddingTop: 8,
      borderTop: "1px dashed #cbd5e1",
    }}
  >
    <div
      style={{
        marginBottom: 5,
        fontSize: 11,
        fontWeight: 600,
        color: "#64748b",
      }}
    >
      Se saldo passivo / negativo
    </div>

    <select
      value={
        mappatureNegative[conto.codice_conto] || ""
      }
      onChange={(e) =>
        setMappatureNegative((prev) => ({
          ...prev,
          [conto.codice_conto]: e.target.value,
        }))
      }
      style={inputStyle}
    >
      <option value="">
        Seleziona voce...
      </option>

      {Object.entries(vociRaggruppate).map(
        ([sezione, elenco]) => (
          <optgroup
            key={sezione}
            label={sezione}
          >
            {elenco.map((voce) => (
              <option
                key={voce.id}
                value={voce.id}
              >
                {voce.descrizione}
              </option>
            ))}
          </optgroup>
        )
      )}
    </select>
  </div>
)}
                              </td>

                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign:
                                    "center",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    escluso
                                  }
                                  onChange={(e) =>
                                    setEsclusi(
                                      (prev) => ({
                                        ...prev,
                                        [conto.codice_conto]:
                                          e.target
                                            .checked,
                                      })
                                    )
                                  }
                                />
                              </td>

                              <td style={tdStyle}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    salvaMappatura(
                                      conto
                                    )
                                  }
                                  style={
                                    smallButtonStyle
                                  }
                                >
                                  Salva
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
       {!origineRevisione &&
  risultato.riepilogo.conti_da_mappare === 0 && (
  <section style={cardStyle}>
    <h2 style={sectionTitleStyle}>
      5. Integrazioni gestionali
    </h2>

    <div
      style={{
        marginBottom: 18,
        color: "#64748b",
        fontSize: 13,
      }}
    >
      Integra i dati che non possono essere
      determinati automaticamente dalla situazione
      contabile. Gli importi dei debiti finanziari
      devono essere indicati come valori positivi.
    </div>

    {loadingIntegrazioni ? (
      <div style={infoStyle}>
        Caricamento integrazioni...
      </div>
    ) : (
      <>
<div style={grid2Style}>
  <div>
    <label style={labelStyle}>
      Debiti finanziari complessivi da contabilità
    </label>

    <input
      type="text"
      value={euro(
        debitiFinanziariContabili
      )}
      disabled
      style={{
        ...inputStyle,
        background: "#f8fafc",
        fontWeight: 600,
      }}
    />

    <div style={helpTextStyle}>
      Totale rilevato automaticamente dalla situazione contabile.
    </div>
  </div>

  <div>
    <label style={labelStyle}>
      Debiti finanziari oltre 12 mesi
    </label>

    <input
      type="text"
      inputMode="decimal"
      placeholder="0,00"
      value={
        integrazioni.debiti_finanziari_mlt
      }
      onChange={(e) =>
        setIntegrazioni((prev) => ({
          ...prev,
          debiti_finanziari_mlt:
            e.target.value,
        }))
      }
      style={inputStyle}
    />

    <div style={helpTextStyle}>
      Quota dei finanziamenti con scadenza oltre i prossimi 12 mesi.
    </div>
  </div>

  <div>
    <label style={labelStyle}>
      Debiti finanziari entro 12 mesi
    </label>

    <input
      type="text"
      value={euro(
        Math.max(
          0,
          debitiFinanziariContabili -
            parseImportoInput(
              integrazioni.debiti_finanziari_mlt
            )
        )
      )}
      disabled
      style={{
        ...inputStyle,
        background: "#f8fafc",
        fontWeight: 600,
      }}
    />

    <div style={helpTextStyle}>
      Calcolato automaticamente come debiti finanziari complessivi meno quota oltre 12 mesi.
    </div>
  </div>

          <div>
            <label style={labelStyle}>
              Rate finanziarie prossimi 12 mesi
            </label>

            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={
                integrazioni.rate_finanziarie_12_mesi
              }
              onChange={(e) =>
                setIntegrazioni((prev) => ({
                  ...prev,
                  rate_finanziarie_12_mesi:
                    e.target.value,
                }))
              }
              style={inputStyle}
            />

            <div style={helpTextStyle}>
              Servizio del debito previsto nei
              prossimi 12 mesi.
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Cash flow operativo previsionale
            </label>

            <input
              type="text"
              inputMode="decimal"
              placeholder="Facoltativo"
              value={
                integrazioni
                  .cash_flow_operativo_previsionale
              }
              onChange={(e) =>
                setIntegrazioni((prev) => ({
                  ...prev,
                  cash_flow_operativo_previsionale:
                    e.target.value,
                }))
              }
              style={inputStyle}
            />

            <div style={helpTextStyle}>
              Facoltativo. Sarà utilizzato per gli
              indicatori prospettici, incluso il DSCR.
            </div>
          </div>
        </div>

<div style={{ marginTop: 18 }}>
          <label style={labelStyle}>
            Note integrazioni gestionali
          </label>

          <textarea
            value={integrazioni.note}
            onChange={(e) =>
              setIntegrazioni((prev) => ({
                ...prev,
                note: e.target.value,
              }))
            }
            rows={4}
            placeholder="Eventuali precisazioni su mutui, finanziamenti, rate, dati previsionali..."
            style={{
              ...inputStyle,
              resize: "vertical",
            }}
          />
        </div>

       <div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 18,
    flexWrap: "wrap",
  }}
>
  <button
    type="button"
    onClick={salvaIntegrazioni}
    disabled={
      salvataggioIntegrazioni ||
      loadingElaborazione
    }
    style={{
      ...secondaryButtonStyle,

      opacity:
        salvataggioIntegrazioni ||
        loadingElaborazione
          ? 0.5
          : 1,

      cursor:
        salvataggioIntegrazioni ||
        loadingElaborazione
          ? "not-allowed"
          : "pointer",
    }}
  >
    {salvataggioIntegrazioni
      ? "Salvataggio..."
      : "Salva integrazioni"}
  </button>

  <button
    type="button"
    onClick={elaboraControllo}
    disabled={
      loadingElaborazione ||
      salvataggioIntegrazioni
    }
    style={{
      ...primaryButtonStyle,

      opacity:
        loadingElaborazione ||
        salvataggioIntegrazioni
          ? 0.5
          : 1,

      cursor:
        loadingElaborazione ||
        salvataggioIntegrazioni
          ? "not-allowed"
          : "pointer",
    }}
  >
    {loadingElaborazione
      ? "Elaborazione..."
      : "Elabora controllo di gestione"}
  </button>
</div>
      </>
    )}
   </section>
)}

          {origineRevisione &&
  risultato.riepilogo.conti_da_mappare === 0 &&
  !elaborazione && (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>
        5. Elaborazione situazione contabile
      </h2>

      <div
        style={{
          marginBottom: 18,
          color: "#64748b",
          fontSize: 13,
        }}
      >
        Tutti i conti risultano classificati.
        Puoi elaborare la situazione contabile
        e renderla disponibile nel controllo
        trimestrale di revisione.
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={elaboraControllo}
          disabled={loadingElaborazione}
          style={{
            ...primaryButtonStyle,

            opacity:
              loadingElaborazione
                ? 0.5
                : 1,

            cursor:
              loadingElaborazione
                ? "not-allowed"
                : "pointer",
          }}
        >
          {loadingElaborazione
            ? "Elaborazione..."
            : "Elabora situazione contabile"}
        </button>
      </div>
    </section>
)}

{elaborazione && (
  <section style={cardStyle}>
    <h2 style={sectionTitleStyle}>
      6. Risultato controllo di gestione
    </h2>

    <div
      style={{
        marginBottom: 18,
        color: "#64748b",
        fontSize: 13,
      }}
    >
      Elaborazione della situazione contabile al{" "}
      <strong>
        {dataIt(
          elaborazione.data_riferimento
        )}
      </strong>
    </div>

    <h3
      style={{
        fontSize: 16,
        marginBottom: 12,
      }}
    >
      Conto economico
    </h3>

    <div style={grid4Style}>
      <StatEuro
        label="Ricavi"
        value={
          elaborazione.conto_economico.ricavi
        }
      />

      <StatEuro
        label="Costi operativi"
        value={
          elaborazione.conto_economico
            .costi_operativi
        }
      />

      <StatEuro
        label="EBITDA"
        value={
          elaborazione.conto_economico.ebitda
        }
      />

      <StatEuro
        label="EBIT"
        value={
          elaborazione.conto_economico.ebit
        }
      />

      <StatEuro
        label="EBT"
        value={
          elaborazione.conto_economico.ebt
        }
      />

      <StatEuro
        label="Imposte"
        value={
          elaborazione.conto_economico.imposte
        }
      />

      <StatEuro
        label="Risultato da CE"
        value={
          elaborazione.conto_economico
            .risultato_conto_economico
        }
      />

      <StatEuro
        label="Risultato provvisorio"
        value={
          elaborazione.conto_economico
            .risultato_provvisorio
        }
      />
    </div>

    <div
      style={{
        ...subCardStyle,
        marginTop: 16,
        background:
          Math.abs(
            elaborazione.conto_economico
              .differenza_risultato
          ) <= 1
            ? "#f0fdf4"
            : "#fffbeb",
      }}
    >
      <div style={smallLabelStyle}>
        Differenza risultato CE / quadratura patrimoniale
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {euro(
          elaborazione.conto_economico
            .differenza_risultato
        )}
      </div>
    </div>

    <h3
      style={{
        fontSize: 16,
        marginTop: 28,
        marginBottom: 12,
      }}
    >
      Stato patrimoniale
    </h3>

    <div style={grid4Style}>
      <StatEuro
        label="Totale attivo"
        value={
          elaborazione.stato_patrimoniale
            .totale_attivo
        }
      />

      <StatEuro
        label="Attivo corrente"
        value={
          elaborazione.stato_patrimoniale
            .attivo_corrente
        }
      />

      <StatEuro
        label="Disponibilità liquide"
        value={
          elaborazione.stato_patrimoniale
            .disponibilita_liquide
        }
      />

      <StatEuro
        label="Patrimonio netto"
        value={
          elaborazione.stato_patrimoniale
            .patrimonio_netto
        }
      />

      <StatEuro
        label="Debiti finanziari BT"
        value={
          elaborazione.stato_patrimoniale
            .debiti_finanziari_bt
        }
      />

      <StatEuro
        label="Debiti finanziari M/L"
        value={
          elaborazione.stato_patrimoniale
            .debiti_finanziari_mlt
        }
      />

      <StatEuro
        label="Debiti totali"
        value={
          elaborazione.stato_patrimoniale
            .debiti_totali
        }
      />

      <StatEuro
        label="Passivo corrente"
        value={
          elaborazione.stato_patrimoniale
            .passivo_corrente
        }
      />
    </div>

    <h3
      style={{
        fontSize: 16,
        marginTop: 28,
        marginBottom: 12,
      }}
    >
      Indicatori
    </h3>

    <div style={grid4Style}>
      <StatPercentuale
        label="ROI"
        value={
          elaborazione.indicatori.roi
        }
      />

      <StatPercentuale
        label="ROE"
        value={
          elaborazione.indicatori.roe
        }
      />

      <StatPercentuale
        label="ROS"
        value={
          elaborazione.indicatori.ros
        }
      />

      <StatPercentuale
        label="ROA"
        value={
          elaborazione.indicatori.roa
        }
      />

      <StatNumero
        label="Indebitamento"
        value={
          elaborazione.indicatori
            .indebitamento
        }
      />

      <StatNumero
        label="Indice di liquidità"
        value={
          elaborazione.indicatori
            .liquidita
        }
      />

      <StatNumero
        label="DSCR"
        value={
          elaborazione.indicatori
            .dscr
        }
      />
    </div>
  </section>
)}

        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={subCardStyle}>
      <div style={smallLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatEuro({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={subCardStyle}>
      <div style={smallLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {euro(value)}
      </div>
    </div>
  );
}

function StatPercentuale({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={subCardStyle}>
      <div style={smallLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {Number(value || 0).toLocaleString(
          "it-IT",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}
        %
      </div>
    </div>
  );
}

function StatNumero({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div style={subCardStyle}>
      <div style={smallLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {value == null
          ? "-"
          : Number(value).toLocaleString(
              "it-IT",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
      </div>
    </div>
  );
}

function Quadratura({
  titolo,
  ok,
  differenza,
}: {
  titolo: string;
  ok: boolean;
  differenza: number;
}) {
  return (
    <div
      style={{
        ...subCardStyle,
        borderColor: ok
          ? "#bbf7d0"
          : "#fecaca",

        background: ok
          ? "#f0fdf4"
          : "#fef2f2",
      }}
    >
      <div
        style={{
          fontWeight: 700,
        }}
      >
        {ok ? "✓" : "⚠"} {titolo}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 13,
          color: "#475569",
        }}
      >
        {ok
          ? "Quadratura corretta"
          : `Differenza: ${euro(
              differenza
            )}`}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 20,
  marginBottom: 20,
};

const subCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 16,
  background: "#ffffff",
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 18,
  fontSize: 18,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
};

const grid4Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "11px 18px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 14px",
  background: "#ffffff",
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: "8px 12px",
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 600,
};

const errorStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
};

const successStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
};

const warningStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 8,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
};

const infoStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 8,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "left",
  borderBottom: "2px solid #e2e8f0",
  color: "#475569",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "middle",
};

const helpTextStyle: React.CSSProperties = {
  marginTop: 5,
  fontSize: 11,
  color: "#64748b",
  lineHeight: 1.4,
};
