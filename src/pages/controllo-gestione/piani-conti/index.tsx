import { useRouter } from "next/router";
import {
  Database,
  FileSpreadsheet,
  ChevronRight,
  Settings,
} from "lucide-react";

type GestionaleCard = {
  key:
    | "datev-koinos"
    | "zucchetti"
    | "teamsystem"
    | "ipsoa";

  nome: string;
  descrizione: string;
  stato: "attivo" | "da_configurare";
  href: string;
};

const gestionali: GestionaleCard[] = [
  {
    key: "datev-koinos",
    nome: "DATEV KOINOS",
    descrizione:
      "Gestione del piano dei conti master DATEV KOINOS e delle associazioni alle voci SMP.",
    stato: "attivo",
    href:
      "/controllo-gestione/piani-conti/datev-koinos",
  },
  {
    key: "zucchetti",
    nome: "Zucchetti",
    descrizione:
      "Configurazione del piano dei conti Zucchetti e relativo mapping contabile.",
    stato: "attivo",
href:
  "/controllo-gestione/piani-conti/crea-master?software=zucchetti",
  },
  {
    key: "teamsystem",
    nome: "TeamSystem",
    descrizione:
      "Configurazione del piano dei conti TeamSystem e relativo mapping contabile.",
    stato: "attivo",
href:
  "/controllo-gestione/piani-conti/crea-master?software=teamsystem",
  },
  {
    key: "ipsoa",
    nome: "IPSOA",
    descrizione:
      "Configurazione del piano dei conti IPSOA e relativo mapping contabile.",
    stato: "attivo",
href:
  "/controllo-gestione/piani-conti/crea-master?software=ipsoa",
  },
];

export default function PianiContiIndexPage() {
  const router = useRouter();

  return (
    <main
      style={{
        maxWidth: 1450,
        margin: "0 auto",
        padding: 24,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Piani dei conti
          </h1>

          <div
            style={{
              marginTop: 6,
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Configurazione dei master contabili utilizzati
            nel controllo di gestione.
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/controllo-gestione"
            )
          }
          style={secondaryButtonStyle}
        >
          Torna al controllo di gestione
        </button>
      </div>

      {/* INFO */}
      <section
        style={{
          ...infoCardStyle,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Settings
              style={{
                width: 19,
                height: 19,
              }}
            />
          </div>

          <div>
            <div
              style={{
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: 4,
              }}
            >
              Master per software contabile
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Ogni gestionale utilizza il proprio piano dei
              conti master. Le società che utilizzano quel
              piano ereditano automaticamente le associazioni
              alle voci SMP. Eventuali conti specifici della
              singola società restano personalizzazioni separate.
            </div>
          </div>
        </div>
      </section>

      {/* CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}
      >
        {gestionali.map(
          (gestionale) => {
            const attivo =
              gestionale.stato ===
              "attivo";

            return (
              <div
                key={gestionale.key}
                style={{
                  ...cardStyle,
                  opacity:
                    attivo ? 1 : 0.82,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "flex-start",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background:
                        attivo
                          ? "#eff6ff"
                          : "#f8fafc",
                      color:
                        attivo
                          ? "#2563eb"
                          : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        "center",
                      flexShrink: 0,
                    }}
                  >
                    {gestionale.key ===
                    "datev-koinos" ? (
                      <Database
                        style={{
                          width: 22,
                          height: 22,
                        }}
                      />
                    ) : (
                      <FileSpreadsheet
                        style={{
                          width: 22,
                          height: 22,
                        }}
                      />
                    )}
                  </div>

                  <span
                    style={{
                      ...badgeStyle,
                      background:
                        attivo
                          ? "#dcfce7"
                          : "#f1f5f9",
                      color:
                        attivo
                          ? "#166534"
                          : "#64748b",
                    }}
                  >
                    {attivo
                      ? "Configurato"
                      : "Da configurare"}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    {gestionale.nome}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      color: "#64748b",
                      fontSize: 13,
                      lineHeight: 1.5,
                      minHeight: 60,
                    }}
                  >
                    {
                      gestionale.descrizione
                    }
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    disabled={!attivo}
                    onClick={() => {
                      if (!attivo) {
                        return;
                      }

                      void router.push(
                        gestionale.href
                      );
                    }}
                    style={{
                      ...primaryButtonStyle,
                      width: "100%",
                      opacity:
                        attivo
                          ? 1
                          : 0.45,
                      cursor:
                        attivo
                          ? "pointer"
                          : "not-allowed",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      gap: 8,
                    }}
                  >
                    {gestionale.key === "datev-koinos"
  ? "Gestisci piano dei conti"
  : "Crea master da file"}

                    {attivo && (
                      <ChevronRight
                        style={{
                          width: 17,
                          height: 17,
                        }}
                      />
                    )}
                  </button>
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* FOOTER INFO */}
      <section
        style={{
          marginTop: 24,
          border:
            "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 18,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          <strong>
            Logica di classificazione:
          </strong>{" "}
          personalizzazione specifica della società →
          master del software contabile → conto da
          classificare.
        </div>
      </section>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  boxShadow:
    "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const infoCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #dbeafe",
  borderRadius: 12,
  padding: 18,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 11,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "11px 14px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  border:
    "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 14px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 600,
  cursor: "pointer",
};
