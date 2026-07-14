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
  amministratore_delegato: "Amministratore delegato",
  presidente_cda: "Presidente del CDA",
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
  const codice = normalizeCF(cf);

  if (codice.length !== 16) return;
  if (!isValidCF(codice)) return;

  try {
    const comune = await getComuneFromCF(codice);
    const dataNascita = extractDataNascitaFromCF(codice);

    setNuovoNominativo((prev: any) => ({
      ...prev,
      codice_fiscale: codice,
      luogo_nascita:
        prev.luogo_nascita || comune?.comune || "",
      data_nascita:
        prev.data_nascita || dataNascita || "",
    }));
  } catch (err) {
    console.error(err);
  }
}
export default function OrganiSocialiPage() {
  const router = useRouter();
  

  const [clienti, setClienti] = useState<any[]>([]);
  const [nominativi, setNominativi] = useState<any[]>([]);
  const [organi, setOrgani] = useState<any[]>([]);

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

const [assettoSocietario, setAssettoSocietario] = useState({
  numero_soci_attesi: "",
  numero_rappresentanti_attesi: 1,
  numero_sindaci_attesi: 0,
  numero_revisori_attesi: 0,
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
    return;
  }

  caricaOrgani();
}, [clienteId]);

useEffect(() => {
  const cliente = clienti.find((c) => c.id === clienteId);

  if (!cliente) {
    setAssettoSocietario({
      numero_soci_attesi: "",
      numero_rappresentanti_attesi: 1,
      numero_sindaci_attesi: 0,
      numero_revisori_attesi: 0,
    });
    return;
  }

  setAssettoSocietario({
    numero_soci_attesi: cliente.numero_soci_attesi ?? "",
    numero_rappresentanti_attesi:
      cliente.numero_rappresentanti_attesi ?? 1,
    numero_sindaci_attesi:
      cliente.numero_sindaci_attesi ?? 0,
    numero_revisori_attesi:
      cliente.numero_revisori_attesi ?? 0,
  });
}, [clienteId, clienti]);

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
    studio_id,
    numero_soci_attesi,
    numero_rappresentanti_attesi,
    numero_sindaci_attesi,
    numero_revisori_attesi
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
      nuovoNominativo.nome_cognome.trim(),

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
      nuovoNominativo.tipologia_cliente,

    tipologia_cliente:
      nuovoNominativo.tipologia_cliente,

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

  if (!file || !clienteId) {
    e.target.value = "";
    return;
  }

  const formData = new FormData();

  /*
   * L’API usa esattamente il campo "clienteId".
   */
  formData.append("clienteId", clienteId);
  formData.append("file", file);

  setLoadingImportazione(true);
  setMessaggio("");

  try {
    const res = await fetch(
      "/api/clienti/organi-sociali/importa-visura",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
          "Errore durante la lettura della visura."
      );
    }

    /*
     * L’API restituisce "soggetti", non "righe".
     */
    setAnteprimaImportazione(
      Array.isArray(data.soggetti)
        ? data.soggetti
        : []
    );

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
    e.target.value = "";
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
} else {
      console.error("Errore caricaOrgani:", data);
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
  
  
  async function salvaAssettoSocietario(
  campo:
    | "numero_soci_attesi"
    | "numero_rappresentanti_attesi"
    | "numero_sindaci_attesi"
    | "numero_revisori_attesi",
  valore: number
) {
  if (!clienteId) return;

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("tbclienti")
    .update({
      [campo]: valore,
    })
    .eq("id", clienteId);

  if (error) {
    console.error(error);
    alert("Errore salvataggio");
    return;
  }

  setClienti((prev) =>
    prev.map((c) =>
      c.id === clienteId
        ? {
            ...c,
            [campo]: valore,
          }
        : c
    )
  );
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
  
  durata_carica:
    form.ruolo === "socio"
      ? null
      : form.durata_carica || null,
  data_scadenza:
    form.data_scadenza || null,
  presenza: null,
  principale: consentePrincipale(form.ruolo) && form.principale,
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
  codiceFiscale &&
  datiNascitaMancanti
) {
  setTimeout(() => {
    aggiornaDatiDaCodiceFiscale(
      codiceFiscale
    );
  }, 0);
}

  setShowNuovoNominativo(true);
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
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>
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

  <div
    style={{
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
    }}
  >
    {loadingImportazione && (
      <span
        style={{
          color: "#64748b",
          fontSize: 13,
        }}
      >
        Lettura visura in corso...
      </span>
    )}

    <button
      type="button"
      style={{
        ...secondaryButton,
        opacity:
          !clienteId || loadingImportazione
            ? 0.55
            : 1,
        cursor:
          !clienteId || loadingImportazione
            ? "not-allowed"
            : "pointer",
      }}
      disabled={
        !clienteId || loadingImportazione
      }
      onClick={() =>
        document
          .getElementById(
            "visuraOrganiInput"
          )
          ?.click()
      }
    >
      Importa da visura
    </button>

    <input
      id="visuraOrganiInput"
      type="file"
      accept="application/pdf,.pdf"
      style={{ display: "none" }}
      onChange={importaVisura}
    />
  </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginTop: 18,
          }}
        >
          <div>
            <label style={labelStyle}>N. soci</label>
          <input
  type="number"
  min="0"
  style={inputStyle}
  value={assettoSocietario.numero_soci_attesi}
  onChange={(e) =>
    setAssettoSocietario((prev) => ({
      ...prev,
      numero_soci_attesi: e.target.value,
    }))
  }
  onBlur={(e) =>
    salvaAssettoSocietario(
      "numero_soci_attesi",
      Number(e.target.value || 0)
    )
  }
