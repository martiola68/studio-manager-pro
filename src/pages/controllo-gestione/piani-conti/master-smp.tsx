import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, BookOpen, Search } from "lucide-react";

type VoceMaster = {
  id: string;
  codice: string;
  descrizione: string;
  sezione: string | null;
  macrovoce: string | null;
};

type Riepilogo = {
  numero_voci: number;
  numero_sezioni: number;
  numero_macrovoci: number;
};

export default function PianoMasterSmpPage() {
  const router = useRouter();
  const [voci, setVoci] = useState<VoceMaster[]>([]);
  const [riepilogo, setRiepilogo] = useState<Riepilogo>({
    numero_voci: 0,
    numero_sezioni: 0,
    numero_macrovoci: 0,
  });
  const [ricerca, setRicerca] = useState("");
  const [sezione, setSezione] = useState("tutte");
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    void carica();
  }, []);

  async function carica() {
    try {
      setLoading(true);
      setErrore("");

      const response = await fetch("/api/controllo-gestione/piano-master-smp");
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Errore caricamento Piano Master SMP");
      }

      setVoci(Array.isArray(json?.data) ? json.data : []);
      setRiepilogo({
        numero_voci: Number(json?.riepilogo?.numero_voci || 0),
        numero_sezioni: Number(json?.riepilogo?.numero_sezioni || 0),
        numero_macrovoci: Number(json?.riepilogo?.numero_macrovoci || 0),
      });
    } catch (error: any) {
      console.error("Errore caricamento Piano Master SMP:", error);
      setErrore(error?.message || "Errore caricamento Piano Master SMP");
    } finally {
      setLoading(false);
    }
  }

  const sezioni = useMemo(
    () =>
      Array.from(
        new Set(voci.map((voce) => voce.sezione).filter((value): value is string => Boolean(value)))
      ).sort((a, b) => a.localeCompare(b, "it")),
    [voci]
  );

  const vociFiltrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();

    return voci.filter((voce) => {
      if (sezione !== "tutte" && voce.sezione !== sezione) return false;
      if (!q) return true;

      return [voce.codice, voce.descrizione, voce.sezione, voce.macrovoce]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [voci, ricerca, sezione]);

  return (
    <main style={{ maxWidth: 1500, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={23} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, color: "#0f172a" }}>Piano dei conti Master SMP</h1>
            <div style={{ marginTop: 5, color: "#64748b", fontSize: 13 }}>
              Piano di destinazione unico utilizzato per la riclassificazione di tutte le società.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/controllo-gestione/piani-conti")}
          style={secondaryButtonStyle}
        >
          <ArrowLeft size={16} />
          Torna ai piani dei conti
        </button>
      </div>

      {errore && <div style={errorStyle}>{errore}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
        <Summary label="Voci master" value={riepilogo.numero_voci} />
        <Summary label="Sezioni" value={riepilogo.numero_sezioni} />
        <Summary label="Macrovoci" value={riepilogo.numero_macrovoci} />
      </div>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#ffffff", padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 220px", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#64748b" }} />
            <input
              value={ricerca}
              onChange={(event) => setRicerca(event.target.value)}
              placeholder="Cerca codice, descrizione o macrovoce..."
              style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px 10px 36px" }}
            />
          </div>

          <select
            value={sezione}
            onChange={(event) => setSezione(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", background: "#ffffff" }}
          >
            <option value="tutte">Tutte le sezioni</option>
            {sezioni.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#ffffff" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#334155", fontSize: 12, textAlign: "left" }}>
                <th style={thStyle}>Codice</th>
                <th style={thStyle}>Descrizione</th>
                <th style={thStyle}>Sezione</th>
                <th style={thStyle}>Macrovoce</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={emptyCellStyle}>Caricamento Piano Master SMP...</td></tr>
              ) : vociFiltrate.length === 0 ? (
                <tr><td colSpan={4} style={emptyCellStyle}>Nessuna voce trovata.</td></tr>
              ) : (
                vociFiltrate.map((voce) => (
                  <tr key={voce.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>{voce.codice}</td>
                    <td style={tdStyle}>{voce.descrizione}</td>
                    <td style={tdStyle}>{voce.sezione || "-"}</td>
                    <td style={tdStyle}>{voce.macrovoce || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#ffffff", padding: "15px 16px" }}>
      <div style={{ fontSize: 23, fontWeight: 800, color: "#0f172a" }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{label}</div>
    </div>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 13px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 600,
  cursor: "pointer",
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

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  color: "#475569",
  fontSize: 13,
};

const emptyCellStyle: React.CSSProperties = {
  padding: 28,
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
};
