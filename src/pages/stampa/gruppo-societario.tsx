import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Building2,
  Printer,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type TitolareEffettivoView = {
  persona_id: string;
  persona_nome: string;

  quota_diretta: number;
  quota_indiretta: number;
  quota_complessiva: number;

  tipo_titolarita:
    | "diretta"
    | "indiretta"
    | "diretta_e_indiretta"
    | "residuale";

  criterio_titolarita?:
    | "proprieta"
    | "residuale";

  ruolo?: string | null;
  carica?: string | null;
  principale?: boolean;
};

type SocietaCollegataView = {
  societa_id: string;
  societa_nome: string;
  quota: number;
  classificazione: string;

  titolari_effettivi?: TitolareEffettivoView[];
};

type SocietaGruppo = {
  id: string;
  nome: string;

  ruolo_nel_gruppo:
    | "capogruppo"
    | "controllata_diretta"
    | "controllata_indiretta";

  livello: number;

  controllante_diretta: {
    id: string;
    nome: string;
    quota: number;
  } | null;

  societa_collegate: SocietaCollegataView[];

  titolari_effettivi: TitolareEffettivoView[];
};

type GruppoSocietario = {
  id: string;
  denominazione: string;

  capogruppo: {
    id: string;
    nome: string;
  };

  riepilogo: {
    numero_societa: number;
    numero_controllate_dirette: number;
    numero_controllate_indirette: number;
    numero_collegate: number;
    numero_titolari_effettivi: number;
    livelli_gruppo: number;
  };

  societa: SocietaGruppo[];
};

type ApiResponse = {
  gruppi_dettaglio?: GruppoSocietario[];
  error?: string;
};

type CollegataGruppo = SocietaCollegataView & {
  collegata_da_id: string;
  collegata_da_nome: string;
};

function formattaPercentuale(value: number) {
  return `${Number(value || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })}%`;
}

function getEtichettaRuolo(
  ruolo: SocietaGruppo["ruolo_nel_gruppo"]
) {
  if (ruolo === "capogruppo") {
    return "Capogruppo";
  }

  if (ruolo === "controllata_diretta") {
    return "Controllata diretta";
  }

  return "Controllata indiretta";
}

function getEtichettaTitolarita(
  tipo: TitolareEffettivoView["tipo_titolarita"]
) {
  if (tipo === "diretta") {
    return "Proprietà diretta";
  }

  if (tipo === "indiretta") {
    return "Proprietà indiretta";
  }

  if (tipo === "diretta_e_indiretta") {
    return "Proprietà diretta e indiretta";
  }

  return "Criterio residuale";
}

