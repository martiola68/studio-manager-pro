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
    <div style={logoTitoloStyle}>
      <img
        src="/logo-elma.png"
        alt="Studio Manager Pro"
        style={logoStyle}
      />

      <div>
        <div style={eyebrowStyle}>
          Studio Manager Pro
        </div>

        <h1 style={titoloStyle}>
          {gruppo.denominazione}
        </h1>

        <div style={dataStyle}>
          Prospetto della struttura societaria e dei
          titolari effettivi
        </div>
      </div>
    </div>

    <div style={dataDocumentoStyle}>
      <strong>Data elaborazione</strong>

      <span>
        {new Date().toLocaleDateString("it-IT")}
      </span>

      <span>
        ore{" "}
        {new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  </header>

  <section style={capogruppoStyle}>
    <div style={capogruppoIconaStyle}>
      <Building2 size={25} />
    </div>

    <div>
      <div style={capogruppoEtichettaStyle}>
        Capogruppo
      </div>

      <div style={capogruppoNomeStyle}>
        {gruppo.capogruppo.nome}
      </div>
    </div>
  </section>

  <section style={riepilogoStyle}>
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
      valore={String(societaCollegate.length)}
    />

    <Dato
      etichetta="Livelli del gruppo"
      valore={String(
        gruppo.riepilogo.livelli_gruppo
      )}
    />
  </section>

  <section style={sezioneStyle}>
    <div style={intestazioneSezioneStyle}>
      <span style={numeroSezioneStyle}>01</span>

      <div>
        <h2 style={sottotitoloStyle}>
          Struttura del gruppo
        </h2>

        <div style={descrizioneSezioneStyle}>
          Società controllate direttamente e
          indirettamente dalla capogruppo.
        </div>
      </div>
    </div>

    <div style={alberoDocumentoStyle}>
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
              ...rigaAlberoStyle,
              marginLeft: societa.livello * 30,
            }}
          >
            <div
              style={{
                ...puntoAlberoDocumentoStyle,
                ...(societa.ruolo_nel_gruppo ===
                "capogruppo"
                  ? puntoCapogruppoDocumentoStyle
                  : {}),
              }}
            />

            <div style={contenutoRigaAlberoStyle}>
              <div style={nomeRigaAlberoStyle}>
                {societa.nome}
              </div>

              <div style={dettaglioStyle}>
                {getEtichettaRuolo(
                  societa.ruolo_nel_gruppo
                )}

                {societa.controllante_diretta
                  ? ` · partecipazione detenuta da ${
                      societa.controllante_diretta
                        .nome
                    }`
                  : ""}
              </div>
            </div>

            <div style={quotaAlberoStyle}>
              {societa.controllante_diretta
                ? formattaPercentuale(
                    societa.controllante_diretta
                      .quota
                  )
                : "100%"}
            </div>
          </div>
        ))}
    </div>
  </section>

  <section style={sezioneStyle}>
    <div style={intestazioneSezioneStyle}>
      <span style={numeroSezioneStyle}>02</span>

      <div>
        <h2 style={sottotitoloStyle}>
          Società collegate
        </h2>

        <div style={descrizioneSezioneStyle}>
          Partecipazioni comprese tra il 20% e il
          50%.
        </div>
      </div>
    </div>

    {societaCollegate.length === 0 ? (
      <div style={testoVuotoStyle}>
        Nessuna società collegata rilevata.
      </div>
    ) : (
      <table style={tabellaStyle}>
        <thead>
          <tr>
            <th style={thStyle}>
              Società collegata
            </th>

            <th style={thStyle}>
              Partecipante
            </th>

            <th style={thDestraStyle}>
              Quota
            </th>
          </tr>
        </thead>

        <tbody>
          {societaCollegate.map((collegata) => (
            <tr
              key={`${collegata.collegata_da_id}-${collegata.societa_id}`}
            >
              <td style={tdStyle}>
                <strong>
                  {collegata.societa_nome}
                </strong>
              </td>

              <td style={tdStyle}>
                {collegata.collegata_da_nome}
              </td>

              <td style={tdDestraStyle}>
                <span style={quotaCollegataStyle}>
                  {formattaPercentuale(
                    collegata.quota
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>

  <section style={sezioneStyle}>
    <div style={intestazioneSezioneStyle}>
      <span style={numeroSezioneStyle}>03</span>

      <div>
        <h2 style={sottotitoloStyle}>
          Titolari effettivi
        </h2>

        <div style={descrizioneSezioneStyle}>
          Titolari individuati per proprietà,
          controllo o criterio residuale.
        </div>
      </div>
    </div>

    <table style={tabellaStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Società</th>
          <th style={thStyle}>
            Titolare effettivo
          </th>
          <th style={thStyle}>Criterio</th>
          <th style={thDestraStyle}>
            Quota / carica
          </th>
        </tr>
      </thead>

      <tbody>
        {gruppo.societa.flatMap((societa) => {
          if (
            !societa.titolari_effettivi ||
            societa.titolari_effettivi.length === 0
          ) {
            return [
              <tr key={`vuoto-${societa.id}`}>
                <td style={tdStyle}>
                  <strong>{societa.nome}</strong>
                </td>

                <td
                  style={{
                    ...tdStyle,
                    color: "#64748b",
                    fontStyle: "italic",
                  }}
                  colSpan={3}
                >
                  Nessun titolare effettivo
                  individuato.
                </td>
              </tr>,
            ];
          }

          return societa.titolari_effettivi.map(
            (titolare) => (
              <tr
                key={`${societa.id}-${titolare.persona_id}`}
              >
                <td style={tdStyle}>
                  <strong>{societa.nome}</strong>
                </td>

                <td style={tdStyle}>
                  {titolare.persona_nome}
                </td>

                <td style={tdStyle}>
                  {getEtichettaTitolarita(
                    titolare.tipo_titolarita
                  )}
                </td>

                <td style={tdDestraStyle}>
                  {titolare.tipo_titolarita ===
                  "residuale"
                    ? titolare.carica ||
                      titolare.ruolo ||
                      "Amministratore"
                    : formattaPercentuale(
                        titolare.quota_complessiva
                      )}
                </td>
              </tr>
            )
          );
        })}

        {societaCollegate.flatMap(
          (collegata) => {
            const titolari =
              collegata.titolari_effettivi || [];

            if (titolari.length === 0) {
              return [
                <tr
                  key={`vuoto-collegata-${collegata.societa_id}`}
                >
                  <td style={tdStyle}>
                    <strong>
                      {collegata.societa_nome}
                    </strong>

                    <div
                      style={badgeCollegataTestoStyle}
                    >
                      Collegata
                    </div>
                  </td>

                  <td
                    style={{
                      ...tdStyle,
                      color: "#64748b",
                      fontStyle: "italic",
                    }}
                    colSpan={3}
                  >
                    Nessun titolare effettivo
                    individuato.
                  </td>
                </tr>,
              ];
            }

            return titolari.map((titolare) => (
              <tr
                key={`collegata-${collegata.societa_id}-${titolare.persona_id}`}
              >
                <td style={tdStyle}>
                  <strong>
                    {collegata.societa_nome}
                  </strong>

                  <div
                    style={badgeCollegataTestoStyle}
                  >
                    Collegata
                  </div>
                </td>

                <td style={tdStyle}>
                  {titolare.persona_nome}
                </td>

                <td style={tdStyle}>
                  {getEtichettaTitolarita(
                    titolare.tipo_titolarita
                  )}
                </td>

                <td style={tdDestraStyle}>
                  {titolare.tipo_titolarita ===
                  "residuale"
                    ? titolare.carica ||
                      titolare.ruolo ||
                      "Amministratore"
                    : formattaPercentuale(
                        titolare.quota_complessiva
                      )}
                </td>
              </tr>
            ));
          }
        )}
      </tbody>
    </table>
  </section>

  <footer style={footerDocumentoStyle}>
    <div>
      Documento elaborato automaticamente da
      Studio Manager Pro.
    </div>

    <div>
      Situazione risultante dai dati presenti nel
      gestionale alla data di elaborazione.
    </div>
  </footer>
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
  maxWidth: 980,
  margin: "0 auto",
  padding: "34px 40px",
  background: "#ffffff",
  boxShadow: "none",
  borderRadius: 0,
};

const intestazioneStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 30,
  paddingBottom: 22,
  marginBottom: 22,
  borderBottom: "3px solid #1d4ed8",
};

const logoTitoloStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
};

const logoStyle: React.CSSProperties = {
  width: 74,
  height: 74,
  objectFit: "contain",
};

const eyebrowStyle: React.CSSProperties = {
  marginBottom: 5,
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.11em",
};

const titoloStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1.15,
  fontWeight: 500,
};

const dataStyle: React.CSSProperties = {
  marginTop: 7,
  color: "#64748b",
  fontSize: 12,
};

const dataDocumentoStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 3,
  color: "#475569",
  fontSize: 11,
  textAlign: "right",
};

const capogruppoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "15px 18px",
  marginBottom: 16,
  background: "#eff6ff",
  borderLeft: "5px solid #2563eb",
};

const capogruppoIconaStyle: React.CSSProperties = {
  display: "flex",
  color: "#2563eb",
};

const capogruppoEtichettaStyle: React.CSSProperties = {
  marginBottom: 3,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const capogruppoNomeStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 500,
};

const riepilogoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(5, minmax(0, 1fr))",
  gap: 8,
  marginBottom: 30,
};

const datoStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "2px solid #cbd5e1",
  textAlign: "center",
};

