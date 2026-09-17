"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Download, Trash2, Upload } from "lucide-react";
import { generaDocumentoPratica } from "@/lib/pratiche/generaDocumentoPratica";

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
  padding: "10px 14px",
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
  padding: 14,
  fontSize: 14,
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

type TipoNomina =
  | "REVISORE_LEGALE"
  | "SOCIETA_REVISIONE"
  | "SINDACO_UNICO"
  | "COLLEGIO_SINDACALE";

type TipoDurata = "DATA_FINE" | "APPROVAZIONE_BILANCIO" | "ANNI";

type Nominato = {
  id: string;
  nominativo_id: string;
  nome: string;
  codice_fiscale: string;
  partita_iva: string;
  carica: string;
  data_inizio: string;
  durata_tipo: TipoDurata;
  data_fine: string;
  bilancio_chiuso_al: string;
  durata_anni: string;
  compenso_lordo: string;
};

const tipoNominaOptions: Array<{ value: TipoNomina; label: string }> = [
  { value: "REVISORE_LEGALE", label: "Revisore legale" },
  { value: "SOCIETA_REVISIONE", label: "Società di revisione" },
  { value: "SINDACO_UNICO", label: "Sindaco unico" },
  { value: "COLLEGIO_SINDACALE", label: "Collegio sindacale" },
];

function tipoDaPratica(pratica: any): TipoNomina {
  const testo = String(
    `${pratica?.titolo || ""} ${pratica?.tipo?.nome || ""} ${pratica?.codice_workflow || ""}`
  ).toLowerCase();

  if (testo.includes("società di revisione") || testo.includes("societa di revisione")) {
    return "SOCIETA_REVISIONE";
  }
  if (testo.includes("sindaco unico")) return "SINDACO_UNICO";
  if (testo.includes("collegio") || testo.includes("sindac")) return "COLLEGIO_SINDACALE";
  return "REVISORE_LEGALE";
}

function carichePerTipo(tipo: TipoNomina) {
  switch (tipo) {
    case "SOCIETA_REVISIONE":
      return ["Società di revisione"];
    case "SINDACO_UNICO":
      return ["Sindaco unico"];
    case "COLLEGIO_SINDACALE":
      return ["Presidente del collegio sindacale", "Sindaco effettivo", "Sindaco supplente"];
    default:
      return ["Revisore legale"];
  }
}

