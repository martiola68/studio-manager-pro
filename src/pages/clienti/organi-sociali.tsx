"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

const ruoli = [
  "tutti",
  "socio",
  "amministratore",
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
      .select("id, ragione_sociale, codice_fiscale")
      .order("ragione_sociale");

    setClienti(data || []);
  }

  async function caricaNominativi() {
   const supabase = getSupabaseClient() as any;

const { data } = await supabase
  .from("rapp_legali")
      .select("id, nome_cognome, codice_fiscale")
      .order("nome_cognome");

    setNominativi(data || []);
  }

  async function caricaOrgani() {
    setLoading(true);

    const res = await fetch(`/api/clienti-organi?cliente_id=${clienteId}`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (res.ok) {
      setOrgani(data.organi || []);
    } else {
      setMessaggio(data.error || "Errore caricamento organi");
    }

    setLoading(false);
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
  ...form,
carica: ruoliLabel[form.ruolo] || form.ruolo,
percentuale_partecipazione:
  form.ruolo === "socio"
    ? form.percentuale_partecipazione || null
    : null,
presenza: null,
        durata_carica: payload.durata_carica || null,
data_scadenza: payload.data_scadenza || null,
principale:
  consentePrincipale(form.ruolo) && form.principale,
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
    rapp_legale_id: organo.rapp_legale_id || "",
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
        <h2 style={titleStyle}>Aggiungi organo</h2>

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
            <label style={labelStyle}>Nominativo</label>
            <select
              style={inputStyle}
              value={form.rapp_legale_id}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  rapp_legale_id: e.target.value,
                }))
              }
            >
              <option value="">Seleziona nominativo</option>

              {nominativi.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome_cognome} — {n.codice_fiscale}
                </option>
              ))}
            </select>
          </div>

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
percentuale_partecipazione:
  e.target.value === "socio"
    ? prev.percentuale_partecipazione
    : "",
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
  <label style={labelStyle}>Data nomina</label>

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
    style={inputStyle}
    value={form.durata_carica}
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
  <label style={labelStyle}>Data scadenza</label>
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
            Salva organo
          </button>
        </div>

        {messaggio && (
          <div style={{ marginTop: 12, fontSize: 14, color: "#475569" }}>
            {messaggio}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Organi collegati</h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
            <thead>
  <tr>
    <th style={thStyle}>Nominativo</th>
    <th style={thStyle}>Codice fiscale</th>
    <th style={thStyle}>Ruolo</th>
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
        {o.rapp_legali?.nome_cognome || "—"}
      </td>

      <td style={tdStyle}>
        {o.rapp_legali?.codice_fiscale || "—"}
      </td>

      <td style={tdStyle}>
        {o.ruolo}
      </td>

      <td style={tdStyle}>
        {o.carica || "—"}
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

      <td style={tdStyle}>{o.durata_carica || "—"}</td>

<td style={tdStyle}>
  {o.data_scadenza
    ? new Date(o.data_scadenza).toLocaleDateString("it-IT")
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
            style={secondaryButton}
          >
            Modifica
          </button>

          {o.attivo && (
            <button
              type="button"
              onClick={() => disattivaOrgano(o)}
              style={dangerButton}
            >
              Disattiva
            </button>
          )}

          <button
            type="button"
            onClick={() => eliminaOrgano(o)}
            style={dangerButton}
          >
            Elimina
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
