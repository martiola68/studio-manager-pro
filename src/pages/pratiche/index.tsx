"use client";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Pratica = {
  id: string;
  numero_pratica: string;
  titolo: string;
  stato: string;
  priorita: string;
  data_apertura: string | null;
  cliente_nome: string;
  tipo_nome: string;
  assegnatario_nome: string;
  avanzamento: number;
  prossima_scadenza: string | null;
};

export default function PratichePage() {
  const [pratiche, setPratiche] = useState<Pratica[]>([]);
  const [loading, setLoading] = useState(true);
  const [ricerca, setRicerca] = useState("");
  const [stato, setStato] = useState("tutti");
  const [priorita, setPriorita] = useState("tutte");

  useEffect(() => {
    async function caricaPratiche() {
      try {
        const res = await fetch("/api/pratiche", { cache: "no-store" });
        const data = await res.json();
        setPratiche(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Errore caricamento pratiche:", error);
      } finally {
        setLoading(false);
      }
    }

    caricaPratiche();
  }, []);

  const praticheFiltrate = useMemo(() => {
    return pratiche.filter((p) => {
      const testo = `${p.numero_pratica} ${p.titolo} ${p.cliente_nome} ${p.tipo_nome} ${p.assegnatario_nome}`.toLowerCase();

      const matchRicerca = testo.includes(ricerca.toLowerCase());
      const matchStato = stato === "tutti" || p.stato === stato;
      const matchPriorita = priorita === "tutte" || p.priorita === priorita;

      return matchRicerca && matchStato && matchPriorita;
    });
  }, [pratiche, ricerca, stato, priorita]);

  function badgeStato(value: string) {
    if (value === "aperta") return "bg-blue-50 text-blue-700 border-blue-200";
    if (value === "chiusa") return "bg-green-50 text-green-700 border-green-200";
    if (value === "sospesa") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }

  function badgePriorita(value: string) {
    if (value === "urgente") return "bg-red-50 text-red-700 border-red-200";
    if (value === "alta") return "bg-orange-50 text-orange-700 border-orange-200";
    if (value === "normale") return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }

  return (
    <main
      className="font-sans"
      style={{ padding: 28, background: "#f8fafc", minHeight: "100vh" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.1,
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              Pratiche
            </h1>

            <p
              style={{
                marginTop: 8,
                fontSize: 15,
                color: "#64748b",
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              Gestione pratiche, workflow automatici, step, checklist e scadenze.
            </p>
          </div>

         <Link
  href="/pratiche/nuova"
  style={{
    background: "#2563eb",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }}
>
  Nuova pratica
</Link>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: 20,
            marginBottom: 16,
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 12,
            }}
          >
            <input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca per numero, titolo, cliente, tipo o assegnatario..."
              style={{
                width: "100%",
                border: "1px solid #9ca3af",
                borderRadius: 7,
                padding: "9px 10px",
                fontSize: 14,
                outline: "none",
              }}
            />

            <select
              value={stato}
              onChange={(e) => setStato(e.target.value)}
              style={{
                border: "1px solid #9ca3af",
                borderRadius: 7,
                padding: "9px 10px",
                fontSize: 14,
                background: "#fff",
              }}
            >
              <option value="tutti">Tutti gli stati</option>
              <option value="aperta">Aperta</option>
              <option value="sospesa">Sospesa</option>
              <option value="chiusa">Chiusa</option>
            </select>

            <select
              value={priorita}
              onChange={(e) => setPriorita(e.target.value)}
              style={{
                border: "1px solid #9ca3af",
                borderRadius: 7,
                padding: "9px 10px",
                fontSize: 14,
                background: "#fff",
              }}
            >
              <option value="tutte">Tutte le priorità</option>
              <option value="bassa">Bassa</option>
              <option value="normale">Normale</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            overflow: "hidden",
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div style={{ padding: 20, borderBottom: "1px solid #e5e7eb" }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
              }}
            >
              Elenco pratiche
            </h2>
            <p style={{ marginTop: 6, color: "#64748b", fontSize: 14 }}>
              {praticheFiltrate.length} pratiche trovate
            </p>
          </div>

          {loading ? (
            <div style={{ padding: 24, color: "#64748b", fontSize: 14 }}>
              Caricamento pratiche...
            </div>
          ) : praticheFiltrate.length === 0 ? (
            <div style={{ padding: 32, color: "#64748b", fontSize: 14 }}>
              Nessuna pratica trovata.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  {[
                    "Pratica",
                    "Cliente",
                    "Tipo",
                    "Stato",
                    "Priorità",
                    "Assegnatario",
                    "Avanzamento",
                   "Azioni",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#475569",
                        textTransform: "uppercase",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {praticheFiltrate.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 16 }}>
                      <Link
                        href={`/pratiche/${p.id}`}
                        style={{
                          color: "#0f172a",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        {p.numero_pratica}
                      </Link>
                      <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                        {p.titolo}
                      </div>
                    </td>

                    <td style={{ padding: 16, fontSize: 14, color: "#334155" }}>
                      {p.cliente_nome}
                    </td>

                    <td style={{ padding: 16, fontSize: 14, color: "#334155" }}>
                      {p.tipo_nome}
                    </td>

                    <td style={{ padding: 16 }}>
                      <span
                        className={badgeStato(p.stato)}
                        style={{
                          display: "inline-flex",
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        {p.stato}
                      </span>
                    </td>

                    <td style={{ padding: 16 }}>
                      <span
                        className={badgePriorita(p.priorita)}
                        style={{
                          display: "inline-flex",
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        {p.priorita}
                      </span>
                    </td>

                    <td style={{ padding: 16, fontSize: 14, color: "#334155" }}>
                      {p.assegnatario_nome}
                    </td>

                   <td style={{ padding: 16 }}>
  <div
    style={{
      width: 100,
      height: 8,
      background: "#e5e7eb",
      borderRadius: 999,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        width: `${p.avanzamento || 0}%`,
        height: "100%",
        background: "#2563eb",
      }}
    />
  </div>

  <div
    style={{
      fontSize: 12,
      marginTop: 4,
      color: "#374151",
    }}
  >
    {p.avanzamento || 0}%
  </div>
</td>

<td style={{ padding: 16, textAlign: "right" }}>

 <button
  type="button"
  onClick={async () => {
    const ok = confirm("Chiudere questa pratica?");
    if (!ok) return;

    const res = await fetch(`/api/pratiche/${p.id}/chiudi`, {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Errore chiusura pratica");
      return;
    }

    alert("Pratica chiusa correttamente");

    window.location.reload();
  }}
>
  Chiudi
</button>
  
  <button
    type="button"
    title="Elimina pratica"
    onClick={async () => {
      if (!confirm("Eliminare definitivamente questa pratica?")) {
        return;
      }

      const res = await fetch(`/api/pratiche/${p.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Errore eliminazione pratica");
        return;
      }

      setPratiche((prev) =>
        prev.filter((x) => x.id !== p.id)
      );
    }}
    style={{
      border: 0,
      background: "transparent",
      color: "#dc2626",
      cursor: "pointer",
    }}
  >
    <Trash2 size={18} />
  </button>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