export default function StampaGruppoSocietarioPage() {
  const router = useRouter();

  const [gruppi, setGruppi] = useState<
    GruppoSocietario[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");

  const gruppoId =
    typeof router.query.id === "string"
      ? router.query.id
      : "";

  useEffect(() => {
    if (!router.isReady || !gruppoId) {
      return;
    }

    async function caricaDati() {
      setLoading(true);
      setErrore("");

      try {
        const response = await fetch(
          "/api/gruppi-societari",
          {
            cache: "no-store",
          }
        );

        const data: ApiResponse =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Errore caricamento gruppo societario"
          );
        }

        setGruppi(data.gruppi_dettaglio || []);
      } catch (error: any) {
        console.error(error);

        setErrore(
          error?.message ||
            "Impossibile caricare il gruppo societario"
        );
      } finally {
        setLoading(false);
      }
    }

    caricaDati();
  }, [router.isReady, gruppoId]);

  const gruppo = useMemo(() => {
    return (
      gruppi.find(
        (elemento) =>
          String(elemento.id) === String(gruppoId)
      ) || null
    );
  }, [gruppi, gruppoId]);

  const societaCollegate = useMemo<
    CollegataGruppo[]
  >(() => {
    if (!gruppo) {
      return [];
    }

    const societaInterneIds = new Set(
      gruppo.societa.map((societa) =>
        String(societa.id)
      )
    );

    const collegateMap = new Map<
      string,
      CollegataGruppo
    >();

    gruppo.societa.forEach((societa) => {
      (societa.societa_collegate || []).forEach(
        (collegata) => {
          const collegataId = String(
            collegata.societa_id
          );

          if (
            collegataId === String(societa.id) ||
            societaInterneIds.has(collegataId)
          ) {
            return;
          }

          const chiave = `${societa.id}-${collegataId}`;

          if (!collegateMap.has(chiave)) {
            collegateMap.set(chiave, {
              ...collegata,
              collegata_da_id: societa.id,
              collegata_da_nome: societa.nome,
            });
          }
        }
      );
    });

    return Array.from(
      collegateMap.values()
    ).sort((a, b) =>
      a.societa_nome.localeCompare(
        b.societa_nome,
        "it"
      )
    );
  }, [gruppo]);

  useEffect(() => {
    if (!loading && gruppo && !errore) {
      const timer = window.setTimeout(() => {
        window.print();
      }, 500);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [loading, gruppo, errore]);

  if (!router.isReady || loading) {
    return (
      <main style={paginaStyle}>
        <div style={statoStyle}>
          <RefreshCw size={25} />
          Caricamento stampa...
        </div>
      </main>
    );
  }

  if (errore) {
    return (
      <main style={paginaStyle}>
        <div style={erroreStyle}>{errore}</div>
      </main>
    );
  }

  if (!gruppo) {
    return (
      <main style={paginaStyle}>
        <div style={erroreStyle}>
          Gruppo societario non trovato.
        </div>
      </main>
    );
  }

  return (
    <main style={paginaStyle}>
      <div className="azioni-no-print" style={azioniStyle}>
        <button
          type="button"
          onClick={() => window.print()}
          style={bottoneStyle}
        >
          <Printer size={17} />
          Stampa
        </button>

        <button
          type="button"
          onClick={() => window.close()}
          style={bottoneStyle}
        >
          Chiudi scheda
        </button>
      </div>

      <article style={reportStyle}>
        <header style={intestazioneStyle}>
          <div>
            <div style={eyebrowStyle}>
              Studio Manager Pro
            </div>

            <h1 style={titoloStyle}>
              {gruppo.denominazione}
            </h1>

            <div style={dataStyle}>
              Elaborazione del{" "}
              {new Date().toLocaleDateString(
                "it-IT"
              )}{" "}
              alle{" "}
              {new Date().toLocaleTimeString(
                "it-IT",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </div>
          </div>

          <Building2 size={42} />
        </header>

        <section style={riepilogoStyle}>
          <Dato
            etichetta="Capogruppo"
            valore={gruppo.capogruppo.nome}
          />

          <Dato
            etichetta="Società nel gruppo"
            valore={String(
              gruppo.riepilogo.numero_societa
            )}
          />

          <Dato
            etichetta="Controllate dirette"
            valore={String(
              gruppo.riepilogo
                .numero_controllate_dirette
            )}
          />

          <Dato
            etichetta="Controllate indirette"
            valore={String(
              gruppo.riepilogo
                .numero_controllate_indirette
            )}
          />

          <Dato
            etichetta="Società collegate"
            valore={String(
              societaCollegate.length
            )}
          />

          <Dato
            etichetta="Livelli del gruppo"
            valore={String(
              gruppo.riepilogo.livelli_gruppo
            )}
          />
        </section>

        <section style={sezioneStyle}>
          <h2 style={sottotitoloStyle}>
            Struttura del gruppo
          </h2>

          {gruppo.societa
            .slice()
            .sort(
              (a, b) =>
                a.livello - b.livello ||
                a.nome.localeCompare(b.nome, "it")
            )
            .map((societa) => (
              <div
                key={societa.id}
                style={{
                  ...rigaSocietaStyle,
                  marginLeft:
                    societa.livello * 22,
                }}
              >
                <div>
                  <strong>{societa.nome}</strong>

                  <div style={dettaglioStyle}>
                    {getEtichettaRuolo(
                      societa.ruolo_nel_gruppo
                    )}

                    {societa.controllante_diretta
                      ? ` · controllata da ${
                          societa.controllante_diretta
                            .nome
                        } al ${formattaPercentuale(
                          societa.controllante_diretta
                            .quota
                        )}`
                      : ""}
                  </div>
                </div>
              </div>
            ))}
        </section>

        <section style={sezioneStyle}>
          <h2 style={sottotitoloStyle}>
            Società collegate
          </h2>

          {societaCollegate.length === 0 ? (
            <div style={testoVuotoStyle}>
              Nessuna società collegata.
            </div>
          ) : (
            societaCollegate.map((collegata) => (
              <div
                key={`${collegata.collegata_da_id}-${collegata.societa_id}`}
                style={rigaSocietaStyle}
              >
                <div>
                  <strong>
                    {collegata.societa_nome}
                  </strong>

                  <div style={dettaglioStyle}>
                    Collegata a{" "}
                    {collegata.collegata_da_nome}
                  </div>
                </div>

                <strong>
                  {formattaPercentuale(
                    collegata.quota
                  )}
                </strong>
              </div>
            ))
          )}
        </section>

        <section style={sezioneStyle}>
          <h2 style={sottotitoloStyle}>
            Titolari effettivi
          </h2>

          {gruppo.societa.map((societa) => (
            <BloccoTitolari
              key={societa.id}
              nomeSocieta={societa.nome}
              titolari={
                societa.titolari_effettivi || []
              }
            />
          ))}

          {societaCollegate.map((collegata) => (
            <BloccoTitolari
              key={`collegata-${collegata.societa_id}`}
              nomeSocieta={
                collegata.societa_nome
              }
              titolari={
                collegata.titolari_effettivi || []
              }
            />
          ))}
        </section>
      </article>

      <style jsx global>{`
        body {
          margin: 0;
          background: #f1f5f9;
        }

        @media print {
          body {
            background: #ffffff;
          }

          .azioni-no-print {
            display: none !important;
          }

          @page {
            size: A4;
            margin: 14mm;
          }
        }
      `}</style>
    </main>
  );
}

function Dato({
  etichetta,
  valore,
}: {
  etichetta: string;
  valore: string;
}) {
  return (
    <div style={datoStyle}>
      <div style={datoEtichettaStyle}>
        {etichetta}
      </div>

      <div style={datoValoreStyle}>
        {valore}
      </div>
    </div>
  );
}

function BloccoTitolari({
  nomeSocieta,
  titolari,
}: {
  nomeSocieta: string;
  titolari: TitolareEffettivoView[];
}) {
  return (
    <div style={bloccoTitolariStyle}>
      <h3 style={nomeSocietaStyle}>
        <ShieldCheck size={16} />
        {nomeSocieta}
      </h3>

      {titolari.length === 0 ? (
        <div style={testoVuotoStyle}>
          Nessun titolare effettivo individuato.
        </div>
      ) : (
        titolari.map((titolare) => (
          <div
            key={`${nomeSocieta}-${titolare.persona_id}`}
            style={rigaTitolareStyle}
          >
            <div>
              <strong>
                {titolare.persona_nome}
              </strong>

              <div style={dettaglioStyle}>
                {getEtichettaTitolarita(
                  titolare.tipo_titolarita
                )}

                {titolare.carica
                  ? ` · ${titolare.carica}`
                  : ""}
              </div>
            </div>

            <strong>
              {titolare.tipo_titolarita ===
              "residuale"
                ? titolare.carica ||
                  titolare.ruolo ||
                  "Criterio residuale"
                : formattaPercentuale(
                    titolare.quota_complessiva
                  )}
            </strong>
          </div>
        ))
      )}
    </div>
  );
}

const paginaStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#f1f5f9",
  color: "#0f172a",
};

const azioniStyle: React.CSSProperties = {
  maxWidth: 1000,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  margin: "0 auto 14px",
};

const bottoneStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

const reportStyle: React.CSSProperties = {
  maxWidth: 1000,
  margin: "0 auto",
  padding: 30,
  background: "#ffffff",
  boxShadow:
    "0 12px 35px rgba(15, 23, 42, 0.12)",
};

const intestazioneStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  paddingBottom: 16,
  marginBottom: 18,
  borderBottom: "2px solid #0f172a",
};

const eyebrowStyle: React.CSSProperties = {
  marginBottom: 5,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const titoloStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 27,
};

const dataStyle: React.CSSProperties = {
  marginTop: 7,
  color: "#64748b",
  fontSize: 12,
};

const riepilogoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, minmax(0, 1fr))",
  gap: 10,
  marginBottom: 24,
};

