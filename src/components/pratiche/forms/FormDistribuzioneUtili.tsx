"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Download, Trash2, Upload } from "lucide-react";

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

  function tornaElenco() {
    router.push("/pratiche");
  }

  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const [clienti, setClienti] = useState<any[]>([]);
  const [soci, setSoci] = useState<any[]>([]);
  const [organiSocieta, setOrganiSocieta] = useState<any[]>([]);
  const [modelli, setModelli] = useState<any[]>([]);
  const [documenti, setDocumenti] = useState<any[]>([]);

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
    luogo_assemblea: pratica.dati_documento?.luogo_assemblea || sede || "",
    oggetto_assemblea:
      pratica.dati_documento?.oggetto_assemblea ||
      "Approvazione bilancio e distribuzione utili",
    presidente:
      pratica.dati_documento?.presidente ||
      pratica.dati_documento?.rappresentante_legale_nome ||
      "",
    segretario: pratica.dati_documento?.segretario || "",
    ora_chiusura: pratica.dati_documento?.ora_chiusura || "",
    importo_dividendo_totale:
      pratica.dati_documento?.importo_dividendo_totale || "",
    percentuale_soci_presenti: String(
      pratica.dati_documento?.percentuale_soci_presenti || "100"
    ),
  });

  const [nuovoSocio, setNuovoSocio] = useState({
    nominativo_id: "",
    nome_cognome: "",
    codice_fiscale: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
    importo_dividendo_totale:
      pratica.dati_documento?.importo_dividendo_totale || "",
    percentuale_partecipazione: "",
    importo_utile: "",
    percentuale_ritenuta: "26",
    importo_ritenuta: "",
    importo_netto: "",
    tipo_pagamento: "",
  });

  useEffect(() => {
    if (praticaId) {
      caricaClienti();
      caricaSoci();
      caricaOrganiSocieta();
      caricaModelli();
      caricaDocumenti();
    }
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function caricaClienti() {
    const res = await fetch("/api/clienti/import-nominativi", {
      cache: "no-store",
    });

    const data = await res.json();
    setClienti(Array.isArray(data) ? data : data.clienti || []);
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

  async function caricaOrganiSocieta() {
    if (!pratica?.cliente_id) return;

    const res = await fetch(
      `/api/clienti-organi?cliente_id=${pratica.cliente_id}`,
      { cache: "no-store" }
    );

    const data = await res.json();

    if (!res.ok) return;

    setOrganiSocieta(
      (data.organi || []).filter(
        (o: any) =>
          o.attivo &&
          ["socio", "amministratore"].includes(
            String(o.ruolo || "").toLowerCase()
          )
      )
    );
  }

  async function caricaModelli() {
    const res = await fetch(`/api/pratiche/${praticaId}/modelli`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (res.ok) {
      setModelli(data.modelli || []);
    }
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
        throw new Error(data.error || "Errore salvataggio dati verbale");
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

  const totaleLordoSoci = soci.reduce(
    (totale, socio) => totale + Number(socio.importo_utile || 0),
    0
  );

  const percentualeSociPresentiCalcolata = soci.reduce(
    (totale, socio) => totale + Number(socio.percentuale_partecipazione || 0),
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

  const modelloDistribuzione =
    modelli.find((m) =>
      String(m.nome || m.codice || "").toLowerCase().includes("distribuzione")
    ) || modelli[0];

  async function generaDocumento() {
    if (!modelloDistribuzione?.codice) {
      alert("Modello Distribuzione utili non trovato.");
      return;
    }

    if (
      Number(form.importo_dividendo_totale || 0).toFixed(2) !==
      totaleLordoSoci.toFixed(2)
    ) {
      alert("Il dividendo totale deve corrispondere al totale lordo dei soci.");
      return;
    }

    if (Number(form.percentuale_soci_presenti || 0) > 100) {
      alert("La percentuale capitale presente non può superare il 100%.");
      return;
    }

    if (percentualeSociPresentiCalcolata > 100) {
      alert("Le percentuali dei soci non possono superare il 100%.");
      return;
    }

    const salvato = await salvaDatiDocumento();
    if (!salvato) return;

    const res = await fetch(`/api/pratiche/${praticaId}/genera-documento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codice_modello: modelloDistribuzione.codice,
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

      <h1
        style={{
          fontSize: 38,
          fontWeight: 800,
          margin: 0,
          color: "#0f172a",
        }}
      >
        {pratica.numero_pratica}
      </h1>

      <p style={{ fontSize: 18, marginTop: 6, color: "#475569" }}>
        {pratica.titolo}
      </p>

      <form onSubmit={salvaDatiDocumento}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati società</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 12,
              marginTop: 18,
            }}
          >
            <div>
              <label style={labelStyle}>Denominazione società</label>

              <select
                style={inputStyle}
                value={form.societa_denominazione}
                onChange={(e) => {
                  const selected = clienti.find(
                    (c) => c.ragione_sociale === e.target.value
                  );

                  const nuovaSede = [
                    selected?.indirizzo,
                    selected?.cap,
                    selected?.citta,
                    selected?.provincia,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  setForm((prev) => ({
                    ...prev,
                    societa_denominazione:
                      selected?.ragione_sociale || e.target.value,
                    societa_codice_fiscale: selected?.codice_fiscale || "",
                    societa_partita_iva:
                      selected?.partita_iva || selected?.codice_fiscale || "",
                    societa_sede: nuovaSede,
                    societa_rea: selected?.numero_rea || "",
                    luogo_assemblea: nuovaSede,
                  }));
                }}
              >
                <option value={form.societa_denominazione}>
                  {form.societa_denominazione || "Seleziona società"}
                </option>

                {clienti.map((c) => (
                  <option key={c.id} value={c.ragione_sociale}>
                    {c.ragione_sociale}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Codice fiscale</label>
              <input
                style={inputStyle}
                value={form.societa_codice_fiscale}
                onChange={(e) =>
                  aggiornaCampo("societa_codice_fiscale", e.target.value)
                }
              />
            </div>

            <div>
              <label style={labelStyle}>Partita IVA</label>
              <input
                style={inputStyle}
                value={form.societa_partita_iva}
                onChange={(e) =>
                  aggiornaCampo("societa_partita_iva", e.target.value)
                }
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 12,
              marginTop: 14,
            }}
          >
            <div>
              <label style={labelStyle}>Sede società</label>
              <input
                style={inputStyle}
                value={form.societa_sede}
                onChange={(e) => aggiornaCampo("societa_sede", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>REA</label>
              <input
                style={inputStyle}
                value={form.societa_rea}
                onChange={(e) => aggiornaCampo("societa_rea", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati verbale distribuzione utili</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 2fr",
              gap: 12,
              marginTop: 18,
            }}
          >
            <div>
              <label style={labelStyle}>Data assemblea</label>
              <input
                type="date"
                style={inputStyle}
                value={form.data_atto}
                onChange={(e) => aggiornaCampo("data_atto", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Ora inizio</label>
              <input
                type="time"
                style={inputStyle}
                value={form.ora_inizio}
                onChange={(e) => aggiornaCampo("ora_inizio", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Luogo assemblea</label>
              <input
                style={inputStyle}
                value={form.luogo_assemblea}
                onChange={(e) =>
                  aggiornaCampo("luogo_assemblea", e.target.value)
                }
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 12,
              marginTop: 14,
            }}
          >
            <div>
              <label style={labelStyle}>Oggetto assemblea</label>
              <input
                style={inputStyle}
                value={form.oggetto_assemblea}
                onChange={(e) =>
                  aggiornaCampo("oggetto_assemblea", e.target.value)
                }
              />
            </div>

            <div>
              <label style={labelStyle}>% capitale presente</label>
              <input
                type="number"
                step="0.01"
                max="100"
                style={{
                  ...inputStyle,
                  borderColor:
                    Number(form.percentuale_soci_presenti || 0) > 100
                      ? "#dc2626"
                      : "#9ca3af",
                }}
                value={form.percentuale_soci_presenti}
                onChange={(e) =>
                  aggiornaCampo("percentuale_soci_presenti", e.target.value)
                }
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginTop: 14,
            }}
          >
            <div>
              <label style={labelStyle}>Presidente</label>
              <input
                style={inputStyle}
                value={form.presidente}
                onChange={(e) => aggiornaCampo("presidente", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Segretario</label>
              <input
                style={inputStyle}
                value={form.segretario}
                onChange={(e) => aggiornaCampo("segretario", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Ora chiusura</label>
              <input
                type="time"
                style={inputStyle}
                value={form.ora_chiusura}
                onChange={(e) => aggiornaCampo("ora_chiusura", e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: messaggio.includes("Errore") ? "#dc2626" : "#64748b",
              }}
            >
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr auto",
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
                  (o) => o.rapp_legale_id === e.target.value
                );

                const percentuale =
                  selected?.percentuale_partecipazione !== null &&
                  selected?.percentuale_partecipazione !== undefined
                    ? String(selected.percentuale_partecipazione)
                    : nuovoSocio.percentuale_partecipazione;

                const dividendo = Number(
                  nuovoSocio.importo_dividendo_totale || 0
                );

                const lordo =
                  (dividendo * Number(percentuale || 0)) / 100;

                setNuovoSocio({
                  ...nuovoSocio,
                  nominativo_id: selected?.rapp_legale_id || "",
                  nome_cognome: selected?.rapp_legali?.nome_cognome || "",
                  codice_fiscale: selected?.rapp_legali?.codice_fiscale || "",
                  indirizzo: selected?.rapp_legali?.indirizzo || "",
                  cap: selected?.rapp_legali?.cap || "",
                  citta: selected?.rapp_legali?.citta || "",
                  provincia: selected?.rapp_legali?.provincia || "",
                  percentuale_partecipazione: percentuale,
                  importo_utile: lordo.toFixed(2),
                });
              }}
            >
              <option value="">Seleziona socio</option>

              {organiSocieta.map((o) => (
                <option key={o.rapp_legale_id} value={o.rapp_legale_id}>
                  {o.rapp_legali?.nome_cognome} — {o.ruolo}
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
                const percentuale = Number(
                  nuovoSocio.percentuale_partecipazione || 0
                );

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
                const dividendo = Number(
                  nuovoSocio.importo_dividendo_totale || 0
                );

                const lordo =
                  (dividendo * Number(percentuale || 0)) / 100;

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
            <input
              style={{ ...inputStyle, background: "#f3f4f6" }}
              value={Number(nuovoSocio.importo_utile || 0).toFixed(2)}
              disabled
            />
          </div>

          <div>
            <label style={labelStyle}>Ritenuta</label>
            <input
              style={{ ...inputStyle, background: "#f3f4f6" }}
              value={importoRitenutaNuovoSocio.toFixed(2)}
              disabled
            />
          </div>

          <div>
            <label style={labelStyle}>Netto</label>
            <input
              style={{ ...inputStyle, background: "#f3f4f6" }}
              value={importoNettoNuovoSocio.toFixed(2)}
              disabled
            />
          </div>

          <button
            type="button"
            style={blueButton}
            onClick={async () => {
              const nuovaPercentuale = Number(
                nuovoSocio.percentuale_partecipazione || 0
              );

              if (!nuovoSocio.nome_cognome) {
                alert("Seleziona un socio.");
                return;
              }

              if (percentualeSociPresentiCalcolata + nuovaPercentuale > 100) {
                alert("Le percentuali non possono superare il 100%.");
                return;
              }

              const res = await fetch(`/api/pratiche/${praticaId}/soci`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
          >
            Aggiungi
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 14, fontWeight: 700 }}>
          Totale quote inserite:{" "}
          {percentualeSociPresentiCalcolata.toFixed(2)}%
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
                <td style={tdStyle}>
                  {Number(s.percentuale_partecipazione || 0).toFixed(2)}%
                </td>
                <td style={tdStyle}>
                  {Number(s.importo_utile || 0).toFixed(2)}
                </td>
                <td style={tdStyle}>
                  {Number(s.importo_ritenuta || 0).toFixed(2)}
                </td>
                <td style={tdStyle}>
                  {Number(s.importo_netto || 0).toFixed(2)}
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
        <h2 style={titleStyle}>Documenti</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr auto",
            gap: 12,
            marginTop: 18,
            alignItems: "end",
          }}
        >
          <div>
            <label style={labelStyle}>Dividendo totale deliberato</label>
            <input
              type="number"
              step="0.01"
              style={{
                ...inputStyle,
                borderColor:
                  Number(form.importo_dividendo_totale || 0).toFixed(2) !==
                  totaleLordoSoci.toFixed(2)
                    ? "#dc2626"
                    : "#9ca3af",
              }}
              value={form.importo_dividendo_totale}
              onChange={(e) => {
                aggiornaCampo("importo_dividendo_totale", e.target.value);

                setNuovoSocio((prev) => ({
                  ...prev,
                  importo_dividendo_totale: e.target.value,
                }));
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>Modello documento</label>
            <input
              style={{ ...inputStyle, background: "#f3f4f6" }}
              value="Distribuzione utili"
              disabled
            />
          </div>

          <button type="button" style={blueButton} onClick={generaDocumento}>
            Genera documento
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 13 }}>
          Totale lordo soci: <strong>{totaleLordoSoci.toFixed(2)}</strong>
        </div>

        {documenti.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 18,
            }}
          >
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
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleString("it-IT")
                      : "—"}
                  </td>
                  <td style={tdStyle}>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <a
                        href={`/api/pratiche/${praticaId}/documenti/${doc.id}/download`}
                        download
                        title="Scarica documento"
                        style={{
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Download size={18} />
                      </a>

                      <label
                        title="Carica documento modificato"
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
                        title="Elimina documento"
                        onClick={async () => {
                          if (!confirm("Eliminare questo documento?")) return;

                          const res = await fetch(
                            `/api/pratiche/${praticaId}/documenti/${doc.id}`,
                            { method: "DELETE" }
                          );

                          if (!res.ok) {
                            alert("Errore eliminazione documento");
                            return;
                          }

                          await caricaDocumenti();
                        }}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#dc2626",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          padding: 0,
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
  verticalAlign: "top",
};
