"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Download, Trash2 } from "lucide-react";

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
};

export default function FormDeterminaLiquidazione({ pratica }: any) {
  const router = useRouter();
  const praticaId = router.query.id as string;

  const [motivi, setMotivi] = useState<any[]>([]);
  const [documenti, setDocumenti] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");

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
    societa_sede: pratica.dati_documento?.societa_sede || sede || "",
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
    rappresentante_legale_nome:
      pratica.dati_documento?.rappresentante_legale_nome ||
      pratica.rappresentante_legale?.nome_cognome ||
      "",
    rappresentante_legale_codice_fiscale:
      pratica.dati_documento?.rappresentante_legale_codice_fiscale ||
      pratica.rappresentante_legale?.codice_fiscale ||
      "",
    motivo_liquidazione: pratica.dati_documento?.motivo_liquidazione || "",
    motivo_liquidazione_testo:
      pratica.dati_documento?.motivo_liquidazione_testo || "",
    data_convocazione: pratica.dati_documento?.data_convocazione || "",
    ora_convocazione: pratica.dati_documento?.ora_convocazione || "",
    luogo_convocazione:
      pratica.dati_documento?.luogo_convocazione || sede || "",
  });

  useEffect(() => {
    if (praticaId) {
      caricaMotivi();
      caricaDocumenti();
    }
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function caricaMotivi() {
    const res = await fetch(`/api/pratiche/${praticaId}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setMotivi(data.motivi_liquidazione || []);
  }

  async function caricaDocumenti() {
    const res = await fetch(`/api/pratiche/${praticaId}/documenti`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setDocumenti(data.documenti || []);
  }

  async function salvaDatiDocumento(e?: React.FormEvent) {
    if (e) e.preventDefault();

    setSaving(true);
    setMessaggio("");

    try {
      const res = await fetch(`/api/pratiche/${praticaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore salvataggio dati");
      }

      setMessaggio("Dati determina salvati correttamente.");
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codice_modello: "DETERMINA_AU_CDA" }),
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
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
      <h1 style={{ fontSize: 38, fontWeight: 800, margin: 0 }}>
        {pratica.numero_pratica}
      </h1>

      <p style={{ fontSize: 18, marginTop: 6, color: "#475569" }}>
        Determina amministratore unico - liquidazione
      </p>

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
          <h2 style={titleStyle}>Dati determina</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12, marginTop: 18 }}>
            <div>
              <label style={labelStyle}>Data determina</label>
              <input type="date" style={inputStyle} value={form.data_atto} onChange={(e) => aggiornaCampo("data_atto", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Ora determina</label>
              <input type="time" style={inputStyle} value={form.ora_inizio} onChange={(e) => aggiornaCampo("ora_inizio", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Luogo determina</label>
              <input style={inputStyle} value={form.luogo_assemblea} onChange={(e) => aggiornaCampo("luogo_assemblea", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Amministratore unico</label>
              <input style={inputStyle} value={form.rappresentante_legale_nome} onChange={(e) => aggiornaCampo("rappresentante_legale_nome", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>CF amministratore unico</label>
              <input style={inputStyle} value={form.rappresentante_legale_codice_fiscale} onChange={(e) => aggiornaCampo("rappresentante_legale_codice_fiscale", e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Causa di scioglimento</label>
            <select
              style={inputStyle}
              value={form.motivo_liquidazione}
              onChange={(e) => {
                const selected = motivi.find((m) => m.codice === e.target.value);

                setForm((prev) => ({
                  ...prev,
                  motivo_liquidazione: selected?.codice || "",
                  motivo_liquidazione_testo: selected?.testo_verbale || "",
                }));
              }}
            >
              <option value="">Seleziona causa</option>

              {motivi.map((m) => (
                <option key={m.id} value={m.codice}>
                  {m.titolo}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Testo causa nel verbale</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90 }}
              value={form.motivo_liquidazione_testo}
              onChange={(e) => aggiornaCampo("motivo_liquidazione_testo", e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Data convocazione assemblea</label>
              <input type="date" style={inputStyle} value={form.data_convocazione} onChange={(e) => aggiornaCampo("data_convocazione", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Ora convocazione</label>
              <input type="time" style={inputStyle} value={form.ora_convocazione} onChange={(e) => aggiornaCampo("ora_convocazione", e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Luogo convocazione</label>
              <input style={inputStyle} value={form.luogo_convocazione} onChange={(e) => aggiornaCampo("luogo_convocazione", e.target.value)} />
            </div>
          </div>

      <div
  style={{
    marginTop: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  }}
>
  <div style={{ fontSize: 14, color: messaggio.includes("Errore") ? "#dc2626" : "#64748b" }}>
    {messaggio}
  </div>

  <div style={{ display: "flex", gap: 12 }}>
    <button type="submit" disabled={saving} style={blueButton}>
      {saving ? "Salvataggio..." : "Salva dati determina"}
    </button>

    <button
      type="button"
      onClick={async () => {
        const res = await fetch(
          `/api/pratiche/${pratica.id}/crea-pratica-liquidazione`,
          { method: "POST" }
        );

        const json = await res.json();

        if (!res.ok) {
          alert(json.error || "Errore");
          return;
        }

        window.location.href = `/pratiche/${json.pratica.id}`;
      }}
      style={{
        ...blueButton,
        background: "#16a34a",
      }}
    >
      Crea pratica verbale messa in liquidazione
    </button>
  </div>
</div>
        </div>
      </form>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Documenti</h2>

        <div style={{ display: "grid", gridTemplateColumns: "2fr auto", gap: 12, marginTop: 18, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Modello documento</label>
            <input style={{ ...inputStyle, background: "#f3f4f6" }} value="Determina AU / CDA" disabled />
          </div>

          <button type="button" style={blueButton} onClick={generaDocumento}>
            Genera documento
          </button>
        </div>

        {documenti.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
            <thead>
              <tr>
                <th style={thStyle}>Documento</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {documenti.map((doc) => (
                <tr key={doc.id}>
                  <td style={tdStyle}>{doc.nome_file}</td>
                  <td style={tdStyle}>{doc.tipo_documento}</td>
                  <td style={tdStyle}>
                    {doc.created_at ? new Date(doc.created_at).toLocaleString("it-IT") : "—"}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <a
                        href={`/api/pratiche/${praticaId}/documenti/${doc.id}/download`}
                        download
                        title="Scarica documento"
                        style={{ color: "#2563eb", display: "flex", alignItems: "center" }}
                      >
                        <Download size={18} />
                      </a>

                      <button
                        type="button"
                        title="Elimina documento"
                        onClick={async () => {
                          if (!confirm("Eliminare questo documento?")) return;

                          const res = await fetch(`/api/pratiche/${praticaId}/documenti/${doc.id}`, {
                            method: "DELETE",
                          });

                          if (!res.ok) {
                            alert("Errore eliminazione documento");
                            return;
                          }

                          await caricaDocumenti();
                        }}
                        style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", padding: 0 }}
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
};