/>
          </div>

          <div>
            <label style={labelStyle}>N. rappresentanti</label>
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={assettoSocietario.numero_rappresentanti_attesi}
              onChange={(e) =>
                setAssettoSocietario((prev) => ({
                  ...prev,
                  numero_rappresentanti_attesi:
                    e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
              onBlur={(e) =>
  salvaAssettoSocietario(
    "numero_rappresentanti_attesi",
    Number(e.target.value || 0)
  )
}
            />
          </div>

          <div>
            <label style={labelStyle}>N. sindaci</label>
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={assettoSocietario.numero_sindaci_attesi}
              onChange={(e) =>
                setAssettoSocietario((prev) => ({
                  ...prev,
                  numero_sindaci_attesi:
                    e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
              onBlur={(e) =>
  salvaAssettoSocietario(
    "numero_sindaci_attesi",
    Number(e.target.value || 0)
  )
}
            />
          </div>

          <div>
            <label style={labelStyle}>N. revisori</label>
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={assettoSocietario.numero_revisori_attesi}
              onChange={(e) =>
                setAssettoSocietario((prev) => ({
                  ...prev,
                  numero_revisori_attesi:
                    e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
              onBlur={(e) =>
  salvaAssettoSocietario(
    "numero_revisori_attesi",
    Number(e.target.value || 0)
  )
}
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Aggiungi socio / organo</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 12,
            marginTop: 18,
            alignItems: "end",
          }}
        >
<div>
  <label style={labelStyle}>Ruolo</label>

  <select
    style={inputStyle}
    value={form.ruolo}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        ruolo: e.target.value,
        carica: ruoliLabel[e.target.value] || "",
       soggetto_cliente_id: "",

        percentuale_partecipazione:
          e.target.value === "socio"
            ? prev.percentuale_partecipazione
            : "",

        durata_carica:
          e.target.value === "socio"
            ? ""
            : prev.durata_carica || "Fino a revoca",

        principale: consentePrincipale(e.target.value)
          ? prev.principale
          : false,
      }))
    }
  >
    {ruoli
      .filter((r) => r !== "tutti")
      .map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
  </select>
</div>

<div>
  <label style={labelStyle}>Nominativo</label>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 8,
    }}
  >
  <select
  style={inputStyle}
  value={form.soggetto_cliente_id}
      onChange={(e) => {
        const id = e.target.value;

        const nominativo = nominativi.find(
          (n) => String(n.id) === String(id)
        );

        setForm((prev) => ({
  ...prev,
  soggetto_cliente_id: id,
}));

        if (!nominativo) return;

        setNuovoNominativo((prev) => ({
          ...prev,
          nome_cognome: nominativo.ragione_sociale || "",
          codice_fiscale: nominativo.codice_fiscale || "",
          indirizzo: nominativo.indirizzo || "",
          citta: nominativo.citta || "",
          provincia: nominativo.provincia || "",
          cap: nominativo.cap || "",
        }));
      }}
    >
      <option value="">Seleziona nominativo</option>

     {nominativi.map((n) => (
  <option key={n.id} value={n.id}>
    {n.ragione_sociale}
    {n.codice_fiscale ? ` — ${n.codice_fiscale}` : ""}
  </option>
))}
    </select>

 <div
  style={{
    display: "flex",
    gap: 8,
  }}
>
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
</div>
  </div>
</div>

          <div>
            <label style={labelStyle}>Quota %</label>
          <input
  type="number"
  step="0.01"
  disabled={!richiedeQuota(form.ruolo)}
  style={{
    ...inputStyle,
    background: richiedeQuota(form.ruolo)
      ? "#fff"
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
    percentuale_partecipazione: valore,

    percentuale_diritti_voto:
      prev.titolo_possesso === "piena_proprieta"
        ? valore
        : prev.percentuale_diritti_voto,

    percentuale_diritti_utili:
      prev.titolo_possesso === "piena_proprieta"
        ? valore
        : prev.percentuale_diritti_utili,
  }));
}}
            />
          </div>

          <div>
  <label style={labelStyle}>Data nomina / dal</label>

  <input
    type="date"
    style={inputStyle}
    value={form.data_nomina}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        data_nomina: e.target.value,
      }))
    }
  />
