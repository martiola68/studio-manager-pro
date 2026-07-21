"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  normalizeCF,
  isValidCF,
  extractDataNascitaFromCF,
} from "@/utils/codiceFiscale";

import { getComuneFromCF } from "@/utils/comuniCatastali";
import {
  Pencil,
  Power,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

const ruoli = [
  "tutti",
  "socio",
  "amministratore",
  "amministratore_unico",
  "liquidatore",
 "amministratore_delegato",
"consigliere_delegato",
"presidente_cda",
"consigliere",
  "sindaco_effettivo",
  "presidente_collegio_sindacale",
  "sindaco_unico",
  "sindaco_supplente",
  "revisore",
  "rappresentante_legale",
];

const ruoliLabel: Record<string, string> = {
  tutti: "Tutti",
  socio: "Socio",
  amministratore: "Amministratore",
  amministratore_unico: "Amministratore unico",
  liquidatore: "Liquidatore",
 amministratore_delegato:
  "Amministratore delegato",

consigliere_delegato:
  "Consigliere delegato",

presidente_cda:
  "Presidente del CDA",
  consigliere: "Consigliere",
  sindaco_effettivo: "Sindaco effettivo",
  presidente_collegio_sindacale: "Presidente del collegio sindacale",
  sindaco_unico: "Sindaco unico",
  sindaco_supplente: "Sindaco supplente",
  revisore: "Revisore",
  rappresentante_legale: "Rappresentante legale",
};

const titoliPossessoLabel: Record<string, string> = {
  piena_proprieta: "Piena proprietà",
  nuda_proprieta: "Nuda proprietà",
  usufrutto: "Usufrutto",
  pegno: "Pegno",
  sequestro: "Sequestro",
  intestazione_fiduciaria: "Intestazione fiduciaria",
  altro: "Altro",
};

const ruoliConPrincipale = [
  "amministratore",
  "amministratore_unico",
  "amministratore_delegato",
  "presidente_cda",
  "consigliere",
  "liquidatore",
  "rappresentante_legale",
];

function richiedeQuota(ruolo: string) {
  return ruolo === "socio";
}

function consentePrincipale(ruolo: string) {
  return ruoliConPrincipale.includes(ruolo);
}
function isTitoloCollegato(titolo: string) {
  return [
    "nuda_proprieta",
    "pegno",
    "sequestro",
    "intestazione_fiduciaria",
    "altro",
  ].includes(titolo);
}

function getCodicePartecipazione(organoId: string) {
  return `PAR-${String(organoId)
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase()}`;
}

async function leggiDatiDaCF(
  cf: string,
  setNuovoNominativo: any
) {
  // ...
}

type TitolareEffettivoApi = {
  persona_id: string;
  persona_nome: string;

  codice_fiscale: string | null;

  quota_diretta: number;
  quota_indiretta: number;
  quota_complessiva: number;

  criterio_titolarita:
    | "proprieta"
    | "residuale";

  tipo_titolarita:
    | "diretta"
    | "indiretta"
    | "mista"
    | "residuale";

  ruolo?: string | null;
  carica?: string | null;
  principale?: boolean;

  valido_dal: string | null;
  valido_al: string | null;

  percorsi: Array<{
    quota_percorso?: number;
    percorso_nomi?: string[];
  }>;
};

type VariazioneTitolareEffettivoApi = {
  data: string;

  criterio_precedente:
    | "proprieta"
    | "residuale";

  criterio_successivo:
    | "proprieta"
    | "residuale";

  precedenti: Array<{
    persona_id: string;
    persona_nome: string;
    codice_fiscale: string | null;
  }>;

  successivi: Array<{
    persona_id: string;
    persona_nome: string;
    codice_fiscale: string | null;
  }>;
};

type RispostaTitolariEffettiviApi = {
  data_riferimento: string;

  criterio_utilizzato:
    | "proprieta"
    | "residuale";

  titolari_effettivi:
    TitolareEffettivoApi[];

  numero_titolari_effettivi: number;

  variazioni_effettive:
    VariazioneTitolareEffettivoApi[];

  numero_variazioni_effettive: number;

  alert: {
    titolare_effettivo_assente: boolean;
    variazione_rilevata: boolean;
    data_ultima_variazione: string | null;
    messaggio: string | null;
  };
};

function formattaDataItaliana(
  data: string | null | undefined
): string {
  if (!data) {
    return "—";
  }

  const parti = data
    .slice(0, 10)
    .split("-");

  if (parti.length !== 3) {
    return data;
  }

  return `${parti[2]}/${parti[1]}/${parti[0]}`;
}

function formattaCriterioTitolare(
  criterio: string | null | undefined
): string {
  switch (criterio) {
    case "diretta":
      return "Proprietà diretta";

    case "indiretta":
      return "Proprietà indiretta";

    case "mista":
      return "Proprietà diretta e indiretta";

    case "residuale":
      return "Criterio residuale";

    default:
      return "Non determinato";
  }
}

export default function OrganiSocialiPage() {
  const router = useRouter();
  

const [clienti, setClienti] = useState<any[]>([]);
const [nominativi, setNominativi] = useState<any[]>([]);
const [organi, setOrgani] = useState<any[]>([]);

const [
  datiTitolariEffettivi,
  setDatiTitolariEffettivi,
] = useState<RispostaTitolariEffettiviApi | null>(
  null
);

const [
  loadingTitolariEffettivi,
  setLoadingTitolariEffettivi,
] = useState(false);

const [
  erroreTitolariEffettivi,
  setErroreTitolariEffettivi,
] = useState("");

const [anteprimaImportazione, setAnteprimaImportazione] =
  useState<any[]>([]);

  const [
  nominativoInModificaId,
  setNominativoInModificaId,
] = useState<string | null>(null);

const [showImportazioneVisura, setShowImportazioneVisura] =
  useState(false);

const [loadingImportazione, setLoadingImportazione] =
  useState(false);

  const [organoInModificaId, setOrganoInModificaId] = useState("");
  const [dirittiCollegati, setDirittiCollegati] = useState<any[]>([]);
const [loadingDiritti, setLoadingDiritti] = useState(false);
const [erroreDiritti, setErroreDiritti] = useState("");

  const [nuovoDiritto, setNuovoDiritto] = useState({
  soggetto_cliente_id: "",
  tipo_diritto: "nuda_proprieta",
  percentuale_quota: "",
  percentuale_diritti_voto: "",
  percentuale_diritti_utili: "",
  diritto_voto: true,
  diritto_utili: true,
  data_inizio: "",
  data_fine: "",
  note: "",
});

  const [clienteId, setClienteId] = useState("");
  const [filtroRuolo, setFiltroRuolo] = useState("tutti");
  const [loading, setLoading] = useState(false);
const [messaggio, setMessaggio] = useState("");

const [showNuovoNominativo, setShowNuovoNominativo] = useState(false);

const [nuovoNominativo, setNuovoNominativo] = useState({
  nome_cognome: "",
  codice_fiscale: "",
  email: "",
  luogo_nascita: "",
  data_nascita: "",
  indirizzo: "",
  citta: "",
  provincia: "",
  cap: "",
  tipologia_cliente: "Persona fisica",
});

const [form, setForm] = useState({
  soggetto_cliente_id: "",
  ruolo: "socio",
  carica: "",

  percentuale_partecipazione: "",
  titolo_possesso: "piena_proprieta",
  percentuale_diritti_voto: "",
  percentuale_diritti_utili: "",
  note_titolo_possesso: "",
  partecipazione_collegata_id: "",

  presenza: "Presente",
  principale: false,
  attivo: true,
  data_nomina: "",
  durata_carica: "Fino a revoca",
  data_scadenza: "",
  data_cessazione: "",
});


useEffect(() => {
  if (!router.isReady) return;

  const id = router.query.cliente_id;

  if (typeof id === "string" && id.trim()) {
    setClienteId(id);
  }
}, [router.isReady, router.query.cliente_id]);
  
  useEffect(() => {
  caricaClienti();
  caricaNominativi();
}, []);

useEffect(() => {
  if (!clienteId) {
    setOrgani([]);
    setDatiTitolariEffettivi(null);
    setErroreTitolariEffettivi("");
    return;
  }

  void caricaOrgani();
}, [clienteId]);


  const organiFiltrati = useMemo(() => {
    if (filtroRuolo === "tutti") return organi;
    return organi.filter((o) => o.ruolo === filtroRuolo);
  }, [organi, filtroRuolo]);

  const totaleQuote = useMemo(() => {
  return organi
    .filter(
      (organo) =>
        organo.ruolo === "socio" &&
        organo.attivo === true
    )
    .reduce(
      (totale, organo) =>
        totale +
        Number(organo.percentuale_partecipazione || 0),
      0
    );
}, [organi]);

const totaleQuoteCorretto =
  Math.abs(totaleQuote - 100) < 0.005;

const differenzaQuote = totaleQuote - 100;

  async function caricaClienti() {
   const supabase = getSupabaseClient() as any;
    
const { data } = await supabase
  .from("tbclienti")
 .select(`
  id,
  ragione_sociale,
  codice_fiscale,
  studio_id
`)
  .order("ragione_sociale");

    setClienti(data || []);
  }

async function caricaNominativi() {
  const supabase = getSupabaseClient() as any;

const { data, error } = await supabase
  .from("tbclienti")
  select(`
  id,
  ragione_sociale,
  cognome,
  nome,
  tipo_cliente,
  codice_fiscale,
    partita_iva,
    email,
    indirizzo,
    citta,
    provincia,
    cap,
    cliente
  `)
  .order("ragione_sociale");

  if (error) {
    console.error("Errore caricaNominativi:", error);
    setNominativi([]);
    return;
  }

  setNominativi(data || []);
}

  function separaCognomeNome(
  nomeCognome: string
): {
  cognome: string;
  nome: string;
} {
  const parti = String(nomeCognome || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);

  if (parti.length === 0) {
    return {
      cognome: "",
      nome: "",
    };
  }

  if (parti.length === 1) {
    return {
      cognome: parti[0],
      nome: "",
    };
  }

  return {
    cognome: parti.slice(0, -1).join(" "),
    nome: parti[parti.length - 1],
  };
}
  
async function salvaNuovoNominativo() {
  if (!nuovoNominativo.nome_cognome.trim()) {
    alert("Cognome e nome obbligatori.");
    return;
  }

  if (!nuovoNominativo.codice_fiscale.trim()) {
    alert("Codice fiscale obbligatorio.");
    return;
  }

  const clienteSelezionato = clienti.find(
    (c) => c.id === clienteId
  );

const modalitaModifica =
  Boolean(nominativoInModificaId);

const nominativoSeparato =
  separaCognomeNome(
    nuovoNominativo.nome_cognome
  );

const payload = {
    ...(modalitaModifica
      ? {
          id: nominativoInModificaId,
        }
      : {
          studio_id:
            clienteSelezionato?.studio_id ||
            null,
        }),

  ragione_sociale:
  nuovoNominativo.nome_cognome
    .trim()
    .replace(/\s+/g, " "),

cognome:
  nominativoSeparato.cognome ||
  null,

nome:
  nominativoSeparato.nome ||
  null,

codice_fiscale:
  nuovoNominativo.codice_fiscale
    .trim()
    .toUpperCase(),

    email:
      nuovoNominativo.email.trim() ||
      null,

    luogo_nascita:
      nuovoNominativo.luogo_nascita.trim() ||
      null,

    data_nascita:
      nuovoNominativo.data_nascita ||
      null,

    indirizzo:
      nuovoNominativo.indirizzo.trim() ||
      null,

    citta:
      nuovoNominativo.citta.trim() ||
      null,

    provincia:
      nuovoNominativo.provincia.trim() ||
      null,

    cap:
      nuovoNominativo.cap.trim() ||
      null,

   tipo_cliente:
  "Persona fisica",

tipologia_cliente:
  nuovoNominativo.tipologia_cliente ===
  "Esterno"
    ? "Esterno"
    : "Interno",

cliente: false,
  };

  try {
    let res: Response;

    if (modalitaModifica) {
      const supabase =
        getSupabaseClient();

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken =
        sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error(
          "Sessione non valida. Effettua nuovamente l'accesso."
        );
      }

      res = await fetch(
        "/api/clienti/update",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${accessToken}`,
          },

          body: JSON.stringify(payload),
        }
      );
    } else {
      res = await fetch(
        "/api/clienti/soggetti",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(payload),
        }
      );
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
          data.details ||
          (modalitaModifica
            ? "Errore aggiornamento nominativo."
            : "Errore salvataggio nominativo.")
      );
    }

    /*
     * L'API di creazione restituisce:
     * { success: true, data: {...} }
     *
     * L'API update restituisce direttamente:
     * { id, ragione_sociale, ... }
     */
    if (
      !modalitaModifica &&
      data.success !== true
    ) {
      throw new Error(
        data.error ||
          "Errore salvataggio nominativo."
      );
    }

    const idSalvato =
      modalitaModifica
        ? nominativoInModificaId
        : data.data?.id;

  await caricaNominativi();

if (idSalvato) {
  setForm((prev) => ({
    ...prev,
    soggetto_cliente_id:
      String(idSalvato),
  }));
}

/*
 * Se il nominativo è già collegato alla società,
 * ricarichiamo anche la tabella degli organi.
 * In questo modo nome, CF e altri dati aggiornati
 * compaiono subito senza premere "Aggiungi nominativo".
 */
await caricaOrgani();

setShowNuovoNominativo(false);
setNominativoInModificaId(null);

setNuovoNominativo({
  nome_cognome: "",
  codice_fiscale: "",
  email: "",
  luogo_nascita: "",
  data_nascita: "",
  indirizzo: "",
  citta: "",
  provincia: "",
  cap: "",
  tipologia_cliente:
    "Persona fisica",
});

setMessaggio(
  modalitaModifica
    ? "Anagrafica aggiornata correttamente."
    : "Nominativo creato correttamente."
);
  } catch (error: any) {
    console.error(
      "Errore salvataggio nominativo:",
      error
    );

    alert(
      error?.message ||
        "Errore durante il salvataggio del nominativo."
    );
  }
}
async function importaVisura(
  e: React.ChangeEvent<HTMLInputElement>
) {
  const file = e.target.files?.[0];

  if (!file) {
    e.target.value = "";
    return;
  }

  if (!clienteId) {
    alert(
      "Seleziona prima la società per la quale importare la visura."
    );

    e.target.value = "";
    return;
  }

  const formData = new FormData();

  /*
   * L'API di anteprima riceve il cliente
   * e il file PDF della visura.
   */
  formData.append("clienteId", clienteId);
  formData.append("file", file);

  setLoadingImportazione(true);
  setMessaggio("");

  try {
    const response = await fetch(
      "/api/clienti/organi-sociali/importa-visura",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.details ||
          "Errore durante la lettura della visura."
      );
    }

    /*
     * L'API restituisce l'anteprima
     * nell'array soggetti.
     */
    const soggettiRicevuti =
      Array.isArray(data.soggetti)
        ? data.soggetti
        : [];

    const righeAnteprima =
      soggettiRicevuti.map(
        (soggetto: any) => ({
          ...soggetto,

          selected:
            soggetto.esito === "gia_presente"
              ? false
              : soggetto.selected !== false,

          percentuale_partecipazione:
            soggetto.percentuale_partecipazione ??
            "",

          titolo_possesso:
            soggetto.titolo_possesso ||
            "piena_proprieta",

          percentuale_diritti_voto:
            soggetto.percentuale_diritti_voto ??
            soggetto.percentuale_partecipazione ??
            "",

          percentuale_diritti_utili:
            soggetto.percentuale_diritti_utili ??
            soggetto.percentuale_partecipazione ??
            "",
        })
      );

    setAnteprimaImportazione(
      righeAnteprima
    );

    /*
     * La modale deve aprirsi anche quando
     * non vengono trovate righe, così viene
     * mostrato il relativo messaggio.
     */
    setShowImportazioneVisura(true);
  } catch (error: any) {
    console.error(
      "Errore importaVisura:",
      error
    );

    alert(
      error?.message ||
        "Errore durante la lettura della visura."
    );
  } finally {
    setLoadingImportazione(false);

    /*
     * Consente di selezionare nuovamente
     * lo stesso file PDF.
     */
    e.target.value = "";
  }
}

async function caricaTitolariEffettivi() {
  if (!clienteId) {
    setDatiTitolariEffettivi(null);
    setErroreTitolariEffettivi("");
    return;
  }

  setLoadingTitolariEffettivi(true);
  setErroreTitolariEffettivi("");

  try {
    const response = await fetch(
      `/api/clienti/${clienteId}/titolari-effettivi`,
      {
        cache: "no-store",
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Errore durante il calcolo del Titolare Effettivo."
      );
    }

    setDatiTitolariEffettivi(
      data as RispostaTitolariEffettiviApi
    );
  } catch (error: any) {
    console.error(
      "Errore caricaTitolariEffettivi:",
      error
    );

    setDatiTitolariEffettivi(null);

    setErroreTitolariEffettivi(
      error?.message ||
        "Errore durante il calcolo del Titolare Effettivo."
    );
  } finally {
    setLoadingTitolariEffettivi(false);
  }
}

async function caricaOrgani() {
  setLoading(true);

  try {
    const res = await fetch(`/api/clienti-organi?cliente_id=${clienteId}`, {
      cache: "no-store",
    });

    const data = await res.json();

   if (res.ok) {
  const organiBase = data.organi || [];

  const organiConDiritti = await Promise.all(
    organiBase.map(async (organo: any) => {
      if (organo.ruolo !== "socio") {
        return {
          ...organo,
          diritti_collegati: [],
        };
      }

      try {
        const rispostaDiritti = await fetch(
          `/api/clienti-organi-diritti?organo_id=${organo.id}`,
          {
            cache: "no-store",
          }
        );

        const datiDiritti = await rispostaDiritti.json();

        return {
          ...organo,
          diritti_collegati:
            rispostaDiritti.ok
              ? datiDiritti.diritti || []
              : [],
        };
      } catch {
        return {
          ...organo,
          diritti_collegati: [],
        };
      }
    })
  );

setOrgani(organiConDiritti);

void caricaTitolariEffettivi().catch((error) => {
  console.error(
    "Errore aggiornamento Titolare Effettivo:",
    error
  );
});
} else {
  console.error(
    "Errore caricaOrgani:",
    data
  );
      setMessaggio(data.error || "Errore caricamento organi");
      setOrgani([]);
    }
  } catch (err) {
    console.error("Errore fetch caricaOrgani:", err);
    setMessaggio("Errore caricamento organi");
    setOrgani([]);
  } finally {
    setLoading(false);
  }
}

  async function caricaDirittiCollegati(organoId: string) {
  if (!organoId) {
    setDirittiCollegati([]);
    setErroreDiritti("");
    return;
  }

  setLoadingDiritti(true);
  setErroreDiritti("");

  try {
    const response = await fetch(
      `/api/clienti-organi-diritti?organo_id=${organoId}`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Errore caricamento diritti collegati"
      );
    }

    setDirittiCollegati(data.diritti || []);
  } catch (error: any) {
    console.error("Errore caricaDirittiCollegati:", error);

    setDirittiCollegati([]);
    setErroreDiritti(
      error?.message || "Errore caricamento diritti collegati"
    );
  } finally {
    setLoadingDiritti(false);
  }
}

async function salvaDirittoCollegato() {
  if (!organoInModificaId) {
    alert("Seleziona prima una partecipazione tramite il pulsante Modifica.");
    return;
  }

  if (!nuovoDiritto.soggetto_cliente_id) {
    alert("Seleziona il soggetto titolare del diritto.");
    return;
  }

  if (
    !nuovoDiritto.percentuale_quota ||
    Number(nuovoDiritto.percentuale_quota) <= 0
  ) {
    alert("Inserisci la percentuale della quota interessata.");
    return;
  }

  const response = await fetch("/api/clienti-organi-diritti", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organo_id: organoInModificaId,

      soggetto_cliente_id:
        nuovoDiritto.soggetto_cliente_id,

      tipo_diritto:
        nuovoDiritto.tipo_diritto,

      percentuale_quota:
        nuovoDiritto.percentuale_quota,

      percentuale_diritti_voto:
        nuovoDiritto.percentuale_diritti_voto || null,

      percentuale_diritti_utili:
        nuovoDiritto.percentuale_diritti_utili || null,

      diritto_voto:
        nuovoDiritto.diritto_voto,

      diritto_utili:
        nuovoDiritto.diritto_utili,

      data_inizio:
        nuovoDiritto.data_inizio || null,

      data_fine:
        nuovoDiritto.data_fine || null,

      note:
        nuovoDiritto.note || null,

      attivo: true,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Errore salvataggio diritto collegato.");
    return;
  }

  setNuovoDiritto({
    soggetto_cliente_id: "",
   tipo_diritto: "nuda_proprieta",
    percentuale_quota:
      form.percentuale_partecipazione || "",
    percentuale_diritti_voto: "",
    percentuale_diritti_utili: "",
    diritto_voto: true,
    diritto_utili: true,
    data_inizio: "",
    data_fine: "",
    note: "",
  });

await caricaDirittiCollegati(organoInModificaId);
await caricaOrgani();
}

  async function eliminaDirittoCollegato(diritto: any) {
  const conferma = confirm(
    `Eliminare il diritto collegato di ${
      diritto.nominativo_nome || "questo soggetto"
    }?`
  );

  if (!conferma) return;

  const response = await fetch("/api/clienti-organi-diritti", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: diritto.id,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Errore eliminazione diritto collegato.");
    return;
  }

  await caricaDirittiCollegati(organoInModificaId);
await caricaOrgani();
}
    
  async function salvaOrgano() {
    if (!clienteId) {
      alert("Seleziona prima un cliente.");
      return;
    }

    if (!form.soggetto_cliente_id) {
  alert("Seleziona un nominativo.");
  return;
}

    const nominativoSelezionato = nominativi.find(
  (n) => String(n.id) === String(form.soggetto_cliente_id)
);

const tipoSoggetto =
  String(nominativoSelezionato?.tipo_cliente || "").toLowerCase().includes("soc")
    ? "societa"
    : "persona_fisica";

    const titoloDaCollegare = [
  "nuda_proprieta",
  "pegno",
  "sequestro",
  "intestazione_fiduciaria",
  "altro",
].includes(form.titolo_possesso);

if (form.ruolo === "socio" && titoloDaCollegare) {
  if (!form.partecipazione_collegata_id) {
    alert("Seleziona la partecipazione alla quale collegare il diritto.");
    return;
  }

  const percentualeQuota = Number(
    form.percentuale_partecipazione || 0
  );

  if (
    !Number.isFinite(percentualeQuota) ||
    percentualeQuota <= 0
  ) {
    alert("Inserisci la percentuale del diritto collegato.");
    return;
  }

  const resDiritto = await fetch(
    "/api/clienti-organi-diritti",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organo_id:
          form.partecipazione_collegata_id,

        soggetto_cliente_id:
          form.soggetto_cliente_id,

        tipo_diritto:
          form.titolo_possesso,

        percentuale_quota:
          percentualeQuota,

      percentuale_diritti_voto: 0,
percentuale_diritti_utili: 0,

diritto_voto: false,
diritto_utili: false,

        data_inizio:
          form.data_nomina || null,

        data_fine:
          form.data_scadenza || null,

        note:
          form.note_titolo_possesso || null,

        attivo: true,
      }),
    }
  );

  const dataDiritto = await resDiritto.json();

  if (!resDiritto.ok) {
    alert(
      dataDiritto.error ||
        "Errore salvataggio diritto collegato."
    );
    return;
  }

  setMessaggio("Diritto collegato correttamente.");

  setForm({
    soggetto_cliente_id: "",
    ruolo: "socio",
    carica: "",
    percentuale_partecipazione: "",
    titolo_possesso: "piena_proprieta",
    percentuale_diritti_voto: "",
    percentuale_diritti_utili: "",
    note_titolo_possesso: "",
    partecipazione_collegata_id: "",
    presenza: "Presente",
    principale: false,
    attivo: true,
    data_nomina: "",
    durata_carica: "Fino a revoca",
    data_scadenza: "",
    data_cessazione: "",
  });

  await caricaOrgani();
  return;
}
  
   const res = await fetch("/api/clienti-organi", {
  method: organoInModificaId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
body: JSON.stringify({
  id: organoInModificaId || undefined,
  cliente_id: clienteId,

  soggetto_cliente_id: form.soggetto_cliente_id,
  tipo_soggetto: tipoSoggetto,
  rappresentante_legale: form.ruolo === "rappresentante_legale",

  tipo_ruolo: getTipoRuolo(form.ruolo),

  ruolo: form.ruolo,
  carica: ruoliLabel[form.ruolo] || form.ruolo,
  percentuale_partecipazione:
    form.ruolo === "socio"
      ? form.percentuale_partecipazione || null
      : null,
  titolo_possesso:
  form.ruolo === "socio"
    ? form.titolo_possesso
    : "piena_proprieta",

percentuale_diritti_voto:
  form.ruolo === "socio"
    ? form.percentuale_diritti_voto || null
    : null,

percentuale_diritti_utili:
  form.ruolo === "socio"
    ? form.percentuale_diritti_utili || null
    : null,

note_titolo_possesso:
  form.ruolo === "socio"
    ? form.note_titolo_possesso || null
    : null,

data_nomina:
  form.data_nomina || null,

durata_carica:
  form.ruolo === "socio"
    ? null
    : form.durata_carica || null,

data_scadenza:
  form.data_scadenza || null,

presenza: null,

attivo:
  form.attivo,

principale:
  consentePrincipale(form.ruolo) &&
  form.principale,
}),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Errore salvataggio organo");
      return;
    }

 setMessaggio("Organo salvato correttamente.");

setForm({
  soggetto_cliente_id: "",
  ruolo: "socio",
  carica: "",
  percentuale_partecipazione: "",
  presenza: "Presente",
  principale: false,
  attivo: true,
  data_nomina: "",
  durata_carica: "Fino a revoca",
  data_scadenza: "",
  data_cessazione: "",
  titolo_possesso: "piena_proprieta",
  percentuale_diritti_voto: "",
  percentuale_diritti_utili: "",
  note_titolo_possesso: "",
  partecipazione_collegata_id: "",
  
});
    
setOrganoInModificaId("");

    setDirittiCollegati([]);
setErroreDiritti("");

await caricaOrgani();

    }

 async function disattivaOrgano(organo: any) {
  const dataCessazione = prompt(
    "Inserisci data cessazione nel formato AAAA-MM-GG",
    new Date().toISOString().slice(0, 10)
  );

  if (!dataCessazione) return;

  const res = await fetch("/api/clienti-organi", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: organo.id,
      attivo: false,
      principale: false,
      data_cessazione: dataCessazione,
    }),
  });

  if (!res.ok) {
    alert("Errore disattivazione");
    return;
  }

  await caricaOrgani();
}

async function eliminaOrgano(organo: any) {
  const ok = confirm("Eliminare definitivamente questo organo?");
  if (!ok) return;

  const res = await fetch("/api/clienti-organi", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: organo.id,
    }),
  });

  if (!res.ok) {
    alert("Errore eliminazione");
    return;
  }

  await caricaOrgani();
}

async function caricaInModifica(organo: any) {
  setOrganoInModificaId(organo.id);

  setNuovoDiritto({
  soggetto_cliente_id: "",
 tipo_diritto: "nuda_proprieta",

  percentuale_quota:
    organo.percentuale_partecipazione != null
      ? String(organo.percentuale_partecipazione)
      : "",

  percentuale_diritti_voto: "",
  percentuale_diritti_utili: "",

  diritto_voto: true,
  diritto_utili: true,

  data_inizio: "",
  data_fine: "",
  note: "",
});

  if (organo.ruolo === "socio") {
  await caricaDirittiCollegati(organo.id);
} else {
  setDirittiCollegati([]);
  setErroreDiritti("");
}

  setForm({
    soggetto_cliente_id: organo.soggetto_cliente_id || "",
    ruolo: organo.ruolo || "socio",
    carica: organo.carica || "",
    percentuale_partecipazione:
      organo.percentuale_partecipazione
        ? String(organo.percentuale_partecipazione)
        : "",
    presenza: organo.presenza || "Presente",
    principale: organo.principale || false,
    attivo: organo.attivo ?? true,
    data_nomina: organo.data_nomina || "",
    durata_carica: organo.durata_carica || "Fino a revoca",
    data_scadenza: organo.data_scadenza || "",
    data_cessazione: organo.data_cessazione || "",
    titolo_possesso:
  organo.titolo_possesso || "piena_proprieta",

percentuale_diritti_voto:
  organo.percentuale_diritti_voto
    ? String(organo.percentuale_diritti_voto)
    : "",

percentuale_diritti_utili:
  organo.percentuale_diritti_utili
    ? String(organo.percentuale_diritti_utili)
    : "",

note_titolo_possesso:
  organo.note_titolo_possesso || "",

    partecipazione_collegata_id: "",
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}
function getTipoRuolo(ruolo: string) {
  if (
    [
      "amministratore",
      "amministratore_unico",
      "amministratore_delegato",
      "presidente_cda",
      "consigliere",
      "liquidatore",
      "rappresentante_legale",
    ].includes(ruolo)
  ) {
    return "R";
  }

  if (ruolo === "socio") {
    return "S";
  }

  return "C";
}

async function importaSelezionatiDaVisura() {
  const selezionati = anteprimaImportazione.filter(
    (riga) => riga.selected === true
  );

  if (selezionati.length === 0) {
    alert("Seleziona almeno un nominativo da importare.");
    return;
  }

  const sociSenzaQuota = selezionati.filter(
    (riga) =>
      riga.ruolo === "socio" &&
      (
        riga.percentuale_partecipazione === "" ||
        riga.percentuale_partecipazione == null ||
        Number(riga.percentuale_partecipazione) <= 0
      )
  );

  if (sociSenzaQuota.length > 0) {
    alert(
      "Inserisci la quota per tutti i soci selezionati prima di procedere."
    );
    return;
  }

  setLoadingImportazione(true);

  try {
    const response = await fetch(
      "/api/clienti/organi-sociali/importa-visura",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conferma: true,
          clienteId,

          soggetti: selezionati.map((riga) => ({
            nome: String(riga.nome || "").trim(),

            codice_fiscale: normalizeCF(
              riga.codice_fiscale || ""
            ),

            ruolo: riga.ruolo,

            carica:
              riga.carica ||
              ruoliLabel[riga.ruolo] ||
              riga.ruolo,

            percentuale_partecipazione:
              riga.ruolo === "socio"
                ? Number(
                    riga.percentuale_partecipazione || 0
                  )
                : null,

            titolo_possesso:
              riga.ruolo === "socio"
                ? riga.titolo_possesso ||
                  "piena_proprieta"
                : "piena_proprieta",

            percentuale_diritti_voto:
              riga.ruolo === "socio"
                ? Number(
                    riga.percentuale_diritti_voto ||
                    riga.percentuale_partecipazione ||
                    0
                  )
                : null,

            percentuale_diritti_utili:
              riga.ruolo === "socio"
                ? Number(
                    riga.percentuale_diritti_utili ||
                    riga.percentuale_partecipazione ||
                    0
                  )
                : null,

            anagrafica_cliente_id:
              riga.anagrafica_cliente_id || null,

            dati_anagrafici:
              riga.dati_anagrafici || {},
          })),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Errore durante l'importazione dei nominativi."
      );
    }

    setShowImportazioneVisura(false);
    setAnteprimaImportazione([]);

    await caricaNominativi();
    await caricaOrgani();

    setMessaggio(
      `Importazione completata: ${
        data.inseriti || 0
      } nominativi inseriti, ${
        data.duplicati || 0
      } già presenti.`
    );
  } catch (error: any) {
    console.error(
      "Errore importaSelezionatiDaVisura:",
      error
    );

    alert(
      error?.message ||
        "Errore durante l'importazione."
    );
  } finally {
    setLoadingImportazione(false);
  }
}

function aggiornaRigaImportazione(
  indice: number,
  modifiche: Record<string, any>
) {
  setAnteprimaImportazione((precedente) =>
    precedente.map((riga, rigaIndice) =>
      rigaIndice === indice
        ? {
            ...riga,
            ...modifiche,
          }
        : riga
    )
  );
}

function selezionaTutteRigheImportazione(
  selezionato: boolean
) {
  setAnteprimaImportazione((precedente) =>
    precedente.map((riga) => ({
      ...riga,

      selected:
        riga.esito === "gia_presente"
          ? false
          : selezionato,
    }))
  );
}

  function apriModificaNominativo() {
  if (!form.soggetto_cliente_id) {
    alert("Seleziona prima un nominativo.");
    return;
  }

  const nominativo = nominativi.find(
    (item) =>
      String(item.id) ===
      String(form.soggetto_cliente_id)
  );

  if (!nominativo) {
    alert("Nominativo non trovato.");
    return;
  }

  setNominativoInModificaId(nominativo.id);

  setNuovoNominativo({
    nome_cognome:
      nominativo.ragione_sociale || "",

    codice_fiscale:
      nominativo.codice_fiscale || "",

    email:
      nominativo.email || "",

    luogo_nascita:
      nominativo.luogo_nascita || "",

    data_nascita:
      nominativo.data_nascita || "",

    indirizzo:
      nominativo.indirizzo || "",

    citta:
      nominativo.citta || "",

    provincia:
      nominativo.provincia || "",

    cap:
      nominativo.cap || "",

    tipologia_cliente:
      nominativo.tipo_cliente ||
      nominativo.tipologia_cliente ||
      "Persona fisica",
  });

    const codiceFiscale =
  String(
    nominativo.codice_fiscale || ""
  )
    .trim()
    .toUpperCase();

const datiNascitaMancanti =
  !nominativo.luogo_nascita ||
  !nominativo.data_nascita;

if (
  codiceFiscale.length === 16 &&
  isValidCF(codiceFiscale) &&
  datiNascitaMancanti
) {
  void leggiDatiDaCF(
    codiceFiscale,
    setNuovoNominativo
  );
}
  setShowNuovoNominativo(true);
}

  function isRuoloRappresentanteLegale(
  ruolo: string | null | undefined
) {
  return [
    "rappresentante_legale",
    "amministratore_unico",
    "amministratore_delegato",
    "presidente_cda",
    "liquidatore",
  ].includes(String(ruolo || ""));
}

const rappresentantePrincipalePresente =
  organi.some(
    (organo) =>
      organo.attivo === true &&
      organo.principale === true &&
      isRuoloRappresentanteLegale(
        organo.ruolo
      )
  );
function isCaricaScaduta(
  dataScadenza: string | null | undefined
): boolean {
  if (!dataScadenza) {
    return false;
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const scadenza = new Date(
    `${dataScadenza}T00:00:00`
  );

  if (Number.isNaN(scadenza.getTime())) {
    return false;
  }

  return scadenza < oggi;
}

function isCodiceFiscaleNominativoValido(): boolean {
  const codice = normalizeCF(
    nuovoNominativo.codice_fiscale || ""
  );

  if (
    nuovoNominativo.tipologia_cliente ===
    "Persona fisica"
  ) {
    return (
      codice.length === 16 &&
      isValidCF(codice)
    );
  }

  return /^\d{11}$/.test(codice);
}

return (
  <main
    style={{
      padding: 28,
      background: "#f8fafc",
      minHeight: "100vh",
    }}
  >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 400, margin: 0 }}>
            Soci e Organi sociali
          </h1>

          <p style={{ color: "#64748b", marginTop: 6 }}>
            Gestione soci, amministratori, liquidatori e altri organi collegati
            alla società.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/clienti")}
          style={secondaryButton}
        >
          ← Torna clienti
        </button>
      </div>

  <div style={cardStyle}>
  <h2 style={titleStyle}>Selezione società</h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: 12,
      marginTop: 18,
    }}
  >
    <div>
      <label style={labelStyle}>
        Cliente / società
      </label>

      <select
        style={{
          ...inputStyle,
          background: router.query.cliente_id
            ? "#f1f5f9"
            : "#fff",
        }}
        value={clienteId}
        disabled={!!router.query.cliente_id}
        onChange={(e) => {
          setClienteId(e.target.value);
          setOrgani([]);
          setDirittiCollegati([]);
          setOrganoInModificaId("");
          setErroreDiritti("");
          setMessaggio("");
        }}
      >
        <option value="">
          Seleziona società
        </option>

        {clienti.map((c) => (
          <option key={c.id} value={c.id}>
            {c.ragione_sociale}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label style={labelStyle}>
        Filtro ruolo
      </label>

      <select
        style={inputStyle}
        value={filtroRuolo}
        onChange={(e) =>
          setFiltroRuolo(e.target.value)
        }
      >
        {ruoli.map((r) => (
          <option key={r} value={r}>
            {ruoliLabel[r] || r}
          </option>
        ))}
      </select>
     </div>
</div>

{clienteId && (
  <div
    style={{
      ...cardStyle,

      border:
        datiTitolariEffettivi?.alert
          .titolare_effettivo_assente
          ? "2px solid #fca5a5"
          : "2px solid #86efac",

      background:
        datiTitolariEffettivi?.alert
          .titolare_effettivo_assente
          ? "#fff7f7"
          : "#f7fff9",
    }}
  >
   <div
  style={{
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  }}
>
  <div>
    <h2
      style={{
        ...titleStyle,
        marginBottom: 4,
      }}
    >
      Titolare Effettivo attuale
    </h2>

    <div
      style={{
        fontSize: 13,
        color: "#64748b",
      }}
    >
      Calcolato dalla composizione sociale,
      dalle partecipazioni indirette e dai
      Gruppi societari.
    </div>
  </div>

  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    }}
  >
    {datiTitolariEffettivi && (
      <div
        style={{
          padding: "7px 11px",
          borderRadius: 999,
          background:
            datiTitolariEffettivi
              .criterio_utilizzato ===
            "proprieta"
              ? "#dbeafe"
              : "#fef3c7",
          color:
            datiTitolariEffettivi
              .criterio_utilizzato ===
            "proprieta"
              ? "#1d4ed8"
              : "#92400e",
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        {datiTitolariEffettivi
          .criterio_utilizzato ===
        "proprieta"
          ? "CRITERIO DI PROPRIETÀ"
          : "CRITERIO RESIDUALE"}
      </div>
    )}

    <button
      type="button"
      onClick={() =>
        router.push(
          `/clienti/titolari-effettivi/verifica?cliente_id=${clienteId}`
        )
      }
      style={{
        padding: "9px 14px",
        borderRadius: 8,
        border: "1px solid #2563eb",
        background: "#2563eb",
        color: "#ffffff",
        fontWeight: 400,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      Verifica Titolari Effettivi
    </button>
  </div>
</div>

    {loadingTitolariEffettivi ? (
      <div
        style={{
          marginTop: 18,
          color: "#64748b",
        }}
      >
        Calcolo del Titolare Effettivo...
      </div>
    ) : erroreTitolariEffettivi ? (
      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 9,
          background: "#fee2e2",
          color: "#991b1b",
          fontWeight: 700,
        }}
      >
        {erroreTitolariEffettivi}
      </div>
    ) : !datiTitolariEffettivi ||
      datiTitolariEffettivi
        .titolari_effettivi.length === 0 ? (
      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 9,
          background: "#fee2e2",
          color: "#991b1b",
          fontWeight: 700,
        }}
      >
        Nessun Titolare Effettivo individuato
        alla data attuale.
      </div>
    ) : (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            marginTop: 18,
          }}
        >
          {datiTitolariEffettivi
            .titolari_effettivi.map(
              (titolare) => (
                <div
                  key={titolare.persona_id}
                  style={{
                    padding: 16,
                    border:
                      "1px solid #bbf7d0",
                    borderRadius: 10,
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      color: "#166534",
                      fontSize: 16,
                      fontWeight: 900,
                    }}
                  >
                    {titolare.persona_nome}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      color: "#475569",
                      fontSize: 13,
                    }}
                  >
                    CF:{" "}
                    {titolare.codice_fiscale ||
                      "non disponibile"}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1fr 1fr",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          textTransform:
                            "uppercase",
                          fontWeight: 800,
                        }}
                      >
                        Criterio
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontWeight: 700,
                        }}
                      >
                        {formattaCriterioTitolare(
                          titolare
                            .tipo_titolarita
                        )}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          textTransform:
                            "uppercase",
                          fontWeight: 800,
                        }}
                      >
                        Quota complessiva
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontWeight: 700,
                        }}
                      >
                        {titolare
                          .criterio_titolarita ===
                        "residuale"
                          ? "Non applicabile"
                          : `${Number(
                              titolare
                                .quota_complessiva ||
                                0
                            ).toLocaleString(
                              "it-IT",
                              {
                                minimumFractionDigits:
                                  2,
                                maximumFractionDigits:
                                  2,
                              }
                            )}%`}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          textTransform:
                            "uppercase",
                          fontWeight: 800,
                        }}
                      >
                        Valido dal
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontWeight: 700,
                        }}
                      >
                        {formattaDataItaliana(
                          titolare.valido_dal
                        )}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          textTransform:
                            "uppercase",
                          fontWeight: 800,
                        }}
                      >
                        Valido fino al
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontWeight: 700,
                        }}
                      >
                        {titolare.valido_al
                          ? formattaDataItaliana(
                              titolare.valido_al
                            )
                          : "In corso"}
                      </div>
                    </div>
                  </div>

                  {titolare
                    .criterio_titolarita ===
                    "residuale" && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 10,
                        borderRadius: 8,
                        background: "#fef3c7",
                        color: "#92400e",
                        fontSize: 13,
                      }}
                    >
                      {titolare.carica ||
                        titolare.ruolo ||
                        "Amministratore"}
                    </div>
                  )}

                  {titolare.percorsi?.length >
                    0 && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 10,
                        borderRadius: 8,
                        background: "#eff6ff",
                        color: "#1e3a8a",
                        fontSize: 12,
                      }}
                    >
                      {titolare.percorsi.map(
                        (percorso, indice) => (
                          <div
                            key={indice}
                            style={{
                              marginTop:
                                indice === 0
                                  ? 0
                                  : 7,
                            }}
                          >
                            {(
                              percorso
                                .percorso_nomi ||
                              []
                            ).join(" → ")}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            )}
        </div>

        {datiTitolariEffettivi.alert
          .variazione_rilevata &&
          datiTitolariEffettivi.alert
            .data_ultima_variazione && (
            <div
              style={{
                marginTop: 16,
                padding: "13px 15px",
                borderRadius: 9,
                border:
                  "1px solid #fbbf24",
                background: "#fffbeb",
                color: "#92400e",
                fontWeight: 800,
              }}
            >
              ⚠ Ultima variazione del Titolare
              Effettivo rilevata in data{" "}
              {formattaDataItaliana(
                datiTitolariEffettivi
                  .alert
                  .data_ultima_variazione
              )}
              .
            </div>
          )}
      </>
    )}
  </div>
)}

<div style={cardStyle}>
  <h2 style={titleStyle}>
    Aggiungi socio / organo
  </h2>

     <div
  style={{
    display: "grid",
    gridTemplateColumns:
      "180px minmax(320px, 1fr) 95px 155px 165px 175px auto",
    gap: 10,
    marginTop: 18,
    alignItems: "end",
  }}
>
  {/* RUOLO */}
  <div>
    <label style={labelStyle}>Ruolo</label>

    <select
      style={inputStyle}
      value={form.ruolo}
      onChange={(e) => {
        const nuovoRuolo = e.target.value;

        setForm((prev) => ({
          ...prev,

          ruolo: nuovoRuolo,

          carica:
            ruoliLabel[nuovoRuolo] || "",

          soggetto_cliente_id: "",

          percentuale_partecipazione:
            nuovoRuolo === "socio"
              ? prev.percentuale_partecipazione
              : "",

          durata_carica:
            nuovoRuolo === "socio"
              ? ""
              : prev.durata_carica ||
                "Fino a revoca",

          principale:
            consentePrincipale(nuovoRuolo)
              ? prev.principale
              : false,
        }));
      }}
    >
      {ruoli
        .filter((ruolo) => ruolo !== "tutti")
        .map((ruolo) => (
          <option key={ruolo} value={ruolo}>
            {ruoliLabel[ruolo] || ruolo}
          </option>
        ))}
    </select>
  </div>

  {/* NOMINATIVO */}
  <div>
    <label style={labelStyle}>
      Nominativo
    </label>

    <select
      style={inputStyle}
      value={form.soggetto_cliente_id}
      onChange={(e) => {
        const id = e.target.value;

        const nominativo =
          nominativi.find(
            (item) =>
              String(item.id) ===
              String(id)
          );

        setForm((prev) => ({
          ...prev,
          soggetto_cliente_id: id,
        }));

        if (!nominativo) {
          return;
        }

        setNuovoNominativo((prev) => ({
          ...prev,

          nome_cognome:
            nominativo.ragione_sociale ||
            "",

          codice_fiscale:
            nominativo.codice_fiscale ||
            "",

          email:
            nominativo.email || "",

          luogo_nascita:
            nominativo.luogo_nascita ||
            "",

          data_nascita:
            nominativo.data_nascita ||
            "",

          indirizzo:
            nominativo.indirizzo || "",

          citta:
            nominativo.citta || "",

          provincia:
            nominativo.provincia || "",

          cap:
            nominativo.cap || "",

          tipologia_cliente:
            nominativo.tipo_cliente ||
            nominativo.tipologia_cliente ||
            "Persona fisica",
        }));
      }}
    >
      <option value="">
        Seleziona nominativo
      </option>

      {nominativi.map((nominativo) => (
        <option
          key={nominativo.id}
          value={nominativo.id}
        >
          {nominativo.ragione_sociale}
          {nominativo.codice_fiscale
            ? ` — ${nominativo.codice_fiscale}`
            : ""}
        </option>
      ))}
    </select>
  </div>

  {/* QUOTA */}
  <div>
    <label style={labelStyle}>
      Quota %
    </label>

    <input
      type="number"
      min="0"
      max="100"
      step="0.01"
      disabled={
        !richiedeQuota(form.ruolo)
      }
      style={{
        ...inputStyle,

        background: richiedeQuota(
          form.ruolo
        )
          ? "#ffffff"
          : "#f1f5f9",
      }}
      value={
        richiedeQuota(form.ruolo)
          ? form.percentuale_partecipazione
          : ""
      }
      onChange={(e) => {
        const valore = e.target.value;

        setForm((prev) => ({
          ...prev,

          percentuale_partecipazione:
            valore,

          percentuale_diritti_voto:
            prev.titolo_possesso ===
            "piena_proprieta"
              ? valore
              : prev.percentuale_diritti_voto,

          percentuale_diritti_utili:
            prev.titolo_possesso ===
            "piena_proprieta"
              ? valore
              : prev.percentuale_diritti_utili,
        }));
      }}
    />
  </div>

  {/* DATA NOMINA / POSSESSO DAL */}
  <div>
    <label style={labelStyle}>
      {form.ruolo === "socio"
        ? "Possesso dal"
        : "Nomina dal"}
    </label>

    <input
      type="date"
      style={inputStyle}
      value={form.data_nomina || ""}
      onChange={(e) =>
        setForm((prev) => ({
          ...prev,
          data_nomina: e.target.value,
        }))
      }
    />
  </div>

  {/* DURATA */}
  <div>
    <label style={labelStyle}>
      Durata
    </label>

    <select
      style={{
        ...inputStyle,

        background:
          form.ruolo === "socio"
            ? "#f1f5f9"
            : "#ffffff",
      }}
      disabled={form.ruolo === "socio"}
      value={
        form.ruolo === "socio"
          ? ""
          : form.durata_carica
      }
      onChange={(e) =>
        setForm((prev) => ({
          ...prev,
          durata_carica:
            e.target.value,
        }))
      }
    >
      <option value="Fino a revoca">
        Fino a revoca
      </option>

      <option value="Anni: 1">
        Anni: 1
      </option>

      <option value="Anni: 2">
        Anni: 2
      </option>

      <option value="Anni: 3">
        Anni: 3
      </option>

      <option value="Anni: 4">
        Anni: 4
      </option>

      <option value="Anni: 5">
        Anni: 5
      </option>

      <option value="Fino al bilancio">
        Fino al bilancio
      </option>
    </select>
  </div>

  {/* DATA SCADENZA / POSSESSO FINO A */}
  <div>
    <label style={labelStyle}>
      {form.ruolo === "socio"
        ? "Possesso fino a"
        : "Scadenza carica"}
    </label>

    <input
      type="date"
      style={inputStyle}
      value={form.data_scadenza || ""}
      onChange={(e) =>
        setForm((prev) => ({
          ...prev,
          data_scadenza:
            e.target.value,
        }))
      }
    />
  </div>

  {/* PRINCIPALE */}
  <div
    style={{
      minHeight: 38,
      display: "flex",
      alignItems: "center",
      paddingBottom: 3,
    }}
  >
    <label
      style={{
        display: "flex",
        gap: 7,
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      <input
        type="checkbox"
        disabled={
          !consentePrincipale(form.ruolo)
        }
        checked={
          consentePrincipale(form.ruolo)
            ? form.principale
            : false
        }
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            principale:
              e.target.checked,
          }))
        }
      />

      Principale
    </label>
  </div>
</div>

        {form.ruolo === "socio" && (
  <div
    style={{
      marginTop: 16,
      padding: 16,
      border: "1px solid #dbeafe",
      borderRadius: 10,
      background: "#f8fbff",
    }}
  >
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr 1fr",
        gap: 12,
        alignItems: "end",
      }}
    >
      <div>
        <label style={labelStyle}>Titolo di possesso</label>

      <select
  style={inputStyle}
  value={form.titolo_possesso}
 onChange={(e) => {
  const titolo = e.target.value;
  const titoloCollegato = isTitoloCollegato(titolo);

  setForm((prev) => ({
    ...prev,
    titolo_possesso: titolo,

    percentuale_diritti_voto:
      titoloCollegato
        ? "0"
        : titolo === "piena_proprieta"
        ? prev.percentuale_partecipazione
        : prev.percentuale_diritti_voto,

    percentuale_diritti_utili:
      titoloCollegato
        ? "0"
        : titolo === "piena_proprieta"
        ? prev.percentuale_partecipazione
        : prev.percentuale_diritti_utili,

    note_titolo_possesso:
      titolo === "piena_proprieta"
        ? ""
        : prev.note_titolo_possesso,

    partecipazione_collegata_id:
      titoloCollegato
        ? prev.partecipazione_collegata_id
        : "",
  }));
}}
>
 <option value="piena_proprieta">
  Piena proprietà
</option>

<option value="usufrutto">
  Usufrutto
</option>

<option value="nuda_proprieta">
  Nuda proprietà
</option>

<option value="pegno">
  Pegno
</option>

<option value="sequestro">
  Sequestro
</option>

<option value="intestazione_fiduciaria">
  Intestazione fiduciaria
</option>

<option value="altro">
  Altro
</option>
</select>

      </div>

      <div>
        <label style={labelStyle}>Diritti di voto %</label>

        <input
  type="number"
  disabled={isTitoloCollegato(form.titolo_possesso)}
  value={form.percentuale_diritti_voto}
  style={{
    ...inputStyle,
    background: isTitoloCollegato(form.titolo_possesso)
      ? "#f1f5f9"
      : "#ffffff",
  }}
  onChange={(e)=>
    setForm((prev)=>({
      ...prev,
      percentuale_diritti_voto:e.target.value,
    }))
  }
/>
      </div>

      <div>
        <label style={labelStyle}>Diritti agli utili %</label>

       <input
  type="number"
  disabled={isTitoloCollegato(form.titolo_possesso)}
  value={form.percentuale_diritti_utili}
  style={{
    ...inputStyle,
    background: isTitoloCollegato(form.titolo_possesso)
      ? "#f1f5f9"
      : "#ffffff",
  }}
  onChange={(e)=>
    setForm((prev)=>({
      ...prev,
      percentuale_diritti_utili:e.target.value,
    }))
  }
/>
      </div>
    </div>

    {form.titolo_possesso !== "piena_proprieta" && (
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Note sul titolo di possesso</label>

        <textarea
          style={{
            ...inputStyle,
            minHeight: 80,
            resize: "vertical",
          }}
          value={form.note_titolo_possesso}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              note_titolo_possesso: e.target.value,
            }))
          }
          placeholder="Indicare eventuali accordi particolari su voto, utili o durata del diritto"
        />
      </div>
       )}
  </div>
)}

{form.ruolo === "socio" &&
  organoInModificaId &&
  form.titolo_possesso === "usufrutto" && (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        border: "2px solid #fecaca",
        borderRadius: 10,
        background: "#fff7f7",
      }}
    >
      <h3
        style={{
          margin: 0,
          color: "#dc2626",
          fontSize: 17,
          fontWeight: 800,
        }}
      >
        NUDO PROPRIETARIO COLLEGATO
      </h3>

      <p
        style={{
          marginTop: 6,
          marginBottom: 16,
          color: "#64748b",
          fontSize: 13,
        }}
      >
        Il soggetto inserito sarà collegato alla quota in
        usufrutto selezionata e non costituirà una nuova
        partecipazione autonoma.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div>
          <label style={labelStyle}>
            Nudo proprietario
          </label>

          <select
            style={inputStyle}
            value={nuovoDiritto.soggetto_cliente_id}
            onChange={(e) =>
              setNuovoDiritto((prev) => ({
                ...prev,
                soggetto_cliente_id: e.target.value,
                tipo_diritto: "nuda_proprieta",
              }))
            }
          >
            <option value="">
              Seleziona nominativo
            </option>

            {nominativi.map((nominativo) => (
              <option
                key={nominativo.id}
                value={nominativo.id}
              >
                {nominativo.ragione_sociale}
                {nominativo.codice_fiscale
                  ? ` — ${nominativo.codice_fiscale}`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>
            Quota interessata %
          </label>

          <input
            type="number"
            min="0"
            max={Number(
              form.percentuale_partecipazione || 100
            )}
            step="0.01"
            style={inputStyle}
            value={nuovoDiritto.percentuale_quota}
            onChange={(e) =>
              setNuovoDiritto((prev) => ({
                ...prev,
                percentuale_quota: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label style={labelStyle}>
            Diritti di voto %
          </label>

          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            style={inputStyle}
            value={
              nuovoDiritto.percentuale_diritti_voto
            }
            onChange={(e) =>
              setNuovoDiritto((prev) => ({
                ...prev,
                percentuale_diritti_voto:
                  e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label style={labelStyle}>
            Diritti agli utili %
          </label>

          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            style={inputStyle}
            value={
              nuovoDiritto.percentuale_diritti_utili
            }
            onChange={(e) =>
              setNuovoDiritto((prev) => ({
                ...prev,
                percentuale_diritti_utili:
                  e.target.value,
              }))
            }
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Note</label>

        <textarea
          style={{
            ...inputStyle,
            minHeight: 70,
            resize: "vertical",
          }}
          value={nuovoDiritto.note}
          onChange={(e) =>
            setNuovoDiritto((prev) => ({
              ...prev,
              note: e.target.value,
            }))
          }
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 14,
        }}
      >
        <button
          type="button"
          style={blueButton}
          onClick={salvaDirittoCollegato}
        >
          Collega nudo proprietario
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <strong>Proprietari già collegati</strong>

        {loadingDiritti ? (
          <div style={{ marginTop: 10 }}>
            Caricamento...
          </div>
        ) : erroreDiritti ? (
          <div
            style={{
              marginTop: 10,
              color: "#dc2626",
            }}
          >
            {erroreDiritti}
          </div>
        ) : dirittiCollegati.length === 0 ? (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              background: "#ffffff",
              borderRadius: 8,
              color: "#64748b",
            }}
          >
            Nessun nudo proprietario collegato.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 10,
            }}
          >
            {dirittiCollegati.map((diritto) => (
              <div
                key={diritto.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  background: "#ffffff",
                }}
              >
                <div>
                  <strong style={{ color: "#dc2626" }}>
                    NUDO PROPRIETARIO:{" "}
                    {diritto.nominativo_nome}
                  </strong>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    Quota{" "}
                    {Number(
                      diritto.percentuale_quota || 0
                    ).toFixed(2)}
                    %
                  </div>
                </div>

                <button
                  type="button"
                  style={iconDangerButton}
                  onClick={() =>
                    eliminaDirittoCollegato(diritto)
                  }
                  title="Elimina collegamento"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
           )}
          </div>
        </div>
      )}

{form.ruolo === "socio" &&
  ["nuda_proprieta", "pegno", "sequestro", "intestazione_fiduciaria", "altro"].includes(
    form.titolo_possesso
  ) && (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        border: "2px solid #fca5a5",
        borderRadius: 10,
        background: "#fff7f7",
      }}
    >
      <h3
        style={{
          margin: 0,
          marginBottom: 6,
          color: "#b91c1c",
          fontSize: 17,
          fontWeight: 800,
        }}
      >
        COLLEGAMENTO ALLA PARTECIPAZIONE
      </h3>

      <p
        style={{
          marginTop: 0,
          marginBottom: 16,
          color: "#64748b",
          fontSize: 13,
        }}
      >
        Questo titolo non costituisce una nuova quota autonoma.
        Seleziona la partecipazione principale alla quale deve essere collegato.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div>
          <label style={labelStyle}>
            Partecipazione / usufruttuario da collegare
          </label>

          <select
            style={{
              ...inputStyle,
              borderColor: form.partecipazione_collegata_id
                ? "#d1d5db"
                : "#dc2626",
              background: form.partecipazione_collegata_id
                ? "#ffffff"
                : "#fef2f2",
            }}
            value={form.partecipazione_collegata_id}
           onChange={(e) => {
  setForm((prev) => ({
    ...prev,
    partecipazione_collegata_id: e.target.value,
  }));
}}
          >
            <option value="">
              Seleziona la partecipazione
            </option>

            {organi
              .filter(
  (organo) =>
    organo.ruolo === "socio" &&
    organo.attivo === true &&
    String(organo.titolo_possesso) === "usufrutto"
)
              .map((organo) => (
                <option key={organo.id} value={organo.id}>
                  {organo.soggetto_cliente?.ragione_sociale || "Nominativo"}
                  {" — "}
                  {titoliPossessoLabel[
                    String(organo.titolo_possesso || "piena_proprieta")
                  ] || "Piena proprietà"}
                  {" — "}
                  {Number(
                    organo.percentuale_partecipazione || 0
                  ).toFixed(2)}
                  %
                </option>
              ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>
            Quota del diritto collegato %
          </label>

          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            style={inputStyle}
            value={form.percentuale_partecipazione}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                percentuale_partecipazione: e.target.value,
              }))
            }
          />
        </div>
      </div>
    </div>
  )}

<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  }}
>
  <button
  type="button"
  disabled={!clienteId}
  onClick={() =>
    document
      .getElementById(
        "visuraOrganiInput"
      )
      ?.click()
  }
  style={{
    border: "1px solid #16a34a",
    borderRadius: 8,
    padding: "9px 14px",
    background: clienteId
      ? "#16a34a"
      : "#dcfce7",
    color: clienteId
      ? "#ffffff"
      : "#86a88f",
    cursor: clienteId
      ? "pointer"
      : "not-allowed",
    fontWeight: 600,
  }}
>
  Importa da visura
</button>

<input
  id="visuraOrganiInput"
  type="file"
  accept=".pdf"
  style={{ display: "none" }}
  onChange={importaVisura}
/>
  <button
    type="button"
    style={secondaryButton}
    onClick={() => {
      setNominativoInModificaId(null);

      setNuovoNominativo({
        nome_cognome: "",
        codice_fiscale: "",
        email: "",
        luogo_nascita: "",
        data_nascita: "",
        indirizzo: "",
        citta: "",
        provincia: "",
        cap: "",
        tipologia_cliente:
          "Persona fisica",
      });

      setShowNuovoNominativo(true);
    }}
  >
    + Nuovo
  </button>

  <button
    type="button"
    style={{
      ...secondaryButton,

      opacity:
        form.soggetto_cliente_id
          ? 1
          : 0.5,

      cursor:
        form.soggetto_cliente_id
          ? "pointer"
          : "not-allowed",
    }}
    disabled={
      !form.soggetto_cliente_id
    }
    onClick={apriModificaNominativo}
  >
    Modifica anagrafica
  </button>

  <button
    type="button"
    style={blueButton}
    onClick={salvaOrgano}
  >
    {organoInModificaId
      ? "Aggiorna nominativo"
      : "Inserisci nominativo"}
  </button>
</div>

{messaggio && (
  <div
    style={{
      marginTop: 12,
      fontSize: 14,
      color: "#475569",
    }}
  >
    {messaggio}
  </div>
)}

</div>

      <div
  style={{
    ...cardStyle,
    border: totaleQuoteCorretto
      ? "2px solid #86efac"
      : "2px solid #fca5a5",
  }}
>
  <h2 style={titleStyle}>Soci / Organi collegati</h2>

  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 14,
      marginTop: 16,
      padding: "14px 16px",
      borderRadius: 10,
      background: totaleQuoteCorretto
        ? "#dcfce7"
        : "#fee2e2",
      color: totaleQuoteCorretto
        ? "#166534"
        : "#991b1b",
      fontWeight: 800,
    }}
  >
    <span>Totale quote societarie</span>

    <span style={{ fontSize: 20 }}>
      {totaleQuote.toLocaleString("it-IT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
      %
    </span>

    {!totaleQuoteCorretto && (
      <span>
        Differenza:{" "}
        {differenzaQuote > 0 ? "+" : ""}
        {differenzaQuote.toLocaleString("it-IT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
        %
      </span>
    )}
  </div>

  {loading ? (
          <p>Caricamento...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
            <thead>
  <tr>
    <th style={thStyle}>Nominativo</th>
    <th style={thStyle}>Codice fiscale</th>
   
    <th style={thStyle}>Carica</th>
    <th style={thStyle}>Quota</th>
     <th style={thStyle}>Titolo</th>
<th style={thStyle}>Voto</th>
<th style={thStyle}>Utili</th>
    <th style={thStyle}>Data nomina</th>
    <th style={thStyle}>Principale</th>
    <th style={thStyle}>Attivo</th>
    <th style={thStyle}>Data cessazione</th>
    <th style={thStyle}>Durata carica</th>
    <th style={thStyle}>Data scadenza</th>
    <th style={thStyle}>Azioni</th>
   
  </tr>
</thead>

           <tbody>
 {organiFiltrati.map((o) => (
  <React.Fragment key={o.id}>
    <tr>
<td
  style={{
    ...tdStyle,
    color: isCaricaScaduta(
      o.data_scadenza
    )
      ? "#dc2626"
      : undefined,
    fontWeight: isCaricaScaduta(
      o.data_scadenza
    )
      ? 700
      : undefined,
    background: isCaricaScaduta(
      o.data_scadenza
    )
      ? "#fef2f2"
      : undefined,
  }}
>
  {o.soggetto_cliente?.ragione_sociale || "—"}
</td>
    <td style={tdStyle}>
 {o.soggetto_cliente?.codice_fiscale ||
  o.soggetto_cliente?.partita_iva ||
  "—"}
</td>

         <td style={tdStyle}>
      {o.carica || ruoliLabel[o.ruolo] || "—"}
      </td>

      <td style={tdStyle}>
        {o.percentuale_partecipazione
          ? `${Number(o.percentuale_partecipazione).toFixed(2)}%`
          : "—"}
      </td>

 <td style={tdStyle}>
  {o.ruolo === "socio" ? (
    <div>
      <div>
        {titoliPossessoLabel[
          String(o.titolo_possesso || "piena_proprieta")
        ] || "Piena proprietà"}
      </div>

      {o.titolo_possesso === "usufrutto" && (
        <div
         style={{
  marginTop: 4,
  fontSize: 11,
  fontWeight: 400,
  color: "#2563eb",
}}
        >
          {getCodicePartecipazione(o.id)}
        </div>
      )}
    </div>
  ) : (
    "—"
  )}
</td>

<td style={tdStyle}>
  {o.ruolo === "socio" && o.percentuale_diritti_voto != null
    ? `${Number(o.percentuale_diritti_voto).toFixed(2)}%`
    : "—"}
</td>

<td style={tdStyle}>
  {o.ruolo === "socio" && o.percentuale_diritti_utili != null
    ? `${Number(o.percentuale_diritti_utili).toFixed(2)}%`
    : "—"}
</td>

  <td style={tdStyle}>
  {o.data_nomina
    ? new Date(
        `${o.data_nomina}T00:00:00`
      ).toLocaleDateString("it-IT")
    : "—"}
</td>

<td style={tdStyle}>
  {o.principale ? "Sì" : "No"}
</td>

<td style={tdStyle}>
  {o.attivo ? "Sì" : "No"}
</td>

<td style={tdStyle}>
  {o.data_cessazione
    ? new Date(o.data_cessazione).toLocaleDateString("it-IT")
    : "—"}
</td>

<td style={tdStyle}>
  {o.durata_carica || "—"}
</td>

<td
  style={{
    ...tdStyle,
    color: isCaricaScaduta(
      o.data_scadenza
    )
      ? "#dc2626"
      : undefined,
    fontWeight: isCaricaScaduta(
      o.data_scadenza
    )
      ? 700
      : undefined,
    background: isCaricaScaduta(
      o.data_scadenza
    )
      ? "#fef2f2"
      : undefined,
  }}
>
  {o.data_scadenza
    ? new Date(
        `${o.data_scadenza}T00:00:00`
      ).toLocaleDateString("it-IT")
    : "—"}
</td>

      <td style={tdStyle}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
         <button
  type="button"
  onClick={() => caricaInModifica(o)}
  title="Modifica"
  style={iconButton}
>
  <Pencil size={16} />
</button>

          {o.attivo && (
           <button
  type="button"
  onClick={() => disattivaOrgano(o)}
  title="Disattiva"
  style={iconButton}
>
  <Power size={16} />
</button>
          )}

         <button
  type="button"
  onClick={() => eliminaOrgano(o)}
  title="Elimina"
  style={iconDangerButton}
>
  <Trash2 size={16} />
</button>
        </div>
      </td>
       </tr>

    {(o.diritti_collegati || []).map(
      (diritto: any) => (
        <tr
          key={diritto.id}
          style={{
            background: "#fff7f7",
          }}
        >
         <td
  style={{
    ...tdStyle,
    paddingLeft: 34,
    color: "#dc2626",
  }}
>
  <div style={{ fontWeight: 800 }}>
    ↳ NUDO PROPRIETARIO:{" "}
    {diritto.nominativo_nome || "—"}
  </div>

  <div
    style={{
      marginTop: 5,
      fontSize: 12,
      fontWeight: 400,
      color: "#64748b",
    }}
  >
    Collegato a:{" "}
    {o.soggetto_cliente?.ragione_sociale || "—"}
  </div>
</td>

          <td
            style={{
              ...tdStyle,
              color: "#dc2626",
            }}
          >
            {diritto.nominativo_codice_fiscale || "—"}
          </td>

          <td style={tdStyle}>
  Socio
</td>

          <td style={tdStyle}>
            {Number(
              diritto.percentuale_quota || 0
            ).toFixed(2)}
            %
          </td>

<td
  style={{
    ...tdStyle,
    color:"#dc2626",
  }}
>
  <div>
    Nudo proprietario
  </div>

  <div
    style={{
      marginTop:4,
      fontSize:11,
      color:"#2563eb",
    }}
  >
    {getCodicePartecipazione(o.id)}
  </div>
</td>

          <td style={tdStyle}>
            {diritto.percentuale_diritti_voto != null
              ? `${Number(
                  diritto.percentuale_diritti_voto
                ).toFixed(2)}%`
              : "—"}
          </td>

          <td style={tdStyle}>
            {diritto.percentuale_diritti_utili != null
              ? `${Number(
                  diritto.percentuale_diritti_utili
                ).toFixed(2)}%`
              : "—"}
          </td>

          <td style={tdStyle}>—</td>
          <td style={tdStyle}>—</td>
          <td style={tdStyle}>
            {diritto.attivo ? "Sì" : "No"}
          </td>
          <td style={tdStyle}>—</td>
          <td style={tdStyle}>—</td>
          <td style={tdStyle}>—</td>

          <td style={tdStyle}>
            <button
              type="button"
              style={iconDangerButton}
              title="Elimina collegamento"
              onClick={() =>
                eliminaDirittoCollegato(diritto)
              }
            >
              <Trash2 size={16} />
            </button>
          </td>
        </tr>
      )
    )}
  </React.Fragment>
))}
              {organiFiltrati.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan={15}>
                    Nessun organo collegato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showImportazioneVisura && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      background: "rgba(15, 23, 42, 0.55)",
    }}
  >
    <div
      style={{
        width: "min(1500px, 98vw)",
        maxHeight: "92vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 14,
        background: "#ffffff",
        boxShadow:
          "0 24px 70px rgba(15, 23, 42, 0.28)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          padding: "20px 22px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div>
          <h2 style={{ ...titleStyle, fontSize: 22 }}>
            Anteprima importazione visura
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: 13,
            }}
          >
            Controlla, modifica e seleziona i
            nominativi da importare.
          </p>
        </div>

        <button
          type="button"
          style={secondaryButton}
          onClick={() => {
            setShowImportazioneVisura(false);
            setAnteprimaImportazione([]);
          }}
        >
          Chiudi
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "12px 22px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div style={{ fontSize: 13, color: "#475569" }}>
          Trovati:{" "}
          <strong>
            {anteprimaImportazione.length}
          </strong>
          {" · "}
          Selezionati:{" "}
          <strong>
            {
              anteprimaImportazione.filter(
                (riga) => riga.selected
              ).length
            }
          </strong>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          <button
            type="button"
            style={secondaryButton}
            onClick={() =>
              selezionaTutteRigheImportazione(true)
            }
          >
            Seleziona tutti
          </button>

          <button
            type="button"
            style={secondaryButton}
            onClick={() =>
              selezionaTutteRigheImportazione(false)
            }
          >
            Deseleziona tutti
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 18,
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 1250,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Importa</th>
              <th style={thStyle}>Nominativo</th>
              <th style={thStyle}>
                Codice fiscale
              </th>
              <th style={thStyle}>Ruolo</th>
              <th style={thStyle}>Carica</th>
              <th style={thStyle}>Quota %</th>
              <th style={thStyle}>Titolo</th>
              <th style={thStyle}>Voto %</th>
              <th style={thStyle}>Utili %</th>
              <th style={thStyle}>Esito</th>
            </tr>
          </thead>

          <tbody>
            {anteprimaImportazione.map(
              (riga, indice) => {
                const giaPresente =
                  riga.esito === "gia_presente";

function isCaricaScaduta(
  dataScadenza: string | null | undefined
) {
  if (!dataScadenza) {
    return false;
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const scadenza = new Date(
    `${dataScadenza}T00:00:00`
  );

  return scadenza < oggi;
}

function isCodiceFiscaleAltroValido(
  valore: string
): boolean {
  const codice = normalizeCF(valore);

  return /^\d{11}$/.test(codice);
}

function isCodiceFiscaleNominativoValido(): boolean {
  const codice = normalizeCF(
    nuovoNominativo.codice_fiscale
  );

  if (
    nuovoNominativo.tipologia_cliente ===
    "Persona fisica"
  ) {
    return (
      codice.length === 16 &&
      isValidCF(codice)
    );
  }

  return isCodiceFiscaleAltroValido(
    codice
  );
}

return (
                  <tr
                    key={`${riga.codice_fiscale}-${riga.ruolo}-${indice}`}
                    style={{
                      background: giaPresente
                        ? "#f8fafc"
                        : "#ffffff",
                    }}
                  >
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={
                          riga.selected === true
                        }
                        disabled={giaPresente}
                        onChange={(event) =>
                          aggiornaRigaImportazione(
                            indice,
                            {
                              selected:
                                event.target.checked,
                            }
                          )
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        style={{
                          ...inputStyle,
                          minWidth: 210,
                        }}
                        value={riga.nome || ""}
                        onChange={(event) =>
                          aggiornaRigaImportazione(
                            indice,
                            {
                              nome:
                                event.target.value,
                            }
                          )
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        style={{
                          ...inputStyle,
                          minWidth: 175,
                        }}
                        maxLength={16}
                        value={
                          riga.codice_fiscale || ""
                        }
                        onChange={(event) =>
                          aggiornaRigaImportazione(
                            indice,
                            {
                              codice_fiscale:
                                normalizeCF(
                                  event.target.value
                                ),
                            }
                          )
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <select
                        style={{
                          ...inputStyle,
                          minWidth: 175,
                        }}
                        value={riga.ruolo || ""}
                        onChange={(event) => {
                          const ruolo =
                            event.target.value;

                          aggiornaRigaImportazione(
                            indice,
                            {
                              ruolo,
                              carica:
                                ruoliLabel[ruolo] ||
                                ruolo,
                            }
                          );
                        }}
                      >
                        {ruoli
                          .filter(
                            (ruolo) =>
                              ruolo !== "tutti"
                          )
                          .map((ruolo) => (
                            <option
                              key={ruolo}
                              value={ruolo}
                            >
                              {ruoliLabel[ruolo] ||
                                ruolo}
                            </option>
                          ))}
                      </select>
                    </td>

                    <td style={tdStyle}>
                      <input
                        style={{
                          ...inputStyle,
                          minWidth: 190,
                        }}
                        value={riga.carica || ""}
                        onChange={(event) =>
                          aggiornaRigaImportazione(
                            indice,
                            {
                              carica:
                                event.target.value,
                            }
                          )
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        disabled={
                          riga.ruolo !== "socio"
                        }
                        style={{
                          ...inputStyle,
                          width: 95,
                          background:
                            riga.ruolo === "socio"
                              ? "#ffffff"
                              : "#f1f5f9",
                        }}
                        value={
                          riga
                            .percentuale_partecipazione ||
                          ""
                        }
                        onChange={(event) => {
                          const valore =
                            event.target.value;

                          aggiornaRigaImportazione(
                            indice,
                            {
                              percentuale_partecipazione:
                                valore,
                              percentuale_diritti_voto:
                                riga.titolo_possesso ===
                                "piena_proprieta"
                                  ? valore
                                  : riga.percentuale_diritti_voto ||
                                    "",
                              percentuale_diritti_utili:
                                riga.titolo_possesso ===
                                "piena_proprieta"
                                  ? valore
                                  : riga.percentuale_diritti_utili ||
                                    "",
                            }
                          );
                        }}
                      />
                    </td>

                    <td style={tdStyle}>
                      <select
                        disabled={
                          riga.ruolo !== "socio"
                        }
                        style={{
                          ...inputStyle,
                          minWidth: 175,
                          background:
                            riga.ruolo === "socio"
                              ? "#ffffff"
                              : "#f1f5f9",
                        }}
                        value={
                          riga.titolo_possesso ||
                          "piena_proprieta"
                        }
                        onChange={(event) => {
                          const titolo =
                            event.target.value;

                          aggiornaRigaImportazione(
                            indice,
                            {
                              titolo_possesso:
                                titolo,
                              percentuale_diritti_voto:
                                titolo ===
                                "piena_proprieta"
                                  ? riga.percentuale_partecipazione ||
                                    ""
                                  : "0",
                              percentuale_diritti_utili:
                                titolo ===
                                "piena_proprieta"
                                  ? riga.percentuale_partecipazione ||
                                    ""
                                  : "0",
                            }
                          );
                        }}
                      >
                        {Object.entries(
                          titoliPossessoLabel
                        ).map(
                          ([valore, etichetta]) => (
                            <option
                              key={valore}
                              value={valore}
                            >
                              {etichetta}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        disabled={
                          riga.ruolo !== "socio"
                        }
                        style={{
                          ...inputStyle,
                          width: 90,
                          background:
                            riga.ruolo === "socio"
                              ? "#ffffff"
                              : "#f1f5f9",
                        }}
                        value={
                          riga
                            .percentuale_diritti_voto ||
                          ""
                        }
                        onChange={(event) =>
                          aggiornaRigaImportazione(
                            indice,
                            {
                              percentuale_diritti_voto:
                                event.target.value,
                            }
                          )
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        disabled={
                          riga.ruolo !== "socio"
                        }
                        style={{
                          ...inputStyle,
                          width: 90,
                          background:
                            riga.ruolo === "socio"
                              ? "#ffffff"
                              : "#f1f5f9",
                        }}
                        value={
                          riga
                            .percentuale_diritti_utili ||
                          ""
                        }
                        onChange={(event) =>
                          aggiornaRigaImportazione(
                            indice,
                            {
                              percentuale_diritti_utili:
                                event.target.value,
                            }
                          )
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 9px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                          background:
                            riga.esito ===
                            "gia_presente"
                              ? "#e2e8f0"
                              : riga.esito ===
                                "nuovo_ruolo"
                              ? "#fef3c7"
                              : "#dcfce7",
                          color:
                            riga.esito ===
                            "gia_presente"
                              ? "#475569"
                              : riga.esito ===
                                "nuovo_ruolo"
                              ? "#92400e"
                              : "#166534",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {riga.esito ===
                        "gia_presente"
                          ? "Già presente"
                          : riga.esito ===
                            "nuovo_ruolo"
                          ? "Nuovo ruolo"
                          : "Nuovo soggetto"}
                      </span>
                    </td>
                  </tr>
                );
              }
            )}

            {anteprimaImportazione.length ===
              0 && (
              <tr>
                <td
                  style={tdStyle}
                  colSpan={10}
                >
                  Nessun nominativo individuato
                  nella visura.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "16px 22px",
          borderTop: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            color: "#b45309",
            fontSize: 12,
          }}
        >
          Controlla attentamente i nominativi prima
          dell’importazione.
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
          }}
        >
          <button
            type="button"
            style={secondaryButton}
            onClick={() => {
              setShowImportazioneVisura(false);
              setAnteprimaImportazione([]);
            }}
          >
            Annulla
          </button>

          <button
            type="button"
            style={{
              ...blueButton,
              opacity:
                anteprimaImportazione.some(
                  (riga) => riga.selected
                )
                  ? 1
                  : 0.55,
              cursor:
                anteprimaImportazione.some(
                  (riga) => riga.selected
                )
                  ? "pointer"
                  : "not-allowed",
            }}
            disabled={
              !anteprimaImportazione.some(
                (riga) => riga.selected
              )
            }
          onClick={importaSelezionatiDaVisura}
          >
            Importa selezionati
          </button>
        </div>
      </div>
    </div>
  </div>
)}
      
  {showNuovoNominativo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              width: 700,
              maxWidth: "95%",
            }}
          >
           <h2>
  {nominativoInModificaId
    ? "Modifica nominativo"
    : "Nuovo nominativo"}
</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 15,
              }}
            >
             <input
  style={inputStyle}
  placeholder="Cognome e nome"
  value={nuovoNominativo.nome_cognome}
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      nome_cognome: e.target.value,
    }))
  }
/>

<select
  style={inputStyle}
  value={nuovoNominativo.tipologia_cliente}
  onChange={(e) => {
    const tipologia = e.target.value;

    setNuovoNominativo((p) => ({
      ...p,
      tipologia_cliente: tipologia,

      luogo_nascita:
        tipologia === "Persona fisica"
          ? p.luogo_nascita
          : "",

      data_nascita:
        tipologia === "Persona fisica"
          ? p.data_nascita
          : "",
    }));
  }}
>
  <option value="Persona fisica">
    Persona fisica
  </option>

  <option value="Altro">
    Società / ente
  </option>
</select>

<div>
  <input
    style={{
      ...inputStyle,
      borderColor:
        nuovoNominativo.codice_fiscale &&
        !isCodiceFiscaleNominativoValido()
          ? "#dc2626"
          : inputStyle.borderColor,
    }}
    placeholder={
      nuovoNominativo.tipologia_cliente ===
      "Persona fisica"
        ? "Codice fiscale"
        : "Codice fiscale società / ente"
    }
    maxLength={
      nuovoNominativo.tipologia_cliente ===
      "Persona fisica"
        ? 16
        : 11
    }
    value={nuovoNominativo.codice_fiscale}
    onChange={async (e) => {
      const cf = normalizeCF(e.target.value);

      setNuovoNominativo((p) => ({
        ...p,
        codice_fiscale: cf,
      }));

      if (
        nuovoNominativo.tipologia_cliente ===
          "Persona fisica" &&
        cf.length === 16 &&
        isValidCF(cf)
      ) {
        await leggiDatiDaCF(
          cf,
          setNuovoNominativo
        );
      }
    }}
  />

  {nuovoNominativo.codice_fiscale &&
    !isCodiceFiscaleNominativoValido() && (
      <div
        style={{
          marginTop: 4,
          color: "#dc2626",
          fontSize: 12,
        }}
      >
        {nuovoNominativo.tipologia_cliente ===
        "Persona fisica"
          ? "Codice fiscale della persona fisica non valido"
          : "Il codice fiscale della società o ente deve essere composto da 11 cifre"}
      </div>
    )}
</div>

<input
  style={inputStyle}
  placeholder="Email"
  value={nuovoNominativo.email}
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      email: e.target.value,
    }))
  }
/>

<input
  style={{
    ...inputStyle,
    background:
      nuovoNominativo.tipologia_cliente ===
      "Persona fisica"
        ? "#fff"
        : "#f1f5f9",
  }}
  placeholder="Luogo nascita"
  disabled={
    nuovoNominativo.tipologia_cliente !==
    "Persona fisica"
  }
  value={nuovoNominativo.luogo_nascita}
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      luogo_nascita: e.target.value,
    }))
  }
/>

<input
  type="date"
  style={{
    ...inputStyle,
    background:
      nuovoNominativo.tipologia_cliente ===
      "Persona fisica"
        ? "#fff"
        : "#f1f5f9",
  }}
  disabled={
    nuovoNominativo.tipologia_cliente !==
    "Persona fisica"
  }
  value={nuovoNominativo.data_nascita}
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      data_nascita: e.target.value,
    }))
  }
/>

<input
  style={inputStyle}
  placeholder="Indirizzo"
  value={nuovoNominativo.indirizzo}
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      indirizzo: e.target.value,
    }))
  }
/>

<input
  style={inputStyle}
  placeholder="Città"
  value={nuovoNominativo.citta}
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      citta: e.target.value,
    }))
  }
/>

<input
  style={inputStyle}
  placeholder="Provincia"
  maxLength={2}
  value={nuovoNominativo.provincia}
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      provincia: e.target.value
        .toUpperCase()
        .slice(0, 2),
    }))
  }
/>

<input
  style={inputStyle}
  placeholder="CAP"
  maxLength={5}
  value={nuovoNominativo.cap}
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      cap: e.target.value
        .replace(/\D/g, "")
        .slice(0, 5),
    }))
  }
/>

</div>

<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  }}
>
  <button
    type="button"
    style={secondaryButton}
    onClick={() => {
      setShowNuovoNominativo(false);
      setNominativoInModificaId(null);
    }}
  >
    Annulla
  </button>

  <button
    type="button"
    style={blueButton}
    onClick={salvaNuovoNominativo}
  >
    {nominativoInModificaId
      ? "Salva modifiche"
      : "Salva nominativo"}
  </button>
</div>

  </div>
</div>
)}

</div>

</main>
);
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginTop: 18,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
  color: "#111827",
};

const blueButton: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#2563eb",
  color: "#fff",
  padding: "10px 18px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  color: "#334155",
  padding: "9px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#dc2626",
  cursor: "pointer",
  fontWeight: 600,
};

const iconButton: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 8,
  width: 36,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#334155",
};

const iconDangerButton: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff",
  borderRadius: 8,
  width: 36,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#dc2626",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: 14,
  fontSize: 14,
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
};
