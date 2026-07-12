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

  const clienteSelezionato = clienti.find((c) => c.id === clienteId);

  const res = await fetch("/api/clienti/soggetti", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studio_id: clienteSelezionato?.studio_id || null,
      ragione_sociale: nuovoNominativo.nome_cognome,
      codice_fiscale: nuovoNominativo.codice_fiscale,
      email: nuovoNominativo.email,
      luogo_nascita: nuovoNominativo.luogo_nascita,
      data_nascita: nuovoNominativo.data_nascita || null,
      indirizzo: nuovoNominativo.indirizzo,
      citta: nuovoNominativo.citta,
      provincia: nuovoNominativo.provincia,
      cap: nuovoNominativo.cap,
      tipo_cliente: nuovoNominativo.tipologia_cliente,
      tipologia_cliente: nuovoNominativo.tipologia_cliente,
      cliente: false,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    alert(data.error || "Errore salvataggio nominativo.");
    return;
  }

  await caricaNominativi();

 setForm((prev) => ({
  ...prev,
  soggetto_cliente_id: data.data.id,
}));

  setShowNuovoNominativo(false);

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
  tipologia_cliente: "Persona fisica",
});
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
  
  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh" }}>
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
            <label style={labelStyle}>Cliente / società</label>
  <select
  style={{
    ...inputStyle,
    background:
      router.query.cliente_id ? "#f1f5f9" : "#fff",
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
              <option value="">Seleziona società</option>

              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ragione_sociale}
                </option>
              ))}
            </select>
          </div>

                  <div>
            <label style={labelStyle}>Filtro ruolo</label>
            <select
              style={inputStyle}
              value={filtroRuolo}
              onChange={(e) => setFiltroRuolo(e.target.value)}
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

   <button
  type="button"
  style={secondaryButton}
  onClick={() => {
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
  tipologia_cliente: "Persona fisica",
});

    setShowNuovoNominativo(true);
  }}
>
  + Nuovo
</button>
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

    setForm((prev) => ({
      ...prev,
      titolo_possesso: titolo,

      percentuale_diritti_voto:
        titolo === "piena_proprieta"
          ? prev.percentuale_partecipazione
          : prev.percentuale_diritti_voto,

      percentuale_diritti_utili:
        titolo === "piena_proprieta"
          ? prev.percentuale_partecipazione
          : prev.percentuale_diritti_utili,

      note_titolo_possesso:
        titolo === "piena_proprieta"
          ? ""
          : prev.note_titolo_possesso,
    }));
  }}
>
  <option value="piena_proprieta">
    Piena proprietà
  </option>

  <option value="usufrutto">
    Usufrutto
  </option>
</select>

      </div>

      <div>
        <label style={labelStyle}>Diritti di voto %</label>

        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          style={inputStyle}
          value={form.percentuale_diritti_voto}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              percentuale_diritti_voto: e.target.value,
            }))
          }
        />
      </div>

      <div>
        <label style={labelStyle}>Diritti agli utili %</label>

        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          style={inputStyle}
          value={form.percentuale_diritti_utili}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              percentuale_diritti_utili: e.target.value,
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

          <button type="button" style={blueButton} onClick={salvaOrgano}>
            Aggiungi nominativo
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
 <td style={tdStyle}>
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
  {o.ruolo === "socio"
    ? titoliPossessoLabel[
        String(o.titolo_possesso || "piena_proprieta")
      ] || "Piena proprietà"
    : "—"}
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

<td style={tdStyle}>
  {o.data_scadenza
    ? new Date(o.data_scadenza).toLocaleDateString("it-IT")
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
              fontWeight: 800,
            }}
          >
            ↳ NUDO PROPRIETARIO:{" "}
            {diritto.nominativo_nome || "—"}
          </td>

          <td
            style={{
              ...tdStyle,
              color: "#dc2626",
            }}
          >
            {diritto.nominativo_codice_fiscale || "—"}
          </td>

          <td
            style={{
              ...tdStyle,
              color: "#dc2626",
              fontWeight: 700,
            }}
          >
            Nudo proprietario
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
              color: "#dc2626",
            }}
          >
            Collegato a{" "}
            {`Q-${String(o.id)
              .slice(0, 6)
              .toUpperCase()}`}
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
            <h2 style={titleStyle}>Nuovo nominativo</h2>

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
                Salva nominativo
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
