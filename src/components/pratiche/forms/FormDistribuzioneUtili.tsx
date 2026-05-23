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

  const [soci, setSoci] = useState<any[]>([]);
  const [nominativi, setNominativi] = useState<any[]>([]);

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

  async function caricaSoci() {
    try {
      const res = await fetch(`/api/pratiche/${praticaId}/soci`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (res.ok) {
        setSoci(data.soci || []);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function caricaNominativi() {
    try {
      const res = await fetch("/api/pratiche/nominativi", {
        cache: "no-store",
      });

      const data = await res.json();

      if (res.ok) {
        setNominativi(data.nominativi || []);
      }
    } catch (error) {
      console.error(error);
    }
  }

  const percentualeSociPresentiCalcolata = soci.reduce(
    (totale, socio) =>
      totale + Number(socio.percentuale_partecipazione || 0),
    0
  );

  const nuovaPercentuale = Number(
    nuovoSocio.percentuale_partecipazione || 0
  );

  const percentualeTotaleConNuovo =
    percentualeSociPresentiCalcolata + nuovaPercentuale;

  const percentualeSuperata =
    percentualeTotaleConNuovo > 100;

  const importoLordoNuovoSocio = Number(
    nuovoSocio.importo_utile || 0
  );

  const percentualeRitenutaNuovoSocio = Number(
    nuovoSocio.percentuale_ritenuta || 0
  );

  const importoRitenutaNuovoSocio =
    (importoLordoNuovoSocio *
      percentualeRitenutaNuovoSocio) /
    100;

  const importoNettoNuovoSocio =
    importoLordoNuovoSocio -
    importoRitenutaNuovoSocio;

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
          Soci presenti / Distribuzione utili
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1.5fr 1fr 1fr 1fr",
            gap: 12,
            marginTop: 18,
            alignItems: "end",
          }}
        >
          <div>
            <label style={labelStyle}>
              Cognome e nome
            </label>

            <select
              style={inputStyle}
              value={nuovoSocio.nominativo_id}
              onChange={(e) => {
                const value = e.target.value;

                const selected = nominativi.find(
                  (n) => n.id === value
                );

                setNuovoSocio({
                  ...nuovoSocio,
                  nominativo_id:
                    selected?.id || "",
                  nome_cognome:
                    selected?.nome_cognome ||
                    "",
                  codice_fiscale:
                    selected?.codice_fiscale ||
                    "",
                });
              }}
            >
              <option value="">
                Seleziona nominativo
              </option>

              {nominativi.map((n) => (
                <option
                  key={n.id}
                  value={n.id}
                >
                  {n.nome_cognome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              % partecipazione
            </label>

            <input
              style={inputStyle}
              value={
                nuovoSocio.percentuale_partecipazione
              }
              onChange={(e) =>
                setNuovoSocio({
                  ...nuovoSocio,
                  percentuale_partecipazione:
                    e.target.value,
                })
              }
            />
          </div>

          <div>
            <label style={labelStyle}>
              Importo lordo
            </label>

            <input
              style={inputStyle}
              value={nuovoSocio.importo_utile}
              onChange={(e) =>
                setNuovoSocio({
                  ...nuovoSocio,
                  importo_utile:
                    e.target.value,
                })
              }
            />
          </div>

          <div>
            <button
              type="button"
              onClick={async () => {
                const res = await fetch(
                  `/api/pratiche/${praticaId}/soci`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type":
                        "application/json",
                    },
                    body: JSON.stringify({
                      ...nuovoSocio,
                      importo_ritenuta:
                        importoRitenutaNuovoSocio,
                      importo_netto:
                        importoNettoNuovoSocio,
                    }),
                  }
                );

                if (!res.ok) {
                  alert(
                    "Errore inserimento socio"
                  );
                  return;
                }

                await caricaSoci();
              }}
              style={{
                border: 0,
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: font,
              }}
            >
              Aggiungi
            </button>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
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
              </tr>
            </thead>

            <tbody>
              {soci.map((s) => (
                <tr key={s.id}>
                  <td style={tdStyle}>
                    {s.nome_cognome}
                  </td>

                  <td style={tdStyle}>
                    {s.codice_fiscale}
                  </td>

                  <td style={tdStyle}>
                    {Number(
                      s.percentuale_partecipazione || 0
                    ).toFixed(2)}
                    %
                  </td>

                  <td style={tdStyle}>
                    {Number(
                      s.importo_utile || 0
                    ).toFixed(2)}
                  </td>

                  <td style={tdStyle}>
                    {Number(
                      s.importo_ritenuta || 0
                    ).toFixed(2)}
                  </td>

                  <td style={tdStyle}>
                    {Number(
                      s.importo_netto || 0
                    ).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
