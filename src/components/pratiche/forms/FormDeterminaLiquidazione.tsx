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

  function tornaElenco() {
  router.push("/pratiche");
}
  
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

  const [nuovoRappLegale, setNuovoRappLegale] =
    useState({
      nome_cognome: "",
      codice_fiscale: "",
      amministratore_principale: false,
      luogo_nascita: "",
      data_nascita: "",
      citta_residenza: "",
      indirizzo_residenza: "",
      provincia: "",
      cap: "",
    });

  useEffect(() => {
   if (praticaId) {
  caricaMotivi();
  caricaDocumenti();
  caricaAmministratori();
}
  }, [praticaId]);

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
        `/api/pratiche/${praticaId}`,
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

async function caricaAmministratori() {
  if (!pratica?.cliente_id) {
    return;
  }

  try {
    const res = await fetch(
      `/api/clienti-organi?cliente_id=${pratica.cliente_id}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return;
    }

const ruoliRappresentante = [
  "amministratore",
  "amministratore_unico",
  "amministratore_delegato",
  "presidente_cda",
  "liquidatore",
  "rappresentante_legale",
];

setRappresentantiLegali(
  (data.organi || []).filter((o: any) => {
    if (o.attivo === false) return false;

    return ruoliRappresentante.includes(String(o.ruolo || ""));
  })
);
  } catch (error: any) {
    console.error("Errore caricamento amministratori:", error);
    alert(error.message || "Errore caricamento amministratori");
  }
}
  
  async function salvaDatiDocumento(
    e?: React.FormEvent
  ) {
    if (e) e.preventDefault();

    setSaving(true);
    setMessaggio("");

    try {
      const res = await fetch(
        `/api/pratiche/${praticaId}`,
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
      `/api/pratiche/${praticaId}/genera-documento`,
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

  async function salvaNuovoRappresentante() {
    try {
     const res = await fetch(
  `/api/rapp-legali/${pratica.id}/nuovo-rapp-pratiche`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studio_id: pratica.studio_id,
            cliente_id: pratica.cliente_id,
            ...nuovoRappLegale,
             amministratore_principale:
              nuovoRappLegale.amministratore_principale,
            rappresentante_legale: true,
          }),
        }
      );

      const data = await res.json();

if (!res.ok) {
  throw new Error(
    data.error ||
      data.ok === false && data.error ||
      "Errore salvataggio rappresentante"
  );
}

const rappresentante = data.rappresentante || data.data;

if (!rappresentante?.id) {
  throw new Error("Rappresentante salvato ma ID non restituito dall'API");
}

await fetch("/api/clienti-organi", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    cliente_id: pratica.cliente_id,
    rapp_legale_id: rappresentante.id,
    ruolo: "amministratore",
    carica: "Amministratore",
    principale: nuovoRappLegale.amministratore_principale,
    attivo: true,
  }),
});

setForm((prev) => ({
  ...prev,
  rappresentante_legale_id: rappresentante.id,
  rappresentante_legale_nome:
    rappresentante.nome_cognome || nuovoRappLegale.nome_cognome || "",
  rappresentante_legale_codice_fiscale:
    rappresentante.codice_fiscale || nuovoRappLegale.codice_fiscale || "",
  rappresentante_legale_indirizzo:
    rappresentante.indirizzo_residenza || nuovoRappLegale.indirizzo_residenza || "",
  rappresentante_legale_citta:
    rappresentante.citta_residenza || nuovoRappLegale.citta_residenza || "",
  rappresentante_legale_provincia:
    rappresentante.provincia || nuovoRappLegale.provincia || "",
  rappresentante_legale_cap:
    rappresentante.cap || nuovoRappLegale.cap || "",
  nuovo_rappresentante: false,
}));

     alert("Rappresentante legale salvato.");

await caricaAmministratori();
    } catch (error: any) {
      alert(
        error.message ||
          "Errore salvataggio"
      );
    }
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

        {/* RAPPRESENTANTE LEGALE */}
        <div style={cardStyle}>
          <h2 style={titleStyle}>
            Rappresentante legale
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "2fr auto",
              gap: 12,
              marginTop: 18,
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>
                Seleziona rappresentante
              </label>

<select
  style={inputStyle}
  value={form.rappresentante_legale_id}
  onChange={(e) => {
    const selected = rappresentantiLegali.find(
      (r: any) => String(r.id) === String(e.target.value)
    );

    if (!selected) return;

    setForm((prev) => ({
      ...prev,
     rappresentante_legale_id: selected.id,
      rappresentante_legale_nome: selected.nominativo_nome || "",
      rappresentante_legale_codice_fiscale:
        selected.nominativo_codice_fiscale || "",
      rappresentante_legale_indirizzo:
        selected.soggetto_cliente?.indirizzo || "",
      rappresentante_legale_citta:
        selected.soggetto_cliente?.citta || "",
      rappresentante_legale_provincia:
        selected.soggetto_cliente?.provincia || "",
      rappresentante_legale_cap:
        selected.soggetto_cliente?.cap || "",
    }));
  }}
>
  <option value="">Seleziona</option>

  {rappresentantiLegali.map((r: any) => (
    <option key={r.id} value={r.id}>
      {r.nominativo_nome} - {r.nominativo_codice_fiscale}
      {r.principale ? " — principale" : ""}
    </option>
  ))}
</select>
          </div>

            <button
              type="button"
              style={secondaryButton}
              onClick={() => {
                setNuovoRappLegale({
  nome_cognome: "",
  codice_fiscale: "",
  amministratore_principale: false,
  luogo_nascita: "",
  data_nascita: "",
  citta_residenza: "",
  indirizzo_residenza: "",
  provincia: "",
  cap: "",
});

                setForm((prev) => ({
                  ...prev,
                  nuovo_rappresentante: true,
                }));
              }}
            >
              + Nuovo
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: 12,
              marginTop: 14,
            }}
          >
            <div>
              <label style={labelStyle}>
                Nome amministratore
              </label>

              <input
                style={inputStyle}
                value={
                  form.rappresentante_legale_nome
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "rappresentante_legale_nome",
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
                  form.rappresentante_legale_codice_fiscale
                }
                onChange={(e) =>
                  aggiornaCampo(
                    "rappresentante_legale_codice_fiscale",
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
      value={form.rappresentante_legale_indirizzo}
      onChange={(e) =>
        aggiornaCampo(
          "rappresentante_legale_indirizzo",
          e.target.value
        )
      }
    />
  </div>

  <div>
    <label style={labelStyle}>Città</label>

    <input
      style={inputStyle}
      value={form.rappresentante_legale_citta}
      onChange={(e) =>
        aggiornaCampo(
          "rappresentante_legale_citta",
          e.target.value
        )
      }
    />
  </div>
            <div>
  <label style={labelStyle}>Provincia</label>
  <input
    style={inputStyle}
    value={form.rappresentante_legale_provincia}
    onChange={(e) =>
      aggiornaCampo(
        "rappresentante_legale_provincia",
        e.target.value.toUpperCase()
      )
    }
  />
</div>

<div>
  <label style={labelStyle}>CAP</label>
  <input
    style={inputStyle}
    value={form.rappresentante_legale_cap}
    onChange={(e) =>
      aggiornaCampo(
        "rappresentante_legale_cap",
        e.target.value
      )
    }
  />
</div>
</div>

          {form.nuovo_rappresentante && (
            <div
              style={{
                marginTop: 18,
                padding: 18,
                border:
                  "1px solid #cbd5e1",
                borderRadius: 10,
                background: "#f8fafc",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 16,
                }}
              >
                Nuovo rappresentante
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={labelStyle}
                  >
                    Cognome e nome
                  </label>

                  <input
                    style={inputStyle}
                    value={
                      nuovoRappLegale.nome_cognome
                    }
                    onChange={(e) =>
                      setNuovoRappLegale(
                        (
                          prev
                        ) => ({
                          ...prev,
                          nome_cognome:
                            e.target
                              .value,
                        })
                      )
                    }
                  />
                </div>

                <div>
                  <label
                    style={labelStyle}
                  >
                    Codice fiscale
                  </label>

                  <input
                    style={inputStyle}
                    value={
                      nuovoRappLegale.codice_fiscale
                    }
                    onChange={(e) =>
                      setNuovoRappLegale(
                        (
                          prev
                        ) => ({
                          ...prev,
                          codice_fiscale:
                            e.target.value.toUpperCase(),
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <div>
                  <label
                    style={labelStyle}
                  >
                    Luogo nascita
                  </label>

                  <input
                    style={inputStyle}
                    value={
                      nuovoRappLegale.luogo_nascita
                    }
                    onChange={(e) =>
                      setNuovoRappLegale(
                        (
                          prev
                        ) => ({
                          ...prev,
                          luogo_nascita:
                            e.target
                              .value,
                        })
                      )
                    }
                  />
                </div>

                <div>
                  <label
                    style={labelStyle}
                  >
                    Data nascita
                  </label>

                  <input
                    type="date"
                    style={inputStyle}
                    value={
                      nuovoRappLegale.data_nascita
                    }
                    onChange={(e) =>
                      setNuovoRappLegale(
                        (
                          prev
                        ) => ({
                          ...prev,
                          data_nascita:
                            e.target
                              .value,
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "2fr 1fr 1fr",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <div>
                  <label
                    style={labelStyle}
                  >
                    Indirizzo residenza
                  </label>

                  <input
                    style={inputStyle}
                    value={
                      nuovoRappLegale.indirizzo_residenza
                    }
                    onChange={(e) =>
                      setNuovoRappLegale(
                        (
                          prev
                        ) => ({
                          ...prev,
                          indirizzo_residenza:
                            e.target
                              .value,
                        })
                      )
                    }
                  />
                </div>

                <div>
                  <label
                    style={labelStyle}
                  >
                    Città
                  </label>

                  <input
                    style={inputStyle}
                    value={
                      nuovoRappLegale.citta_residenza
                    }
                    onChange={(e) =>
                      setNuovoRappLegale(
                        (
                          prev
                        ) => ({
                          ...prev,
                          citta_residenza:
                            e.target
                              .value,
                        })
                      )
                    }
                  />
                </div>

                <div>
                  <label
                    style={labelStyle}
                  >
                    Provincia
                  </label>

                  <input
                    style={inputStyle}
                    value={
                      nuovoRappLegale.provincia
                    }
                    onChange={(e) =>
                      setNuovoRappLegale(
                        (
                          prev
                        ) => ({
                          ...prev,
                          provincia:
                            e.target
                              .value,
                        })
                      )
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  maxWidth: 220,
                }}
              >
                <label style={labelStyle}>
                  CAP
                </label>

                <input
                  style={inputStyle}
                  value={
                    nuovoRappLegale.cap
                  }
                  onChange={(e) =>
                    setNuovoRappLegale(
                      (prev) => ({
                        ...prev,
                        cap: e.target
                          .value,
                      })
                    )
                  }
                />
              </div>

              <div style={{ marginTop: 12 }}>
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      fontWeight: 500,
    }}
  >
    <input
      type="checkbox"
      checked={
        nuovoRappLegale.amministratore_principale
      }
      onChange={(e) =>
        setNuovoRappLegale((prev) => ({
          ...prev,
          amministratore_principale:
            e.target.checked,
        }))
      }
    />

    Imposta come amministratore principale
  </label>
</div>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  justifyContent:
                    "flex-end",
                }}
              >
                <button
                  type="button"
                  style={greenButton}
                  onClick={
                    salvaNuovoRappresentante
                  }
                >
                  Salva rappresentante
                </button>
              </div>
            </div>
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
        `/api/pratiche/${praticaId}/documento-modificato`,
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
                                `/api/pratiche/${praticaId}/documenti/${doc.id}`,
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
