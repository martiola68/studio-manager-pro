"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const font =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #9ca3af",
  borderRadius: 7,
  padding: "9px 10px",
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
  fontFamily: font,
};

export default function FormDistribuzioneUtili({ pratica }: any) {
  const router = useRouter();
  const praticaId = router.query.id as string;

  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const [soci, setSoci] = useState<any[]>([]);
  const [nominativi, setNominativi] = useState<any[]>([]);

  const sede = [
    pratica.cliente?.indirizzo,
    pratica.cliente?.cap,
    pratica.cliente?.citta,
    pratica.cliente?.provincia,
  ]
    .filter(Boolean)
    .join(" ");

  const [form, setForm] = useState({
    societa_denominazione:
      pratica.dati_documento?.societa_denominazione ||
      pratica.cliente?.ragione_sociale ||
      "",
    societa_sede:
      pratica.dati_documento?.societa_sede || sede || "",
    societa_codice_fiscale:
      pratica.dati_documento?.societa_codice_fiscale ||
      pratica.cliente?.codice_fiscale ||
      "",
    societa_partita_iva:
      pratica.dati_documento?.societa_partita_iva ||
      pratica.cliente?.partita_iva ||
      "",
    societa_rea:
      pratica.dati_documento?.societa_rea ||
      pratica.cliente?.numero_rea ||
      "",
    data_atto: pratica.dati_documento?.data_atto || "",
    ora_inizio: pratica.dati_documento?.ora_inizio || "",
    luogo_assemblea:
      pratica.dati_documento?.luogo_assemblea || sede || "",
    presidente: pratica.dati_documento?.presidente || "",
    segretario: pratica.dati_documento?.segretario || "",
    ora_chiusura: pratica.dati_documento?.ora_chiusura || "",
  });

  const [nuovoSocio, setNuovoSocio] = useState({
    nominativo_id: "",
    nome_cognome: "",
    codice_fiscale: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
    importo_dividendo_totale: "",
    percentuale_partecipazione: "",
    importo_utile: "",
    percentuale_ritenuta: "26",
    importo_ritenuta: "",
    importo_netto: "",
    tipo_pagamento: "",
  });

  useEffect(() => {
    if (praticaId) {
      caricaSoci();
      caricaNominativi();
    }
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function caricaSoci() {
    const res = await fetch(`/api/pratiche/${praticaId}/soci`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setSoci(data.soci || []);
  }

  async function caricaNominativi() {
    const res = await fetch("/api/pratiche/nominativi", {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setNominativi(data.nominativi || []);
  }

  async function salvaDatiDocumento(e: React.FormEvent) {
    e.preventDefault();
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
        throw new Error(data.error || "Errore salvataggio dati verbale");
      }

      setMessaggio("Dati verbale salvati correttamente.");
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  }

  const percentualeSociPresentiCalcolata = soci.reduce(
    (totale, socio) =>
      totale + Number(socio.percentuale_partecipazione || 0),
    0
  );

  const importoLordoNuovoSocio = Number(nuovoSocio.importo_utile || 0);
  const percentualeRitenutaNuovoSocio = Number(
    nuovoSocio.percentuale_ritenuta || 0
  );

  const importoRitenutaNuovoSocio =
    (importoLordoNuovoSocio * percentualeRitenutaNuovoSocio) / 100;

  const importoNettoNuovoSocio =
    importoLordoNuovoSocio - importoRitenutaNuovoSocio;

  return (
    <main
      style={{
        padding: 28,
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily: font,
      }}
    >
      <h1>{pratica.numero_pratica}</h1>
      <p>{pratica.titolo}</p>

      <form onSubmit={salvaDatiDocumento}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati società</h2>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 18 }}>
            <div>
              <label style={labelStyle}>Denominazione società</label>
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
              <label style={labelStyle}>Sede società</label>
              <input style={inputStyle} value={form.societa_sede} onChange={(e) => aggiornaCampo("societa_sede", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>REA</label>
              <input style={inputStyle} value={form.societa_rea} onChange={(e) => aggiornaCampo("societa_rea", e.target.value)} />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati verbale distribuzione utili</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12, marginTop: 18 }}>
            <div>
              <label style={labelStyle}>Data assemblea</label>
              <input type="date" style={inputStyle} value={form.data_atto} onChange={(e) => aggiornaCampo("data_atto", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Ora inizio</label>
              <input type="time" style={inputStyle} value={form.ora_inizio} onChange={(e) => aggiornaCampo("ora_inizio", e.target.value)} />
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
              <label style={labelStyle}>Ora chiusura</label>
              <input type="time" style={inputStyle} value={form.ora_chiusura} onChange={(e) => aggiornaCampo("ora_chiusura", e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
        <h2 style={titleStyle}>Soci presenti / Distribuzione utili</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr auto", gap: 12, marginTop: 18, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Socio</label>
            <select
              style={inputStyle}
              value={nuovoSocio.nominativo_id}
              onChange={(e) => {
                const selected = nominativi.find((n) => n.id === e.target.value);
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

          <div>
            <label style={labelStyle}>Dividendo totale</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={nuovoSocio.importo_dividendo_totale}
              onChange={(e) => {
                const valore = e.target.value;
                const percentuale = Number(nuovoSocio.percentuale_partecipazione || 0);
                const lordo = (Number(valore || 0) * percentuale) / 100;

                setNuovoSocio({
                  ...nuovoSocio,
                  importo_dividendo_totale: valore,
                  importo_utile: lordo.toFixed(2),
                });
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>% partecipazione</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={nuovoSocio.percentuale_partecipazione}
              onChange={(e) => {
                const percentuale = e.target.value;
                const dividendoTotale = Number(nuovoSocio.importo_dividendo_totale || 0);
                const lordo = (dividendoTotale * Number(percentuale || 0)) / 100;

                setNuovoSocio({
                  ...nuovoSocio,
                  percentuale_partecipazione: percentuale,
                  importo_utile: lordo.toFixed(2),
                });
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>Importo lordo</label>
            <input style={{ ...inputStyle, background: "#f3f4f6" }} value={Number(nuovoSocio.importo_utile || 0).toFixed(2)} disabled />
          </div>

          <div>
            <label style={labelStyle}>Ritenuta</label>
            <input style={{ ...inputStyle, background: "#f3f4f6" }} value={importoRitenutaNuovoSocio.toFixed(2)} disabled />
          </div>

          <div>
            <label style={labelStyle}>Netto</label>
            <input style={{ ...inputStyle, background: "#f3f4f6" }} value={importoNettoNuovoSocio.toFixed(2)} disabled />
          </div>

          <button
            type="button"
            onClick={async () => {
              if (!nuovoSocio.nome_cognome) {
                alert("Seleziona un socio.");
                return;
              }

              const res = await fetch(`/api/pratiche/${praticaId}/soci`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  ...nuovoSocio,
                  importo_ritenuta: importoRitenutaNuovoSocio,
                  importo_netto: importoNettoNuovoSocio,
                }),
              });

              if (!res.ok) {
                alert("Errore inserimento socio");
                return;
              }

              setNuovoSocio({
                nominativo_id: "",
                nome_cognome: "",
                codice_fiscale: "",
                indirizzo: "",
                cap: "",
                citta: "",
                provincia: "",
                importo_dividendo_totale: nuovoSocio.importo_dividendo_totale,
                percentuale_partecipazione: "",
                importo_utile: "",
                percentuale_ritenuta: "26",
                importo_ritenuta: "",
                importo_netto: "",
                tipo_pagamento: "",
              });

              await caricaSoci();
            }}
            style={blueButton}
          >
            Aggiungi
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 14, fontWeight: 700 }}>
          Totale quote inserite: {percentualeSociPresentiCalcolata.toFixed(2)}%
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
          <thead>
            <tr>
              <th style={thStyle}>Socio</th>
              <th style={thStyle}>CF</th>
              <th style={thStyle}>%</th>
              <th style={thStyle}>Lordo</th>
              <th style={thStyle}>Ritenuta</th>
              <th style={thStyle}>Netto</th>
              <th style={thStyle}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {soci.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>{s.nome_cognome}</td>
                <td style={tdStyle}>{s.codice_fiscale}</td>
                <td style={tdStyle}>{Number(s.percentuale_partecipazione || 0).toFixed(2)}%</td>
                <td style={tdStyle}>{Number(s.importo_utile || 0).toFixed(2)}</td>
                <td style={tdStyle}>{Number(s.importo_ritenuta || 0).toFixed(2)}</td>
                <td style={tdStyle}>{Number(s.importo_netto || 0).toFixed(2)}</td>
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
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 24,
  marginTop: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
  color: "#0f172a",
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
  verticalAlign: "top",
};
