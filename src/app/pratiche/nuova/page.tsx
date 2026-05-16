"use client";

import { useState } from "react";

export default function NuovaPraticaPage() {
  const [loading, setLoading] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const [form, setForm] = useState({
    studio_id: "1",
    cliente_id: "",
    tipo_pratica_id: "",
    titolo: "",
    priorita: "normale",
    assegnato_a: "",
    note: "",
  });

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function creaPratica(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessaggio("");

    const payload = {
      studio_id: Number(form.studio_id),
      cliente_id: Number(form.cliente_id),
      tipo_pratica_id: Number(form.tipo_pratica_id),
      titolo: form.titolo,
      priorita: form.priorita,
      assegnato_a: form.assegnato_a ? Number(form.assegnato_a) : null,
      note: form.note || null,
    };

    try {
      const res = await fetch("/api/pratiche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Errore creazione pratica");

      setMessaggio(`Pratica creata correttamente: ${data.pratica.numero_pratica}`);
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #9ca3af",
  borderRadius: 7,
  padding: "8px 10px",
  fontSize: 14,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

 return (
  <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
          Nuova pratica
        </h1>
        <p style={{ color: "#64748b", marginTop: 6 }}>
          Crea una pratica guidata con workflow automatico, step, checklist e scadenze.
        </p>
      </div>

      <form onSubmit={creaPratica}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Dati pratica
              </h2>
              <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>
                Seleziona cliente, tipo pratica e informazioni principali.
              </p>
            </div>

            <a
              href="/pratiche"
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "9px 16px",
                background: "#fff",
                color: "#111827",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Torna alle pratiche
            </a>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Studio ID</label>
              <input
                style={inputStyle}
                value={form.studio_id}
                onChange={(e) => aggiornaCampo("studio_id", e.target.value)}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Cliente ID</label>
              <input
                style={inputStyle}
                value={form.cliente_id}
                onChange={(e) => aggiornaCampo("cliente_id", e.target.value)}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Tipo pratica ID</label>
              <input
                style={inputStyle}
                value={form.tipo_pratica_id}
                onChange={(e) => aggiornaCampo("tipo_pratica_id", e.target.value)}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Priorità</label>
              <select
                style={inputStyle}
                value={form.priorita}
                onChange={(e) => aggiornaCampo("priorita", e.target.value)}
              >
                <option value="bassa">Bassa</option>
                <option value="normale">Normale</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Titolo pratica</label>
              <input
                style={inputStyle}
                value={form.titolo}
                onChange={(e) => aggiornaCampo("titolo", e.target.value)}
                placeholder="Es. Messa in liquidazione Rossi SRL"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Assegnato a ID</label>
              <input
                style={inputStyle}
                value={form.assegnato_a}
                onChange={(e) => aggiornaCampo("assegnato_a", e.target.value)}
                placeholder="Opzionale"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Note interne</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              value={form.note}
              onChange={(e) => aggiornaCampo("note", e.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0 }}>
            Workflow automatico
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 10,
              marginTop: 14,
              marginBottom: 20,
            }}
          >
            {[
              "Step operativi da template",
              "Checklist pratica",
              "Scadenze automatiche",
              "Log iniziale",
              "Documenti modello collegati",
            ].map((item) => (
              <div
                key={item}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                  background: "#f9fafb",
                }}
              >
                {item}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                border: 0,
                borderRadius: 8,
                padding: "10px 18px",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Creazione in corso..." : "Crea pratica"}
            </button>
          </div>

          {messaggio && (
            <div
              style={{
                marginTop: 16,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#f9fafb",
                padding: 12,
                fontSize: 14,
              }}
            >
              {messaggio}
            </div>
          )}
        </div>
      </form>
    </div>
  </main>
);
}
