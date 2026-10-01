"use client";

import React, { useEffect, useMemo, useState } from "react";
import { isCompanyClient } from "@/lib/isCompanyClient";
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
  "vice_presidente_cda",
  "consigliere",
  "sindaco_effettivo",
  "presidente_collegio_sindacale",
  "sindaco_unico",
  "sindaco_supplente",
  "revisore",
  "rappresentante_legale",
  "altro",
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

vice_presidente_cda:
  "Vice presidente del CDA",

consigliere:
  "Consigliere",
  sindaco_effettivo: "Sindaco effettivo",
  presidente_collegio_sindacale: "Presidente del collegio sindacale",
  sindaco_unico: "Sindaco unico",
  sindaco_supplente: "Sindaco supplente",
  revisore: "Revisore",
  rappresentante_legale: "Rappresentante legale",
  altro:
  "Altro",
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
  "vice_presidente_cda",
  "consigliere",
  "liquidatore",
  "rappresentante_legale",
];

const ruoliAmministrazione = [
  "amministratore",
  "amministratore_unico",
  "amministratore_delegato",
  "consigliere_delegato",
  "presidente_cda",
  "vice_presidente_cda",
  "consigliere",
  "liquidatore",
  "rappresentante_legale",
];

const ruoliControllo = [
  "sindaco_effettivo",
  "presidente_collegio_sindacale",
  "sindaco_unico",
  "sindaco_supplente",
  "revisore",
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
  const codiceFiscale = normalizeCF(cf);

  if (
    codiceFiscale.length !== 16 ||
    !isValidCF(codiceFiscale)
  ) {
    return;
  }

  try {
    const [
      dataNascita,
      comuneNascita,
    ] = await Promise.all([
      Promise.resolve(
        extractDataNascitaFromCF(
          codiceFiscale
        )
      ),
      getComuneFromCF(
        codiceFiscale
      ),
    ]);

    setNuovoNominativo((prev: any) => ({
      ...prev,
      data_nascita:
        dataNascita ||
        prev.data_nascita ||
        "",
      luogo_nascita:
        comuneNascita?.comune ||
        prev.luogo_nascita ||
        "",
    }));
  } catch (error) {
    console.error(
      "Errore compilazione automatica dati da codice fiscale:",
      error
    );
  }
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

  criterio_dettaglio?: string | null;
  societa_intermedia_nome?: string | null;
  quota_societa_intermedia?: number | null;
  quota_controllo_societa_intermedia?: number | null;

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

function calcolaScadenzaDaAnni(dataNomina: string, anniRaw: string | number): string {
  if (!dataNomina) return "";
  const anni = Number(anniRaw);
  if (!Number.isFinite(anni) || anni <= 0) return "";
  const parti = dataNomina.split("-").map(Number);
  if (parti.length !== 3 || parti.some((n) => !Number.isFinite(n))) return "";
  const [anno, mese, giorno] = parti;
  const targetYear = anno + Math.trunc(anni);
  const ultimoGiornoMese = new Date(targetYear, mese, 0).getDate();
  const giornoValido = Math.min(giorno, ultimoGiornoMese);
  return `${targetYear}-${String(mese).padStart(2, "0")}-${String(giornoValido).padStart(2, "0")}`;
}

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

  const [
  nominativoInModificaId,
  setNominativoInModificaId,
] = useState<string | null>(null);

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
const [modalSezione, setModalSezione] = useState<"soci" | "amministrazione" | "controllo" | null>(null);
const [ricercaNominativo, setRicercaNominativo] = useState("");

const [showNuovoNominativo, setShowNuovoNominativo] = useState(false);
const [
  nuovoNominativoDestinazione,
  setNuovoNominativoDestinazione,
] = useState<"principale" | "compagine">("principale");

const [compagineSocietaId, setCompagineSocietaId] = useState("");
const [compagineStack, setCompagineStack] = useState<string[]>([]);
const [compagineSoci, setCompagineSoci] = useState<any[]>([]);
const [compagineInModificaId, setCompagineInModificaId] = useState("");
const [loadingCompagine, setLoadingCompagine] = useState(false);
const [erroreCompagine, setErroreCompagine] = useState("");
const [socioCompagineForm, setSocioCompagineForm] = useState({
  soggetto_cliente_id: "",
  percentuale_partecipazione: "",
  importo_quota_nominale: "",
  percentuale_diritti_voto: "",
  percentuale_diritti_utili: "",
  data_nomina: "",
  data_scadenza: "",
});

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

  percentuale_partecipazione: "", importo_quota_nominale: "",
  titolo_possesso: "piena_proprieta",
  percentuale_diritti_voto: "",
  percentuale_diritti_utili: "",
  note_titolo_possesso: "",
  partecipazione_collegata_id: "",

  presenza: "Presente",
  principale: false,
  attivo: true,
  data_nomina: "",
  durata_carica: "A revoca", durata_carica_anni: "",
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
  if (!router.isReady) return;
  void caricaClienti();
}, [router.isReady, router.query.cliente_id]);

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

const nominativoSocioSelezionato = useMemo(
  () =>
    nominativi.find(
      (n) =>
        String(n.id) ===
        String(form.soggetto_cliente_id)
    ) || null,
  [nominativi, form.soggetto_cliente_id]
);

const socioSocietaSelezionata =
  modalSezione === "soci" &&
  Boolean(nominativoSocioSelezionato) &&
  isSocietaNominativo(
    nominativoSocioSelezionato
  );

const societaSelezionataClienteSmp =
  nominativoSocioSelezionato?.cliente === true;

useEffect(() => {
  if (!socioSocietaSelezionata) {
    setCompagineSocietaId("");
    setCompagineStack([]);
    setCompagineSoci([]);
    setErroreCompagine("");
    return;
  }

  const rootId = String(
    nominativoSocioSelezionato?.id || ""
  );

  if (
    rootId &&
    compagineStack.length === 0 &&
    compagineSocietaId !== rootId
  ) {
    setCompagineSocietaId(rootId);
  }
}, [
  socioSocietaSelezionata,
  nominativoSocioSelezionato?.id,
]);

