"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Download,
  Trash2,
  Upload,
} from "lucide-react";

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
  router.push("/pratiche");
}

  const [documenti, setDocumenti] = useState<any[]>([]);
  const [rappresentantiLegali, setRappresentantiLegali] = useState<any[]>(
  pratica?.rappresentanti_legali || []
);
  const [soci, setSoci] = useState<any[]>([]);
const [nominativi, setNominativi] = useState<any[]>([]);
const [mostraNuovoNominativo, setMostraNuovoNominativo] = useState(false);

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

const [nuovoNominativo, setNuovoNominativo] = useState({
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

    dicitura_presentazione:
      pratica?.dati_documento?.dicitura_presentazione || "",

    professionista_nome:
      pratica?.dati_documento?.professionista_nome || "",

    qualifica_professionista:
      pratica?.dati_documento?.qualifica_professionista || "",

    professionista_cf:
      pratica?.dati_documento?.professionista_cf || "",
  });

useEffect(() => {
  if (praticaId) {
    caricaDocumenti();
    caricaSoci();
    caricaNominativi();
  }
}, [praticaId]);

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({
      ...prev,
      [campo]: valore,
    }));
  }

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

async function caricaNominativi() {
  const res = await fetch("/api/pratiche/nominativi", {
    cache: "no-store",
  });

  const data = await res.json();

  if (res.ok) {
    setNominativi(data.nominativi || []);
  }
}

