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
});

const [form, setForm] = useState({
  rapp_legale_id: "",
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

  const organiFiltrati = useMemo(() => {
    if (filtroRuolo === "tutti") return organi;
    return organi.filter((o) => o.ruolo === filtroRuolo);
  }, [organi, filtroRuolo]);

  async function caricaClienti() {
   const supabase = getSupabaseClient() as any;

    const { data } = await supabase
  .from("tbclienti")
     .select("id, ragione_sociale, codice_fiscale, studio_id")
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
      tipo_cliente: "Persona fisica",
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
    rapp_legale_id: data.data.id,
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
      setOrgani(data.organi || []);
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
  
  async function salvaOrgano() {
    if (!clienteId) {
      alert("Seleziona prima un cliente.");
      return;
    }

    if (!form.rapp_legale_id) {
      alert("Seleziona un nominativo.");
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

  rapp_legale_id: null,
  soggetto_cliente_id: form.rapp_legale_id,
  tipo_soggetto: "persona_fisica",
  rappresentante_legale: form.ruolo === "rappresentante_legale",

  ruolo: form.ruolo,
  carica: ruoliLabel[form.ruolo] || form.ruolo,
  percentuale_partecipazione:
    form.ruolo === "socio"
      ? form.percentuale_partecipazione || null
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
  rapp_legale_id: "",
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
});
    
setOrganoInModificaId("");

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

  function caricaInModifica(organo: any) {
  setOrganoInModificaId(organo.id);

  setForm({
rapp_legale_id:
  organo.soggetto_cliente_id ||
  organo.rapp_legale_id ||
  "",
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
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}
  
  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>
            Organi sociali
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
        rapp_legale_id: "",

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
      value={form.rapp_legale_id}
      onChange={(e) => {
        const id = e.target.value;

        const nominativo = nominativi.find(
          (n) => String(n.id) === String(id)
        );

        setForm((prev) => ({
          ...prev,
          rapp_legale_id: id,
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
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  percentuale_partecipazione: e.target.value,
                }))
              }
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

      <div style={cardStyle}>
      <h2 style={titleStyle}>Soci / Organi collegati</h2>

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
    <tr key={o.id}>
   <td style={tdStyle}>
  {o.soggetto_cliente?.ragione_sociale ||
    o.rapp_legali?.nome_cognome ||
    "—"}
</td>

    <td style={tdStyle}>
  {o.soggetto_cliente?.codice_fiscale ||
    o.soggetto_cliente?.partita_iva ||
    o.rapp_legali?.codice_fiscale ||
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
    ))}
              {organiFiltrati.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan={12}>
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