useEffect(() => {
  if (!compagineSocietaId) {
    setCompagineSoci([]);
    return;
  }

  void caricaCompagineSocieta(
    compagineSocietaId
  );
}, [compagineSocietaId]);

  async function caricaClienti() {
    const supabase = getSupabaseClient() as any;
    const idDaQuery =
      typeof router.query.cliente_id === "string"
        ? router.query.cliente_id.trim()
        : "";

    let query = supabase
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        codice_fiscale,
        partita_iva,
        cognome,
        nome,
        studio_id,
        tipo_cliente,
        attivo
      `)
      .eq("cliente", true)
      .eq("attivo", true);

    if (idDaQuery) {
      query = query.eq("id", idDaQuery).limit(1);
    } else {
      query = query.order("ragione_sociale");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Errore caricaClienti:", error);
      setClienti([]);
      return;
    }

    const clientiSocieta = (data || []).filter(isCompanyClient);

    setClienti(clientiSocieta);
  }

async function caricaNominativi() {
  const supabase = getSupabaseClient() as any;

const { data, error } = await supabase
  .from("tbclienti")
  .select(`
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
  
function isSocietaNominativo(
  nominativo: any
): boolean {
  if (!nominativo) return false;

  const tipo = String(
    nominativo?.tipo_cliente || ""
  )
    .trim()
    .toLowerCase();

  if (
    tipo &&
    !tipo.includes("persona fisica")
  ) {
    return true;
  }

  const codiceFiscale = String(
    nominativo?.codice_fiscale || ""
  )
    .trim()
    .toUpperCase();

  const partitaIva = String(
    nominativo?.partita_iva || ""
  )
    .trim();

  /*
   * In alcune vecchie anagrafiche tipo_cliente
   * può essere valorizzato in modo incoerente.
   * CF/P.IVA numerico di 11 cifre identifica qui
   * una società/ente ai fini della gestione soci.
   */
  if (/^\d{11}$/.test(codiceFiscale)) {
    return true;
  }

  if (/^\d{11}$/.test(partitaIva)) {
    return true;
  }

  return false;
}

async function caricaCompagineSocieta(
  societaId: string
) {
  if (!societaId) {
    setCompagineSoci([]);
    setErroreCompagine("");
    return;
  }

  setLoadingCompagine(true);
  setErroreCompagine("");

  try {
    const res = await fetch(
      `/api/clienti-organi?cliente_id=${encodeURIComponent(
        societaId
      )}`,
      { cache: "no-store" }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
          "Errore caricamento compagine societaria"
      );
    }

    setCompagineSoci(
      (data.organi || []).filter(
        (item: any) =>
          item.ruolo === "socio" &&
          item.attivo !== false
      )
    );
  } catch (error: any) {
    console.error(
      "Errore caricaCompagineSocieta:",
      error
    );
    setCompagineSoci([]);
    setErroreCompagine(
      error?.message ||
        "Errore caricamento compagine societaria"
    );
  } finally {
    setLoadingCompagine(false);
  }
}