const datoEtichettaStyle: React.CSSProperties = {
  marginBottom: 5,
  color: "#64748b",
  fontSize: 9,
  fontWeight: 500,
  textTransform: "uppercase",
};

const datoValoreStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 500,
};

const sezioneStyle: React.CSSProperties = {
  marginBottom: 31,
  breakInside: "auto",
};

const intestazioneSezioneStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 13,
};

const numeroSezioneStyle: React.CSSProperties = {
  minWidth: 32,
  color: "#2563eb",
  fontSize: 21,
  fontWeight: 900,
};

const sottotitoloStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 500,
};

const descrizioneSezioneStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 11,
};

const alberoDocumentoStyle: React.CSSProperties = {
  paddingLeft: 4,
};

const rigaAlberoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 42,
  padding: "7px 10px",
  marginBottom: 4,
  borderBottom: "1px solid #e2e8f0",
  breakInside: "avoid",
};

const puntoAlberoDocumentoStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  flexShrink: 0,
  borderRadius: "50%",
  background: "#94a3b8",
};

const puntoCapogruppoDocumentoStyle: React.CSSProperties = {
  width: 11,
  height: 11,
  background: "#2563eb",
};

const contenutoRigaAlberoStyle: React.CSSProperties = {
  flex: 1,
};

const nomeRigaAlberoStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
};

const quotaAlberoStyle: React.CSSProperties = {
  flexShrink: 0,
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 600,
};

const dettaglioStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 10,
};

const tabellaStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 11,
};

const thStyle: React.CSSProperties = {
  padding: "9px 10px",
  borderBottom: "1px solid #94a3b8",
  background: "transparent",
  color: "#475569",
  fontSize: 9,
  fontWeight: 600,
  textAlign: "left",
  textTransform: "uppercase",
};

const thDestraStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 10px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
  breakInside: "avoid",
};

const tdDestraStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontWeight: 800,
};

const quotaCollegataStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#92400e",
  fontWeight: 800,
};

const badgeCollegataTestoStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#92400e",
  fontSize: 9,
  fontWeight: 800,
  textTransform: "uppercase",
};

const testoVuotoStyle: React.CSSProperties = {
  padding: "13px 10px",
  borderBottom: "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: 11,
  fontStyle: "italic",
};

const footerDocumentoStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 25,
  paddingTop: 14,
  marginTop: 34,
  borderTop: "1px solid #94a3b8",
  color: "#64748b",
  fontSize: 9,
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
