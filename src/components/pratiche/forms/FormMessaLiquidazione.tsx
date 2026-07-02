"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Download,
  Trash2,
  Upload,
} from "lucide-react";
import { generaDocumentoPratica } from "@/lib/pratiche/generaDocumentoPratica";
import { getSupabaseClient } from "@/lib/supabaseClient";

const font =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: font,
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
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
  color: "#111827",
};

const blueButton: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#2563eb",
  color: "#fff",
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: font,
};

const secondaryButton: React.CSSProperties = {
  border: "1px solid #2563eb",
  borderRadius: 8,
  background: "#fff",
  color: "#2563eb",
  padding: "10px 12px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: font,
  whiteSpace: "nowrap",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: 16,
  fontSize: 14,
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
};

export default function FormMessaLiquidazione({ pratica }: any) {
  const router = useRouter();
  const praticaId = router.query.id as string;

  function tornaElenco() {
  router.push("/pratiche/variazioni");
}

  const [documenti, setDocumenti] = useState<any[]>([]);
 const [rappresentantiLegali, setRappresentantiLegali] = useState<any[]>(
  pratica?.rappresentanti_legali || []
);

const [liquidatoriDisponibili, setLiquidatoriDisponibili] = useState<any[]>([]);
  
  const [soci, setSoci] = useState<any[]>([]);

  const [professionisti, setProfessionisti] = useState<any[]>([]);
  const [diciture, setDiciture] = useState<any[]>([]);

const [nuovoSocio, setNuovoSocio] = useState({
  nominativo_id: "",
  nome_cognome: "",
  codice_fiscale: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  percentuale_partecipazione: "",
  presenza: "Presente",
});

const [organiSocieta, setOrganiSocieta] = useState<any[]>([]);

const [mostraNuovoLiquidatore, setMostraNuovoLiquidatore] = useState(false);

const [nuovoLiquidatore, setNuovoLiquidatore] = useState({
  nome_cognome: "",
  codice_fiscale: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
});
  
  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const sedeSocieta = [
    pratica?.cliente?.indirizzo,
    pratica?.cliente?.cap,
    pratica?.cliente?.citta,
    pratica?.cliente?.provincia,
  ]
    .filter(Boolean)
    .join(" ");

  const [form, setForm] = useState({
    societa_denominazione:
      pratica?.dati_documento?.societa_denominazione ||
      pratica?.cliente?.ragione_sociale ||
      "",

    societa_sede:
      pratica?.dati_documento?.societa_sede || sedeSocieta || "",

    societa_codice_fiscale:
      pratica?.dati_documento?.societa_codice_fiscale ||
      pratica?.cliente?.codice_fiscale ||
      "",

    societa_partita_iva:
      pratica?.dati_documento?.societa_partita_iva ||
      pratica?.cliente?.partita_iva ||
      "",

    societa_rea:
      pratica?.dati_documento?.societa_rea ||
      pratica?.cliente?.numero_rea ||
      "",

    data_atto: pratica?.dati_documento?.data_atto || "",
    ora_inizio: pratica?.dati_documento?.ora_inizio || "",
    ora_chiusura: pratica?.dati_documento?.ora_chiusura || "",
    luogo_assemblea:
      pratica?.dati_documento?.luogo_assemblea || sedeSocieta || "",

    presidente: pratica?.dati_documento?.presidente || "",
    segretario: pratica?.dati_documento?.segretario || "",

    percentuale_capitale:
      pratica?.dati_documento?.percentuale_capitale || "100",

    motivo_liquidazione:
      pratica?.dati_documento?.motivo_liquidazione || "",

    motivo_liquidazione_testo:
      pratica?.dati_documento?.motivo_liquidazione_testo || "",

  liquidatore_id: "",

liquidatore_nome:
  pratica?.dati_documento?.liquidatore_nome || "",

liquidatore_codice_fiscale:
  pratica?.dati_documento?.liquidatore_codice_fiscale || "",

liquidatore_indirizzo:
  pratica?.dati_documento?.liquidatore_indirizzo || "",

liquidatore_citta:
  pratica?.dati_documento?.liquidatore_citta || "",

liquidatore_provincia:
  pratica?.dati_documento?.liquidatore_provincia || "",

liquidatore_cap:
  pratica?.dati_documento?.liquidatore_cap || "",

liquidatore_residenza:
  pratica?.dati_documento?.liquidatore_residenza || "",

liquidatore_tipo_scadenza:
  pratica?.dati_documento?.liquidatore_tipo_scadenza || "Fino a revoca",

liquidatore_data_scadenza:
  pratica?.dati_documento?.liquidatore_data_scadenza || "",
    dicitura_presentazione:
      pratica?.dati_documento?.dicitura_presentazione || "",

  professionista_nome:
  pratica?.dati_documento?.professionista_nome || "",

verbale_definitivo:
  pratica?.dati_documento?.verbale_definitivo || false,

    });

useEffect(() => {
  if (praticaId) {
    caricaDocumenti();
    caricaSoci();
    caricaOrganiSocieta();
    caricaProfessionisti();
    caricaDiciture();
    caricaLiquidatoriDisponibili();
  }
}, [praticaId]);

async function caricaDocumenti() {
  const res = await fetch(`/api/pratiche/${praticaId}/documenti`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (res.ok) {
    setDocumenti(data.documenti || []);
  }
}

async function caricaSoci() {
  const res = await fetch(`/api/pratiche/${praticaId}/soci`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (res.ok) {
    setSoci(data.soci || []);
  }
}

  async function caricaProfessionisti() {
  const res = await fetch("/api/pratiche/professionisti", {
    cache: "no-store",
  });

  const data = await res.json();

  if (res.ok) {
    setProfessionisti(data.professionisti || []);
  }
}

async function caricaDiciture() {
  const res = await fetch("/api/pratiche/diciture-documenti", {
    cache: "no-store",
  });

  const data = await res.json();

  if (res.ok) {
    setDiciture(data.diciture || []);
  }
}

 async function caricaLiquidatoriDisponibili() {
  const supabase = getSupabaseClient() as any;

  const { data, error } = await supabase
    .from("tbclienti")
    .select(`
      id,
      ragione_sociale,
      codice_fiscale,
      partita_iva,
      indirizzo,
      citta,
      provincia,
      cap,
      tipo_cliente,
      cliente
    `)
    .eq("tipo_cliente", "Persona fisica")
    .order("ragione_sociale", { ascending: true });

  if (error) {
    console.error("Errore caricaLiquidatoriDisponibili:", error);
    setLiquidatoriDisponibili([]);
    return;
  }

  setLiquidatoriDisponibili(data || []);
}

async function caricaOrganiSocieta() {
  if (!pratica?.cliente_id) return;

  const res = await fetch(
    `/api/clienti-organi?cliente_id=${pratica.cliente_id}`,
    { cache: "no-store" }
  );

  const data = await res.json();

  if (!res.ok) return;

const organiAttivi = (data.organi || []).filter(
  (o: any) => o.attivo !== false
);

setOrganiSocieta(
  organiAttivi.filter((o: any) => o.tipo_ruolo === "S")
);

setRappresentantiLegali(
  organiAttivi.filter((o: any) => o.tipo_ruolo === "R")
);
  }
  
function normalizzaCF(cf: string) {
  return String(cf || "").trim().toUpperCase();
}

  
function aggiornaCampo(campo: string, valore: string) {
  setForm((prev) => ({
    ...prev,
    [campo]: valore,
  }));
}
  async function salvaDatiDocumento(e?: React.FormEvent) {
    if (e) e.preventDefault();

    setSaving(true);
    setMessaggio("");

    try {
      const res = await fetch(`/api/pratiche/${praticaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore salvataggio dati");
      }

      setMessaggio("Dati verbale salvati correttamente.");
      return true;
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
      return false;
    } finally {
      setSaving(false);
    }
  }

 async function generaDocumento() {
  const salvato = await salvaDatiDocumento();
  if (!salvato) return;

  try {
    await generaDocumentoPratica({
      praticaId,
      codiceModello: "VERBALE_LIQUIDAZIONE",
      onSuccess: caricaDocumenti,
    });

    alert("Documento generato.");
  } catch (error: any) {
    alert(error.message || "Errore generazione documento");
  }
}

async function generaAccettazioneCarica() {
  const ok = confirm(
    "Generare il documento di accettazione carica?"
  );

  if (!ok) return;

  const res = await fetch(
    `/api/pratiche/${praticaId}/genera-documento`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codice_modello: "ACCETTAZIONE_CARICHE",
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Errore generazione accettazione carica");
    return;
  }

  alert("Accettazione carica generata correttamente");
  await caricaDocumenti();
}

  return (
    <main
      style={{
        padding: 28,
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily: font,
      }}
    >

      <div
  style={{
    marginBottom: 18,
    display: "flex",
    justifyContent: "flex-end",
  }}
>
  <button
    type="button"
    onClick={tornaElenco}
    style={{
      border: "1px solid #cbd5e1",
      background: "#fff",
      color: "#334155",
      borderRadius: 8,
      padding: "9px 16px",
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: font,
    }}
  >
    ← Torna a elenco pratiche
  </button>
</div>
      <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>
        {pratica?.numero_pratica}
      </h1>

      <p style={{ marginTop: 6, fontSize: 18, color: "#64748b" }}>
        Verbale assemblea soci - messa in liquidazione
      </p>

      <form onSubmit={salvaDatiDocumento}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati società</h2>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 18 }}>
            <div>
              <label style={labelStyle}>Denominazione</label>
              <input style={inputStyle} value={form.societa_denominazione} onChange={(e) => aggiornaCampo("societa_denominazione", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Codice fiscale</label>
              <input style={inputStyle} value={form.societa_codice_fiscale} onChange={(e) => aggiornaCampo("societa_codice_fiscale", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Partita IVA</label>
              <input style={inputStyle} value={form.societa_partita_iva} onChange={(e) => aggiornaCampo("societa_partita_iva", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Sede</label>
              <input style={inputStyle} value={form.societa_sede} onChange={(e) => aggiornaCampo("societa_sede", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>REA</label>
              <input style={inputStyle} value={form.societa_rea} onChange={(e) => aggiornaCampo("societa_rea", e.target.value)} />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati assemblea</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 12, marginTop: 18 }}>
            <div>
              <label style={labelStyle}>Data assemblea</label>
              <input type="date" style={inputStyle} value={form.data_atto} onChange={(e) => aggiornaCampo("data_atto", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Ora inizio</label>
              <input type="time" style={inputStyle} value={form.ora_inizio} onChange={(e) => aggiornaCampo("ora_inizio", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Ora chiusura</label>
              <input type="time" style={inputStyle} value={form.ora_chiusura} onChange={(e) => aggiornaCampo("ora_chiusura", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Luogo assemblea</label>
              <input style={inputStyle} value={form.luogo_assemblea} onChange={(e) => aggiornaCampo("luogo_assemblea", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Presidente</label>
              <input style={inputStyle} value={form.presidente} onChange={(e) => aggiornaCampo("presidente", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Segretario</label>
              <input style={inputStyle} value={form.segretario} onChange={(e) => aggiornaCampo("segretario", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Percentuale capitale presente</label>
              <input
  style={{
    ...inputStyle,
    background: "#f1f5f9",
    fontWeight: 700,
  }}
  value={soci.reduce(
    (totale: number, socio: any) =>
      totale +
      Number(
        socio.percentuale_partecipazione || 0
      ),
    0
  ).toFixed(2)}
  disabled
/>

              {soci.reduce(
  (totale: number, socio: any) =>
    totale +
    Number(
      socio.percentuale_partecipazione || 0
    ),
  0
) > 100 && (
  <div
    style={{
      color: "#dc2626",
      fontSize: 12,
      marginTop: 4,
      fontWeight: 600,
    }}
  >
    La percentuale totale non può superare 100%
  </div>
)}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Causa di scioglimento</h2>

          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>Motivazione</label>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
              value={form.motivo_liquidazione_testo}
              onChange={(e) => aggiornaCampo("motivo_liquidazione_testo", e.target.value)}
            />
          </div>
        </div>

        <div style={cardStyle}>
  <h2 style={titleStyle}>Soci presenti</h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "2fr auto 1fr 1fr auto",
      gap: 12,
      marginTop: 18,
      alignItems: "end",
    }}
  >
    <div>
      <label style={labelStyle}>Socio</label>
<select
  style={inputStyle}
  value={nuovoSocio.nominativo_id}
  onChange={(e) => {
    const selected = organiSocieta.find(
      (o) => String(o.soggetto_cliente_id) === String(e.target.value)
    );

 setNuovoSocio({
  ...nuovoSocio,
nominativo_id: selected?.soggetto_cliente_id || "",
nome_cognome: selected?.soggetto_cliente?.ragione_sociale || "",
codice_fiscale:
  selected?.soggetto_cliente?.codice_fiscale ||
  selected?.soggetto_cliente?.partita_iva ||
  "",
indirizzo: selected?.soggetto_cliente?.indirizzo || "",
cap: selected?.soggetto_cliente?.cap || "",
citta: selected?.soggetto_cliente?.citta || "",
provincia: selected?.soggetto_cliente?.provincia || "",
  percentuale_partecipazione:
    selected?.percentuale_partecipazione
      ? String(selected.percentuale_partecipazione)
      : "",
  presenza: nuovoSocio.presenza || "Presente",
});
  }}
>
  <option value="">Seleziona socio</option>

  {organiSocieta.map((o) => {
    const id = o.soggetto_cliente_id;
    const nome = o.soggetto_cliente?.ragione_sociale || "-";

    return (
      <option key={o.id} value={id || ""}>
        {nome}
      </option>
    );
  })}
</select>
    </div>


    <div>
      <label style={labelStyle}>% partecipazione</label>
      <input
        type="number"
        step="0.01"
        style={inputStyle}
        value={nuovoSocio.percentuale_partecipazione}
        onChange={(e) =>
          setNuovoSocio({
            ...nuovoSocio,
            percentuale_partecipazione: e.target.value,
          })
        }
      />
    </div>

    <div>
      <label style={labelStyle}>Presenza / delega</label>
      <input
        style={inputStyle}
        value={nuovoSocio.presenza}
        onChange={(e) =>
          setNuovoSocio({
            ...nuovoSocio,
            presenza: e.target.value,
          })
        }
      />
    </div>

    <button
      type="button"
      style={blueButton}
      onClick={async () => {
        if (!nuovoSocio.nome_cognome) {
          alert("Seleziona un socio.");
          return;
        }

        const res = await fetch(`/api/pratiche/${praticaId}/soci`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nuovoSocio),
        });

        if (!res.ok) {
          alert("Errore inserimento socio");
          return;
        }

await fetch("/api/clienti-organi", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    cliente_id: pratica.cliente_id,
    soggetto_cliente_id: nuovoSocio.nominativo_id,
    tipo_ruolo: "S",
    ruolo: "socio",
    carica: "Socio",
    percentuale_partecipazione:
      nuovoSocio.percentuale_partecipazione || null,
    presenza: nuovoSocio.presenza || "Presente",
    attivo: true,
  }),
});

        setNuovoSocio({
          nominativo_id: "",
          nome_cognome: "",
          codice_fiscale: "",
          indirizzo: "",
          cap: "",
          citta: "",
          provincia: "",
          percentuale_partecipazione: "",
          presenza: "Presente",
        });

        await caricaSoci();
      }}
    >
      Aggiungi
    </button>
  </div>

  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      marginTop: 18,
    }}
  >
    <thead>
      <tr>
        <th style={thStyle}>Socio</th>
        <th style={thStyle}>CF</th>
        <th style={thStyle}>Quota</th>
        <th style={thStyle}>Presenza / delega</th>
        <th style={thStyle}>Azioni</th>
      </tr>
    </thead>

    <tbody>
      {soci.map((s) => (
        <tr key={s.id}>
          <td style={tdStyle}>{s.nome_cognome}</td>
          <td style={tdStyle}>{s.codice_fiscale}</td>
          <td style={tdStyle}>
            {Number(s.percentuale_partecipazione || 0).toFixed(2)}%
          </td>
          <td style={tdStyle}>
            {s.presenza || s.tipo_pagamento || "Presente"}
          </td>
          <td style={tdStyle}>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Eliminare il socio?")) return;

                await fetch(`/api/pratiche/${praticaId}/soci/${s.id}`, {
                  method: "DELETE",
                });

                await caricaSoci();
              }}
              style={{
                border: 0,
                background: "transparent",
                color: "#dc2626",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Elimina
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

      <div style={cardStyle}>
  <h2 style={titleStyle}>Liquidatore</h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "2fr auto auto",
      gap: 12,
      marginTop: 18,
      alignItems: "end",
    }}
  >
    <div>
      <label style={labelStyle}>Seleziona liquidatore</label>

<select
  style={inputStyle}
  value={form.liquidatore_id}
  onChange={(e) => {
   const selected = liquidatoriDisponibili.find(
  (r: any) => String(r.id) === String(e.target.value)
);
    
    if (!selected) {
      setForm((prev) => ({
        ...prev,
        liquidatore_id: "",
        liquidatore_nome: "",
        liquidatore_codice_fiscale: "",
        liquidatore_indirizzo: "",
        liquidatore_citta: "",
        liquidatore_provincia: "",
        liquidatore_cap: "",
        liquidatore_residenza: "",
      }));
      return;
    }

   setForm((prev) => ({
  ...prev,
  liquidatore_id: selected.id,
  liquidatore_nome: selected.ragione_sociale || "",
  liquidatore_codice_fiscale:
    selected.codice_fiscale || selected.partita_iva || "",
  liquidatore_indirizzo: selected.indirizzo || "",
  liquidatore_citta: selected.citta || "",
  liquidatore_provincia: selected.provincia || "",
  liquidatore_cap: selected.cap || "",
  liquidatore_residenza: [
  selected.indirizzo,
  selected.cap,
  selected.citta,
  selected.provincia,
]
  .filter(Boolean)
  .join(" "),
    }));
  }}
>
  <option value="">Seleziona liquidatore</option>

{liquidatoriDisponibili.map((l: any) => (
  <option key={l.id} value={l.id}>
    {l.ragione_sociale}
    {l.codice_fiscale ? ` - ${l.codice_fiscale}` : ""}
  </option>
))}
  
</select>
    </div>

 <button
  type="button"
  style={secondaryButton}
  onClick={() => {
    setNuovoLiquidatore({
      nome_cognome: "",
      codice_fiscale: "",
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
    });

    setMostraNuovoLiquidatore(true);
  }}
>
  + Nuovo
</button>
    
  </div>

        {mostraNuovoLiquidatore && (
  <div
    style={{
      ...cardStyle,
      marginTop: 18,
      background: "#f8fafc",
    }}
  >
    <h3 style={{ margin: 0, fontSize: 16 }}>
      Aggiungi nuovo liquidatore
    </h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
        marginTop: 14,
      }}
    >
      <div>
        <label style={labelStyle}>Nome e cognome</label>
        <input
          style={inputStyle}
          value={nuovoLiquidatore.nome_cognome}
          onChange={(e) =>
            setNuovoLiquidatore({
              ...nuovoLiquidatore,
              nome_cognome: e.target.value,
            })
          }
        />
      </div>

      <div>
        <label style={labelStyle}>Codice fiscale</label>
        <input
          style={inputStyle}
          value={nuovoLiquidatore.codice_fiscale}
          onChange={(e) =>
            setNuovoLiquidatore({
              ...nuovoLiquidatore,
              codice_fiscale: e.target.value.toUpperCase(),
            })
          }
        />
      </div>

      <div>
        <label style={labelStyle}>Indirizzo</label>
        <input
          style={inputStyle}
          value={nuovoLiquidatore.indirizzo}
          onChange={(e) =>
            setNuovoLiquidatore({
              ...nuovoLiquidatore,
              indirizzo: e.target.value,
            })
          }
        />
      </div>

      <div>
        <label style={labelStyle}>CAP</label>
        <input
          style={inputStyle}
          value={nuovoLiquidatore.cap}
          onChange={(e) =>
            setNuovoLiquidatore({
              ...nuovoLiquidatore,
              cap: e.target.value,
            })
          }
        />
      </div>

      <div>
        <label style={labelStyle}>Città</label>
        <input
          style={inputStyle}
          value={nuovoLiquidatore.citta}
          onChange={(e) =>
            setNuovoLiquidatore({
              ...nuovoLiquidatore,
              citta: e.target.value,
            })
          }
        />
      </div>

      <div>
        <label style={labelStyle}>Provincia</label>
        <input
          style={inputStyle}
          value={nuovoLiquidatore.provincia}
          onChange={(e) =>
            setNuovoLiquidatore({
              ...nuovoLiquidatore,
              provincia: e.target.value.toUpperCase(),
            })
          }
        />
      </div>
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
      <button
        type="button"
        style={blueButton}
        onClick={async () => {
          const cf = normalizzaCF(nuovoLiquidatore.codice_fiscale);

          if (!nuovoLiquidatore.nome_cognome.trim()) {
            alert("Nome liquidatore obbligatorio.");
            return;
          }

          if (!cf) {
            alert("Codice fiscale obbligatorio.");
            return;
          }


const payload = {
  nome_cognome: nuovoLiquidatore.nome_cognome?.trim(),
  codice_fiscale: cf,
  indirizzo: nuovoLiquidatore.indirizzo?.trim(),
  cap: nuovoLiquidatore.cap?.trim(),
  citta: nuovoLiquidatore.citta?.trim(),
  provincia: nuovoLiquidatore.provincia?.trim(),
};

console.log("PAYLOAD NUOVO LIQUIDATORE", payload);

const res = await fetch(
  `/api/rapp-legali/${praticaId}/nuovo-rapp-pratiche`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }
);

          const data = await res.json();

          if (!res.ok) {
            alert(data.error || "Errore creazione liquidatore");
            return;
          }

        const nuovo = data.data;

          setRappresentantiLegali((prev) => [nuovo, ...prev]);

          setForm((prev) => ({
            ...prev,
            liquidatore_id: nuovo.id,
            liquidatore_nome: nuovo.nome_cognome || "",
            liquidatore_codice_fiscale: nuovo.codice_fiscale || "",
            liquidatore_indirizzo:
              nuovo.indirizzo_residenza || nuovo.indirizzo || "",
            liquidatore_citta:
              nuovo.citta_residenza || nuovo.citta || "",
            liquidatore_provincia: nuovo.provincia || "",
            liquidatore_cap: nuovo.cap || nuovo.CAP || "",
            liquidatore_residenza: [
              nuovo.indirizzo_residenza || nuovo.indirizzo,
              nuovo.cap || nuovo.CAP,
              nuovo.citta_residenza || nuovo.citta,
              nuovo.provincia,
            ]
              .filter(Boolean)
              .join(" "),
          }));

          setNuovoLiquidatore({
            nome_cognome: "",
            codice_fiscale: "",
            indirizzo: "",
            cap: "",
            citta: "",
            provincia: "",
          });

          setMostraNuovoLiquidatore(false);
        }}
      >
        Aggiungi liquidatore
      </button>
    </div>
  </div>
)}

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginTop: 14,
    }}
  >
    <div>
      <label style={labelStyle}>Nome liquidatore</label>
      <input
        style={inputStyle}
        value={form.liquidatore_nome}
        onChange={(e) =>
          aggiornaCampo("liquidatore_nome", e.target.value)
        }
      />
    </div>

    <div>
      <label style={labelStyle}>Codice fiscale</label>
      <input
        style={inputStyle}
        value={form.liquidatore_codice_fiscale}
        onChange={(e) =>
          aggiornaCampo(
            "liquidatore_codice_fiscale",
            e.target.value.toUpperCase()
          )
        }
      />
    </div>
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr 1fr 1fr",
      gap: 12,
      marginTop: 14,
    }}
  >
    <div>
      <label style={labelStyle}>Indirizzo</label>
      <input
        style={inputStyle}
        value={form.liquidatore_indirizzo}
        onChange={(e) =>
          aggiornaCampo("liquidatore_indirizzo", e.target.value)
        }
      />
    </div>

    <div>
      <label style={labelStyle}>Città</label>
      <input
        style={inputStyle}
        value={form.liquidatore_citta}
        onChange={(e) =>
          aggiornaCampo("liquidatore_citta", e.target.value)
        }
      />
    </div>

    <div>
      <label style={labelStyle}>Provincia</label>
      <input
        style={inputStyle}
        value={form.liquidatore_provincia}
        onChange={(e) =>
          aggiornaCampo("liquidatore_provincia", e.target.value.toUpperCase())
        }
      />
    </div>

    <div>
      <label style={labelStyle}>CAP</label>
      <input
        style={inputStyle}
        value={form.liquidatore_cap}
        onChange={(e) =>
          aggiornaCampo("liquidatore_cap", e.target.value)
        }
      />
    </div>
  </div>
        <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 14,
  }}
>
  <div>
    <label style={labelStyle}>Tipo scadenza carica</label>

    <select
      style={inputStyle}
      value={form.liquidatore_tipo_scadenza}
      onChange={(e) =>
        aggiornaCampo(
          "liquidatore_tipo_scadenza",
          e.target.value
        )
      }
    >
      <option value="Fino a revoca">Fino a revoca</option>
      <option value="Fino al bilancio">Fino al bilancio</option>
      <option value="Data specifica">Data specifica</option>
    </select>
  </div>

  <div>
    <label style={labelStyle}>Data scadenza</label>

    <input
      type="date"
      style={inputStyle}
      value={form.liquidatore_data_scadenza}
      disabled={
        form.liquidatore_tipo_scadenza !== "Data specifica"
      }
      onChange={(e) =>
        aggiornaCampo(
          "liquidatore_data_scadenza",
          e.target.value
        )
      }
    />
  </div>
</div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dichiarazione di conformità</h2>

     <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 18,
  }}
>
  <div>
    <label style={labelStyle}>Professionista incaricato</label>

    <select
      style={inputStyle}
  value={
  professionisti.find(
    (p) => p.ragione_sociale === form.professionista_nome
  )?.id || ""
}
onChange={(e) => {
  const prof = professionisti.find(
    (p) => p.id === e.target.value
  );

  aggiornaCampo("professionista_nome", prof?.ragione_sociale || "");
}}
      >
      <option value="">Seleziona professionista</option>

   {professionisti.map((p) => (
  <option key={p.id} value={p.id}>
    {p.ragione_sociale}
  </option>
))}
    </select>
  </div>

  <div>
    <label style={labelStyle}>Tipo dicitura</label>

    <select
      style={inputStyle}
      onChange={(e) => {
        const dicitura = diciture.find(
          (d) => d.id === e.target.value
        );

        if (!dicitura) return;

        const testoFinale = String(
          dicitura.testo || ""
        ).replaceAll(
          "[PROFESSIONISTA_NOME]",
          form.professionista_nome || ""
        );

        aggiornaCampo(
          "dicitura_presentazione",
          testoFinale
        );
      }}
    >
      <option value="">Seleziona dicitura</option>

      {diciture.map((d) => (
        <option key={d.id} value={d.id}>
          {d.titolo}
        </option>
      ))}
    </select>
  </div>
</div>

<div style={{ marginTop: 14 }}>
  <label style={labelStyle}>Dicitura presentazione</label>

  <textarea
    style={{
      ...inputStyle,
      minHeight: 120,
      resize: "vertical",
      background: "#f8fafc",
    }}
    value={form.dicitura_presentazione}
    onChange={(e) =>
      aggiornaCampo(
        "dicitura_presentazione",
        e.target.value
      )
    }
  />
</div>

          <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, color: messaggio.includes("Errore") ? "#dc2626" : "#64748b" }}>
              {messaggio}
            </div>

            <button type="submit" disabled={saving} style={blueButton}>
              {saving ? "Salvataggio..." : "Salva dati verbale"}
            </button>
          </div>
        </div>
      </form>

      <div style={cardStyle}>
  <h2 style={titleStyle}>Documenti</h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 12,
      marginTop: 18,
    }}
  >
    <div>
      <label style={labelStyle}>Modello documento</label>
      <input
        style={{ ...inputStyle, background: "#f1f5f9" }}
        value="VERBALE_LIQUIDAZIONE"
        disabled
      />
    </div>

    <div
  style={{
    display: "flex",
    gap: 28,
    marginTop: 18,
    marginBottom: 18,
    alignItems: "center",
    flexWrap: "wrap",
  }}
>

<label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
  }}
>
  <input
    type="checkbox"
    checked={form.verbale_definitivo}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        verbale_definitivo: e.target.checked,
      }))
    }
  />

  Verbale definitivo
</label>

<label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#475569",
  }}
>
  <input
    type="checkbox"
    disabled
    checked={documenti.some(
      d => d.tipo_documento === "VERBALE_LIQUIDAZIONE"
    )}
  />

  Verbale generato
</label>

<label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#475569",
  }}
>
  <input
    type="checkbox"
    disabled
    checked={documenti.some(
      d => d.tipo_documento === "ACCETTAZIONE_CARICHE"
    )}
  />

  Accettazione carica generata
</label>

</div>

    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
      <button type="button" style={blueButton} onClick={generaDocumento}>
        Genera documento
      </button>

      <button
        type="button"
        style={blueButton}
        onClick={generaAccettazioneCarica}
      >
        Genera accettazione carica
      </button>
    </div>
  </div>

  {documenti.length > 0 && (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
      <thead>
        <tr>
          <th style={thStyle}>Documento</th>
          <th style={thStyle}>Tipo</th>
          <th style={thStyle}>Data</th>
          <th style={thStyle}>Azioni</th>
        </tr>
      </thead>

      <tbody>
        {documenti.map((doc: any) => (
          <tr key={doc.id}>
            <td style={tdStyle}>{doc.nome_file}</td>
            <td style={tdStyle}>{doc.tipo_documento}</td>
            <td style={tdStyle}>
              {doc.created_at
                ? new Date(doc.created_at).toLocaleString("it-IT")
                : "—"}
            </td>
            <td style={tdStyle}>
              <div style={{ display: "flex", gap: 14 }}>
                <a
                  href={`/api/pratiche/${praticaId}/documenti/${doc.id}/download`}
                  download
                  style={{ color: "#2563eb", display: "flex", alignItems: "center" }}
                >
                  <Download size={18} />
                </a>

                <label
                  style={{
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <Upload size={18} />

                  <input
                    type="file"
                    accept=".docx"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const formData = new FormData();
                      formData.append("file", file);
                      formData.append("documento_id", doc.id);

                      const res = await fetch(
                        `/api/pratiche/${praticaId}/documento-modificato`,
                        {
                          method: "POST",
                          body: formData,
                        }
                      );

                      const data = await res.json();

                      if (!res.ok) {
                        alert(data.error || "Errore upload documento");
                        return;
                      }

                      alert("Documento aggiornato correttamente");
                      await caricaDocumenti();
                    }}
                  />
                </label>

                <button
                  type="button"
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#dc2626",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  onClick={async () => {
                    if (!confirm("Eliminare documento?")) return;

                    const res = await fetch(
                      `/api/pratiche/${praticaId}/documenti/${doc.id}`,
                      {
                        method: "DELETE",
                      }
                    );

                    if (!res.ok) {
                      alert("Errore eliminazione documento");
                      return;
                    }

                    await caricaDocumenti();
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
    </main>
  );
}
