"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Head from "next/head";
import { useRouter } from "next/router";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  FilterX,
  Loader2,
  RefreshCcw,
  Search,
  TimerReset,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type StatoScadenza =
  | "scaduta"
  | "scade_oggi"
  | "in_scadenza_7_giorni"
  | "in_scadenza_30_giorni"
  | "futura"
  | "completata"
  | "annullata"
  | "sospesa";

type ScadenzaCentrale = {
  id: string;

  studio_id: string;
  cliente_id: string | null;
  operatore_responsabile_id: string | null;

  origine_modulo: string;
  origine_tabella: string;
  origine_record_id: string;
  tipo_scadenza: string;

  titolo: string;
  descrizione: string | null;

  data_scadenza: string;

  stato_archiviato: string;
  stato_calcolato: StatoScadenza;

  giorni_residui: number;
  giorni_scaduta_da: number;

  priorita:
    | "bassa"
    | "normale"
    | "alta"
    | "urgente";

  giorni_preavviso_1: number | null;
  giorni_preavviso_2: number | null;
  giorni_preavviso_3: number | null;

  numero_alert_inviati: number;
  ultimo_alert_inviato_at: string | null;
  prossimo_alert_at: string | null;

  link_dettaglio: string | null;
  metadati: Record<string, any> | null;

  completata_at: string | null;
  annullata_at: string | null;

  created_at: string;
  updated_at: string;

  cliente: string | null;
  cliente_codice_fiscale: string | null;

  operatore_responsabile: string | null;
  operatore_email: string | null;
  operatore_settore: string | null;

  alert_inviati_effettivi: number;
  alert_con_errore: number;
  data_ultimo_alert_effettivo: string | null;
};

type FiltroOperatore = {
  id: string;
  nome: string;
};

type FiltroCliente = {
  id: string;
  nome: string;
};

type FiltroStato = {
  valore: StatoScadenza;
  etichetta: string;
};

type RispostaApi = {
  success: boolean;

  studio_id: string;

  utente: {
    id: string;
    nome: string;
    cognome: string;
    email: string;
    tipo_utente: string;
  };

  riepilogo: {
    totale: number;
    scadute: number;
    scadono_oggi: number;
    entro_7_giorni: number;
    entro_30_giorni: number;
    future: number;
    completate: number;
    senza_operatore: number;
    con_errori_alert: number;
  };

  filtri: {
    moduli: string[];
    operatori: FiltroOperatore[];
    clienti: FiltroCliente[];
    stati: FiltroStato[];
  };

  scadenze: ScadenzaCentrale[];
  numero_scadenze: number;
};

type FiltriPagina = {
  ricerca: string;
  stato: string;
  origine_modulo: string;
  operatore_id: string;
  cliente_id: string;
  data_dal: string;
  data_al: string;
};

const filtriIniziali: FiltriPagina = {
  ricerca: "",
  stato: "",
  origine_modulo: "",
  operatore_id: "",
  cliente_id: "",
  data_dal: "",
  data_al: "",
};

function formattaData(
  valore: string | null | undefined
): string {
  if (!valore) {
    return "—";
  }

  const soloData = String(valore)
    .trim()
    .slice(0, 10);

  const parti = soloData.split("-");

  if (parti.length !== 3) {
    return "—";
  }

  const [anno, mese, giorno] =
    parti.map(Number);

  if (!anno || !mese || !giorno) {
    return "—";
  }

  const data = new Date(
    anno,
    mese - 1,
    giorno
  );

  if (Number.isNaN(data.getTime())) {
    return "—";
  }

  return data.toLocaleDateString(
    "it-IT"
  );
}

