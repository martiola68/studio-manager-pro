import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import Head from "next/head";
import { useRouter } from "next/router";

import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCcw,
  RotateCcw,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type AlertNonInviato = {
  log_id: string;
  scadenza_id: string;

  cliente: string | null;
  cliente_id: string | null;

  origine_modulo: string;
  titolo: string;
  descrizione: string | null;
  data_scadenza: string;

  operatore: string | null;
  operatore_email: string | null;
  destinatario_email: string | null;

  errore: string | null;
  tipo_alert: string | null;
  data_tentativo: string;

  link_dettaglio: string | null;
};

function formattaData(
  valore: string | null | undefined
) {
  if (!valore) {
    return "—";
  }

  const data = new Date(valore);

  if (Number.isNaN(data.getTime())) {
    return "—";
  }

  return data.toLocaleString(
    "it-IT",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

function formattaSoloData(
  valore: string | null | undefined
) {
  if (!valore) {
    return "—";
  }

  const data = new Date(
    `${valore.slice(0, 10)}T00:00:00`
  );

  if (Number.isNaN(data.getTime())) {
    return "—";
  }

  return data.toLocaleDateString(
    "it-IT"
  );
}

function formattaErrore(
  errore: string | null
) {
  if (!errore) {
    return "Errore non specificato";
  }

  try {
    const parsed =
      JSON.parse(errore);

    return (
      parsed?.error ||
      parsed?.message ||
      errore
    );
  } catch {
    return errore;
  }
}

export default function AlertNonInviatiPage() {
  const router = useRouter();

  const [
    errori,
    setErrori,
  ] = useState<AlertNonInviato[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

 const [
  erroreCaricamento,
  setErroreCaricamento,
] = useState("");

const [
  retryInCorsoId,
  setRetryInCorsoId,
] = useState<string | null>(null);

const [
  messaggioOperazione,
  setMessaggioOperazione,
] = useState("");

  const caricaErrori =
    useCallback(async () => {
      setLoading(true);
      setErroreCaricamento("");

      try {
        const supabase =
          getSupabaseClient();

        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const accessToken =
          sessionData.session
            ?.access_token;

        if (!accessToken) {
          throw new Error(
            "Sessione non valida."
          );
        }

        const response = await fetch(
          "/api/scadenze-centrale/alert-non-inviati",
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );

        const risultato =
          await response.json();

        if (!response.ok) {
          throw new Error(
            risultato.error ||
              "Errore caricamento."
          );
        }

        setErrori(
          risultato.errori || []
        );
      } catch (error: any) {
        setErroreCaricamento(
          error?.message ||
            "Errore durante il caricamento."
        );
      } finally {
        setLoading(false);
      }
    }, []);

useEffect(() => {
  void caricaErrori();
}, [caricaErrori]);

async function riprovaInvio(
  scadenzaId: string
) {
  setRetryInCorsoId(
    scadenzaId
  );

  setMessaggioOperazione("");
  setErroreCaricamento("");

  try {
    const supabase =
      getSupabaseClient();

    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken =
      sessionData.session
        ?.access_token;

    if (!accessToken) {
      throw new Error(
        "Sessione non valida."
      );
    }

    const response = await fetch(
      "/api/scadenze-centrale/riprova-alert",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          scadenza_id:
            scadenzaId,
        }),
      }
    );

    const risultato =
      await response.json();

    if (!response.ok) {
      throw new Error(
        risultato.error ||
          "Errore durante il nuovo tentativo."
      );
    }

    const numeroInviati =
      Number(
        risultato?.risultato
          ?.inviati || 0
      );

    if (numeroInviati < 1) {
      throw new Error(
        risultato?.risultato
          ?.dettagli?.[0]
          ?.messaggio ||
          "Invio non confermato."
      );
    }

    setMessaggioOperazione(
      "Alert inviato correttamente."
    );

    await caricaErrori();
  } catch (error: any) {
    setErroreCaricamento(
      error?.message ||
        "Errore durante il nuovo tentativo."
    );
  } finally {
    setRetryInCorsoId(null);
  }
}

return (
    <>
      <Head>
        <title>
          Alert non inviati | Studio Manager Pro
        </title>
      </Head>

      <main
        style={{
          minHeight: "100vh",
          padding: 28,
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div>
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/scadenze"
                )
              }
              style={linkButtonStyle}
            >
              <ArrowLeft size={16} />
              Torna alle scadenze
            </button>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: 32,
                fontWeight: 400,
              }}
            >
              Alert non inviati
            </h1>

            <p
              style={{
                margin: "7px 0 0",
                color: "#64748b",
                fontSize: 14,
              }}
            >
              Sono mostrati soltanto
              gli ultimi tentativi
              ancora in errore.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void caricaErrori()
            }
            disabled={loading}
            style={secondaryButtonStyle}
          >
            {loading ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <RefreshCcw size={16} />
            )}

            Aggiorna
          </button>
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 18,
            border:
              errori.length > 0
                ? "1px solid #fca5a5"
                : "1px solid #bbf7d0",
            borderRadius: 12,
            background:
              errori.length > 0
                ? "#fff7f7"
                : "#f0fdf4",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <AlertCircle
              size={22}
              color={
                errori.length > 0
                  ? "#b91c1c"
                  : "#166534"
              }
            />

            <div>
              <div
                style={{
                  fontSize: 27,
                  fontWeight: 900,
                  color:
                    errori.length > 0
                      ? "#b91c1c"
                      : "#166534",
                }}
              >
                {errori.length}
              </div>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Alert attualmente non
                inviati
              </div>
            </div>
          </div>
        </div>

        {messaggioOperazione && (
  <div
    style={{
      marginTop: 18,
      padding: 14,
      border:
        "1px solid #bbf7d0",
      borderRadius: 10,
      background: "#f0fdf4",
      color: "#166534",
      fontWeight: 700,
    }}
  >
    {messaggioOperazione}
  </div>
)}

