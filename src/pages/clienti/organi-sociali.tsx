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
       * Il calcolo del Titolare Effettivo
       * parte immediatamente.
       */
      void caricaTitolariEffettivi().catch(
        (error) => {
          console.error(
            "Errore aggiornamento Titolare Effettivo:",
            error
          );
        }
      );

      /*
       * I diritti collegati vengono caricati
       * successivamente, senza bloccare il TE.
       */
      const organiConDiritti =
        await Promise.all(
          organiBase.map(
            async (organo: any) => {
              if (
                organo.ruolo !== "socio"
              ) {
                return {
                  ...organo,
                  diritti_collegati: [],
                };
              }

              try {
                const rispostaDiritti =
                  await fetch(
                    `/api/clienti-organi-diritti?organo_id=${organo.id}`,
                    {
                      cache: "no-store",
                    }
                  );

                const datiDiritti =
                  await rispostaDiritti.json();

                return {
                  ...organo,
                  diritti_collegati:
                    rispostaDiritti.ok
                      ? datiDiritti.diritti ||
                        []
                      : [],
                };
              } catch {
                return {
                  ...organo,
                  diritti_collegati: [],
                };
              }
            }
          )
        );

      setOrgani(organiConDiritti);
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

function apriInserimentoSezione(sezione: "soci" | "amministrazione" | "controllo") {
  setOrganoInModificaId("");
  setDirittiCollegati([]);
  setErroreDiritti("");
  setRicercaNominativo("");
  setForm({
    soggetto_cliente_id: "",
    ruolo: sezione === "soci" ? "socio" : sezione === "controllo" ? "sindaco_effettivo" : "amministratore",
    carica: "", percentuale_partecipazione: "", titolo_possesso: "piena_proprieta",
    percentuale_diritti_voto: "", percentuale_diritti_utili: "", note_titolo_possesso: "",
    partecipazione_collegata_id: "", presenza: "Presente", principale: false, attivo: true,
    data_nomina: "", durata_carica: "Fino a revoca", data_scadenza: "", data_cessazione: "",
  });
  setModalSezione(sezione);
}

