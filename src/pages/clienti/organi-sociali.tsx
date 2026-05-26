"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

const ruoli = [
  "tutti",
  "socio",
  "amministratore",
  "liquidatore",
  "sindaco",
  "revisore",
  "rappresentante_legale",
];

export default function OrganiSocialiPage() {
  const router = useRouter();
  const supabase = getSupabaseClient() as any;

  const [clienti, setClienti] = useState<any[]>([]);
  const [nominativi, setNominativi] = useState<any[]>([]);
  const [organi, setOrgani] = useState<any[]>([]);

  const [clienteId, setClienteId] = useState("");
  const [filtroRuolo, setFiltroRuolo] = useState("tutti");
  const [loading, setLoading] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const [form, setForm] = useState({
    rapp_legale_id: "",
    ruolo: "socio",
    carica: "",
    percentuale_partecipazione: "",
    presenza: "Presente",
    principale: false,
    attivo: true,
  });

  useEffect(() => {
    caricaClienti();
    caricaNominativi();
  }, []);

  useEffect(() => {
    if (clienteId) caricaOrgani();
  }, [clienteId]);

  const organiFiltrati = useMemo(() => {
    if (filtroRuolo === "tutti") return organi;
    return organi.filter((o) => o.ruolo === filtroRuolo);
  }, [organi, filtroRuolo]);

  async function caricaClienti() {
    const { data } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, codice_fiscale")
      .order("ragione_sociale");

    setClienti(data || []);
  }

  async function caricaNominativi() {
    const { data } = await supabase
      .from("rapp_legali")
      .select("id, nome_cognome, codice_fiscale")
      .order("nome_cognome");

    setNominativi(data || []);
  }

  async function caricaOrgani() {
    setLoading(true);

    const res = await fetch(`/api/clienti-organi?cliente_id=${clienteId}`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (res.ok) {
      setOrgani(data.organi || []);
    } else {
      setMessaggio(data.error || "Errore caricamento organi");
    }

    setLoading(false);
  }

  async function salvaOrgano() {
    if (!clienteId) {
      alert("Seleziona prima un cliente.");
      return;
    }

    if (!form.rapp_legale_id) {
      alert("Seleziona un nominativo.");
      return;
    }

    const res = await fetch("/api/clienti-organi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cliente_id: clienteId,
        ...form,
        percentuale_partecipazione:
          form.percentuale_partecipazione || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Errore salvataggio organo");
      return;
    }

    setMessaggio("Organo salvato correttamente.");

    setForm({
      rapp_legale_id: "",
      ruolo: "socio",
      carica: "",
      percentuale_partecipazione: "",
      presenza: "Presente",
      principale: false,
      attivo: true,
    });

    await caricaOrgani();
  }

  async function disattivaOrgano(organo: any) {
    const ok = confirm("Disattivare questo organo?");
    if (!ok) return;

    const res = await fetch("/api/clienti-organi", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: organo.id,
        attivo: false,
        principale: false,
        data_cessazione: new Date().toISOString().slice(0, 10),
      }),
    });

    if (!res.ok) {
      alert("Errore disattivazione");
      return;
    }

    await caricaOrgani();
  }

  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>
            Organi sociali
          </h1>

          <p style={{ color: "#64748b", marginTop: 6 }}>
            Gestione soci, amministratori, liquidatori e altri organi collegati
            alla società.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/clienti")}
          style={secondaryButton}
        >
          ← Torna clienti
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Selezione società</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 12,
            marginTop: 18,
          }}
        >
          <div>
            <label style={labelStyle}>Cliente / società</label>
            <select
              style={inputStyle}
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Seleziona società</option>

              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ragione_sociale}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Filtro ruolo</label>
            <select
              style={inputStyle}
              value={filtroRuolo}
              onChange={(e) => setFiltroRuolo(e.target.value)}
            >
              {ruoli.map((r) => (
                <option key={r} value={r}>
                  {r === "tutti" ? "Tutti" : r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Aggiungi organo</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 12,
            marginTop: 18,
            alignItems: "end",
          }}
        >
          <div>
            <label style={labelStyle}>Nominativo</label>
            <select
              style={inputStyle}
              value={form.rapp_legale_id}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  rapp_legale_id: e.target.value,
                }))
              }
            >
              <option value="">Seleziona nominativo</option>

              {nominativi.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome_cognome} — {n.codice_fiscale}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Ruolo</label>
            <select
              style={inputStyle}
              value={form.ruolo}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  ruolo: e.target.value,
                }))
              }
            >
              {ruoli
                .filter((r) => r !== "tutti")
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Carica</label>
            <input
              style={inputStyle}
              value={form.carica}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  carica: e.target.value,
                }))
              }
              placeholder="Es. Amministratore unico"
            />
          </div>

          <div>
            <label style={labelStyle}>Quota %</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={form.percentuale_partecipazione}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  percentuale_partecipazione: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: 12,
            marginTop: 14,
            alignItems: "center",
          }}
        >
          <div>
            <label style={labelStyle}>Presenza / delega</label>
            <input
              style={inputStyle}
              value={form.presenza}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  presenza: e.target.value,
                }))
              }
            />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.principale}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  principale: e.target.checked,
                }))
              }
            />
            Principale
          </label>

          <button type="button" style={blueButton} onClick={salvaOrgano}>
            Salva organo
          </button>
        </div>

        {messaggio && (
          <div style={{ marginTop: 12, fontSize: 14, color: "#475569" }}>
            {messaggio}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Organi collegati</h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
            <thead>
              <tr>
                <th style={thStyle}>Nominativo</th>
                <th style={thStyle}>Codice fiscale</th>
                <th style={thStyle}>Ruolo</th>
                <th style={thStyle}>Carica</th>
                <th style={thStyle}>Quota</th>
                <th style={thStyle}>Principale</th>
                <th style={thStyle}>Attivo</th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {organiFiltrati.map((o) => (
                <tr key={o.id}>
                  <td style={tdStyle}>{o.rapp_legali?.nome_cognome || "—"}</td>
                  <td style={tdStyle}>{o.rapp_legali?.codice_fiscale || "—"}</td>
                  <td style={tdStyle}>{o.ruolo}</td>
                  <td style={tdStyle}>{o.carica || "—"}</td>
                  <td style={tdStyle}>
                    {o.percentuale_partecipazione
                      ? `${Number(o.percentuale_partecipazione).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td style={tdStyle}>{o.principale ? "Sì" : "No"}</td>
                  <td style={tdStyle}>{o.attivo ? "Sì" : "No"}</td>
                  <td style={tdStyle}>
                    {o.attivo && (
                      <button
                        type="button"
                        onClick={() => disattivaOrgano(o)}
                        style={dangerButton}
                      >
                        Disattiva
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {organiFiltrati.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan={8}>
                    Nessun organo collegato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginTop: 18,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
  color: "#111827",
};

const blueButton: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#2563eb",
  color: "#fff",
  padding: "10px 18px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  color: "#334155",
  padding: "9px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#dc2626",
  cursor: "pointer",
  fontWeight: 600,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: 14,
  fontSize: 14,
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
};