</div>

          <div>
  <label style={labelStyle}>Durata carica</label>
 <select
  style={{
    ...inputStyle,
    background: form.ruolo === "socio" ? "#f1f5f9" : "#fff",
  }}
  disabled={form.ruolo === "socio"}
  value={form.ruolo === "socio" ? "" : form.durata_carica}
  onChange={(e) =>
    setForm((prev) => ({
      ...prev,
      durata_carica: e.target.value,
    }))
  }
>
    <option value="Fino a revoca">Fino a revoca</option>
    <option value="Anni: 1">Anni: 1</option>
    <option value="Anni: 2">Anni: 2</option>
    <option value="Anni: 3">Anni: 3</option>
    <option value="Anni: 4">Anni: 4</option>
    <option value="Anni: 5">Anni: 5</option>
    <option value="Fino al bilancio">Fino al bilancio</option>
  </select>
</div>

<div>
 <label style={labelStyle}>Data scadenza / Fino a</label>
  <input
    type="date"
    style={inputStyle}
    value={form.data_scadenza}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        data_scadenza: e.target.value,
      }))
    }
  />
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
    display: "grid",
    gridTemplateColumns: "1fr auto",
            gap: 12,
            marginTop: 14,
            alignItems: "center",
          }}
        >
         
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
           <input
  type="checkbox"
  disabled={!consentePrincipale(form.ruolo)}
  checked={
    consentePrincipale(form.ruolo)
      ? form.principale
      : false
  }
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  principale: e.target.checked,
                }))
              }
            />
            Principale
          </label>

          <button
  type="button"
  style={primaryButton}
  onClick={salvaOrgano}
>
  {organoInModificaId
    ? "Aggiorna nominativo"
    : "Aggiungi nominativo"}
</button>
        </div>

        {messaggio && (
          <div style={{ marginTop: 12, fontSize: 14, color: "#475569" }}>
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
    ? new Date(o.data_nomina).toLocaleDateString("it-IT")
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
  onChange={(e) =>
    setNuovoNominativo((p) => ({
      ...p,
      tipologia_cliente: e.target.value,
    }))
  }
>
  <option value="Persona fisica">Persona fisica</option>
  <option value="Altro">Altro</option>
</select>

             <input
  style={inputStyle}
  placeholder="Codice fiscale"
  maxLength={16}
  value={nuovoNominativo.codice_fiscale}
  onChange={async (e) => {
    const cf = normalizeCF(e.target.value);

    setNuovoNominativo((p) => ({
      ...p,
      codice_fiscale: cf,
    }));

    if (cf.length === 16) {
      await leggiDatiDaCF(cf, setNuovoNominativo);
    }
  }}
/>

              {nuovoNominativo.codice_fiscale.length === 16 &&
 !isValidCF(
   normalizeCF(nuovoNominativo.codice_fiscale)
 ) && (
  <div
    style={{
      color: "#dc2626",
      fontSize: 12,
    }}
  >
    Codice fiscale non valido
  </div>
)}

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
                style={inputStyle}
                placeholder="Luogo nascita"
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
                style={inputStyle}
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
                placeholder="CAP"
                value={nuovoNominativo.cap}
                onChange={(e) =>
                  setNuovoNominativo((p) => ({
                    ...p,
                    cap: e.target.value,
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
                onClick={() => setShowNuovoNominativo(false)}
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
