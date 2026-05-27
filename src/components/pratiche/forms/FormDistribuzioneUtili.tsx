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

  const [clienti, setClienti] = useState<any[]>([]);
  const [soci, setSoci] = useState<any[]>([]);
  const [nominativi, setNominativi] = useState<any[]>([]);
  const [modelli, setModelli] = useState<any[]>([]);
  const [documenti, setDocumenti] = useState<any[]>([]);

  const [mostraNuovoNominativo, setMostraNuovoNominativo] = useState(false);

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
      pratica.dati_documento?.societa_rea || pratica.cliente?.numero_rea || "",
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
    percentuale_soci_presenti:
      String(pratica.dati_documento?.percentuale_soci_presenti || "100"),
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

  const [nuovoNominativo, setNuovoNominativo] = useState({
    nome_cognome: "",
    codice_fiscale: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
  });

  useEffect(() => {
    if (praticaId) {
      caricaClienti();
      caricaSoci();
      caricaNominativi();
      caricaModelli();
      caricaDocumenti();
    }
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  function normalizzaCF(cf: string) {
    return String(cf || "").trim().toUpperCase();
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
    if (res.ok) setSoci(data.soci || []);
  }

  async function caricaNominativi() {
    const res = await fetch("/api/pratiche/nominativi", {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setNominativi(data.nominativi || []);
  }

  async function caricaModelli() {
    const res = await fetch(`/api/pratiche/${praticaId}/modelli`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setModelli(data.modelli || []);
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

  async function aggiungiNominativo() {
    const cf = normalizzaCF(nuovoNominativo.codice_fiscale);

    if (!nuovoNominativo.nome_cognome.trim()) {
      alert("Nome e cognome obbligatori.");
      return;
    }

    if (!cf) {
      alert("Codice fiscale obbligatorio.");
      return;
    }

    const esistente = nominativi.find(
      (n) => normalizzaCF(n.codice_fiscale) === cf
    );

    if (esistente) {
      setNuovoSocio({
        ...nuovoSocio,
        nominativo_id: esistente.id,
        nome_cognome: esistente.nome_cognome || "",
        codice_fiscale: esistente.codice_fiscale || "",
        indirizzo: esistente.indirizzo || "",
        cap: esistente.cap || "",
        citta: esistente.citta || "",
        provincia: esistente.provincia || "",
      });

      alert("Nominativo già esistente: selezionato automaticamente.");
      setMostraNuovoNominativo(false);
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

    setNuovoNominativo({
      nome_cognome: "",
      codice_fiscale: "",
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
    });

    setMostraNuovoNominativo(false);
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
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
      <h1 style={{ fontSize: 38, fontWeight: 800, margin: 0, color: "#0f172a" }}>
        {pratica.numero_pratica}
      </h1>

      <p style={{ fontSize: 18, marginTop: 6, color: "#475569" }}>
        {pratica.titolo}
      </p>

      <form onSubmit={salvaDatiDocumento}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati società</h2>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 18 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 14 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12, marginTop: 18 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 14 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr auto 1fr 1fr 1fr 1fr 1fr auto", gap: 12, marginTop: 18, alignItems: "end" }}>
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

          <button
            type="button"
            style={secondaryButton}
            onClick={() => setMostraNuovoNominativo(!mostraNuovoNominativo)}
          >
            + Nuovo
          </button>

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
                const dividendo = Number(nuovoSocio.importo_dividendo_totale || 0);
                const lordo = (dividendo * Number(percentuale || 0)) / 100;

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

        {mostraNuovoNominativo && (
          <div style={{ ...cardStyle, marginTop: 18, background: "#f8fafc" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              Aggiungi nuovo nominativo
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
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
                <label style={labelStyle}>Codice fiscale *</label>
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
                      provincia: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Codice fiscale obbligatorio. Se già esiste, viene selezionato senza duplicarlo.
              </div>

              <button type="button" style={blueButton} onClick={aggiungiNominativo}>
                Aggiungi nominativo
              </button>
            </div>
          </div>
        )}

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
                <td style={tdStyle}>
                  {Number(s.percentuale_partecipazione || 0).toFixed(2)}%
                </td>
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

      <div style={cardStyle}>
        <h2 style={titleStyle}>Documenti</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 12, marginTop: 18, alignItems: "end" }}>
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
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleString("it-IT")
                      : "—"}
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
