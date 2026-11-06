"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { urlInserimentoOrgano } from "@/lib/pratiche/organiSocialiLink";
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
  background: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: font,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginTop: 18,
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#111827",
  margin: 0,
};

const blueButton: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#2563eb",
  color: "#ffffff",
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: font,
};

const greenButton: React.CSSProperties = {
  ...blueButton,
  background: "#16a34a",
};

const secondaryButton: React.CSSProperties = {
  ...blueButton,
  background: "#475569",
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

export default function FormDeterminaLiquidazione({
  pratica,
}: any) {
  const router = useRouter();

  const praticaId = router.query.id as string;

 const [motivi, setMotivi] = useState<any[]>([]);
const [documenti, setDocumenti] = useState<any[]>([]);
const [rappresentantiLegali, setRappresentantiLegali] = useState<any[]>([]);

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
      pratica?.dati_documento?.societa_sede ||
      sedeSocieta ||
      "",

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

    data_atto:
      pratica?.dati_documento?.data_atto || "",

    ora_inizio:
      pratica?.dati_documento?.ora_inizio || "",

    luogo_assemblea:
      pratica?.dati_documento?.luogo_assemblea ||
      sedeSocieta ||
      "",

   rappresentante_legale_id:
  pratica?.dati_documento?.rappresentante_legale_id || "",

    rappresentante_legale_nome:
      pratica?.dati_documento
        ?.rappresentante_legale_nome || "",

    rappresentante_legale_codice_fiscale:
      pratica?.dati_documento
        ?.rappresentante_legale_codice_fiscale || "",

    rappresentante_legale_indirizzo:
      pratica?.dati_documento
        ?.rappresentante_legale_indirizzo || "",

    rappresentante_legale_citta:
      pratica?.dati_documento
        ?.rappresentante_legale_citta || "",

    rappresentante_legale_provincia:
  pratica?.dati_documento?.rappresentante_legale_provincia || "",

rappresentante_legale_cap:
  pratica?.dati_documento?.rappresentante_legale_cap || "",

    motivo_liquidazione:
      pratica?.dati_documento?.motivo_liquidazione ||
      "",

    motivo_liquidazione_testo:
      pratica?.dati_documento
        ?.motivo_liquidazione_testo || "",

    data_convocazione:
      pratica?.dati_documento?.data_convocazione ||
      "",

    ora_convocazione:
      pratica?.dati_documento?.ora_convocazione ||
      "",

    luogo_convocazione:
      pratica?.dati_documento
        ?.luogo_convocazione ||
      sedeSocieta ||
      "",

    nuovo_rappresentante: false,
  });

  const [caricamentoOrgani, setCaricamentoOrgani] = useState(true);

 useEffect(() => {
  if (praticaId) {
    caricaMotivi();
    caricaDocumenti();
  }
}, [praticaId]);

