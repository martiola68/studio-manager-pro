"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type PraticaDettaglio = {
  id: string;
  numero_pratica: string;
  titolo: string;
  stato: string;
  priorita: string;
  data_apertura: string;
  cliente?: {
    ragione_sociale?: string;
    codice_fiscale?: string;
    partita_iva?: string;
    indirizzo?: string;
    cap?: string;
    citta?: string;
    provincia?: string;
    numero_rea?: string;
  };
  tipo?: {
    ente?: string;
    nome?: string;
  };
  assegnatario?: {
    nome?: string;
    cognome?: string;
  };
  dati_documento?: any;
};

type Professionista = {
  id: string;
  ragione_sociale: string;
  codice_fiscale?: string | null;
};

type MotivoLiquidazione = {
  id: string;
  titolo: string;
  testo_verbale: string;
};

type Dicitura = {
  id: string;
  titolo: string;
  testo: string;
};

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

export default function DettaglioPraticaPage() {
  const params = useParams();
  const praticaId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");
  const [pratica, setPratica] = useState<PraticaDettaglio | null>(null);

  const [professionisti, setProfessionisti] = useState<Professionista[]>([]);
  const [motiviLiquidazione, setMotiviLiquidazione] = useState<MotivoLiquidazione[]>([]);
  const [diciture, setDiciture] = useState<Dicitura[]>([]);

  const [documenti, setDocumenti] = useState<any[]>([]);
const [uploadingDocumento, setUploadingDocumento] = useState(false);
const [tipoDocumento, setTipoDocumento] = useState("altro");
const [fileDocumento, setFileDocumento] = useState<File | null>(null);

  const [form, setForm] = useState({
    societa_denominazione: "",
    societa_sede: "",
    societa_codice_fiscale: "",
    societa_partita_iva: "",
    societa_rea: "",
    data_atto: "",
    ora_inizio: "",
    luogo_assemblea: "",
    presidente: "",
    segretario: "",
    motivo_liquidazione: "",
    motivo_liquidazione_altro: "",
    ora_chiusura: "",
    professionista_nome: "",
    professionista_codice_fiscale: "",
    professionista_qualifica: "",
    dicitura_presentazione: "",
  });

  useEffect(() => {
    async function caricaPratica() {
      try {
        const res = await fetch(`/api/pratiche/${praticaId}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Errore caricamento pratica");
        }

        const p = data.pratica;
        setPratica(p);

        setProfessionisti(data.professionisti || []);
        setMotiviLiquidazione(data.motivi_liquidazione || []);
        setDiciture(data.diciture || []);

        const sede = [
          p.cliente?.indirizzo,
          p.cliente?.cap,
          p.cliente?.citta,
          p.cliente?.provincia,
        ]
          .filter(Boolean)
          .join(" ");

        setForm({
          societa_denominazione:
            p.dati_documento?.societa_denominazione ||
            p.cliente?.ragione_sociale ||
            "",
          societa_sede:
            p.dati_documento?.societa_sede || sede || "",
          societa_codice_fiscale:
            p.dati_documento?.societa_codice_fiscale ||
            p.cliente?.codice_fiscale ||
            "",
          societa_partita_iva:
            p.dati_documento?.societa_partita_iva ||
            p.cliente?.partita_iva ||
            "",
          societa_rea:
            p.dati_documento?.societa_rea ||
            p.cliente?.numero_rea ||
            "",
          data_atto: p.dati_documento?.data_atto || "",
          ora_inizio: p.dati_documento?.ora_inizio || "",
          luogo_assemblea: p.dati_documento?.luogo_assemblea || "",
          presidente: p.dati_documento?.presidente || "",
          segretario: p.dati_documento?.segretario || "",
          motivo_liquidazione:
            p.dati_documento?.motivo_liquidazione || "",
          motivo_liquidazione_altro:
            p.dati_documento?.motivo_liquidazione_altro || "",
          ora_chiusura: p.dati_documento?.ora_chiusura || "",
          professionista_nome:
            p.dati_documento?.professionista_nome || "",
          professionista_codice_fiscale:
            p.dati_documento?.professionista_codice_fiscale || "",
          professionista_qualifica:
            p.dati_documento?.professionista_qualifica || "",
          dicitura_presentazione:
            p.dati_documento?.dicitura_presentazione || "",
        });
      } catch (error: any) {
        setMessaggio(error.message || "Errore caricamento pratica");
      } finally {
        setLoading(false);
      }
    }

   if (praticaId) {
  caricaPratica();
  caricaDocumenti();
}
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function caricaDocumenti() {
  try {
    const res = await fetch(
      `/api/pratiche/${praticaId}/documenti`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (res.ok) {
      setDocumenti(data.documenti || []);
    }
  } catch (error) {
    console.error(error);
  }
}

async function uploadDocumento() {
  if (!fileDocumento) return;

  try {
    setUploadingDocumento(true);

    const formData = new FormData();

    formData.append("file", fileDocumento);
    formData.append("tipo_documento", tipoDocumento);

    const res = await fetch(
      `/api/pratiche/${praticaId}/documenti`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || "Errore upload documento"
      );
    }

    setFileDocumento(null);
    await caricaDocumenti();
  } catch (error: any) {
    alert(error.message);
  } finally {
    setUploadingDocumento(false);
  }
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
        throw new Error(data.error || "Errore salvataggio dati documento");
      }

      setMessaggio("Dati documento salvati correttamente.");
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
        Caricamento pratica...
      </main>
    );
  }

  if (!pratica) {
    return (
      <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
        Pratica non trovata.
      </main>
    );
  }

  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/pratiche"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Torna alle pratiche
          </Link>

          <h1
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: "#0f172a",
              margin: "14px 0 0",
              lineHeight: 1.1,
            }}
          >
            {pratica.numero_pratica}
          </h1>

          <p style={{ marginTop: 8, fontSize: 15, color: "#64748b" }}>
            {pratica.titolo}
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0f172a" }}>
            Riepilogo pratica
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 14,
              marginTop: 18,
              fontSize: 14,
            }}
          >
            <div>
              <strong>Cliente</strong>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {pratica.cliente?.ragione_sociale || "—"}
              </div>
            </div>

            <div>
              <strong>Tipo pratica</strong>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {pratica.tipo
                  ? `${pratica.tipo.ente} - ${pratica.tipo.nome}`
                  : "—"}
              </div>
            </div>

            <div>
              <strong>Stato</strong>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {pratica.stato}
              </div>
            </div>

            <div>
              <strong>Priorità</strong>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {pratica.priorita}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={salvaDatiDocumento}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Dati per documenti
            </h2>

            <p style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>
              Questi dati verranno usati per compilare automaticamente bozze,
              verbali, atti e documenti collegati alla pratica.
            </p>

            <h3 style={{ marginTop: 24, fontSize: 16, fontWeight: 700 }}>
              Dati società
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
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

            <h3 style={{ marginTop: 28, fontSize: 16, fontWeight: 700 }}>
              Dati verbale / atto
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Data atto</label>
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
                <label style={labelStyle}>Ora chiusura verbale</label>
                <input type="time" style={inputStyle} value={form.ora_chiusura} onChange={(e) => aggiornaCampo("ora_chiusura", e.target.value)} />
              </div>
            </div>

            <h3 style={{ marginTop: 28, fontSize: 16, fontWeight: 700 }}>
              Motivo messa in liquidazione
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Motivo</label>
                <select
                  style={inputStyle}
                  value={form.motivo_liquidazione}
                  onChange={(e) => aggiornaCampo("motivo_liquidazione", e.target.value)}
                >
                  <option value="">Seleziona motivo</option>

                  {motiviLiquidazione.map((m) => (
                    <option key={m.id} value={m.testo_verbale}>
                      {m.titolo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Altro motivo</label>
                <input
                  style={inputStyle}
                  value={form.motivo_liquidazione_altro}
                  onChange={(e) => aggiornaCampo("motivo_liquidazione_altro", e.target.value)}
                  placeholder="Compilare solo se necessario"
                />
              </div>
            </div>

<h3 style={{ marginTop: 28, fontSize: 16, fontWeight: 700 }}>
  Professionista / presentazione
</h3>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
  <div>
    <label style={labelStyle}>Nome professionista</label>

    <select
      style={inputStyle}
      value={form.professionista_nome}
      onChange={(e) => {
        const nomeProfessionista = e.target.value;

        const selected = professionisti.find(
          (p) => p.ragione_sociale === nomeProfessionista
        );

        setForm((prev) => ({
          ...prev,
          professionista_nome: nomeProfessionista,
          professionista_codice_fiscale: selected?.codice_fiscale || "",
          dicitura_presentazione: prev.dicitura_presentazione
            .replaceAll("{{professionista_nome}}", nomeProfessionista)
            .replaceAll("[professionista_nome]", nomeProfessionista)
            .replaceAll("[PROFESSIONISTA_NOME]", nomeProfessionista),
        }));
      }}
    >
      <option value="">Seleziona professionista</option>

      {professionisti.map((p) => (
        <option key={p.id} value={p.ragione_sociale}>
          {p.ragione_sociale}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label style={labelStyle}>Codice fiscale professionista</label>
    <input
      style={inputStyle}
      value={form.professionista_codice_fiscale}
      onChange={(e) =>
        aggiornaCampo("professionista_codice_fiscale", e.target.value)
      }
    />
  </div>

  <div>
    <label style={labelStyle}>Qualifica</label>

    <select
      style={inputStyle}
      value={form.professionista_qualifica}
      onChange={(e) =>
        aggiornaCampo("professionista_qualifica", e.target.value)
      }
    >
      <option value="">Seleziona qualifica</option>
      <option value="Dottore Commercialista">Dottore Commercialista</option>
      <option value="Ragioniere Commercialista">Ragioniere Commercialista</option>
    </select>
  </div>
</div>

<div style={{ marginTop: 14 }}>
  <label style={labelStyle}>Dicitura presentazione pratica</label>

  <select
    style={{ ...inputStyle, marginBottom: 10 }}
    onChange={(e) => {
      const selected = diciture.find((d) => d.testo === e.target.value);

      if (selected) {
        aggiornaCampo(
          "dicitura_presentazione",
          selected.testo
            .replaceAll("{{professionista_nome}}", form.professionista_nome)
            .replaceAll("[professionista_nome]", form.professionista_nome)
            .replaceAll("[PROFESSIONISTA_NOME]", form.professionista_nome)
        );
      }
    }}
  >
    <option value="">Seleziona dicitura predefinita</option>

    {diciture.map((d) => (
      <option key={d.id} value={d.testo}>
        {d.titolo}
      </option>
    ))}
  </select>

  <textarea
    style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
    value={form.dicitura_presentazione}
    onChange={(e) =>
      aggiornaCampo("dicitura_presentazione", e.target.value)
    }
    placeholder="Inserire la dicitura da integrare nei documenti per la presentazione."
  />
</div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, color: messaggio.includes("Errore") ? "#dc2626" : "#64748b" }}>
              {messaggio}
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                border: 0,
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
                fontFamily: font,
              }}
            >
              {saving ? "Salvataggio..." : "Salva dati documento"}
            </button>
          </div>
          <div
  style={{
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 24,
    marginTop: 16,
  }}
>
  <h2
    style={{
      fontSize: 20,
      fontWeight: 700,
      margin: 0,
      color: "#0f172a",
    }}
  >
    Documenti pratica
  </h2>

  <p
    style={{
      marginTop: 6,
      fontSize: 14,
      color: "#64748b",
    }}
  >
    Carica verbali, ricevute di deposito,
    visure e documenti collegati alla pratica.
  </p>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr auto",
      gap: 12,
      marginTop: 18,
      alignItems: "end",
    }}
  >
    <div>
      <label style={labelStyle}>
        Tipo documento
      </label>

      <select
        style={inputStyle}
        value={tipoDocumento}
        onChange={(e) =>
          setTipoDocumento(e.target.value)
        }
      >
        <option value="verbale_assemblea">
          Verbale assemblea
        </option>

        <option value="nomina_liquidatore">
          Nomina liquidatore
        </option>

        <option value="accettazione_liquidatore">
          Accettazione liquidatore
        </option>

        <option value="dichiarazione_conformita">
          Dichiarazione conformità
        </option>

        <option value="ricevuta_deposito">
          Ricevuta deposito
        </option>

        <option value="visura_evasione">
          Visura evasione
        </option>

        <option value="altro">
          Altro
        </option>
      </select>
    </div>

    <div style={{ gridColumn: "span 2" }}>
      <label style={labelStyle}>
        File
      </label>

      <input
        type="file"
        onChange={(e) =>
          setFileDocumento(
            e.target.files?.[0] || null
          )
        }
      />
    </div>

    <button
      type="button"
      onClick={uploadDocumento}
      disabled={
        uploadingDocumento || !fileDocumento
      }
      style={{
        border: 0,
        borderRadius: 8,
        background: "#2563eb",
        color: "#fff",
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        opacity:
          uploadingDocumento || !fileDocumento
            ? 0.6
            : 1,
        fontFamily: font,
      }}
    >
      {uploadingDocumento
        ? "Upload..."
        : "Carica"}
    </button>
  </div>

  <div style={{ marginTop: 24 }}>
    {documenti.length === 0 ? (
      <div
        style={{
          fontSize: 14,
          color: "#64748b",
        }}
      >
        Nessun documento caricato.
      </div>
    ) : (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom:
                "1px solid #e5e7eb",
            }}
          >
            <th style={thStyle}>Documento</th>
            <th style={thStyle}>Tipo</th>
            <th style={thStyle}>Data</th>
            <th style={thStyle}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {documenti.map((doc) => (
            <tr
              key={doc.id}
              style={{
                borderBottom:
                  "1px solid #f1f5f9",
              }}
            >
              <td style={tdStyle}>
                {doc.nome_file}
              </td>

              <td style={tdStyle}>
                {doc.tipo_documento}
              </td>

              <td style={tdStyle}>
                {new Date(
                  doc.created_at
                ).toLocaleString("it-IT")}
              </td>

              <td style={tdStyle}>
  <a
    href={`/api/pratiche/${praticaId}/documenti/${doc.id}/download`}
    target="_blank"
    style={{
      color: "#2563eb",
      fontWeight: 600,
      textDecoration: "none",
    }}
  >
    Scarica
  </a>
</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
</div>
        </form>
      </div>
    </main>
  );
}
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