const datoStyle: React.CSSProperties = {
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
};

const datoEtichettaStyle: React.CSSProperties = {
  marginBottom: 4,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
};

const datoValoreStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
};

const sezioneStyle: React.CSSProperties = {
  marginBottom: 24,
};

const sottotitoloStyle: React.CSSProperties = {
  margin: "0 0 10px",
  paddingBottom: 7,
  borderBottom: "1px solid #94a3b8",
  fontSize: 18,
};

const rigaSocietaStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 10px",
  marginBottom: 5,
  border: "1px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 12,
  breakInside: "avoid",
};

const dettaglioStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 11,
};

const bloccoTitolariStyle: React.CSSProperties = {
  marginBottom: 15,
  breakInside: "avoid",
};

const nomeSocietaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  margin: "0 0 6px",
  fontSize: 14,
};

const rigaTitolareStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 10px",
  marginBottom: 4,
  background: "#f8fafc",
  borderRadius: 6,
  fontSize: 12,
};

const testoVuotoStyle: React.CSSProperties = {
  padding: 10,
  color: "#64748b",
  fontSize: 12,
  fontStyle: "italic",
};

const statoStyle: React.CSSProperties = {
  minHeight: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const erroreStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: "40px auto",
  padding: 18,
  border: "1px solid #fecaca",
  borderRadius: 10,
  background: "#fef2f2",
  color: "#b91c1c",
};
