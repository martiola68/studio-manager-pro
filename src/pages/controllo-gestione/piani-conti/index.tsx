import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowRight,
  BookOpen,
  Database,
  FileSpreadsheet,
  Layers3,
  Plus,
  RefreshCw,
} from "lucide-react";
import { getSupabaseClient } from "../../../lib/supabaseClient";

type ModelloRaccordo = {
  id: string;
  studio_id: string;
  software_contabile: string;
  nome: string;
  descrizione: string | null;
  predefinito: boolean;
  attivo: boolean;
  modello_import_id: string | null;
  numero_conti: number;
  numero_societa: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type RiepilogoMaster = {
  numero_voci: number;
  numero_sezioni: number;
  numero_macrovoci: number;
};

const softwareDisponibili = [
  { value: "datev_koinos", label: "DATEV KOINOS" },
  { value: "zucchetti", label: "Zucchetti" },
  { value: "teamsystem", label: "TeamSystem" },
  { value: "ipsoa", label: "IPSOA" },
];

function softwareLabel(value: string) {
  return (
    softwareDisponibili.find((item) => item.value === value)?.label ||
    value ||
    "Altro"
  );
}

export default function PianiContiIndexPage() {
  const router = useRouter();

  const [studioId, setStudioId] = useState("");
  const [modelli, setModelli] = useState<ModelloRaccordo[]>([]);
  const [riepilogoMaster, setRiepilogoMaster] = useState<RiepilogoMaster>({
    numero_voci: 0,
    numero_sezioni: 0,
    numero_macrovoci: 0,
  });
  const [softwareNuovo, setSoftwareNuovo] = useState("datev_koinos");
  const [ricerca, setRicerca] = useState("");
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    void inizializza();
  }, []);

  async function inizializza() {
    try {
      setLoading(true);
      setErrore("");

      const supabase = getSupabaseClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Utente non autenticato.");
      }

      const { data: utente, error: utenteError } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (utenteError || !utente?.studio_id) {
        throw new Error("Impossibile determinare lo studio dell'utente.");
      }

      setStudioId(utente.studio_id);
      await caricaDati(utente.studio_id);
    } catch (error: any) {
      console.error("Errore inizializzazione piani conti:", error);
      setErrore(error?.message || "Errore inizializzazione pagina");
    } finally {
      setLoading(false);
    }
  }

  async function caricaDati(sid = studioId) {
    if (!sid) return;

    try {
      setLoading(true);
      setErrore("");

      const [modelliResponse, masterResponse] = await Promise.all([
        fetch(
          `/api/controllo-gestione/master-piano-conti?studio_id=${encodeURIComponent(
            sid
          )}`
        ),
        fetch("/api/controllo-gestione/piano-master-smp"),
      ]);

      const [modelliJson, masterJson] = await Promise.all([
        modelliResponse.json(),
        masterResponse.json(),
      ]);

      if (!modelliResponse.ok) {
        throw new Error(modelliJson?.error || "Errore caricamento modelli di raccordo");
      }

      if (!masterResponse.ok) {
        throw new Error(masterJson?.error || "Errore caricamento Piano Master SMP");
      }

      setModelli(Array.isArray(modelliJson?.data) ? modelliJson.data : []);
      setRiepilogoMaster({
        numero_voci: Number(masterJson?.riepilogo?.numero_voci || 0),
        numero_sezioni: Number(masterJson?.riepilogo?.numero_sezioni || 0),
        numero_macrovoci: Number(masterJson?.riepilogo?.numero_macrovoci || 0),
      });
    } catch (error: any) {
      console.error("Errore caricamento piani conti:", error);
      setErrore(error?.message || "Errore caricamento dati");
    } finally {
      setLoading(false);
    }
  }

  const modelliFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return modelli;

    return modelli.filter((modello) => {
      const testo = [
        modello.nome,
        modello.descrizione,
        softwareLabel(modello.software_contabile),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return testo.includes(q);
    });
  }, [modelli, ricerca]);

  const modelliAttivi = modelli.filter((modello) => modello.attivo).length;
  const societaCollegate = modelli.reduce(
    (totale, modello) => totale + Number(modello.numero_societa || 0),
    0
  );

  return (
    <main style={{ maxWidth: 1500, margin: "0 auto", padding: 24 }}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Piano dei conti e modelli di raccordo</h1>
          <div style={subtitleStyle}>
            Un unico Piano Master SMP per la riclassificazione e modelli riutilizzabili per i diversi piani dei conti importati.
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/controllo-gestione")}
          style={secondaryButtonStyle}
        >
          Torna al controllo di gestione
        </button>
      </div>

      {errore && <div style={errorStyle}>{errore}</div>}

      <section style={{ ...masterCardStyle, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flex: "1 1 620px" }}>
            <div style={masterIconStyle}>
              <BookOpen size={25} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>
                  Piano dei conti Master SMP
                </h2>
                <span style={masterBadgeStyle}>Master dello Studio</span>
              </div>

              <p style={{ margin: "8px 0 0", color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
                È il piano di destinazione unico utilizzato da tutte le società. I conti provenienti da DATEV, Zucchetti, TeamSystem, IPSOA o altri software vengono raccordati a queste voci SMP.
              </p>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 16 }}>
                <Stat label="Voci master" value={riepilogoMaster.numero_voci} />
                <Stat label="Sezioni" value={riepilogoMaster.numero_sezioni} />
                <Stat label="Macrovoci" value={riepilogoMaster.numero_macrovoci} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => router.push("/controllo-gestione/piani-conti/master-smp")}
              style={{ ...primaryButtonStyle, display: "flex", alignItems: "center", gap: 8 }}
            >
              Apri Piano Master
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      <section style={infoStripStyle}>
        <Layers3 size={19} style={{ color: "#2563eb", flexShrink: 0 }} />
        <div>
          <strong>Nuova logica di classificazione:</strong>{" "}
          personalizzazione della società → modello di raccordo → Piano Master SMP → conto da classificare.
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Modelli di raccordo</h2>
            <div style={{ marginTop: 5, color: "#64748b", fontSize: 13 }}>
              Configurazioni riutilizzabili come base per nuove società, modificabili poi con personalizzazioni specifiche.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={softwareNuovo}
              onChange={(event) => setSoftwareNuovo(event.target.value)}
              style={selectStyle}
              aria-label="Software del nuovo modello"
            >
              {softwareDisponibili.map((software) => (
                <option key={software.value} value={software.value}>
                  {software.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/controllo-gestione/piani-conti/crea-master?software=${encodeURIComponent(
                    softwareNuovo
                  )}`
                )
              }
              style={{ ...primaryButtonStyle, display: "flex", alignItems: "center", gap: 8 }}
            >
              <Plus size={17} />
              Nuovo modello di raccordo
            </button>

            <button
              type="button"
              onClick={() => void caricaDati()}
              disabled={loading}
              style={{ ...secondaryButtonStyle, display: "flex", alignItems: "center", gap: 7 }}
            >
              <RefreshCw size={16} />
              Aggiorna
            </button>
          </div>
        </div>

        <div style={summaryGridStyle}>
          <SummaryCard label="Modelli presenti" value={modelli.length} />
          <SummaryCard label="Modelli attivi" value={modelliAttivi} />
          <SummaryCard label="Società collegate" value={societaCollegate} />
        </div>

        <div style={{ margin: "18px 0 14px" }}>
          <input
            value={ricerca}
            onChange={(event) => setRicerca(event.target.value)}
            placeholder="Cerca per nome modello o software..."
            style={searchStyle}
          />
        </div>

        {loading ? (
          <div style={emptyStyle}>Caricamento modelli di raccordo...</div>
        ) : modelliFiltrati.length === 0 ? (
          <div style={emptyStyle}>
            Nessun modello di raccordo disponibile. Crea il primo modello partendo da un piano dei conti reale.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 16 }}>
            {modelliFiltrati.map((modello) => (
              <article key={modello.id} style={modelCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={modelIconStyle}>
                    {modello.software_contabile === "datev_koinos" ? (
                      <Database size={21} />
                    ) : (
                      <FileSpreadsheet size={21} />
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {modello.predefinito && <span style={defaultBadgeStyle}>Predefinito</span>}
                    <span style={modello.attivo ? activeBadgeStyle : inactiveBadgeStyle}>
                      {modello.attivo ? "Attivo" : "Non attivo"}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>
                    {softwareLabel(modello.software_contabile)}
                  </div>
                  <h3 style={{ margin: "5px 0 0", color: "#0f172a", fontSize: 18 }}>
                    {modello.nome}
                  </h3>
                  <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.5, minHeight: 40 }}>
                    {modello.descrizione || "Modello riutilizzabile per il raccordo al Piano Master SMP."}
                  </p>
                </div>

                <div style={modelStatsStyle}>
                  <Stat label="Conti raccordati" value={modello.numero_conti || 0} compact />
                  <Stat label="Società" value={modello.numero_societa || 0} compact />
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/controllo-gestione/piani-conti/${modello.id}`)}
                  style={{ ...primaryButtonStyle, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  Apri modello di raccordo
                  <ArrowRight size={16} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: compact ? 18 : 20, fontWeight: 800, color: "#0f172a" }}>{value}</div>
      <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={summaryCardStyle}>
      <div style={{ fontSize: 23, fontWeight: 800, color: "#0f172a" }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{label}</div>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 24,
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 27,
  fontWeight: 800,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 13,
};

const masterCardStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: 22,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const masterIconStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: "#dbeafe",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const masterBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 9px",
  background: "#dbeafe",
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 700,
};

const infoStripStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  border: "1px solid #dbeafe",
  borderRadius: 12,
  background: "#eff6ff",
  padding: "13px 16px",
  color: "#334155",
  fontSize: 13,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const summaryCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "14px 16px",
  background: "#ffffff",
};

const modelCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#ffffff",
  padding: 18,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const modelIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 11,
  background: "#eff6ff",
  color: "#2563eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modelStatsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  padding: "14px 0",
  margin: "14px 0",
  borderTop: "1px solid #e2e8f0",
  borderBottom: "1px solid #e2e8f0",
};

const defaultBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  background: "#fef3c7",
  color: "#92400e",
  fontSize: 10,
  fontWeight: 700,
};

const activeBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: 10,
  fontWeight: 700,
};

const inactiveBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  background: "#f1f5f9",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "11px 14px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 13px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 600,
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  minWidth: 165,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 12px",
  background: "#ffffff",
  color: "#334155",
};

const searchStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "11px 12px",
  background: "#ffffff",
  color: "#0f172a",
};

const errorStyle: React.CSSProperties = {
  marginBottom: 16,
  border: "1px solid #fecaca",
  borderRadius: 10,
  background: "#fef2f2",
  color: "#b91c1c",
  padding: "12px 14px",
  fontSize: 13,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 12,
  background: "#f8fafc",
  color: "#64748b",
  padding: 30,
  textAlign: "center",
  fontSize: 13,
};
