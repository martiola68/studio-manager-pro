"use client";

import React, { useEffect, useMemo, useState } from "react";
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

const redTextButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#dc2626",
  cursor: "pointer",
  fontWeight: 600,
  padding: 0,
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
  borderBottom: "1px solid #f1f5f9",
};

const tipiCarica = [
  "Amministratore unico",
  "Amministratore delegato",
  "Presidente CDA",
  "Consigliere",
  "Liquidatore",
];

const tipiDurata = [
  "Revoca",
  "Anni",
  "Da data a data",
  "Fino a data",
  "Fino ad approvazione del bilancio",
];

type Amministratore = {
  id: string;
  nominativo_id: string;
  nome_cognome: string;
  codice_fiscale: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  carica: string;
  durata_tipo?: string;
  durata_anni?: string;
  data_da?: string;
  data_a?: string;
  fino_data?: string;
  bilancio_esercizio?: string;
  note?: string;
};

function normalizzaCF(cf: string) {
  return String(cf || "").trim().toUpperCase();
}

function nuovoAmministratoreVuoto(): Amministratore {
  return {
    id: "",
    nominativo_id: "",
    nome_cognome: "",
    codice_fiscale: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
    carica: "",
    durata_tipo: "Fino ad approvazione del bilancio",
    durata_anni: "",
    data_da: "",
    data_a: "",
    fino_data: "",
    bilancio_esercizio: "",
    note: "",
  };
}