function normalizzaCF(cf: string) {
  return String(cf || "").trim().toUpperCase();
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

    const res = await fetch(`/api/pratiche/${praticaId}/genera-documento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codice_modello: "VERBALE_LIQUIDAZIONE",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Errore generazione documento");
      return;
    }

    await caricaDocumenti();
    alert("Documento generato.");
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
          const selected = nominativi.find(
            (n) => n.id === e.target.value
          );

          setNuovoSocio({
            ...nuovoSocio,
            nominativo_id: selected?.id || "",
            nome_cognome: selected?.nome_cognome || "",
            codice_fiscale: selected?.codice_fiscale || "",
            indirizzo: selected?.indirizzo || "",
            cap: selected?.cap || "",
            citta: selected?.citta || "",
            provincia: selected?.provincia || "",
          });
        }}
      >
        <option value="">Seleziona nominativo</option>

        {nominativi.map((n) => (
          <option key={n.id} value={n.id}>
            {n.nome_cognome}
          </option>
        ))}
      </select>
    </div>

   <button
  type="button"
  style={secondaryButton}
  onClick={() => {
    setNuovoNominativo({
      nome_cognome: "",
      codice_fiscale: "",
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
    });

    setMostraNuovoNominativo(true);
  }}
>
  + Nuovo
</button>
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
    rapp_legale_id: nuovoSocio.nominativo_id,
    ruolo: "socio",
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

  {mostraNuovoNominativo && (
    <div
      style={{
        ...cardStyle,
        marginTop: 18,
        background: "#f8fafc",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16 }}>
        Aggiungi nuovo nominativo
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
            value={nuovoNominativo.nome_cognome}
            onChange={(e) =>
              setNuovoNominativo({
                ...nuovoNominativo,
                nome_cognome: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label style={labelStyle}>Codice fiscale</label>
          <input
            style={inputStyle}
            value={nuovoNominativo.codice_fiscale}
            onChange={(e) =>
              setNuovoNominativo({
                ...nuovoNominativo,
                codice_fiscale: e.target.value.toUpperCase(),
              })
            }
          />
        </div>

        <div>
          <label style={labelStyle}>Indirizzo</label>
          <input
            style={inputStyle}
            value={nuovoNominativo.indirizzo}
            onChange={(e) =>
              setNuovoNominativo({
                ...nuovoNominativo,
                indirizzo: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label style={labelStyle}>CAP</label>
          <input
            style={inputStyle}
            value={nuovoNominativo.cap}
            onChange={(e) =>
              setNuovoNominativo({
                ...nuovoNominativo,
                cap: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label style={labelStyle}>Città</label>
          <input
            style={inputStyle}
            value={nuovoNominativo.citta}
            onChange={(e) =>
              setNuovoNominativo({
                ...nuovoNominativo,
                citta: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label style={labelStyle}>Provincia</label>
          <input
            style={inputStyle}
            value={nuovoNominativo.provincia}
            onChange={(e) =>
              setNuovoNominativo({
                ...nuovoNominativo,
                provincia: e.target.value.toUpperCase(),
              })
            }
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 16,
        }}
      >
        <button
          type="button"
          style={blueButton}
          onClick={async () => {
            const cf = normalizzaCF(nuovoNominativo.codice_fiscale);

            if (!nuovoNominativo.nome_cognome.trim()) {
              alert("Nome e cognome obbligatori.");
              return;
            }

            if (!cf) {
              alert("Codice fiscale obbligatorio.");
              return;
            }

            const res = await fetch("/api/pratiche/nominativi", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...nuovoNominativo,
                codice_fiscale: cf,
              }),
            });

            const data = await res.json();

            if (!res.ok) {
              alert(data.error || "Errore creazione nominativo");
              return;
            }

            await caricaNominativi();

            const nuovo = data.nominativo;

            setNuovoSocio({
              ...nuovoSocio,
              nominativo_id: nuovo.id,
              nome_cognome: nuovo.nome_cognome || "",
              codice_fiscale: nuovo.codice_fiscale || "",
              indirizzo: nuovo.indirizzo || "",
              cap: nuovo.cap || "",
              citta: nuovo.citta || "",
              provincia: nuovo.provincia || "",
            });

            setMostraNuovoNominativo(false);
          }}
        >
          Aggiungi nominativo
        </button>
      </div>
    </div>
  )}

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
      gridTemplateColumns: "2fr auto",
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
          const selected = pratica?.rappresentanti_legali?.find(
            (r: any) => r.id === e.target.value
          );

          setForm((prev) => ({
            ...prev,
            liquidatore_id: selected?.id || "",
            liquidatore_nome: selected?.nome_cognome || "",
            liquidatore_codice_fiscale: selected?.codice_fiscale || "",
            liquidatore_indirizzo:
              selected?.indirizzo_residenza || selected?.indirizzo || "",
            liquidatore_citta:
              selected?.citta_residenza || selected?.citta || "",
            liquidatore_provincia: selected?.provincia || "",
            liquidatore_cap: selected?.cap || "",
            liquidatore_residenza: [
              selected?.indirizzo_residenza || selected?.indirizzo,
              selected?.cap,
              selected?.citta_residenza || selected?.citta,
              selected?.provincia,
            ]
              .filter(Boolean)
              .join(" "),
          }));
        }}
      >
        <option value="">Seleziona</option>

        {pratica?.rappresentanti_legali?.map((r: any) => (
          <option key={r.id} value={r.id}>
            {r.nome_cognome}
          </option>
        ))}
      </select>
    </div>

   <button
  type="button"
  style={secondaryButton}
  onClick={() => {
    setNuovoNominativo({
      nome_cognome: "",
      codice_fiscale: "",
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
    });

    setMostraNuovoNominativo(false);
  }}
>
  + Nuovo
</button>
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
</div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dichiarazione di conformità</h2>

          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>Dicitura presentazione</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              value={form.dicitura_presentazione}
              onChange={(e) => aggiornaCampo("dicitura_presentazione", e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Professionista</label>
              <input style={inputStyle} value={form.professionista_nome} onChange={(e) => aggiornaCampo("professionista_nome", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Qualifica</label>
              <input style={inputStyle} value={form.qualifica_professionista} onChange={(e) => aggiornaCampo("qualifica_professionista", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Codice fiscale professionista</label>
              <input style={inputStyle} value={form.professionista_cf} onChange={(e) => aggiornaCampo("professionista_cf", e.target.value.toUpperCase())} />
            </div>
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

        <div style={{ display: "grid", gridTemplateColumns: "2fr auto", gap: 12, marginTop: 18, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Modello documento</label>
            <input style={{ ...inputStyle, background: "#f1f5f9" }} value="VERBALE_LIQUIDAZIONE" disabled />
          </div>

          <button type="button" style={blueButton} onClick={generaDocumento}>
            Genera documento
          </button>
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
                    {doc.created_at ? new Date(doc.created_at).toLocaleString("it-IT") : "—"}
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

                          const res = await fetch(`/api/pratiche/${praticaId}/documenti/${doc.id}`, {
                            method: "DELETE",
                          });

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