function formattaDataOra(
  valore: string | null | undefined
): string {
  if (!valore) {
    return "—";
  }

  const data = new Date(valore);

  if (Number.isNaN(data.getTime())) {
    return "—";
  }

  return data.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function etichettaStato(
  stato: StatoScadenza
): string {
  switch (stato) {
    case "scaduta":
      return "Scaduta";

    case "scade_oggi":
      return "Scade oggi";

    case "in_scadenza_7_giorni":
      return "Entro 7 giorni";

    case "in_scadenza_30_giorni":
      return "Entro 30 giorni";

    case "futura":
      return "Futura";

    case "completata":
      return "Completata";

    case "annullata":
      return "Annullata";

    case "sospesa":
      return "Sospesa";

    default:
      return stato;
  }
}

function getStatoStyle(
  stato: StatoScadenza
): React.CSSProperties {
  switch (stato) {
    case "scaduta":
      return {
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      };

    case "scade_oggi":
      return {
        background: "#ffedd5",
        color: "#9a3412",
        border: "1px solid #fed7aa",
      };

    case "in_scadenza_7_giorni":
      return {
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      };

    case "in_scadenza_30_giorni":
      return {
        background: "#fef9c3",
        color: "#854d0e",
        border: "1px solid #fef08a",
      };

    case "futura":
      return {
        background: "#dbeafe",
        color: "#1e40af",
        border: "1px solid #bfdbfe",
      };

    case "completata":
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #bbf7d0",
      };

    case "annullata":
      return {
        background: "#e2e8f0",
        color: "#475569",
        border: "1px solid #cbd5e1",
      };

    case "sospesa":
      return {
        background: "#f3e8ff",
        color: "#6b21a8",
        border: "1px solid #e9d5ff",
      };

    default:
      return {
        background: "#f1f5f9",
        color: "#475569",
        border: "1px solid #e2e8f0",
      };
  }
}

function descrizioneGiorni(
  scadenza: ScadenzaCentrale
): string {
  if (
    scadenza.stato_calcolato ===
    "completata"
  ) {
    return "Completata";
  }

  if (
    scadenza.stato_calcolato ===
    "annullata"
  ) {
    return "Annullata";
  }

  if (
    scadenza.stato_calcolato ===
    "sospesa"
  ) {
    return "Sospesa";
  }

  if (
    scadenza.giorni_residui < 0
  ) {
    const giorni = Math.abs(
      scadenza.giorni_residui
    );

    return `Scaduta da ${giorni} ${
      giorni === 1 ? "giorno" : "giorni"
    }`;
  }

  if (
    scadenza.giorni_residui === 0
  ) {
    return "Scade oggi";
  }

  return `Mancano ${
    scadenza.giorni_residui
  } ${
    scadenza.giorni_residui === 1
      ? "giorno"
      : "giorni"
  }`;
}