async function apriModificaSezione(organo: any, sezione: "soci" | "amministrazione" | "controllo") {
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

<div style={{ ...cardStyle, border: "1px solid #dbeafe" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
    <div><h2 style={titleStyle}>Soci</h2><div style={{ color: "#64748b", fontSize: 13 }}>Partecipazioni al capitale e diritti collegati.</div></div>
    <button type="button" style={blueButton} onClick={() => apriInserimentoSezione("soci")}>+ Aggiungi socio</button>
  </div>
  <div style={{ marginTop: 16, overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={thStyle}>Nominativo</th><th style={thStyle}>Codice fiscale</th><th style={thStyle}>Tipologia del diritto</th><th style={thStyle}>Quota</th><th style={thStyle}>Voto</th><th style={thStyle}>Utili</th><th style={thStyle}>Dal</th><th style={thStyle}>Al</th><th style={thStyle}>Azioni</th></tr></thead><tbody>
    {sociVisualizzati.map((o) => <tr key={o.id}><td style={tdStyle}>{o.soggetto_cliente?.ragione_sociale || "—"}</td><td style={tdStyle}>{o.soggetto_cliente?.codice_fiscale || o.soggetto_cliente?.partita_iva || "—"}</td><td style={tdStyle}>{titoliPossessoLabel[String(o.titolo_possesso || "piena_proprieta")] || "Piena proprietà"}</td><td style={tdStyle}>{o.percentuale_partecipazione != null ? `${Number(o.percentuale_partecipazione).toFixed(2)}%` : "—"}</td><td style={tdStyle}>{o.percentuale_diritti_voto != null ? `${Number(o.percentuale_diritti_voto).toFixed(2)}%` : "—"}</td><td style={tdStyle}>{o.percentuale_diritti_utili != null ? `${Number(o.percentuale_diritti_utili).toFixed(2)}%` : "—"}</td><td style={tdStyle}>{formattaDataItaliana(o.data_nomina)}</td><td style={tdStyle}>{formattaDataItaliana(o.data_scadenza)}</td><td style={tdStyle}><div style={{display:"flex",gap:8}}><button type="button" style={iconButton} title="Modifica" onClick={() => void apriModificaSezione(o,"soci")}><Pencil size={16}/></button>{o.attivo && <button type="button" style={iconButton} title="Disattiva" onClick={() => disattivaOrgano(o)}><Power size={16}/></button>}<button type="button" style={iconDangerButton} title="Elimina" onClick={() => eliminaOrgano(o)}><Trash2 size={16}/></button></div></td></tr>)}
    {sociVisualizzati.length === 0 && <tr><td style={tdStyle} colSpan={9}>Nessun socio presente.</td></tr>}
  </tbody></table></div>
  <div style={{marginTop:14,padding:"12px 14px",borderRadius:9,background:totaleQuoteCorretto?"#dcfce7":"#fee2e2",color:totaleQuoteCorretto?"#166534":"#991b1b",fontWeight:800,display:"flex",justifyContent:"space-between"}}><span>Totale quote societarie</span><span>{totaleQuote.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}%</span></div>
</div>

<div style={{ ...cardStyle, border: "1px solid #dbeafe" }}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><div><h2 style={titleStyle}>Organo di amministrazione</h2><div style={{color:"#64748b",fontSize:13}}>Amministratori, consiglieri, liquidatori e rappresentanti legali.</div></div><button type="button" style={blueButton} onClick={() => apriInserimentoSezione("amministrazione")}>+ Aggiungi componente</button></div>
  <div style={{marginTop:16,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={thStyle}>Nominativo</th><th style={thStyle}>Codice fiscale</th><th style={thStyle}>Qualifica / Carica</th><th style={thStyle}>Dal</th><th style={thStyle}>Al</th><th style={thStyle}>Principale</th><th style={thStyle}>Azioni</th></tr></thead><tbody>{amministrazioneVisualizzata.map((o)=><tr key={o.id}><td style={tdStyle}>{o.soggetto_cliente?.ragione_sociale||"—"}</td><td style={tdStyle}>{o.soggetto_cliente?.codice_fiscale||o.soggetto_cliente?.partita_iva||"—"}</td><td style={tdStyle}>{o.carica||ruoliLabel[o.ruolo]||"—"}</td><td style={tdStyle}>{formattaDataItaliana(o.data_nomina)}</td><td style={tdStyle}>{formattaDataItaliana(o.data_scadenza)}</td><td style={tdStyle}>{o.principale?"Sì":"No"}</td><td style={tdStyle}><div style={{display:"flex",gap:8}}><button type="button" style={iconButton} title="Modifica" onClick={()=>void apriModificaSezione(o,"amministrazione")}><Pencil size={16}/></button>{o.attivo&&<button type="button" style={iconButton} title="Disattiva" onClick={()=>disattivaOrgano(o)}><Power size={16}/></button>}<button type="button" style={iconDangerButton} title="Elimina" onClick={()=>eliminaOrgano(o)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
</div>

{controlloVisualizzato.length > 0 && <div style={{ ...cardStyle, border: "1px solid #dbeafe" }}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><div><h2 style={titleStyle}>Organo di controllo</h2><div style={{color:"#64748b",fontSize:13}}>Sindaci e revisori.</div></div><button type="button" style={blueButton} onClick={()=>apriInserimentoSezione("controllo")}>+ Aggiungi componente</button></div><div style={{marginTop:16,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={thStyle}>Nominativo</th><th style={thStyle}>Codice fiscale</th><th style={thStyle}>Qualifica</th><th style={thStyle}>Dal</th><th style={thStyle}>Al</th><th style={thStyle}>Azioni</th></tr></thead><tbody>{controlloVisualizzato.map((o)=><tr key={o.id}><td style={tdStyle}>{o.soggetto_cliente?.ragione_sociale||"—"}</td><td style={tdStyle}>{o.soggetto_cliente?.codice_fiscale||o.soggetto_cliente?.partita_iva||"—"}</td><td style={tdStyle}>{o.carica||ruoliLabel[o.ruolo]||"—"}</td><td style={tdStyle}>{formattaDataItaliana(o.data_nomina)}</td><td style={tdStyle}>{formattaDataItaliana(o.data_scadenza)}</td><td style={tdStyle}><div style={{display:"flex",gap:8}}><button type="button" style={iconButton} title="Modifica" onClick={()=>void apriModificaSezione(o,"controllo")}><Pencil size={16}/></button>{o.attivo&&<button type="button" style={iconButton} title="Disattiva" onClick={()=>disattivaOrgano(o)}><Power size={16}/></button>}<button type="button" style={iconDangerButton} title="Elimina" onClick={()=>eliminaOrgano(o)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div></div>}

{modalSezione && <div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(15,23,42,.55)"}}><div style={{width:"min(900px,96vw)",maxHeight:"92vh",overflowY:"auto",borderRadius:12,background:"#fff",boxShadow:"0 24px 70px rgba(15,23,42,.28)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:"#5b5b5b",color:"#fff"}}><strong style={{fontSize:18}}>{modalSezione==="soci"?"Soci":modalSezione==="amministrazione"?"Organo di amministrazione":"Organo di controllo"}</strong><button type="button" onClick={()=>setModalSezione(null)} style={{border:0,background:"transparent",color:"#fff",fontSize:22,cursor:"pointer"}}>×</button></div><div style={{padding:20}}>
  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}><div><label style={labelStyle}>Ricerca nominativo</label><input style={inputStyle} value={ricercaNominativo} onChange={(e)=>setRicercaNominativo(e.target.value)} placeholder="Cognome e nome, codice fiscale o partita IVA"/></div><button type="button" style={secondaryButton}>Cerca</button></div>
  <div style={{marginTop:12}}><label style={labelStyle}>Nominativo</label><select style={inputStyle} value={form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,soggetto_cliente_id:e.target.value}))}><option value="">Seleziona nominativo</option>{nominativi.filter((n)=>!ricercaNominativo.trim() || [n.ragione_sociale,n.codice_fiscale,n.partita_iva].some((v)=>String(v||"").toLowerCase().includes(ricercaNominativo.trim().toLowerCase()))).map((n)=><option key={n.id} value={n.id}>{n.ragione_sociale}{n.codice_fiscale?` — ${n.codice_fiscale}`:""}</option>)}</select></div>
  {modalSezione==="soci" ? <><div style={{marginTop:18,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}><div><label style={labelStyle}>Tipo</label><input style={{...inputStyle,background:"#f1f5f9"}} value="Socio" disabled/></div><div><label style={labelStyle}>Dal</label><input type="date" style={inputStyle} value={form.data_nomina} onChange={(e)=>setForm((p)=>({...p,data_nomina:e.target.value}))}/></div><div><label style={labelStyle}>Al</label><input type="date" style={inputStyle} value={form.data_scadenza} onChange={(e)=>setForm((p)=>({...p,data_scadenza:e.target.value}))}/></div></div><div style={{marginTop:16,padding:16,border:"1px solid #dbeafe",borderRadius:10,background:"#f8fbff"}}><div style={{display:"grid",gridTemplateColumns:"1.2fr .7fr .7fr",gap:12}}><div><label style={labelStyle}>Tipologia del diritto</label><select style={inputStyle} value={form.titolo_possesso} onChange={(e)=>setForm((p)=>({...p,titolo_possesso:e.target.value}))}><option value="piena_proprieta">Piena proprietà</option><option value="usufrutto">Usufrutto</option><option value="nuda_proprieta">Nuda proprietà</option><option value="pegno">Pegno</option><option value="sequestro">Sequestro</option><option value="intestazione_fiduciaria">Intestazione fiduciaria</option><option value="altro">Altro</option></select></div><div><label style={labelStyle}>Quota %</label><input type="number" min="0" max="100" step="0.01" style={inputStyle} value={form.percentuale_partecipazione} onChange={(e)=>{const v=e.target.value;setForm((p)=>({...p,percentuale_partecipazione:v,percentuale_diritti_voto:p.titolo_possesso==="piena_proprieta"?v:p.percentuale_diritti_voto,percentuale_diritti_utili:p.titolo_possesso==="piena_proprieta"?v:p.percentuale_diritti_utili}))}}/></div><div><label style={labelStyle}>Diritti di voto %</label><input type="number" min="0" max="100" step="0.01" style={inputStyle} value={form.percentuale_diritti_voto} onChange={(e)=>setForm((p)=>({...p,percentuale_diritti_voto:e.target.value}))}/></div></div><div style={{marginTop:12}}><label style={labelStyle}>Partecipazione agli utili %</label><input type="number" min="0" max="100" step="0.01" style={inputStyle} value={form.percentuale_diritti_utili} onChange={(e)=>setForm((p)=>({...p,percentuale_diritti_utili:e.target.value}))}/></div></div></> : <div style={{marginTop:18,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}><div><label style={labelStyle}>Qualifica</label><select style={inputStyle} value={form.ruolo} onChange={(e)=>setForm((p)=>({...p,ruolo:e.target.value,carica:ruoliLabel[e.target.value]||e.target.value}))}>{(modalSezione==="amministrazione"?ruoliAmministrazione:ruoliControllo).map((r)=><option key={r} value={r}>{ruoliLabel[r]||r}</option>)}</select></div><div><label style={labelStyle}>Data nomina</label><input type="date" style={inputStyle} value={form.data_nomina} onChange={(e)=>setForm((p)=>({...p,data_nomina:e.target.value}))}/></div><div><label style={labelStyle}>Data revoca / dimissioni</label><input type="date" style={inputStyle} value={form.data_scadenza} onChange={(e)=>setForm((p)=>({...p,data_scadenza:e.target.value}))}/></div></div>}
  <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22,borderTop:"1px solid #e2e8f0",paddingTop:16}}><button type="button" style={secondaryButton} onClick={()=>setModalSezione(null)}>Annulla</button><button type="button" style={blueButton} onClick={salvaOrgano}>{organoInModificaId?"Salva modifiche":"OK"}</button></div>
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