function nuovoNominato(tipo: TipoNomina): Nominato {
  return {
    id: "",
    nominativo_id: "",
    nome: "",
    codice_fiscale: "",
    partita_iva: "",
    carica: carichePerTipo(tipo)[0],
    data_inizio: "",
    durata_tipo: "APPROVAZIONE_BILANCIO",
    data_fine: "",
    bilancio_chiuso_al: "",
    durata_anni: "",
    compenso_lordo: "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function FormNominaOrganoControllo({ pratica }: any) {
  const router = useRouter();
  const praticaId = String(router.query.id || pratica?.id || "");

  const sedeSocieta = [
    pratica?.cliente?.indirizzo,
    pratica?.cliente?.cap,
    pratica?.cliente?.citta,
    pratica?.cliente?.provincia,
  ]
    .filter(Boolean)
    .join(" ");

  const tipoIniziale =
    (pratica?.dati_documento?.tipo_nomina_organo_controllo as TipoNomina) ||
    tipoDaPratica(pratica);

  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");
  const [documenti, setDocumenti] = useState<any[]>([]);
  const [soci, setSoci] = useState<any[]>([]);
  const [organiSocieta, setOrganiSocieta] = useState<any[]>([]);
  const [professionisti, setProfessionisti] = useState<any[]>([]);
  const [diciture, setDiciture] = useState<any[]>([]);
  const [nominativi, setNominativi] = useState<any[]>([]);

  const [tipoNomina, setTipoNomina] = useState<TipoNomina>(tipoIniziale);
  const [nominati, setNominati] = useState<Nominato[]>(
    Array.isArray(pratica?.dati_documento?.nominati_organo_controllo)
      ? pratica.dati_documento.nominati_organo_controllo
      : []
  );
  const [nominato, setNominato] = useState<Nominato>(nuovoNominato(tipoIniziale));

  const [nuovoSocio, setNuovoSocio] = useState({
    nominativo_id: "",
    nome_cognome: "",
    codice_fiscale: "",
    percentuale_partecipazione: "",
    presenza: "Presente",
  });

  const [form, setForm] = useState({
    societa_denominazione:
      pratica?.dati_documento?.societa_denominazione || pratica?.cliente?.ragione_sociale || "",
    societa_sede: pratica?.dati_documento?.societa_sede || sedeSocieta || "",
    societa_codice_fiscale:
      pratica?.dati_documento?.societa_codice_fiscale || pratica?.cliente?.codice_fiscale || "",
    societa_partita_iva:
      pratica?.dati_documento?.societa_partita_iva || pratica?.cliente?.partita_iva || "",
    societa_rea:
      pratica?.dati_documento?.societa_rea || pratica?.cliente?.numero_rea || "",
    data_atto: pratica?.dati_documento?.data_atto || "",
    ora_inizio: pratica?.dati_documento?.ora_inizio || "",
    ora_chiusura: pratica?.dati_documento?.ora_chiusura || "",
    luogo_assemblea: pratica?.dati_documento?.luogo_assemblea || sedeSocieta || "",
    presidente: pratica?.dati_documento?.presidente || "",
    segretario: pratica?.dati_documento?.segretario || "",
    professionista_nome: pratica?.dati_documento?.professionista_nome || "",
    dicitura_presentazione: pratica?.dati_documento?.dicitura_presentazione || "",
    verbale_definitivo: Boolean(pratica?.dati_documento?.verbale_definitivo),
  });

  const tipoLabel = useMemo(
    () => tipoNominaOptions.find((o) => o.value === tipoNomina)?.label || "Organo di controllo",
    [tipoNomina]
  );

  useEffect(() => {
    if (!praticaId) return;
    void Promise.all([
      caricaDocumenti(),
      caricaSoci(),
      caricaOrganiSocieta(),
      caricaProfessionisti(),
      caricaDiciture(),
      caricaNominativi(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: any) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function caricaDocumenti() {
    const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/documenti`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setDocumenti(data.documenti || []);
  }

  async function caricaSoci() {
    const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soci`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setSoci(data.soci || []);
  }

  async function caricaOrganiSocieta() {
    if (!pratica?.cliente_id) return;
    const res = await fetch(
      `/api/clienti-organi?cliente_id=${encodeURIComponent(String(pratica.cliente_id))}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) return;
    setOrganiSocieta(
      (data.organi || []).filter((o: any) => o.attivo !== false && o.tipo_ruolo === "S")
    );
  }

  async function caricaProfessionisti() {
    const res = await fetch("/api/pratiche/professionisti", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setProfessionisti(data.professionisti || []);
  }

  async function caricaDiciture() {
    const res = await fetch("/api/pratiche/diciture-documenti", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setDiciture(data.diciture || []);
  }

  async function caricaNominativi() {
    const res = await fetch("/api/clienti/import-nominativi", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setNominativi(Array.isArray(data) ? data : data.clienti || []);
  }

  function cambiaTipoNomina(tipo: TipoNomina) {
    setTipoNomina(tipo);
    setNominato(nuovoNominato(tipo));
  }

  function applicaNominativo(id: string) {
    const selected = nominativi.find((n: any) => String(n.id) === String(id));
    setNominato((prev) => ({
      ...prev,
      nominativo_id: id,
      nome: selected?.ragione_sociale || selected?.nome_cognome || "",
      codice_fiscale: selected?.codice_fiscale || "",
      partita_iva: selected?.partita_iva || "",
    }));
  }

  function aggiungiNominato() {
    if (!nominato.nome.trim()) {
      alert(tipoNomina === "SOCIETA_REVISIONE" ? "Inserisci la società di revisione." : "Inserisci il nominativo.");
      return;
    }
    if (!nominato.carica) {
      alert("Seleziona la carica.");
      return;
    }
    if (!nominato.data_inizio) {
      alert("Inserisci la data di inizio incarico.");
      return;
    }
    if (nominato.durata_tipo === "DATA_FINE" && !nominato.data_fine) {
      alert("Inserisci la data di fine incarico.");
      return;
    }
    if (nominato.durata_tipo === "APPROVAZIONE_BILANCIO" && !nominato.bilancio_chiuso_al) {
      alert("Inserisci la data di chiusura del bilancio di riferimento.");
      return;
    }
    if (nominato.durata_tipo === "ANNI" && !Number(nominato.durata_anni || 0)) {
      alert("Inserisci la durata in anni.");
      return;
    }

    setNominati((prev) => [...prev, { ...nominato, id: crypto.randomUUID() }]);
    setNominato(nuovoNominato(tipoNomina));
  }

  async function salvaDatiDocumento(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (nominati.length === 0) {
      alert("Inserisci almeno un nominato prima di salvare il verbale.");
      return false;
    }

    setSaving(true);
    setMessaggio("");
    try {
      const payload = {
        ...form,
        tipo_nomina_organo_controllo: tipoNomina,
        tipo_nomina_organo_controllo_label: tipoLabel,
        nominati_organo_controllo: nominati,
      };

      const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore salvataggio dati verbale");
      setMessaggio("Dati verbale di nomina salvati correttamente.");
      return true;
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function generaVerbale() {
    const salvato = await salvaDatiDocumento();
    if (!salvato) return;
    try {
      await generaDocumentoPratica({
        praticaId,
        codiceModello: "VERBALE_NOMINA_ORGANO_CONTROLLO",
        onSuccess: caricaDocumenti,
      });
      alert("Verbale di nomina generato.");
    } catch (error: any) {
      alert(
        error.message ||
          "Modello VERBALE_NOMINA_ORGANO_CONTROLLO non ancora configurato. Verrà completato con il verbale di esempio."
      );
    }
  }

  async function generaAccettazione() {
    const salvato = await salvaDatiDocumento();
    if (!salvato) return;
    try {
      await generaDocumentoPratica({
        praticaId,
        codiceModello: "ACCETTAZIONE_CARICHE",
        onSuccess: caricaDocumenti,
      });
      alert("Accettazione carica/cariche generata.");
    } catch (error: any) {
      alert(error.message || "Errore generazione accettazione carica/cariche");
    }
  }

  const capitalePresente = soci.reduce(
    (totale: number, socio: any) => totale + Number(socio.percentuale_partecipazione || 0),
    0
  );

  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={() => router.push("/pratiche/variazioni")} style={secondaryButton}>
          ← Torna a elenco pratiche
        </button>
      </div>

      <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>{pratica?.numero_pratica}</h1>
      <p style={{ marginTop: 6, fontSize: 18, color: "#64748b" }}>
        Verbale di nomina - {tipoLabel}
      </p>

      <form onSubmit={salvaDatiDocumento}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati società</h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 18 }}>
            <Field label="Denominazione"><input style={inputStyle} value={form.societa_denominazione} onChange={(e) => aggiornaCampo("societa_denominazione", e.target.value)} /></Field>
            <Field label="Codice fiscale"><input style={inputStyle} value={form.societa_codice_fiscale} onChange={(e) => aggiornaCampo("societa_codice_fiscale", e.target.value)} /></Field>
            <Field label="Partita IVA"><input style={inputStyle} value={form.societa_partita_iva} onChange={(e) => aggiornaCampo("societa_partita_iva", e.target.value)} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 14 }}>
            <Field label="Sede"><input style={inputStyle} value={form.societa_sede} onChange={(e) => aggiornaCampo("societa_sede", e.target.value)} /></Field>
            <Field label="REA"><input style={inputStyle} value={form.societa_rea} onChange={(e) => aggiornaCampo("societa_rea", e.target.value)} /></Field>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati assemblea</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 12, marginTop: 18 }}>
            <Field label="Data assemblea"><input type="date" style={inputStyle} value={form.data_atto} onChange={(e) => aggiornaCampo("data_atto", e.target.value)} /></Field>
            <Field label="Ora inizio"><input type="time" style={inputStyle} value={form.ora_inizio} onChange={(e) => aggiornaCampo("ora_inizio", e.target.value)} /></Field>
            <Field label="Ora chiusura"><input type="time" style={inputStyle} value={form.ora_chiusura} onChange={(e) => aggiornaCampo("ora_chiusura", e.target.value)} /></Field>
            <Field label="Luogo assemblea"><input style={inputStyle} value={form.luogo_assemblea} onChange={(e) => aggiornaCampo("luogo_assemblea", e.target.value)} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
            <Field label="Presidente"><input style={inputStyle} value={form.presidente} onChange={(e) => aggiornaCampo("presidente", e.target.value)} /></Field>
            <Field label="Segretario"><input style={inputStyle} value={form.segretario} onChange={(e) => aggiornaCampo("segretario", e.target.value)} /></Field>
            <Field label="Percentuale capitale presente"><input style={{ ...inputStyle, background: "#f1f5f9", fontWeight: 700 }} value={capitalePresente.toFixed(2)} disabled /></Field>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Soci presenti</h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, marginTop: 18, alignItems: "end" }}>
            <Field label="Socio">
              <select
                style={inputStyle}
                value={nuovoSocio.nominativo_id}
                onChange={(e) => {
                  const selected = organiSocieta.find((o: any) => String(o.soggetto_cliente_id) === String(e.target.value));
                  setNuovoSocio({
                    nominativo_id: selected?.soggetto_cliente_id || "",
                    nome_cognome: selected?.soggetto_cliente?.ragione_sociale || "",
                    codice_fiscale: selected?.soggetto_cliente?.codice_fiscale || selected?.soggetto_cliente?.partita_iva || "",
                    percentuale_partecipazione: selected?.percentuale_partecipazione ? String(selected.percentuale_partecipazione) : "",
                    presenza: nuovoSocio.presenza || "Presente",
                  });
                }}
              >
                <option value="">Seleziona socio</option>
                {organiSocieta.map((o: any) => (
                  <option key={o.id} value={o.soggetto_cliente_id || ""}>{o.soggetto_cliente?.ragione_sociale || "-"}</option>
                ))}
              </select>
            </Field>
            <Field label="% partecipazione"><input type="number" step="0.01" style={inputStyle} value={nuovoSocio.percentuale_partecipazione} onChange={(e) => setNuovoSocio({ ...nuovoSocio, percentuale_partecipazione: e.target.value })} /></Field>
            <Field label="Presenza / delega"><input style={inputStyle} value={nuovoSocio.presenza} onChange={(e) => setNuovoSocio({ ...nuovoSocio, presenza: e.target.value })} /></Field>
            <button
              type="button"
              style={blueButton}
              onClick={async () => {
                if (!nuovoSocio.nome_cognome) return alert("Seleziona un socio.");
                if (capitalePresente + Number(nuovoSocio.percentuale_partecipazione || 0) > 100) return alert("La percentuale totale non può superare il 100%.");
                const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soci`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(nuovoSocio),
                });
                if (!res.ok) return alert("Errore inserimento socio");
                setNuovoSocio({ nominativo_id: "", nome_cognome: "", codice_fiscale: "", percentuale_partecipazione: "", presenza: "Presente" });
                await caricaSoci();
              }}
            >Aggiungi</button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
            <thead><tr><th style={thStyle}>Socio</th><th style={thStyle}>CF</th><th style={thStyle}>Quota</th><th style={thStyle}>Presenza / delega</th><th style={thStyle}>Azioni</th></tr></thead>
            <tbody>
              {soci.map((s: any) => (
                <tr key={s.id}>
                  <td style={tdStyle}>{s.nome_cognome}</td>
                  <td style={tdStyle}>{s.codice_fiscale}</td>
                  <td style={tdStyle}>{Number(s.percentuale_partecipazione || 0).toFixed(2)}%</td>
                  <td style={tdStyle}>{s.presenza || "Presente"}</td>
                  <td style={tdStyle}><button type="button" style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 600 }} onClick={async () => { if (!confirm("Eliminare il socio?")) return; await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soci/${encodeURIComponent(String(s.id))}`, { method: "DELETE" }); await caricaSoci(); }}>Elimina</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Nomina organo di controllo / revisione</h2>
          <div style={{ marginTop: 18, maxWidth: 520 }}>
            <Field label="Tipologia di nomina">
              <select style={inputStyle} value={tipoNomina} onChange={(e) => cambiaTipoNomina(e.target.value as TipoNomina)}>
                {tipoNominaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ ...cardStyle, marginTop: 18, background: "#f8fafc" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <Field label={tipoNomina === "SOCIETA_REVISIONE" ? "Seleziona società / nominativo esistente" : "Seleziona nominativo esistente"}>
                <select style={inputStyle} value={nominato.nominativo_id} onChange={(e) => applicaNominativo(e.target.value)}>
                  <option value="">Inserimento manuale</option>
                  {nominativi.map((n: any) => <option key={n.id} value={n.id}>{n.ragione_sociale || n.nome_cognome}</option>)}
                </select>
              </Field>
              <Field label="Carica">
                <select style={inputStyle} value={nominato.carica} onChange={(e) => setNominato({ ...nominato, carica: e.target.value })}>
                  {carichePerTipo(tipoNomina).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              <Field label={tipoNomina === "SOCIETA_REVISIONE" ? "Denominazione" : "Nome e cognome"}><input style={inputStyle} value={nominato.nome} onChange={(e) => setNominato({ ...nominato, nome: e.target.value })} /></Field>
              <Field label="Codice fiscale"><input style={inputStyle} value={nominato.codice_fiscale} onChange={(e) => setNominato({ ...nominato, codice_fiscale: e.target.value.toUpperCase() })} /></Field>
              <Field label="Partita IVA"><input style={inputStyle} value={nominato.partita_iva} onChange={(e) => setNominato({ ...nominato, partita_iva: e.target.value })} /></Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 12, marginTop: 14 }}>
              <Field label="Data inizio incarico"><input type="date" style={inputStyle} value={nominato.data_inizio} onChange={(e) => setNominato({ ...nominato, data_inizio: e.target.value })} /></Field>
              <Field label="Durata incarico">
                <select style={inputStyle} value={nominato.durata_tipo} onChange={(e) => setNominato({ ...nominato, durata_tipo: e.target.value as TipoDurata, data_fine: "", bilancio_chiuso_al: "", durata_anni: "" })}>
                  <option value="DATA_FINE">Fino a data</option>
                  <option value="APPROVAZIONE_BILANCIO">Fino all'approvazione del bilancio</option>
                  <option value="ANNI">Durata in anni</option>
                </select>
              </Field>
              {nominato.durata_tipo === "DATA_FINE" && <Field label="Data fine incarico"><input type="date" style={inputStyle} value={nominato.data_fine} onChange={(e) => setNominato({ ...nominato, data_fine: e.target.value })} /></Field>}
              {nominato.durata_tipo === "APPROVAZIONE_BILANCIO" && <Field label="Bilancio chiuso al"><input type="date" style={inputStyle} value={nominato.bilancio_chiuso_al} onChange={(e) => setNominato({ ...nominato, bilancio_chiuso_al: e.target.value })} /></Field>}
              {nominato.durata_tipo === "ANNI" && <Field label="Durata (anni)"><input type="number" min="1" step="1" style={inputStyle} value={nominato.durata_anni} onChange={(e) => setNominato({ ...nominato, durata_anni: e.target.value })} /></Field>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginTop: 14, alignItems: "end" }}>
              <Field label="Compenso lordo (€)"><input type="number" min="0" step="0.01" style={inputStyle} value={nominato.compenso_lordo} onChange={(e) => setNominato({ ...nominato, compenso_lordo: e.target.value })} /></Field>
              <button type="button" style={blueButton} onClick={aggiungiNominato}>Aggiungi nominato</button>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
            <thead><tr><th style={thStyle}>Nominato</th><th style={thStyle}>Carica</th><th style={thStyle}>Inizio</th><th style={thStyle}>Durata / fine</th><th style={thStyle}>Compenso lordo</th><th style={thStyle}>Azioni</th></tr></thead>
            <tbody>
              {nominati.length === 0 ? (
                <tr><td style={{ ...tdStyle, color: "#64748b" }} colSpan={6}>Nessun nominato inserito.</td></tr>
              ) : nominati.map((n) => (
                <tr key={n.id}>
                  <td style={tdStyle}><strong>{n.nome}</strong><div style={{ color: "#64748b", fontSize: 12 }}>{n.codice_fiscale || n.partita_iva || ""}</div></td>
                  <td style={tdStyle}>{n.carica}</td>
                  <td style={tdStyle}>{n.data_inizio ? new Date(`${n.data_inizio}T00:00:00`).toLocaleDateString("it-IT") : "—"}</td>
                  <td style={tdStyle}>{n.durata_tipo === "DATA_FINE" ? `Fino al ${n.data_fine ? new Date(`${n.data_fine}T00:00:00`).toLocaleDateString("it-IT") : "—"}` : n.durata_tipo === "ANNI" ? `${n.durata_anni} anni` : `Fino all'approvazione del bilancio chiuso al ${n.bilancio_chiuso_al ? new Date(`${n.bilancio_chiuso_al}T00:00:00`).toLocaleDateString("it-IT") : "—"}`}</td>
                  <td style={tdStyle}>{n.compenso_lordo ? `${Number(n.compenso_lordo).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}</td>
                  <td style={tdStyle}><button type="button" style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 600 }} onClick={() => setNominati((prev) => prev.filter((x) => x.id !== n.id))}>Elimina</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dichiarazione di conformità</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            <Field label="Professionista incaricato">
              <select style={inputStyle} value={professionisti.find((p: any) => p.ragione_sociale === form.professionista_nome)?.id || ""} onChange={(e) => { const prof = professionisti.find((p: any) => p.id === e.target.value); aggiornaCampo("professionista_nome", prof?.ragione_sociale || ""); }}>
                <option value="">Seleziona professionista</option>
                {professionisti.map((p: any) => <option key={p.id} value={p.id}>{p.ragione_sociale}</option>)}
              </select>
            </Field>
            <Field label="Tipo dicitura">
              <select style={inputStyle} onChange={(e) => { const d = diciture.find((x: any) => x.id === e.target.value); if (!d) return; aggiornaCampo("dicitura_presentazione", String(d.testo || "").replaceAll("[PROFESSIONISTA_NOME]", form.professionista_nome || "")); }}>
                <option value="">Seleziona dicitura</option>
                {diciture.map((d: any) => <option key={d.id} value={d.id}>{d.titolo}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Dicitura presentazione"><textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical", background: "#f8fafc" }} value={form.dicitura_presentazione} onChange={(e) => aggiornaCampo("dicitura_presentazione", e.target.value)} /></Field>
          </div>
          <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, color: messaggio.toLowerCase().includes("errore") ? "#dc2626" : "#64748b" }}>{messaggio}</div>
            <button type="submit" disabled={saving} style={blueButton}>{saving ? "Salvataggio..." : "Salva dati verbale"}</button>
          </div>
        </div>
      </form>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Documenti</h2>
        <div style={{ marginTop: 18 }}>
          <Field label="Modello verbale"><input style={{ ...inputStyle, background: "#f1f5f9" }} value="VERBALE_NOMINA_ORGANO_CONTROLLO" disabled /></Field>
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 18, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}><input type="checkbox" checked={form.verbale_definitivo} onChange={(e) => aggiornaCampo("verbale_definitivo", e.target.checked)} /> Verbale definitivo</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}><input type="checkbox" disabled checked={documenti.some((d: any) => d.tipo_documento === "VERBALE_NOMINA_ORGANO_CONTROLLO")} /> Verbale di nomina generato</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}><input type="checkbox" disabled checked={documenti.some((d: any) => d.tipo_documento === "ACCETTAZIONE_CARICHE")} /> Accettazione carica/cariche generata</label>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" style={blueButton} onClick={generaVerbale}>Genera verbale di nomina</button>
          <button type="button" style={blueButton} onClick={generaAccettazione}>Genera accettazione carica/cariche</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>Il modello definitivo del verbale verrà completato con i campi di unione appena viene caricato il verbale di esempio.</div>

        {documenti.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
            <thead><tr><th style={thStyle}>Documento</th><th style={thStyle}>Tipo</th><th style={thStyle}>Data</th><th style={thStyle}>Azioni</th></tr></thead>
            <tbody>
              {documenti.map((doc: any) => (
                <tr key={doc.id}>
                  <td style={tdStyle}>{doc.nome_file}</td>
                  <td style={tdStyle}>{doc.tipo_documento}</td>
                  <td style={tdStyle}>{doc.created_at ? new Date(doc.created_at).toLocaleString("it-IT") : "—"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 14 }}>
                      <a href={`/api/pratiche/${praticaId}/documenti/${doc.id}/download`} download style={{ color: "#2563eb", display: "flex", alignItems: "center" }}><Download size={18} /></a>
                      <label style={{ color: "#16a34a", display: "flex", alignItems: "center", cursor: "pointer" }}><Upload size={18} /><input type="file" accept=".docx" style={{ display: "none" }} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append("file", file); fd.append("documento_id", doc.id); const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/documento-modificato`, { method: "POST", body: fd }); if (!res.ok) return alert("Errore upload documento"); await caricaDocumenti(); }} /></label>
                      <button type="button" style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }} onClick={async () => { if (!confirm("Eliminare documento?")) return; const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/documenti/${encodeURIComponent(String(doc.id))}`, { method: "DELETE" }); if (!res.ok) return alert("Errore eliminazione documento"); await caricaDocumenti(); }}><Trash2 size={18} /></button>
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