export default function ScadenzeCentralePage() {
  const router = useRouter();

  const [
    dati,
    setDati,
  ] = useState<RispostaApi | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errore,
    setErrore,
  ] = useState("");

  const [
    filtri,
    setFiltri,
  ] = useState<FiltriPagina>(
    filtriIniziali
  );

  const [
    filtriApplicati,
    setFiltriApplicati,
  ] = useState<FiltriPagina>(
    filtriIniziali
  );

  const [
    pagina,
    setPagina,
  ] = useState(1);

  const righePerPagina = 25;

  const caricaScadenze =
    useCallback(async () => {
      setLoading(true);
      setErrore("");

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
            "Sessione non valida. Effettua nuovamente l'accesso."
          );
        }

        const params =
          new URLSearchParams();

        Object.entries(
          filtriApplicati
        ).forEach(([chiave, valore]) => {
          const valorePulito =
            String(valore || "").trim();

          if (valorePulito) {
            params.set(
              chiave,
              valorePulito
            );
          }
        });

        const queryString =
          params.toString();

        const response = await fetch(
          `/api/scadenze-centrale${
            queryString
              ? `?${queryString}`
              : ""
          }`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );

        const risposta =
          await response.json();

        if (!response.ok) {
          throw new Error(
            risposta.error ||
              "Errore durante il caricamento delle scadenze."
          );
        }

        setDati(
          risposta as RispostaApi
        );
      } catch (error: any) {
        console.error(
          "Errore caricamento scadenze:",
          error
        );

        setErrore(
          error?.message ||
            "Errore durante il caricamento delle scadenze."
        );

        setDati(null);
      } finally {
        setLoading(false);
      }
    }, [filtriApplicati]);

  useEffect(() => {
    void caricaScadenze();
  }, [caricaScadenze]);

  useEffect(() => {
    setPagina(1);
  }, [filtriApplicati]);

  const scadenze =
    dati?.scadenze || [];

  const numeroPagine =
    Math.max(
      1,
      Math.ceil(
        scadenze.length /
          righePerPagina
      )
    );

  const scadenzePagina =
    useMemo(() => {
      const indiceInizio =
        (pagina - 1) *
        righePerPagina;

      return scadenze.slice(
        indiceInizio,
        indiceInizio +
          righePerPagina
      );
    }, [scadenze, pagina]);

  function applicaFiltri() {
    setFiltriApplicati({
      ...filtri,
      ricerca:
        filtri.ricerca.trim(),
    });
  }

  function azzeraFiltri() {
    setFiltri(filtriIniziali);
    setFiltriApplicati(
      filtriIniziali
    );
  }

  function gestisciInvioRicerca(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    applicaFiltri();
  }

  function apriScadenza(
    scadenza: ScadenzaCentrale
  ) {
    if (!scadenza.link_dettaglio) {
      return;
    }

    router.push(
      scadenza.link_dettaglio
    );
  }

  const riepilogo =
    dati?.riepilogo;

  return (
    <>
      <Head>
        <title>
          Scadenze | Studio Manager Pro
        </title>
      </Head>

      <main style={pageStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={pageTitleStyle}>
              Scadenze
            </h1>

            <p style={pageSubtitleStyle}>
              Riepilogo unico delle
              scadenze provenienti da
              tutti i moduli di Studio
              Manager Pro.
            </p>
          </div>

          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() =>
              void caricaScadenze()
            }
            disabled={loading}
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

        {errore && (
          <div style={errorBoxStyle}>
            <CircleAlert size={19} />

            <div>
              <div
                style={{
                  fontWeight: 800,
                }}
              >
                Errore caricamento
              </div>

              <div
                style={{
                  marginTop: 3,
                }}
              >
                {errore}
              </div>
            </div>
          </div>
        )}

        <section style={cardsGridStyle}>
          <SummaryCard
            titolo="Totale"
            valore={
              riepilogo?.totale || 0
            }
            descrizione="Tutte le scadenze"
            icona={
              <CalendarClock
                size={21}
              />
            }
          />

          <SummaryCard
            titolo="Scadute"
            valore={
              riepilogo?.scadute || 0
            }
            descrizione="Da gestire"
            icona={
              <AlertCircle size={21} />
            }
            evidenza={
              (riepilogo?.scadute ||
                0) > 0
            }
          />

          <SummaryCard
            titolo="Oggi"
            valore={
              riepilogo?.scadono_oggi ||
              0
            }
            descrizione="Scadono oggi"
            icona={<Clock3 size={21} />}
            evidenza={
              (riepilogo
                ?.scadono_oggi || 0) >
              0
            }
          />

          <SummaryCard
            titolo="Entro 7 giorni"
            valore={
              riepilogo
                ?.entro_7_giorni || 0
            }
            descrizione="Priorità immediata"
            icona={
              <TimerReset size={21} />
            }
          />

          <SummaryCard
            titolo="Entro 30 giorni"
            valore={
              riepilogo
                ?.entro_30_giorni || 0
            }
            descrizione="Da programmare"
            icona={
              <CalendarClock
                size={21}
              />
            }
          />

          <SummaryCard
            titolo="Future"
            valore={
              riepilogo?.future || 0
            }
            descrizione="Oltre 30 giorni"
            icona={
              <ChevronRight size={21} />
            }
          />

          <SummaryCard
            titolo="Senza operatore"
            valore={
              riepilogo
                ?.senza_operatore || 0
            }
            descrizione="Da assegnare"
            icona={
              <CircleAlert size={21} />
            }
            evidenza={
              (riepilogo
                ?.senza_operatore ||
                0) > 0
            }
          />

          <SummaryCard
            titolo="Errori alert"
            valore={
              riepilogo
                ?.con_errori_alert || 0
            }
            descrizione="Invii da verificare"
            icona={
              <AlertCircle size={21} />
            }
            evidenza={
              (riepilogo
                ?.con_errori_alert ||
                0) > 0
            }
          />
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
                Filtri
              </h2>

              <p
                style={
                  sectionSubtitleStyle
                }
              >
                Ricerca per modulo,
                operatore, cliente, stato
                o intervallo di date.
              </p>
            </div>

            <button
              type="button"
              style={linkButtonStyle}
              onClick={azzeraFiltri}
            >
              <FilterX size={16} />
              Azzera filtri
            </button>
          </div>

          <form
            onSubmit={
              gestisciInvioRicerca
            }
          >
            <div style={filtersGridStyle}>
              <div
                style={{
                  gridColumn:
                    "span 2",
                }}
              >
                <label style={labelStyle}>
                  Ricerca
                </label>

                <div
                  style={{
                    position: "relative",
                  }}
                >
                  <Search
                    size={16}
                    style={{
                      position:
                        "absolute",
                      left: 12,
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      color: "#64748b",
                    }}
                  />

                  <input
                    type="text"
                    style={{
                      ...inputStyle,
                      paddingLeft: 38,
                    }}
                    value={
                      filtri.ricerca
                    }
                    onChange={(event) =>
                      setFiltri(
                        (precedente) => ({
                          ...precedente,
                          ricerca:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="Cliente, titolo, operatore o modulo"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Stato
                </label>

                <select
                  style={inputStyle}
                  value={filtri.stato}
                  onChange={(event) =>
                    setFiltri(
                      (precedente) => ({
                        ...precedente,
                        stato:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    Tutti
                  </option>

                  {dati?.filtri.stati.map(
                    (stato) => (
                      <option
                        key={stato.valore}
                        value={stato.valore}
                      >
                        {stato.etichetta}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Modulo
                </label>

                <select
                  style={inputStyle}
                  value={
                    filtri.origine_modulo
                  }
                  onChange={(event) =>
                    setFiltri(
                      (precedente) => ({
                        ...precedente,
                        origine_modulo:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    Tutti i moduli
                  </option>

                  {dati?.filtri.moduli.map(
                    (modulo) => (
                      <option
                        key={modulo}
                        value={modulo}
                      >
                        {modulo}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Operatore
                </label>

                <select
                  style={inputStyle}
                  value={
                    filtri.operatore_id
                  }
                  onChange={(event) =>
                    setFiltri(
                      (precedente) => ({
                        ...precedente,
                        operatore_id:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    Tutti gli operatori
                  </option>

                  {dati?.filtri.operatori.map(
                    (operatore) => (
                      <option
                        key={operatore.id}
                        value={operatore.id}
                      >
                        {operatore.nome}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Cliente
                </label>

                <select
                  style={inputStyle}
                  value={
                    filtri.cliente_id
                  }
                  onChange={(event) =>
                    setFiltri(
                      (precedente) => ({
                        ...precedente,
                        cliente_id:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    Tutti i clienti
                  </option>

                  {dati?.filtri.clienti.map(
                    (cliente) => (
                      <option
                        key={cliente.id}
                        value={cliente.id}
                      >
                        {cliente.nome}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Data dal
                </label>

                <input
                  type="date"
                  style={inputStyle}
                  value={filtri.data_dal}
                  onChange={(event) =>
                    setFiltri(
                      (precedente) => ({
                        ...precedente,
                        data_dal:
                          event.target
                            .value,
                      })
                    )
                  }
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Data al
                </label>

                <input
                  type="date"
                  style={inputStyle}
                  value={filtri.data_al}
                  onChange={(event) =>
                    setFiltri(
                      (precedente) => ({
                        ...precedente,
                        data_al:
                          event.target
                            .value,
                      })
                    )
                  }
                />
              </div>
            </div>

            <div style={filtersActionsStyle}>
              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={loading}
              >
                <Search size={16} />
                Applica filtri
              </button>
            </div>
          </form>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
                Elenco scadenze
              </h2>

              <p
                style={
                  sectionSubtitleStyle
                }
              >
                {loading
                  ? "Caricamento in corso..."
                  : `${dati?.numero_scadenze || 0} scadenze trovate`}
              </p>
            </div>
          </div>

          {loading ? (
            <div style={loadingBoxStyle}>
              <Loader2
                size={24}
                className="animate-spin"
              />

              Caricamento scadenze...
            </div>
          ) : scadenzePagina.length ===
            0 ? (
            <div style={emptyBoxStyle}>
              Nessuna scadenza trovata con
              i filtri selezionati.
            </div>
          ) : (
            <div style={tableWrapperStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>
                      Stato
                    </th>

                    <th style={thStyle}>
                      Scadenza
                    </th>

                    <th style={thStyle}>
                      Origine
                    </th>

                    <th style={thStyle}>
                      Cliente
                    </th>

                    <th style={thStyle}>
                      Oggetto
                    </th>

                    <th style={thStyle}>
                      Operatore
                    </th>

                    <th style={thStyle}>
                      Alert
                    </th>

                    <th style={thStyle}>
                      Prossimo alert
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
                  {scadenzePagina.map(
                    (scadenza) => (
                      <tr
                        key={scadenza.id}
                        style={trStyle}
                      >
                        <td style={tdStyle}>
                          <span
                            style={{
                              ...statusBadgeStyle,
                              ...getStatoStyle(
                                scadenza.stato_calcolato
                              ),
                            }}
                          >
                            {etichettaStato(
                              scadenza.stato_calcolato
                            )}
                          </span>

                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 11,
                              color:
                                scadenza
                                  .giorni_residui <
                                0
                                  ? "#b91c1c"
                                  : "#64748b",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {descrizioneGiorni(
                              scadenza
                            )}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: 800,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {formattaData(
                              scadenza.data_scadenza
                            )}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: 700,
                            }}
                          >
                            {
                              scadenza.origine_modulo
                            }
                          </div>

                          <div
                            style={
                              smallMutedStyle
                            }
                          >
                            {
                              scadenza.tipo_scadenza
                            }
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: 700,
                            }}
                          >
                            {scadenza.cliente ||
                              "—"}
                          </div>

                          {scadenza.cliente_codice_fiscale && (
                            <div
                              style={
                                smallMutedStyle
                              }
                            >
                              CF:{" "}
                              {
                                scadenza.cliente_codice_fiscale
                              }
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: 700,
                            }}
                          >
                            {
                              scadenza.titolo
                            }
                          </div>

                          {scadenza.descrizione &&
                            scadenza.descrizione !==
                              scadenza.titolo && (
                              <div
                                style={{
                                  ...smallMutedStyle,
                                  marginTop: 4,
                                  maxWidth: 320,
                                }}
                              >
                                {
                                  scadenza.descrizione
                                }
                              </div>
                            )}
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              fontWeight: 700,
                            }}
                          >
                            {scadenza.operatore_responsabile ||
                              "Non assegnato"}
                          </div>

                          {scadenza.operatore_email && (
                            <div
                              style={
                                smallMutedStyle
                              }
                            >
                              {
                                scadenza.operatore_email
                              }
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: 6,
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle2
                              size={14}
                            />

                            {
                              scadenza.alert_inviati_effettivi
                            }{" "}
                            inviati
                          </div>

                          {scadenza.alert_con_errore >
                            0 && (
                            <div
                              style={{
                                marginTop: 5,
                                color:
                                  "#b91c1c",
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              {
                                scadenza.alert_con_errore
                              }{" "}
                              errori
                            </div>
                          )}

                          {scadenza.data_ultimo_alert_effettivo && (
                            <div
                              style={
                                smallMutedStyle
                              }
                            >
                              Ultimo:{" "}
                              {formattaDataOra(
                                scadenza.data_ultimo_alert_effettivo
                              )}
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {formattaDataOra(
                            scadenza.prossimo_alert_at
                          )}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            textAlign:
                              "center",
                          }}
                        >
                          {scadenza.link_dettaglio ? (
                            <button
                              type="button"
                              style={
                                iconButtonStyle
                              }
                              title="Apri il modulo di origine"
                              onClick={() =>
                                apriScadenza(
                                  scadenza
                                )
                              }
                            >
                              <ExternalLink
                                size={16}
                              />
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading &&
            scadenze.length >
              righePerPagina && (
              <div
                style={
                  paginationStyle
                }
              >
                <button
                  type="button"
                  style={
                    paginationButtonStyle
                  }
                  disabled={pagina <= 1}
                  onClick={() =>
                    setPagina(
                      (precedente) =>
                        Math.max(
                          1,
                          precedente - 1
                        )
                    )
                  }
                >
                  Precedente
                </button>

                <div
                  style={{
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Pagina {pagina} di{" "}
                  {numeroPagine}
                </div>

                <button
                  type="button"
                  style={
                    paginationButtonStyle
                  }
                  disabled={
                    pagina >=
                    numeroPagine
                  }
                  onClick={() =>
                    setPagina(
                      (precedente) =>
                        Math.min(
                          numeroPagine,
                          precedente + 1
                        )
                    )
                  }
                >
                  Successiva
                </button>
              </div>
            )}
        </section>
      </main>
    </>
  );
}

function SummaryCard({
  titolo,
  valore,
  descrizione,
  icona,
  evidenza = false,
}: {
  titolo: string;
  valore: number;
  descrizione: string;
  icona: React.ReactNode;
  evidenza?: boolean;
}) {
  return (
    <div
      style={{
        ...summaryCardStyle,
        borderColor: evidenza
          ? "#fca5a5"
          : "#e2e8f0",
        background: evidenza
          ? "#fff7f7"
          : "#ffffff",
      }}
    >
      <div style={summaryIconStyle}>
        {icona}
      </div>

      <div>
        <div
          style={{
            color: "#64748b",
            fontSize: 12,
            fontWeight: 800,
            textTransform:
              "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {titolo}
        </div>

        <div
          style={{
            marginTop: 3,
            fontSize: 27,
            lineHeight: 1,
            fontWeight: 900,
            color: evidenza
              ? "#b91c1c"
              : "#0f172a",
          }}
        >
          {valore}
        </div>

        <div
          style={{
            marginTop: 6,
            color: "#64748b",
            fontSize: 12,
          }}
        >
          {descrizione}
        </div>
      </div>
    </div>
  );
}

const pageStyle:
  React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background: "#f8fafc",
};

const headerStyle:
  React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
};

const pageTitleStyle:
  React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  fontWeight: 400,
  color: "#0f172a",
};

const pageSubtitleStyle:
  React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const cardsGridStyle:
  React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 22,
};

const summaryCardStyle:
  React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 13,
  minHeight: 100,
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow:
    "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const summaryIconStyle:
  React.CSSProperties = {
  width: 42,
  height: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: 10,
  color: "#1d4ed8",
  background: "#eff6ff",
};

const cardStyle:
  React.CSSProperties = {
  marginTop: 18,
  padding: 20,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#ffffff",
  boxShadow:
    "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const sectionHeaderStyle:
  React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
};

const sectionTitleStyle:
  React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 19,
  fontWeight: 800,
};

const sectionSubtitleStyle:
  React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const filtersGridStyle:
  React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 18,
};

const filtersActionsStyle:
  React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 14,
};

const labelStyle:
  React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#334155",
  fontSize: 12,
  fontWeight: 700,
};

const inputStyle:
  React.CSSProperties = {
  width: "100%",
  minHeight: 38,
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  outline: "none",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 13,
  boxSizing: "border-box",
};

const primaryButtonStyle:
  React.CSSProperties = {
  minHeight: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "8px 15px",
  border: "1px solid #2563eb",
  borderRadius: 8,
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle:
  React.CSSProperties = {
  minHeight: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "8px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
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
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const tableWrapperStyle:
  React.CSSProperties = {
  marginTop: 18,
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
};

const tableStyle:
  React.CSSProperties = {
  width: "100%",
  minWidth: 1450,
  borderCollapse: "collapse",
};

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
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};

const tdStyle:
  React.CSSProperties = {
  padding: "12px",
  borderBottom:
    "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 13,
  verticalAlign: "top",
};

const trStyle:
  React.CSSProperties = {
  background: "#ffffff",
};

const smallMutedStyle:
  React.CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 11,
};

const statusBadgeStyle:
  React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: "nowrap",
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

const paginationStyle:
  React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  marginTop: 18,
};

const paginationButtonStyle:
  React.CSSProperties = {
  minHeight: 34,
  padding: "7px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#334155",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const loadingBoxStyle:
  React.CSSProperties = {
  minHeight: 170,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  color: "#64748b",
  fontSize: 14,
};

const emptyBoxStyle:
  React.CSSProperties = {
  marginTop: 18,
  padding: 28,
  border: "1px dashed #cbd5e1",
  borderRadius: 10,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
};

const errorBoxStyle:
  React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  marginTop: 18,
  padding: 14,
  border: "1px solid #fecaca",
  borderRadius: 10,
  background: "#fee2e2",
  color: "#991b1b",
  fontSize: 13,
};