async function salvaSocioCompagine() {
  if (!compagineSocietaId) {
    alert(
      "Società partecipante non disponibile."
    );
    return;
  }

  if (!socioCompagineForm.soggetto_cliente_id) {
    alert(
      "Seleziona il socio della società partecipante."
    );
    return;
  }

  if (
    String(
      socioCompagineForm.soggetto_cliente_id
    ) === String(compagineSocietaId)
  ) {
    alert(
      "Una società non può essere socia di se stessa."
    );
    return;
  }

  const quota = Number(
    socioCompagineForm.percentuale_partecipazione
  );

  if (
    !Number.isFinite(quota) ||
    quota <= 0 ||
    quota > 100
  ) {
    alert(
      "Inserisci una quota compresa tra 0 e 100."
    );
    return;
  }

  const nominativo = nominativi.find(
    (n) =>
      String(n.id) ===
      String(
        socioCompagineForm.soggetto_cliente_id
      )
  );

  const res = await fetch(
    "/api/clienti-organi",
    {
      method:
        compagineInModificaId
          ? "PUT"
          : "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        id:
          compagineInModificaId ||
          undefined,
        cliente_id: compagineSocietaId,
        soggetto_cliente_id:
          socioCompagineForm.soggetto_cliente_id,
        tipo_soggetto:
          isSocietaNominativo(nominativo)
            ? "societa"
            : "persona_fisica",
        rappresentante_legale: false,
        tipo_ruolo: "S",
        ruolo: "socio",
        carica: "Socio",
        percentuale_partecipazione:
          socioCompagineForm.percentuale_partecipazione,
        importo_quota_nominale:
          socioCompagineForm.importo_quota_nominale ||
          null,
        titolo_possesso:
          "piena_proprieta",
        percentuale_diritti_voto:
          socioCompagineForm.percentuale_diritti_voto ||
          socioCompagineForm.percentuale_partecipazione,
        percentuale_diritti_utili:
          socioCompagineForm.percentuale_diritti_utili ||
          socioCompagineForm.percentuale_partecipazione,
        data_nomina:
          socioCompagineForm.data_nomina ||
          null,
        data_scadenza:
          socioCompagineForm.data_scadenza ||
          null,
        presenza: null,
        principale: false,
        attivo: true,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(
      data.error ||
        "Errore salvataggio socio della società partecipante."
    );
    return;
  }

  setCompagineInModificaId("");
  setSocioCompagineForm({
    soggetto_cliente_id: "",
    percentuale_partecipazione: "",
    importo_quota_nominale: "",
    percentuale_diritti_voto: "",
    percentuale_diritti_utili: "",
    data_nomina: "",
    data_scadenza: "",
  });

  await caricaCompagineSocieta(
    compagineSocietaId
  );
  await caricaTitolariEffettivi();
}

function modificaSocioCompagine(
  socio: any
) {
  setCompagineInModificaId(String(socio.id || ""));
  setSocioCompagineForm({
    soggetto_cliente_id: String(socio.soggetto_cliente_id || ""),
    percentuale_partecipazione:
      socio.percentuale_partecipazione != null
        ? String(socio.percentuale_partecipazione)
        : "",
    importo_quota_nominale:
      socio.importo_quota_nominale != null
        ? String(socio.importo_quota_nominale)
        : "",
    percentuale_diritti_voto:
      socio.percentuale_diritti_voto != null
        ? String(socio.percentuale_diritti_voto)
        : "",
    percentuale_diritti_utili:
      socio.percentuale_diritti_utili != null
        ? String(socio.percentuale_diritti_utili)
        : "",
    data_nomina: socio.data_nomina || "",
    data_scadenza: socio.data_scadenza || "",
  });
}

async function eliminaSocioCompagine(
  socio: any
) {
  const ok = confirm(
    `Eliminare ${socio.nominativo_nome || "questo socio"} dalla compagine?`
  );

  if (!ok) return;

  const res = await fetch(
    "/api/clienti-organi",
    {
      method: "DELETE",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        id: socio.id,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(
      data.error ||
        "Errore eliminazione socio della società partecipante."
    );
    return;
  }

  await caricaCompagineSocieta(
    compagineSocietaId
  );
  await caricaTitolariEffettivi();
}

function apriCompagineFiglia(
  societaId: string
) {
  if (!societaId || !compagineSocietaId) {
    return;
  }

  setCompagineStack((prev) => [
    ...prev,
    compagineSocietaId,
  ]);
  setCompagineSocietaId(societaId);
  setCompagineInModificaId("");
  setSocioCompagineForm({
    soggetto_cliente_id: "",
    percentuale_partecipazione: "",
    importo_quota_nominale: "",
    percentuale_diritti_voto: "",
    percentuale_diritti_utili: "",
    data_nomina: "",
    data_scadenza: "",
  });
}

function tornaCompaginePadre() {
  setCompagineStack((prev) => {
    if (prev.length === 0) {
      return prev;
    }

    const copia = [...prev];
    const parentId = copia.pop();

    if (parentId) {
      setCompagineSocietaId(parentId);
    }

    return copia;
  });
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

const nominativoPersonaFisica =
  nuovoNominativo.tipologia_cliente ===
  "Persona fisica";

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
  nominativoPersonaFisica
    ? nominativoSeparato.cognome || null
    : null,

nome:
  nominativoPersonaFisica
    ? nominativoSeparato.nome || null
    : null,

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
  nominativoPersonaFisica
    ? "Persona fisica"
    : "Società",

tipologia_cliente:
  nominativoPersonaFisica
    ? "Interno"
    : "Esterno",

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
  if (
    nuovoNominativoDestinazione ===
    "compagine"
  ) {
    setSocioCompagineForm((prev) => ({
      ...prev,
      soggetto_cliente_id:
        String(idSalvato),
    }));
  } else {
    setForm((prev) => ({
      ...prev,
      soggetto_cliente_id:
        String(idSalvato),
    }));
  }
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
setNuovoNominativoDestinazione(
  "principale"
);

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
      `/api/clienti/${encodeURIComponent(String(clienteId))}/titolari-effettivi`,
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
    const res = await fetch(
      `/api/clienti-organi?cliente_id=${clienteId}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (res.ok) {
      const organiBase =
        data.organi || [];

      /*
       * Mostriamo subito gli organi senza
       * aspettare i diritti collegati.
       */
      setOrgani(
        organiBase.map(
          (organo: any) => ({
            ...organo,
            diritti_collegati: [],
          })
        )
      );

      /*
       * Il Titolare Effettivo non deve rallentare l'ingresso nella pagina.
       * Lo avviamo quando il browser e' libero, dopo che gli organi sono gia' visibili.
       */
      const avviaTitolareEffettivo = () => {
        void caricaTitolariEffettivi().catch((error) => {
          console.error(
            "Errore aggiornamento Titolare Effettivo:",
            error
          );
        });
      };

      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        (window as any).requestIdleCallback(avviaTitolareEffettivo, { timeout: 1200 });
      } else if (typeof window !== "undefined") {
        globalThis.setTimeout(avviaTitolareEffettivo, 350);
      }

      /*
       * I diritti collegati NON vengono precaricati qui.
       * Vengono richiesti solo quando si apre la modifica di un socio,
       * così l'ingresso nella pagina resta immediato.
       */
    } else {
      console.error(
        "Errore caricaOrgani:",
        data
      );

      setMessaggio(
        data.error ||
          "Errore caricamento organi"
      );

      setOrgani([]);
      setDatiTitolariEffettivi(null);
    }
  } catch (err) {
    console.error(
      "Errore fetch caricaOrgani:",
      err
    );

    setMessaggio(
      "Errore caricamento organi"
    );

    setOrgani([]);
    setDatiTitolariEffettivi(null);
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
  setModalSezione(null);
  setOrganoInModificaId("");

  setForm({
    soggetto_cliente_id: "",
    ruolo: "socio",
    carica: "",
    percentuale_partecipazione: "", importo_quota_nominale: "",
    titolo_possesso: "piena_proprieta",
    percentuale_diritti_voto: "",
    percentuale_diritti_utili: "",
    note_titolo_possesso: "",
    partecipazione_collegata_id: "",
    presenza: "Presente",
    principale: false,
    attivo: true,
    data_nomina: "",
    durata_carica: "A revoca", durata_carica_anni: "",
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

importo_quota_nominale:
  form.ruolo === "socio"
    ? form.importo_quota_nominale || null
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

durata_carica_anni:
  form.ruolo !== "socio" && form.durata_carica === "Anni n."
    ? Number(form.durata_carica_anni) || null
    : null,

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
setModalSezione(null);

setForm({
  soggetto_cliente_id: "",
  ruolo: "socio",
  carica: "",
  percentuale_partecipazione: "", importo_quota_nominale: "",
  presenza: "Presente",
  principale: false,
  attivo: true,
  data_nomina: "",
  durata_carica: "A revoca", durata_carica_anni: "",
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
    importo_quota_nominale:
      organo.importo_quota_nominale != null
        ? String(organo.importo_quota_nominale)
        : "",
    presenza: organo.presenza || "Presente",
    principale: organo.principale || false,
    attivo: organo.attivo ?? true,
    data_nomina: organo.data_nomina || "",
    durata_carica: ["A revoca", "A tempo indeterminato", "Anni n."].includes(organo.durata_carica) ? organo.durata_carica : "A revoca",
    durata_carica_anni: organo.durata_carica_anni != null ? String(organo.durata_carica_anni) : "",
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
  "vice_presidente_cda",
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

const sociVisualizzati = organi.filter((o) => o.ruolo === "socio");
const amministrazioneVisualizzata = organi.filter((o) => ruoliAmministrazione.includes(String(o.ruolo || "")));
const controlloVisualizzato = organi.filter((o) => ruoliControllo.includes(String(o.ruolo || "")));

async function apriInserimentoSezione(sezione: "soci" | "amministrazione" | "controllo") {
  if (nominativi.length === 0) {
    await caricaNominativi();
  }
  setOrganoInModificaId("");
  setDirittiCollegati([]);
  setErroreDiritti("");
  setRicercaNominativo("");
  setForm({
    soggetto_cliente_id: "",
    ruolo: sezione === "soci" ? "socio" : sezione === "controllo" ? "sindaco_effettivo" : "amministratore",
    carica: "", percentuale_partecipazione: "", importo_quota_nominale: "", titolo_possesso: "piena_proprieta",
    percentuale_diritti_voto: "", percentuale_diritti_utili: "", note_titolo_possesso: "",
    partecipazione_collegata_id: "", presenza: "Presente", principale: false, attivo: true,
    data_nomina: "", durata_carica: "A revoca", durata_carica_anni: "", data_scadenza: "", data_cessazione: "",
  });
  setModalSezione(sezione);
}

async function apriModificaSezione(organo: any, sezione: "soci" | "amministrazione" | "controllo") {
  if (nominativi.length === 0) {
    await caricaNominativi();
  }
  await caricaInModifica(organo);
  setRicercaNominativo("");
  setModalSezione(sezione);
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
        router.push({
          pathname: "/clienti/titolari-effettivi/verifica",
          query: { cliente_id: clienteId },
        })
      }
      style={{ ...blueButton, width: 190, height: 40, minWidth: 190, minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f", whiteSpace: "nowrap" }}
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

                      {titolare.criterio_dettaglio ===
                        "controllo_societa_intermedia" && (
                        <div
                          style={{
                            marginTop: 4,
                            color: "#64748b",
                            fontSize: 11,
                            lineHeight: 1.35,
                          }}
                        >
                          Partecipazione economica indiretta
                        </div>
                      )}
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

                  {titolare.criterio_dettaglio ===
                    "controllo_societa_intermedia" && (
                    <div
                      style={{
                        marginTop: 12,
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(3, minmax(0, 1fr))",
                        gap: 8,
                        padding: 10,
                        borderRadius: 8,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            textTransform: "uppercase",
                            fontWeight: 800,
                          }}
                        >
                          Società intermedia
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {titolare.societa_intermedia_nome ||
                            "—"}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            textTransform: "uppercase",
                            fontWeight: 800,
                          }}
                        >
                          Quota sul cliente
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {Number(
                            titolare.quota_societa_intermedia ||
                              0
                          ).toLocaleString("it-IT", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          %
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            textTransform: "uppercase",
                            fontWeight: 800,
                          }}
                        >
                          Controllo della società
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {Number(
                            titolare.quota_controllo_societa_intermedia ||
                              0
                          ).toLocaleString("it-IT", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          %
                        </div>
                      </div>
                    </div>
                  )}

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

<div style={{ ...cardStyle, border: "1px solid #8cddff", borderRadius: 12, background: "#ffffff", boxShadow: "0 12px 30px rgba(14,78,112,0.12)" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
    <div><h2 style={titleStyle}>Soci</h2><div style={{ color: "#64748b", fontSize: 13 }}>Partecipazioni al capitale e diritti collegati.</div></div>
    <button type="button" style={{ ...blueButton, width: 190, height: 40, minWidth: 190, minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f" }} onClick={() => apriInserimentoSezione("soci")}>+ Aggiungi socio</button>
  </div>
  <div style={{ marginTop: 16, overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={thStyle}>Nominativo</th><th style={thStyle}>Codice fiscale</th><th style={thStyle}>Tipologia del diritto</th><th style={thStyle}>Quota</th><th style={thStyle}>Voto</th><th style={thStyle}>Utili</th><th style={thStyle}>Dal</th><th style={thStyle}>Al</th><th style={thStyle}>Azioni</th></tr></thead><tbody>
    {sociVisualizzati.map((o) => <tr key={o.id}><td style={tdStyle}>{o.soggetto_cliente?.ragione_sociale || "—"}</td><td style={tdStyle}>{o.soggetto_cliente?.codice_fiscale || o.soggetto_cliente?.partita_iva || "—"}</td><td style={tdStyle}>{titoliPossessoLabel[String(o.titolo_possesso || "piena_proprieta")] || "Piena proprietà"}</td><td style={tdStyle}>{o.percentuale_partecipazione != null ? `${Number(o.percentuale_partecipazione).toFixed(2)}%` : "—"}</td><td style={tdStyle}>{o.percentuale_diritti_voto != null ? `${Number(o.percentuale_diritti_voto).toFixed(2)}%` : "—"}</td><td style={tdStyle}>{o.percentuale_diritti_utili != null ? `${Number(o.percentuale_diritti_utili).toFixed(2)}%` : "—"}</td><td style={tdStyle}>{formattaDataItaliana(o.data_nomina)}</td><td style={tdStyle}>{formattaDataItaliana(o.data_scadenza)}</td><td style={tdStyle}><div style={{display:"flex",gap:8}}><button type="button" style={iconButton} title="Modifica" onClick={() => void apriModificaSezione(o,"soci")}><Pencil size={16}/></button>{o.attivo && <button type="button" style={iconButton} title="Disattiva" onClick={() => disattivaOrgano(o)}><Power size={16}/></button>}<button type="button" style={iconDangerButton} title="Elimina" onClick={() => eliminaOrgano(o)}><Trash2 size={16}/></button></div></td></tr>)}
    {sociVisualizzati.length === 0 && <tr><td style={tdStyle} colSpan={9}>Nessun socio presente.</td></tr>}
  </tbody></table></div>
  <div style={{marginTop:14,padding:"12px 14px",borderRadius:9,background:totaleQuoteCorretto?"#dcfce7":"#fee2e2",color:totaleQuoteCorretto?"#166534":"#991b1b",fontWeight:800,display:"flex",justifyContent:"space-between"}}><span>Totale quote societarie</span><span>{totaleQuote.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}%</span></div>
</div>

<div style={{ ...cardStyle, border: "1px solid #8cddff", borderRadius: 12, background: "#ffffff", boxShadow: "0 12px 30px rgba(14,78,112,0.12)" }}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><div><h2 style={titleStyle}>Organo di amministrazione</h2><div style={{color:"#64748b",fontSize:13}}>Amministratori, consiglieri, liquidatori e rappresentanti legali.</div></div><button type="button" style={{ ...blueButton, width: 190, height: 40, minWidth: 190, minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f" }} onClick={() => apriInserimentoSezione("amministrazione")}>+ Aggiungi componente</button></div>
  <div style={{marginTop:16,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={thStyle}>Nominativo</th><th style={thStyle}>Codice fiscale</th><th style={thStyle}>Qualifica / Carica</th><th style={thStyle}>Dal</th><th style={thStyle}>Al</th><th style={thStyle}>Principale</th><th style={thStyle}>Azioni</th></tr></thead><tbody>{amministrazioneVisualizzata.map((o)=><tr key={o.id}><td style={tdStyle}>{o.soggetto_cliente?.ragione_sociale||"—"}</td><td style={tdStyle}>{o.soggetto_cliente?.codice_fiscale||o.soggetto_cliente?.partita_iva||"—"}</td><td style={tdStyle}>{o.carica||ruoliLabel[o.ruolo]||"—"}</td><td style={tdStyle}>{formattaDataItaliana(o.data_nomina)}</td><td style={tdStyle}>{o.data_scadenza ? formattaDataItaliana(o.data_scadenza) : (o.durata_carica === "Fino a revoca" ? "A revoca" : o.durata_carica || "—")}</td><td style={tdStyle}>{o.principale?"Sì":"No"}</td><td style={tdStyle}><div style={{display:"flex",gap:8}}><button type="button" style={iconButton} title="Modifica" onClick={()=>void apriModificaSezione(o,"amministrazione")}><Pencil size={16}/></button>{o.attivo&&<button type="button" style={iconButton} title="Disattiva" onClick={()=>disattivaOrgano(o)}><Power size={16}/></button>}<button type="button" style={iconDangerButton} title="Elimina" onClick={()=>eliminaOrgano(o)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
</div>

<div style={{ ...cardStyle, border: "1px solid #8cddff", borderRadius: 12, background: "#ffffff", boxShadow: "0 12px 30px rgba(14,78,112,0.12)" }}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><div><h2 style={titleStyle}>Organo di controllo</h2><div style={{color:"#64748b",fontSize:13}}>Sindaci e revisori.</div></div><button type="button" style={{ ...blueButton, width: 190, height: 40, minWidth: 190, minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f" }} onClick={()=>apriInserimentoSezione("controllo")}>+ Aggiungi componente</button></div><div style={{marginTop:16,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={thStyle}>Nominativo</th><th style={thStyle}>Codice fiscale</th><th style={thStyle}>Qualifica</th><th style={thStyle}>Dal</th><th style={thStyle}>Al</th><th style={thStyle}>Azioni</th></tr></thead><tbody>{controlloVisualizzato.map((o)=><tr key={o.id}><td style={tdStyle}>{o.soggetto_cliente?.ragione_sociale||"—"}</td><td style={tdStyle}>{o.soggetto_cliente?.codice_fiscale||o.soggetto_cliente?.partita_iva||"—"}</td><td style={tdStyle}>{o.carica||ruoliLabel[o.ruolo]||"—"}</td><td style={tdStyle}>{formattaDataItaliana(o.data_nomina)}</td><td style={tdStyle}>{o.data_scadenza ? formattaDataItaliana(o.data_scadenza) : (o.durata_carica === "Fino a revoca" ? "A revoca" : o.durata_carica || "—")}</td><td style={tdStyle}><div style={{display:"flex",gap:8}}><button type="button" style={iconButton} title="Modifica" onClick={()=>void apriModificaSezione(o,"controllo")}><Pencil size={16}/></button>{o.attivo&&<button type="button" style={iconButton} title="Disattiva" onClick={()=>disattivaOrgano(o)}><Power size={16}/></button>}<button type="button" style={iconDangerButton} title="Elimina" onClick={()=>eliminaOrgano(o)}><Trash2 size={16}/></button></div></td></tr>)}{controlloVisualizzato.length === 0 && <tr><td style={tdStyle} colSpan={6}>Nessun componente dell'organo di controllo presente.</td></tr>}</tbody></table></div></div>

{modalSezione && <div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(15,23,42,.55)"}}><div style={{width:"min(900px,96vw)",maxHeight:"92vh",overflowY:"auto",borderRadius:12,background:"#fff",boxShadow:"0 24px 70px rgba(15,23,42,.28)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:"#5b5b5b",color:"#fff"}}><strong style={{fontSize:18}}>{modalSezione==="soci"?"Soci":modalSezione==="amministrazione"?"Organo di amministrazione":"Organo di controllo"}</strong><button type="button" onClick={()=>setModalSezione(null)} style={{border:0,background:"transparent",color:"#fff",fontSize:22,cursor:"pointer"}}>×</button></div><div style={{padding:20}}>
  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}><div><label style={labelStyle}>Filtro nominativo</label><input style={inputStyle} value={ricercaNominativo} onChange={(e)=>setRicercaNominativo(e.target.value)} placeholder="Cognome e nome, codice fiscale o partita IVA"/></div><button type="button" style={{ ...secondaryButton, width: 140, height: 40, padding: "0 14px" }}>Filtra nomi</button></div>
  <div style={{marginTop:12}}><label style={labelStyle}>Nominativo</label><select style={inputStyle} value={form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,soggetto_cliente_id:e.target.value}))}><option value="">Seleziona nominativo</option>{nominativi.filter((n)=>!ricercaNominativo.trim() || [n.ragione_sociale,n.codice_fiscale,n.partita_iva].some((v)=>String(v||"").toLowerCase().includes(ricercaNominativo.trim().toLowerCase()))).map((n)=><option key={n.id} value={n.id}>{n.ragione_sociale}{n.codice_fiscale?` — ${n.codice_fiscale}`:""}</option>)}</select></div>
  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10,flexWrap:"wrap"}}><button type="button" style={{ ...secondaryButton, width: 140, height: 40, padding: "0 14px" }} onClick={()=>{setNuovoNominativoDestinazione("principale");setNominativoInModificaId(null);setNuovoNominativo({nome_cognome:"",codice_fiscale:"",email:"",luogo_nascita:"",data_nascita:"",indirizzo:"",citta:"",provincia:"",cap:"",tipologia_cliente:"Persona fisica"});setShowNuovoNominativo(true);}}>Nuovo</button><button type="button" style={{ ...secondaryButton, width: 190, minWidth: 190, height: 40, padding: "0 16px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "center" }} disabled={!form.soggetto_cliente_id} onClick={apriModificaNominativo}>Modifica anagrafica</button></div>
  {modalSezione==="soci" ? <><div style={{marginTop:18,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}><div><label style={labelStyle}>Tipo</label><input style={{...inputStyle,background:"#f1f5f9"}} value="Socio" disabled/></div><div><label style={labelStyle}>Dal</label><input type="date" style={inputStyle} value={form.data_nomina} onChange={(e)=>{const dataNomina=e.target.value;setForm((p)=>({...p,data_nomina:dataNomina,data_scadenza:p.durata_carica==="Anni n."?calcolaScadenzaDaAnni(dataNomina,p.durata_carica_anni):p.data_scadenza}))}}/></div><div><label style={labelStyle}>Al</label><input type="date" style={inputStyle} value={form.data_scadenza} onChange={(e)=>setForm((p)=>({...p,data_scadenza:e.target.value}))}/></div></div><div style={{marginTop:16,padding:16,border:"1px solid #dbeafe",borderRadius:10,background:"#f8fbff"}}><div style={{display:"grid",gridTemplateColumns:"1.2fr .7fr .7fr",gap:12}}><div><label style={labelStyle}>Tipologia del diritto</label><select style={inputStyle} value={form.titolo_possesso} onChange={(e)=>setForm((p)=>({...p,titolo_possesso:e.target.value}))}><option value="piena_proprieta">Piena proprietà</option><option value="usufrutto">Usufrutto</option><option value="nuda_proprieta">Nuda proprietà</option><option value="pegno">Pegno</option><option value="sequestro">Sequestro</option><option value="intestazione_fiduciaria">Intestazione fiduciaria</option><option value="altro">Altro</option></select></div><div><label style={labelStyle}>Quota %</label><input type="number" min="0" max="100" step="0.01" style={inputStyle} value={form.percentuale_partecipazione} onChange={(e)=>{const v=e.target.value;setForm((p)=>({...p,percentuale_partecipazione:v,percentuale_diritti_voto:p.titolo_possesso==="piena_proprieta"?v:p.percentuale_diritti_voto,percentuale_diritti_utili:p.titolo_possesso==="piena_proprieta"?v:p.percentuale_diritti_utili}))}}/></div><div><label style={labelStyle}>Diritti di voto %</label><input type="number" min="0" max="100" step="0.01" style={inputStyle} value={form.percentuale_diritti_voto} onChange={(e)=>setForm((p)=>({...p,percentuale_diritti_voto:e.target.value}))}/></div></div><div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={labelStyle}>Valore nominale</label><input type="number" min="0" step="0.01" style={inputStyle} value={form.importo_quota_nominale} onChange={(e)=>setForm((p)=>({...p,importo_quota_nominale:e.target.value}))}/></div><div><label style={labelStyle}>Partecipazione agli utili %</label><input type="number" min="0" max="100" step="0.01" style={inputStyle} value={form.percentuale_diritti_utili} onChange={(e)=>setForm((p)=>({...p,percentuale_diritti_utili:e.target.value}))}/></div></div></div>

{socioSocietaSelezionata && (
  <div
    style={{
      marginTop: 14,
      padding: 12,
      border: "1px solid #bae6fd",
      borderRadius: 9,
      background: "#f0f9ff",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#0c4a6e",
          }}
        >
          Compagine della società partecipante
        </div>
        <div
          style={{
            marginTop: 3,
            color: "#475569",
            fontSize: 12,
          }}
        >
          {societaSelezionataClienteSmp
            ? "Società già presente come cliente SMP: qui visualizzi e aggiorni la stessa compagine già registrata nel gestionale."
            : "Società non cliente: puoi ricostruire qui la compagine anche su più livelli per il calcolo del Titolare Effettivo."}
        </div>
      </div>

      {compagineStack.length > 0 && (
        <button
          type="button"
          style={{
            ...secondaryButton,
            width: 145,
            minWidth: 145,
            height: 36,
            padding: "0 10px",
            fontSize: 12,
          }}
          onClick={tornaCompaginePadre}
        >
          ← Livello precedente
        </button>
      )}
    </div>

    <div
      style={{
        marginTop: 10,
        padding: "7px 10px",
        borderRadius: 8,
        background: "#e0f2fe",
        color: "#075985",
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      Società corrente:{" "}
      {nominativi.find(
        (n) =>
          String(n.id) ===
          String(compagineSocietaId)
      )?.ragione_sociale || "Società partecipante"}
    </div>

    {loadingCompagine ? (
      <div
        style={{
          marginTop: 12,
          color: "#64748b",
        }}
      >
        Caricamento compagine...
      </div>
    ) : erroreCompagine ? (
      <div
        style={{
          marginTop: 12,
          color: "#b91c1c",
          fontWeight: 700,
        }}
      >
        {erroreCompagine}
      </div>
    ) : (
      <div
        style={{
          marginTop: 10,
          overflowX: "auto",
          maxWidth: 760,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Socio</th>
              <th style={thStyle}>CF / P.IVA</th>
              <th style={thStyle}>Quota</th>
              <th style={thStyle}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {compagineSoci.map((socio) => {
              const soggetto =
                nominativi.find(
                  (n) =>
                    String(n.id) ===
                    String(
                      socio.soggetto_cliente_id
                    )
                ) ||
                socio.soggetto_cliente ||
                null;

              const societa =
                isSocietaNominativo(soggetto);

              const clienteSmp =
                soggetto?.cliente === true;

              return (
                <tr key={socio.id}>
                  <td style={{...tdStyle,padding:"10px 12px",fontSize:13}}>
                    {soggetto?.ragione_sociale ||
                      socio.nominativo_nome ||
                      "—"}
                    {societa && clienteSmp && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 999,
                          background: "#dcfce7",
                          color: "#166534",
                          fontWeight: 800,
                        }}
                      >
                        CLIENTE SMP
                      </span>
                    )}
                  </td>
                  <td style={{...tdStyle,padding:"10px 12px",fontSize:13}}>
                    {soggetto?.codice_fiscale ||
                      soggetto?.partita_iva ||
                      socio.nominativo_codice_fiscale ||
                      "—"}
                  </td>
                  <td style={{...tdStyle,padding:"10px 12px",fontSize:13}}>
                    {socio.percentuale_partecipazione !=
                    null
                      ? `${Number(
                          socio.percentuale_partecipazione
                        ).toLocaleString("it-IT", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}%`
                      : "—"}
                  </td>
                  <td style={{...tdStyle,padding:"10px 12px",fontSize:13}}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        style={{ ...iconButton, width: 32, height: 32 }}
                        title="Modifica"
                        onClick={() => modificaSocioCompagine(socio)}
                      >
                        <Pencil size={15} />
                      </button>

                      {societa && !clienteSmp && (
                        <button
                          type="button"
                          style={{
                            ...secondaryButton,
                            width: 118,
                            height: 32,
                            padding: "0 8px",
                            fontSize: 11,
                          }}
                          onClick={() =>
                            apriCompagineFiglia(
                              String(
                                socio.soggetto_cliente_id
                              )
                            )
                          }
                        >
                          Apri compagine
                        </button>
                      )}

                      <button
                        type="button"
                        style={{ ...iconDangerButton, width: 32, height: 32 }}
                        title="Elimina dalla compagine"
                        onClick={() =>
                          void eliminaSocioCompagine(
                            socio
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {compagineSoci.length === 0 && (
              <tr>
                <td
                  style={{...tdStyle,padding:"10px 12px",fontSize:13}}
                  colSpan={4}
                >
                  Nessun socio inserito per questa società.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )}

    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid #bae6fd",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "2.2fr .65fr .75fr",
          gap: 8,
          alignItems: "end",
        }}
      >
        <div>
          <label style={labelStyle}>
            Socio della società
          </label>
          <select
            style={{...inputStyle,padding:"8px 10px",fontSize:13}}
            value={
              socioCompagineForm.soggetto_cliente_id
            }
            onChange={(e) =>
              setSocioCompagineForm((p) => ({
                ...p,
                soggetto_cliente_id:
                  e.target.value,
              }))
            }
          >
            <option value="">
              Seleziona nominativo
            </option>
            {nominativi
              .filter(
                (n) =>
                  String(n.id) !==
                  String(compagineSocietaId)
              )
              .map((n) => (
                <option
                  key={n.id}
                  value={n.id}
                >
                  {n.ragione_sociale}
                  {n.codice_fiscale
                    ? ` — ${n.codice_fiscale}`
                    : n.partita_iva
                    ? ` — ${n.partita_iva}`
                    : ""}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>
            Quota %
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            style={{...inputStyle,padding:"8px 10px",fontSize:13}}
            value={
              socioCompagineForm.percentuale_partecipazione
            }
            onChange={(e) => {
              const value = e.target.value;
              setSocioCompagineForm((p) => ({
                ...p,
                percentuale_partecipazione:
                  value,
                percentuale_diritti_voto:
                  p.percentuale_diritti_voto ||
                  value,
                percentuale_diritti_utili:
                  p.percentuale_diritti_utili ||
                  value,
              }));
            }}
          />
        </div>

        <div>
          <label style={labelStyle}>
            Valore nominale
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{...inputStyle,padding:"8px 10px",fontSize:13}}
            value={
              socioCompagineForm.importo_quota_nominale
            }
            onChange={(e) =>
              setSocioCompagineForm((p) => ({
                ...p,
                importo_quota_nominale:
                  e.target.value,
              }))
            }
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr 1fr 1fr",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div>
          <label style={labelStyle}>
            Voto %
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            style={{...inputStyle,padding:"8px 10px",fontSize:13}}
            value={
              socioCompagineForm.percentuale_diritti_voto
            }
            onChange={(e) =>
              setSocioCompagineForm((p) => ({
                ...p,
                percentuale_diritti_voto:
                  e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label style={labelStyle}>
            Utili %
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            style={{...inputStyle,padding:"8px 10px",fontSize:13}}
            value={
              socioCompagineForm.percentuale_diritti_utili
            }
            onChange={(e) =>
              setSocioCompagineForm((p) => ({
                ...p,
                percentuale_diritti_utili:
                  e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label style={labelStyle}>
            Dal
          </label>
          <input
            type="date"
            style={{...inputStyle,padding:"8px 10px",fontSize:13}}
            value={
              socioCompagineForm.data_nomina
            }
            onChange={(e) =>
              setSocioCompagineForm((p) => ({
                ...p,
                data_nomina:
                  e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label style={labelStyle}>
            Al
          </label>
          <input
            type="date"
            style={{...inputStyle,padding:"8px 10px",fontSize:13}}
            value={
              socioCompagineForm.data_scadenza
            }
            onChange={(e) =>
              setSocioCompagineForm((p) => ({
                ...p,
                data_scadenza:
                  e.target.value,
              }))
            }
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 8,
          flexWrap: "nowrap",
        }}
      >
        <button
          type="button"
          style={{
            ...secondaryButton,
            width: 150,
            minWidth: 150,
            height: 36,
            padding: "0 10px",
            whiteSpace: "nowrap",
            fontSize: 12,
          }}
          onClick={() => {
            setNuovoNominativoDestinazione(
              "compagine"
            );
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
          Nuovo nominativo
        </button>

        <button
          type="button"
          style={{
            ...blueButton,
            width: 150,
            height: 38,
            padding: "0 12px",
          }}
          onClick={() =>
            void salvaSocioCompagine()
          }
        >
          {compagineInModificaId
            ? "Salva modifiche"
            : "Aggiungi socio"}
        </button>
      </div>
    </div>
  </div>
)}
</> : <div style={{marginTop:18,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}><div><label style={labelStyle}>Qualifica</label><select style={inputStyle} value={form.ruolo} onChange={(e)=>setForm((p)=>({...p,ruolo:e.target.value,carica:ruoliLabel[e.target.value]||e.target.value}))}>{(modalSezione==="amministrazione"?ruoliAmministrazione:ruoliControllo).map((r)=><option key={r} value={r}>{ruoliLabel[r]||r}</option>)}</select></div><div><label style={labelStyle}>Data nomina</label><input type="date" style={inputStyle} value={form.data_nomina} onChange={(e)=>{const dataNomina=e.target.value;setForm((p)=>({...p,data_nomina:dataNomina,data_scadenza:p.durata_carica==="Anni n."&&p.durata_carica_anni?calcolaScadenzaDaAnni(dataNomina,p.durata_carica_anni):p.data_scadenza}))}}/></div><div><label style={labelStyle}>Scadenza</label><input type="date" style={inputStyle} value={form.data_scadenza} onChange={(e)=>setForm((p)=>({...p,data_scadenza:e.target.value}))}/></div></div>}
  {(modalSezione==="amministrazione" || modalSezione==="controllo") && <div style={{marginTop:16,display:"grid",gridTemplateColumns:form.durata_carica==="Anni n."?"1fr 1fr":"1fr",gap:12,alignItems:"end"}}><div><label style={labelStyle}>{modalSezione==="amministrazione"?"Scadenza amministratore":"Scadenza organo di controllo"}</label><select style={inputStyle} value={form.durata_carica} onChange={(e)=>{const durata=e.target.value;setForm((p)=>({...p,durata_carica:durata,durata_carica_anni:durata==="Anni n."?p.durata_carica_anni:"",data_scadenza:durata==="Anni n."&&p.data_nomina&&p.durata_carica_anni?calcolaScadenzaDaAnni(p.data_nomina,p.durata_carica_anni):p.data_scadenza}))}}><option value="A revoca">A revoca</option><option value="A tempo indeterminato">A tempo indeterminato</option><option value="Anni n.">Anni n.</option></select></div>{form.durata_carica==="Anni n." && <div><label style={labelStyle}>Numero anni</label><input type="number" min="1" step="1" style={inputStyle} value={form.durata_carica_anni} onChange={(e)=>{const anni=e.target.value;setForm((p)=>({...p,durata_carica_anni:anni,data_scadenza:p.data_nomina?calcolaScadenzaDaAnni(p.data_nomina,anni):p.data_scadenza}))}}/></div>}</div>}
  {modalSezione==="amministrazione" && <div style={{marginTop:16,display:"flex",alignItems:"center",justifyContent:"flex-start"}}><label style={{display:"inline-flex",alignItems:"center",gap:9,fontSize:14,fontWeight:600,color:"#334155",cursor:form.soggetto_cliente_id?"pointer":"not-allowed",userSelect:"none"}}><input type="checkbox" checked={Boolean(form.principale)} disabled={!form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,principale:e.target.checked}))} style={{width:17,height:17,accentColor:"#0d6f9f",cursor:form.soggetto_cliente_id?"pointer":"not-allowed"}}/><span>Firmatario</span></label></div>}
  <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22,borderTop:"1px solid #e2e8f0",paddingTop:16}}><button type="button" style={{ ...secondaryButton, width: 130, height: 40, padding: "0 14px" }} onClick={()=>setModalSezione(null)}>Annulla</button><button type="button" style={{ ...blueButton, width: organoInModificaId ? 190 : 130, minWidth: organoInModificaId ? 190 : 130, height: 40, padding: "0 16px", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "center" }} onClick={salvaOrgano}>{organoInModificaId?"Salva modifiche":"OK"}</button></div>
</div></div></div>}

  {showNuovoNominativo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10001,
          }}
        >
          <div
            style={{
              width: "min(900px,96vw)",
              maxHeight: "92vh",
              overflowY: "auto",
              borderRadius: 12,
              background: "#fff",
              boxShadow: "0 24px 70px rgba(15,23,42,.28)",
            }}
          >
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:"#5b5b5b",color:"#fff"}}>
              <strong style={{fontSize:18}}>
                {nominativoInModificaId ? "Modifica nominativo" : "Nuovo nominativo"}
              </strong>
              <button type="button" onClick={()=>{setShowNuovoNominativo(false);setNominativoInModificaId(null);setNuovoNominativoDestinazione("principale");}} style={{border:0,background:"transparent",color:"#fff",fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:20}}>

            <div
              style={{
                padding: 14,
                border: "1px solid #bae6fd",
                borderRadius: 10,
                background: "#f0f9ff",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={labelStyle}>
                    {nuovoNominativo.tipologia_cliente ===
                    "Persona fisica"
                      ? "Cognome e nome"
                      : "Ragione sociale"}
                  </label>
                  <input
                    style={inputStyle}
                    placeholder={
                      nuovoNominativo.tipologia_cliente ===
                      "Persona fisica"
                        ? "Cognome e nome"
                        : "Ragione sociale"
                    }
                    value={nuovoNominativo.nome_cognome}
                    onChange={(e) =>
                      setNuovoNominativo((p) => ({
                        ...p,
                        nome_cognome:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Tipologia soggetto
                  </label>
                  <select
                    style={inputStyle}
                    value={
                      nuovoNominativo.tipologia_cliente
                    }
                    onChange={(e) => {
                      const tipologia =
                        e.target.value;

                      setNuovoNominativo((p) => ({
                        ...p,
                        tipologia_cliente:
                          tipologia,
                        luogo_nascita:
                          tipologia ===
                          "Persona fisica"
                            ? p.luogo_nascita
                            : "",
                        data_nascita:
                          tipologia ===
                          "Persona fisica"
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
                </div>

                <div>
                  <label style={labelStyle}>
                    {nuovoNominativo.tipologia_cliente ===
                    "Persona fisica"
                      ? "Codice fiscale"
                      : "Codice fiscale / P.IVA"}
                  </label>

                  <input
                    style={{
                      ...inputStyle,
                      border:
                        nuovoNominativo.codice_fiscale &&
                        !isCodiceFiscaleNominativoValido()
                          ? "1.5px solid #dc2626"
                          : "1.5px solid #94a3b8",
                      background: "#fff",
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
                    value={
                      nuovoNominativo.codice_fiscale
                    }
                    onChange={async (e) => {
                      const cf = normalizeCF(
                        e.target.value
                      );

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
                    onBlur={async (e) => {
                      const cf = normalizeCF(
                        e.target.value
                      );

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

                <div>
                  <label style={labelStyle}>
                    Email
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="Email"
                    value={
                      nuovoNominativo.email
                    }
                    onChange={(e) =>
                      setNuovoNominativo((p) => ({
                        ...p,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Luogo di nascita
                  </label>
                  <input
                    style={{
                      ...inputStyle,
                      background:
                        nuovoNominativo.tipologia_cliente ===
                        "Persona fisica"
                          ? "#fff"
                          : "#e2e8f0",
                    }}
                    placeholder="Luogo di nascita"
                    disabled={
                      nuovoNominativo.tipologia_cliente !==
                      "Persona fisica"
                    }
                    value={
                      nuovoNominativo.luogo_nascita
                    }
                    onChange={(e) =>
                      setNuovoNominativo((p) => ({
                        ...p,
                        luogo_nascita:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Data di nascita
                  </label>
                  <input
                    type="date"
                    style={{
                      ...inputStyle,
                      background:
                        nuovoNominativo.tipologia_cliente ===
                        "Persona fisica"
                          ? "#fff"
                          : "#e2e8f0",
                    }}
                    disabled={
                      nuovoNominativo.tipologia_cliente !==
                      "Persona fisica"
                    }
                    value={
                      nuovoNominativo.data_nascita
                    }
                    onChange={(e) =>
                      setNuovoNominativo((p) => ({
                        ...p,
                        data_nascita:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                  }}
                >
                  <label style={labelStyle}>
                    Indirizzo
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="Indirizzo"
                    value={
                      nuovoNominativo.indirizzo
                    }
                    onChange={(e) =>
                      setNuovoNominativo((p) => ({
                        ...p,
                        indirizzo:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Città
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="Città"
                    value={
                      nuovoNominativo.citta
                    }
                    onChange={(e) =>
                      setNuovoNominativo((p) => ({
                        ...p,
                        citta:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Provincia
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="Provincia"
                    maxLength={2}
                    value={
                      nuovoNominativo.provincia
                    }
                    onChange={(e) =>
                      setNuovoNominativo((p) => ({
                        ...p,
                        provincia:
                          e.target.value
                            .toUpperCase()
                            .slice(0, 2),
                      }))
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    CAP
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="CAP"
                    maxLength={5}
                    value={
                      nuovoNominativo.cap
                    }
                    onChange={(e) =>
                      setNuovoNominativo((p) => ({
                        ...p,
                        cap:
                          e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 5),
                      }))
                    }
                  />
                </div>
              </div>
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
      setNuovoNominativoDestinazione(
        "principale"
      );
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
</div>
)}

</div>

</main>
);
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid #94a3b8",
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