{erroreCaricamento && (
  <div
            style={{
              marginTop: 18,
              padding: 14,
              border:
                "1px solid #fecaca",
              borderRadius: 10,
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {erroreCaricamento}
          </div>
        )}

        <section
          style={{
            marginTop: 18,
            padding: 20,
            border:
              "1px solid #e2e8f0",
            borderRadius: 12,
            background: "#ffffff",
          }}
        >
          {loading ? (
            <div
              style={{
                minHeight: 160,
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "center",
                gap: 10,
                color: "#64748b",
              }}
            >
              <Loader2
                size={22}
                className="animate-spin"
              />

              Caricamento...
            </div>
          ) : errori.length === 0 ? (
            <div
              style={{
                padding: 32,
                border:
                  "1px dashed #bbf7d0",
                borderRadius: 10,
                background: "#f0fdf4",
                color: "#166534",
                textAlign: "center",
                fontWeight: 700,
              }}
            >
              Tutti gli alert risultano
              inviati correttamente.
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                border:
                  "1px solid #e2e8f0",
                borderRadius: 10,
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: 1250,
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>
                      Tentativo
                    </th>
                    <th style={thStyle}>
                      Cliente
                    </th>
                    <th style={thStyle}>
                      Modulo
                    </th>
                    <th style={thStyle}>
                      Oggetto
                    </th>
                    <th style={thStyle}>
                      Scadenza
                    </th>
                    <th style={thStyle}>
                      Operatore
                    </th>
                    <th style={thStyle}>
                      Errore
                    </th>
                    <th
                      style={{
                        ...thStyle,
                        textAlign:
                          "center",
                      }}
                    >
                      Azioni
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {errori.map(
                    (item) => (
                      <tr
                        key={
                          item.scadenza_id
                        }
                      >
                        <td style={tdStyle}>
                          {formattaData(
                            item.data_tentativo
                          )}
                        </td>

                        <td style={tdStyle}>
                          <strong>
                            {item.cliente ||
                              "—"}
                          </strong>
                        </td>

                        <td style={tdStyle}>
                          {
                            item.origine_modulo
                          }
                        </td>

                        <td style={tdStyle}>
                          <strong>
                            {item.titolo}
                          </strong>

                          {item.descrizione && (
                            <div
                              style={{
                                marginTop: 4,
                                color:
                                  "#64748b",
                                fontSize: 11,
                              }}
                            >
                              {
                                item.descrizione
                              }
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {formattaSoloData(
                            item.data_scadenza
                          )}
                        </td>

                        <td style={tdStyle}>
                          <strong>
                            {item.operatore ||
                              "—"}
                          </strong>

                          <div
                            style={{
                              marginTop: 3,
                              color:
                                "#64748b",
                              fontSize: 11,
                            }}
                          >
                            {item.operatore_email ||
                              item.destinatario_email ||
                              "—"}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              maxWidth: 360,
                              color:
                                "#b91c1c",
                              fontWeight: 700,
                            }}
                          >
                            {formattaErrore(
                              item.errore
                            )}
                          </div>
                        </td>

                       <td
  style={{
    ...tdStyle,
    textAlign: "center",
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    }}
  >
    <button
      type="button"
      title="Riprova invio"
      onClick={() =>
        void riprovaInvio(
          item.scadenza_id
        )
      }
      disabled={
        retryInCorsoId ===
        item.scadenza_id
      }
      style={{
        ...retryButtonStyle,

        opacity:
          retryInCorsoId ===
          item.scadenza_id
            ? 0.6
            : 1,

        cursor:
          retryInCorsoId ===
          item.scadenza_id
            ? "not-allowed"
            : "pointer",
      }}
    >
      {retryInCorsoId ===
      item.scadenza_id ? (
        <Loader2
          size={16}
          className="animate-spin"
        />
      ) : (
        <RotateCcw
          size={16}
        />
      )}
    </button>

    {item.link_dettaglio && (
      <button
        type="button"
        title="Apri scadenza"
        onClick={() =>
          router.push(
            item.link_dettaglio!
          )
        }
        style={
          iconButtonStyle
        }
      >
        <ExternalLink
          size={16}
        />
      </button>
    )}
  </div>
</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

const thStyle:
  React.CSSProperties = {
  padding: "11px 12px",
  borderBottom:
    "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#475569",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle:
  React.CSSProperties = {
  padding: 12,
  borderBottom:
    "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 13,
  verticalAlign: "top",
};

const linkButtonStyle:
  React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "#2563eb",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle:
  React.CSSProperties = {
  minHeight: 38,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const retryButtonStyle:
  React.CSSProperties = {
  width: 34,
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #fde68a",
  borderRadius: 8,
  background: "#fffbeb",
  color: "#b45309",
};

const iconButtonStyle:
  React.CSSProperties = {
  width: 34,
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  background: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
};