export default function FormCambioAmministratore({ pratica }: any) {
  const router = useRouter();
  const praticaId = router.query.id as string;

  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const [clienti, setClienti] = useState<any[]>([]);

  const [organiSocieta, setOrganiSocieta] = useState<any[]>([]);
  
  const [modelli, setModelli] = useState<any[]>([]);
  const [documenti, setDocumenti] = useState<any[]>([]);

  const [vecchiAmministratori, setVecchiAmministratori] = useState<
    Amministratore[]
  >([]);
  const [nuoviAmministratori, setNuoviAmministratori] = useState<
    Amministratore[]
  >([]);

  const [nuovoVecchio, setNuovoVecchio] =
    useState<Amministratore>(nuovoAmministratoreVuoto());
  const [nuovoNuovo, setNuovoNuovo] =
    useState<Amministratore>(nuovoAmministratoreVuoto());

  const sede = [
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
    societa_sede: pratica?.dati_documento?.societa_sede || sede || "",
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
      pratica?.dati_documento?.luogo_assemblea || sede || "",
    oggetto_assemblea:
      pratica?.dati_documento?.oggetto_assemblea ||
      "Revoca e nomina amministratore",
    presidente:
      pratica?.dati_documento?.presidente ||
      pratica?.dati_documento?.rappresentante_legale_nome ||
      "",
    segretario: pratica?.dati_documento?.segretario || "",
    vecchi_amministratori:
      pratica?.dati_documento?.vecchi_amministratori || [],
    nuovi_amministratori:
      pratica?.dati_documento?.nuovi_amministratori || [],
  });

  const modelloCambioAmministratore = useMemo(() => {
    return (
      modelli.find((m) =>
        String(`${m.nome || ""} ${m.codice || ""}`)
          .toLowerCase()
          .includes("cambio")
      ) ||
      modelli.find((m) =>
        String(`${m.nome || ""} ${m.codice || ""}`)
          .toLowerCase()
          .includes("amministratore")
      ) ||
      modelli[0]
    );
  }, [modelli]);

  useEffect(() => {
    if (praticaId) {
      caricaClienti();
     caricaOrganiSocieta();
      caricaModelli();
      caricaDocumenti();

      setVecchiAmministratori(
        Array.isArray(pratica?.dati_documento?.vecchi_amministratori)
          ? pratica.dati_documento.vecchi_amministratori
          : []
      );

      setNuoviAmministratori(
        Array.isArray(pratica?.dati_documento?.nuovi_amministratori)
          ? pratica.dati_documento.nuovi_amministratori
          : []
      );
    }
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: any) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  function applicaNominativo(
    amministratore: Amministratore,
    nominativoId: string
  ) {
    const selected = organiSocieta.find(
  (o) => o.rapp_legale_id === nominativoId
);

    return {
      ...amministratore,
     nominativo_id: selected?.rapp_legale_id || "",
nome_cognome: selected?.rapp_legali?.nome_cognome || "",
codice_fiscale: selected?.rapp_legali?.codice_fiscale || "",
indirizzo: selected?.rapp_legali?.indirizzo || "",
cap: selected?.rapp_legali?.cap || "",
citta: selected?.rapp_legali?.citta || "",
provincia: selected?.rapp_legali?.provincia || "",
    };
  }

  async function caricaClienti() {
    const res = await fetch("/api/clienti/import-nominativi", {
      cache: "no-store",
    });
    const data = await res.json();
    setClienti(Array.isArray(data) ? data : data.clienti || []);
  }

  async function caricaOrganiSocieta() {
  if (!pratica?.cliente_id) return;

  const res = await fetch(
    `/api/clienti-organi?cliente_id=${pratica.cliente_id}`,
    {
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok) return;

  setOrganiSocieta(
    (data.organi || []).filter(
      (o: any) =>
        o.attivo &&
        [
          "amministratore",
          "amministratore_delegato",
          "presidente_cda",
          "liquidatore",
        ].includes(
          String(o.ruolo || "").toLowerCase()
        )
    )
  );
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
      const payload = {
        ...form,
        vecchi_amministratori: vecchiAmministratori,
        nuovi_amministratori: nuoviAmministratori,
      };

      const res = await fetch(`/api/pratiche/${praticaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore salvataggio dati verbale");
      }

      setMessaggio("Dati cambio amministratore salvati correttamente.");
      return true;
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
      return false;
    } finally {
      setSaving(false);
    }
  }

     const esistente = nominativi.find(
      (n) => normalizzaCF(n.codice_fiscale) === cf
    );

    if (esistente) {
      setNuovoNuovo(applicaNominativo(nuovoNuovo, esistente.id));
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

    setNuovoNuovo({
      ...nuovoNuovo,
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

  function aggiungiVecchioAmministratore() {
    if (!nuovoVecchio.nome_cognome) {
      alert("Seleziona o inserisci il vecchio amministratore.");
      return;
    }

    if (!nuovoVecchio.carica) {
      alert("Inserisci la carica del vecchio amministratore.");
      return;
    }

    setVecchiAmministratori((prev) => [
      ...prev,
      { ...nuovoVecchio, id: crypto.randomUUID() },
    ]);

    setNuovoVecchio(nuovoAmministratoreVuoto());
  }

  function aggiungiNuovoAmministratore() {
    if (!nuovoNuovo.nome_cognome) {
      alert("Seleziona o inserisci il nuovo amministratore.");
      return;
    }

    if (!nuovoNuovo.carica) {
      alert("Seleziona il tipo di carica.");
      return;
    }

    if (!nuovoNuovo.durata_tipo) {
      alert("Seleziona la durata della carica.");
      return;
    }

    setNuoviAmministratori((prev) => [
      ...prev,
      { ...nuovoNuovo, id: crypto.randomUUID() },
    ]);

    setNuovoNuovo(nuovoAmministratoreVuoto());
  }

  async function generaDocumento() {
    if (!modelloCambioAmministratore?.codice) {
      alert("Modello cambio amministratore non trovato.");
      return;
    }

    if (vecchiAmministratori.length === 0) {
      alert("Inserisci almeno un vecchio amministratore.");
      return;
    }

    if (nuoviAmministratori.length === 0) {
      alert("Inserisci almeno un nuovo amministratore.");
      return;
    }

    const salvato = await salvaDatiDocumento();
    if (!salvato) return;

    const res = await fetch(`/api/pratiche/${praticaId}/genera-documento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codice_modello: modelloCambioAmministratore.codice,
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
          onClick={() => router.push("/pratiche")}
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

      <h1 style={{ fontSize: 38, fontWeight: 800, margin: 0, color: "#0f172a" }}>
        {pratica?.numero_pratica}
      </h1>

      <p style={{ fontSize: 18, marginTop: 6, color: "#475569" }}>
        Cambio amministratore
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
          <h2 style={titleStyle}>Dati verbale</h2>

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
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
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
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Vecchio/i amministratore/i</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr auto 1.4fr auto",
              gap: 12,
              marginTop: 18,
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>Amministratore uscente</label>
              <select
                style={inputStyle}
                value={nuovoVecchio.nominativo_id}
                onChange={(e) =>
                  setNuovoVecchio(applicaNominativo(nuovoVecchio, e.target.value))
                }
              >
                <option value="">Seleziona nominativo</option>
                {organiSocieta.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nome_cognome}
                  </option>
                ))}
              </select>
            </div>

             <div>
              <label style={labelStyle}>Carica attuale</label>
              <select
                style={inputStyle}
                value={nuovoVecchio.carica}
                onChange={(e) =>
                  setNuovoVecchio({ ...nuovoVecchio, carica: e.target.value })
                }
              >
                <option value="">Seleziona carica</option>
                {tipiCarica.map((carica) => (
                  <option key={carica} value={carica}>
                    {carica}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              style={blueButton}
              onClick={aggiungiVecchioAmministratore}
            >
              Aggiungi uscente
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
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>CF</th>
                <th style={thStyle}>Carica</th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {vecchiAmministratori.map((a) => (
                <tr key={a.id}>
                  <td style={tdStyle}>{a.nome_cognome}</td>
                  <td style={tdStyle}>{a.codice_fiscale}</td>
                  <td style={tdStyle}>{a.carica}</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      style={redTextButton}
                      onClick={() =>
                        setVecchiAmministratori((prev) =>
                          prev.filter((x) => x.id !== a.id)
                        )
                      }
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
          <h2 style={titleStyle}>Nuovo/i amministratore/i</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr auto 1.3fr 1.5fr auto",
              gap: 12,
              marginTop: 18,
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>Nuovo amministratore</label>
              <select
                style={inputStyle}
                value={nuovoNuovo.nominativo_id}
                onChange={(e) =>
                  setNuovoNuovo(applicaNominativo(nuovoNuovo, e.target.value))
                }
              >
                <option value="">Seleziona nominativo</option>
                {organiSocieta.map((n) => (
                 <option
  key={n.rapp_legale_id}
  value={n.rapp_legale_id}
>
  {n.rapp_legali?.nome_cognome}
</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Tipo carica</label>
              <select
                style={inputStyle}
                value={nuovoNuovo.carica}
                onChange={(e) =>
                  setNuovoNuovo({ ...nuovoNuovo, carica: e.target.value })
                }
              >
                <option value="">Seleziona carica</option>
                {tipiCarica.map((carica) => (
                  <option key={carica} value={carica}>
                    {carica}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Durata</label>
              <select
                style={inputStyle}
                value={nuovoNuovo.durata_tipo}
                onChange={(e) =>
                  setNuovoNuovo({
                    ...nuovoNuovo,
                    durata_tipo: e.target.value,
                  })
                }
              >
                {tipiDurata.map((durata) => (
                  <option key={durata} value={durata}>
                    {durata}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              style={blueButton}
              onClick={aggiungiNuovoAmministratore}
            >
              Aggiungi nuovo
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 12,
              marginTop: 14,
            }}
          >
            {nuovoNuovo.durata_tipo === "Anni" && (
              <div>
                <label style={labelStyle}>Numero anni</label>
                <input
                  type="number"
                  min="1"
                  style={inputStyle}
                  value={nuovoNuovo.durata_anni}
                  onChange={(e) =>
                    setNuovoNuovo({
                      ...nuovoNuovo,
                      durata_anni: e.target.value,
                    })
                  }
                />
              </div>
            )}

            {nuovoNuovo.durata_tipo === "Da data a data" && (
              <>
                <div>
                  <label style={labelStyle}>Da data</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={nuovoNuovo.data_da}
                    onChange={(e) =>
                      setNuovoNuovo({
                        ...nuovoNuovo,
                        data_da: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>A data</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={nuovoNuovo.data_a}
                    onChange={(e) =>
                      setNuovoNuovo({
                        ...nuovoNuovo,
                        data_a: e.target.value,
                      })
                    }
                  />
                </div>
              </>
            )}

            {nuovoNuovo.durata_tipo === "Fino a data" && (
              <div>
                <label style={labelStyle}>Fino al</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={nuovoNuovo.fino_data}
                  onChange={(e) =>
                    setNuovoNuovo({
                      ...nuovoNuovo,
                      fino_data: e.target.value,
                    })
                  }
                />
              </div>
            )}

            {nuovoNuovo.durata_tipo ===
              "Fino ad approvazione del bilancio" && (
              <div>
                <label style={labelStyle}>Bilancio esercizio</label>
                <input
                  style={inputStyle}
                  value={nuovoNuovo.bilancio_esercizio}
                  onChange={(e) =>
                    setNuovoNuovo({
                      ...nuovoNuovo,
                      bilancio_esercizio: e.target.value,
                    })
                  }
                  placeholder="es. 2026"
                />
              </div>
            )}

            <div>
              <label style={labelStyle}>Note durata/carica</label>
              <input
                style={inputStyle}
                value={nuovoNuovo.note}
                onChange={(e) =>
                  setNuovoNuovo({
                    ...nuovoNuovo,
                    note: e.target.value,
                  })
                }
              />
            </div>
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
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>CF</th>
                <th style={thStyle}>Carica</th>
                <th style={thStyle}>Durata</th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {nuoviAmministratori.map((a) => (
                <tr key={a.id}>
                  <td style={tdStyle}>{a.nome_cognome}</td>
                  <td style={tdStyle}>{a.codice_fiscale}</td>
                  <td style={tdStyle}>{a.carica}</td>
                  <td style={tdStyle}>
                    {a.durata_tipo}
                    {a.durata_anni ? ` - ${a.durata_anni} anni` : ""}
                    {a.data_da && a.data_a
                      ? ` - dal ${a.data_da} al ${a.data_a}`
                      : ""}
                    {a.fino_data ? ` - fino al ${a.fino_data}` : ""}
                    {a.bilancio_esercizio
                      ? ` - bilancio ${a.bilancio_esercizio}`
                      : ""}
                  </td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      style={redTextButton}
                      onClick={() =>
                        setNuoviAmministratori((prev) =>
                          prev.filter((x) => x.id !== a.id)
                        )
                      }
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
          <div
            style={{
              marginTop: 4,
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
        <h2 style={titleStyle}>Documenti</h2>

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
            <label style={labelStyle}>Modello documento</label>
            <input
              style={{ ...inputStyle, background: "#f3f4f6" }}
              value={modelloCambioAmministratore?.codice || "CAMBIO_AMMINISTRATORE"}
              disabled
            />
          </div>

          <button type="button" style={blueButton} onClick={generaDocumento}>
            Genera documento
          </button>
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