useEffect(() => {
  if (praticaId && pratica?.cliente_id) {
    caricaAmministratori();
  }
}, [praticaId, pratica?.cliente_id]);

  function aggiornaCampo(
    campo: string,
    valore: string
  ) {
    setForm((prev) => ({
      ...prev,
      [campo]: valore,
    }));
  }

  async function caricaMotivi() {
    try {
      const res = await fetch(
        `/api/pratiche/${encodeURIComponent(String(praticaId))}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();


      if (res.ok) {
        setMotivi(data.motivi_liquidazione || []);
      }
    } catch (error) {
      console.error(error);
    }
  }

async function caricaDocumenti() {
  try {
    const res = await fetch(
      `/api/pratiche/${encodeURIComponent(String(praticaId))}/documenti`,
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

async function caricaAmministratori() {
  if (!pratica?.cliente_id) return;
  setCaricamentoOrgani(true);
  try {
    const res = await fetch(
      `/api/clienti-organi?cliente_id=${encodeURIComponent(String(pratica.cliente_id))}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Impossibile leggere gli organi sociali");

    const organi = (data.organi || []).filter((o: any) =>
      o.attivo !== false && o.tipo_ruolo === "R" && o.soggetto_cliente_id && o.soggetto_cliente
    );
    setRappresentantiLegali(organi);
    // Individua automaticamente l'organo principale. Se manca e ne esiste
    // uno solo, utilizza quello. Con più rappresentanti senza principale,
    // richiede selezione esplicita.
    const principale = organi.find((o: any) => o.principale === true);
    const scelto = principale || (organi.length === 1 ? organi[0] : null);
    setForm((prev) => {
      const collegato = organi.find((o: any) => String(o.id) === String(prev.rappresentante_legale_id));
      const effective = collegato || scelto;
      const soggetto = effective?.soggetto_cliente;
      return {
        ...prev,
        rappresentante_legale_id: effective?.id || "",
        rappresentante_legale_nome: soggetto?.ragione_sociale || "",
        rappresentante_legale_codice_fiscale: soggetto?.codice_fiscale || soggetto?.partita_iva || "",
        rappresentante_legale_indirizzo: soggetto?.indirizzo || "",
        rappresentante_legale_citta: soggetto?.citta || "",
        rappresentante_legale_provincia: soggetto?.provincia || "",
        rappresentante_legale_cap: soggetto?.cap || "",
        nuovo_rappresentante: false,
      };
    });
  } catch (error: any) {
    console.error("Errore caricamento organi sociali", error);
    setMessaggio(error?.message || "Impossibile caricare il rappresentante legale");
  } finally {
    setCaricamentoOrgani(false);
  }
}

  async function salvaDatiDocumento(
    e?: React.FormEvent
  ) {
    if (e) e.preventDefault();
    if (!form.rappresentante_legale_id || !rappresentantiLegali.some(o => String(o.id) === String(form.rappresentante_legale_id))) {
      setMessaggio("Inserire il rappresentante legale nell'archivio Organi sociali prima di salvare la Determina.");
      return false;
    }

    setSaving(true);
    setMessaggio("");

    try {
      const res = await fetch(
        `/api/pratiche/${encodeURIComponent(String(praticaId))}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Errore salvataggio"
        );
      }

      setMessaggio(
        "Dati determina salvati correttamente."
      );

      return true;
    } catch (error: any) {
      setMessaggio(
        error.message || "Errore imprevisto"
      );

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function generaDocumento() {
    const salvato =
      await salvaDatiDocumento();

    if (!salvato) return;

    const res = await fetch(
      `/api/pratiche/${encodeURIComponent(String(praticaId))}/genera-documento`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codice_modello: "DETERMINA_AU_CDA",
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(
        data.error ||
          "Errore generazione documento"
      );
      return;
    }

    await caricaDocumenti();

    alert("Documento generato.");
  }

 async function creaPraticaLiquidazione() {
  const salvato = await salvaDatiDocumento();

  if (!salvato) return;

  const res = await fetch(
    `/api/pratiche/${encodeURIComponent(String(praticaId))}/crea-pratica-liquidazione`,
    {
      method: "POST",
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Errore creazione pratica di messa in liquidazione");
    return;
  }

  alert(
    data.alreadyExists
      ? "Pratica di messa in liquidazione già esistente."
      : "Pratica di messa in liquidazione creata correttamente."
  );

  if (data.pratica?.id) {
    router.push(`/pratiche/${data.pratica.id}`);
  }
}

  const determinaGenerata = documenti.some(
  (doc: any) => doc.tipo_documento === "DETERMINA_AU_CDA"
);

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
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 24,
  }}
>
  <button
    type="button"
    style={{
      background: "#ffffff",
      color: "#1e3a8a",
      border: "1px solid #cbd5e1",
      borderRadius: 8,
      padding: "10px 18px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: font,
    }}
    onClick={() => router.push("/pratiche/variazioni")}
  >
    ← Torna a Variazioni
  </button>
</div>

<h1
        style={{
          fontSize: 36,
          fontWeight: 800,
          margin: 0,
        }}
      >
        {pratica?.numero_pratica}

        
      </h1>

      <p
        style={{
          marginTop: 6,
          fontSize: 18,
          color: "#64748b",
        }}
      >
        Determina causa scioglimento /
        liquidazione
      </p>

      <form onSubmit={salvaDatiDocumento}>
        {/* DATI SOCIETA */}
        <div style={cardStyle}>
          <h2 style={titleStyle}>
            Dati società
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "2fr 1fr 1fr",
              gap: 12,
              marginTop: 18,
            }}
          >
            <div>
              <label style={labelStyle}>
                Denominazione
              </label>

              <input
                style={{
  ...inputStyle,
  fontSize: 19,
  fontWeight: 700,
}}
                value={
                  form.societa_denominazione
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "societa_denominazione",
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Codice fiscale
              </label>

              <input
                style={inputStyle}
                value={
                  form.societa_codice_fiscale
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "societa_codice_fiscale",
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Partita IVA
              </label>

              <input
                style={inputStyle}
                value={
                  form.societa_partita_iva
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "societa_partita_iva",
                    e.target.value
                  )
                }
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "2fr 1fr",
              gap: 12,
              marginTop: 14,
            }}
          >
            <div>
              <label style={labelStyle}>
                Sede società
              </label>

              <input
                style={inputStyle}
                value={form.societa_sede}
                onChange={(e) =>
                  aggiornaCampo(
                    "societa_sede",
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Numero REA
              </label>

              <input
                style={inputStyle}
                value={form.societa_rea}
                onChange={(e) =>
                  aggiornaCampo(
                    "societa_rea",
                    e.target.value
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* DATI DETERMINA */}
        <div style={cardStyle}>
          <h2 style={titleStyle}>
            Dati determina
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr 2fr",
              gap: 12,
              marginTop: 18,
            }}
          >
            <div>
              <label style={labelStyle}>
                Data determina
              </label>

              <input
                type="date"
                style={inputStyle}
                value={form.data_atto}
                onChange={(e) =>
                  aggiornaCampo(
                    "data_atto",
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Ora determina
              </label>

              <input
                type="time"
                style={inputStyle}
                value={form.ora_inizio}
                onChange={(e) =>
                  aggiornaCampo(
                    "ora_inizio",
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Luogo assemblea
              </label>

              <input
                style={inputStyle}
                value={
                  form.luogo_assemblea
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "luogo_assemblea",
                    e.target.value
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* RAPPRESENTANTE LEGALE - SOLO ARCHIVIO ORGANI SOCIALI */}
        <div style={cardStyle}>
          <h2 style={titleStyle}>Rappresentante legale</h2>
          <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
            Dati recuperati dall'archivio unico Soci e Organi sociali della società.
            La pratica non crea né modifica anagrafiche.
          </p>
          {caricamentoOrgani ? (
            <p style={{ marginTop: 16 }}>Caricamento organi sociali...</p>
          ) : rappresentantiLegali.length === 0 ? (
            <div style={{ marginTop: 16, padding: 14, border: "1px solid #f59e0b", borderRadius: 8, background: "#fffbeb" }}>
              <p style={{ color: "#92400e", marginBottom: 12, fontWeight: 600 }}>
                Inserire il rappresentante legale nell'archivio Organi sociali.
              </p>
              <button type="button" style={secondaryButton} onClick={() =>
                router.push(urlInserimentoOrgano(String(pratica.cliente_id), String(praticaId), "amministrazione", "rappresentante_legale"))
              }>Inserisci organo sociale</button>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "end", marginTop: 16 }}>
                <div>
                  <label style={labelStyle}>Rappresentante legale della società</label>
                  <select style={inputStyle} value={form.rappresentante_legale_id} onChange={(e) => {
                    const selected = rappresentantiLegali.find((o: any) => String(o.id) === e.target.value);
                    const soggetto = selected?.soggetto_cliente;
                    setForm(prev => ({
                      ...prev,
                      rappresentante_legale_id: selected?.id || "",
                      rappresentante_legale_nome: soggetto?.ragione_sociale || "",
                      rappresentante_legale_codice_fiscale: soggetto?.codice_fiscale || soggetto?.partita_iva || "",
                      rappresentante_legale_indirizzo: soggetto?.indirizzo || "",
                      rappresentante_legale_citta: soggetto?.citta || "",
                      rappresentante_legale_provincia: soggetto?.provincia || "",
                      rappresentante_legale_cap: soggetto?.cap || "",
                    }));
                  }}>
                    <option value="">Seleziona rappresentante</option>
                    {rappresentantiLegali.map((o: any) => (
                      <option key={o.id} value={o.id}>
                        {o.soggetto_cliente?.ragione_sociale || "Nominativo senza nome"}
                        {o.principale ? " — principale" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" style={secondaryButton} onClick={() =>
                  router.push(urlInserimentoOrgano(String(pratica.cliente_id), String(praticaId), "amministrazione"))
                }>Organi sociali</button>
              </div>
              {form.rappresentante_legale_id && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                  <div><label style={labelStyle}>Nominativo (archivio)</label><input style={{ ...inputStyle, background: "#f8fafc" }} value={form.rappresentante_legale_nome} readOnly /></div>
                  <div><label style={labelStyle}>Codice fiscale (archivio)</label><input style={{ ...inputStyle, background: "#f8fafc" }} value={form.rappresentante_legale_codice_fiscale} readOnly /></div>
                  <div><label style={labelStyle}>Indirizzo (archivio)</label><input style={{ ...inputStyle, background: "#f8fafc" }} value={form.rappresentante_legale_indirizzo} readOnly /></div>
                  <div><label style={labelStyle}>Città, Provincia, CAP (archivio)</label><input style={{ ...inputStyle, background: "#f8fafc" }} value={[form.rappresentante_legale_citta, form.rappresentante_legale_provincia, form.rappresentante_legale_cap].filter(Boolean).join(" ")} readOnly /></div>
                </div>
              )}
            </>
          )}
        </div>

        {/* CAUSA SCIOGLIMENTO */}
        <div style={cardStyle}>
          <h2 style={titleStyle}>
            Causa scioglimento
          </h2>

          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>
              Motivo liquidazione
            </label>

            <select
              style={inputStyle}
              value={
                form.motivo_liquidazione
              }
              onChange={(e) => {
                const selected =
                  motivi.find(
                    (m: any) =>
                      m.codice ===
                      e.target.value
                  );

                setForm((prev) => ({
                  ...prev,

                  motivo_liquidazione:
                    selected?.codice ||
                    "",

                  motivo_liquidazione_testo:
                    selected?.testo_verbale ||
                    "",
                }));
              }}
            >
              <option value="">
                Seleziona causa
              </option>

              {motivi.map((m: any) => (
                <option
                  key={m.id}
                  value={m.codice}
                >
                  {m.titolo}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>
              Testo verbale
            </label>

            <textarea
              style={{
                ...inputStyle,
                minHeight: 120,
                resize: "vertical",
              }}
              value={
                form.motivo_liquidazione_testo
              }
              onChange={(e) =>
                aggiornaCampo(
                  "motivo_liquidazione_testo",
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* CONVOCAZIONE */}
        <div style={cardStyle}>
          <h2 style={titleStyle}>
            Convocazione assemblea
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr 2fr",
              gap: 12,
              marginTop: 18,
            }}
          >
            <div>
              <label style={labelStyle}>
                Data convocazione
              </label>

              <input
                type="date"
                style={inputStyle}
                value={
                  form.data_convocazione
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "data_convocazione",
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Ora convocazione
              </label>

              <input
                type="time"
                style={inputStyle}
                value={
                  form.ora_convocazione
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "ora_convocazione",
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Luogo convocazione
              </label>

              <input
                style={inputStyle}
                value={
                  form.luogo_convocazione
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "luogo_convocazione",
                    e.target.value
                  )
                }
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                fontSize: 14,
                color:
                  messaggio.includes(
                    "Errore"
                  )
                    ? "#dc2626"
                    : "#64748b",
              }}
            >
              {messaggio}
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={blueButton}
              >
                {saving
                  ? "Salvataggio..."
                  : "Salva dati"}
              </button>

               </div>
          </div>
        </div>
      </form>

      {/* DOCUMENTI */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>
          Documenti
        </h2>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "end",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>
              Modello
            </label>

            <input
              disabled
              style={{
                ...inputStyle,
                background: "#f1f5f9",
              }}
              value="DETERMINA_AU_CDA"
            />
          </div>

          <button
            type="button"
            style={blueButton}
            onClick={generaDocumento}
          >
            Genera documento
          </button>

          {determinaGenerata && (
  <button
    type="button"
    style={greenButton}
    onClick={creaPraticaLiquidazione}
  >
    Crea pratica di liquidazione
  </button>
)}
          
        </div>

        {documenti.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              marginTop: 20,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>
                  Documento
                </th>

                <th style={thStyle}>
                  Tipo
                </th>

                <th style={thStyle}>
                  Data
                </th>

                <th style={thStyle}>
                  Azioni
                </th>
              </tr>
            </thead>

            <tbody>
              {documenti.map(
                (doc: any) => (
                  <tr key={doc.id}>
                    <td style={tdStyle}>
                      {doc.nome_file}
                    </td>

                    <td style={tdStyle}>
                      {
                        doc.tipo_documento
                      }
                    </td>

                    <td style={tdStyle}>
                      {doc.created_at
                        ? new Date(
                            doc.created_at
                          ).toLocaleString(
                            "it-IT"
                          )
                        : "—"}
                    </td>

                    <td style={tdStyle}>
                      <div
                        style={{
                          display:
                            "flex",
                          gap: 14,
                        }}
                      >
                        <a
                          href={`/api/pratiche/${praticaId}/documenti/${doc.id}/download`}
                          download
                          style={{
                            color:
                              "#2563eb",
                            display:
                              "flex",
                            alignItems:
                              "center",
                          }}
                        >
                          <Download
                            size={18}
                          />
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
      formData.append(
        "documento_id",
        doc.id
      );

      const res = await fetch(
        `/api/pratiche/${encodeURIComponent(String(praticaId))}/documento-modificato`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(
          data.error ||
            "Errore upload documento"
        );
        return;
      }

      alert(
        "Documento aggiornato correttamente"
      );

      await caricaDocumenti();
    }}
  />
</label>
                        
                        <button
                          type="button"
                          style={{
                            border: 0,
                            background:
                              "transparent",
                            color:
                              "#dc2626",
                            cursor:
                              "pointer",
                            padding: 0,
                            display:
                              "flex",
                            alignItems:
                              "center",
                          }}
                          onClick={async () => {
                            const ok =
                              confirm(
                                "Eliminare documento?"
                              );

                            if (!ok)
                              return;

                            const res =
                              await fetch(
                                `/api/pratiche/${encodeURIComponent(String(praticaId))}/documenti/${encodeURIComponent(String(doc.id))}`,
                                {
                                  method:
                                    "DELETE",
                                }
                              );

                            if (
                              !res.ok
                            ) {
                              alert(
                                "Errore eliminazione"
                              );
                              return;
                            }

                            await caricaDocumenti();
                          }}
                        >
                          <Trash2
                            size={18}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
