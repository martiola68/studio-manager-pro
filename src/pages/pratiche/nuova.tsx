"use client";

import { useEffect, useState } from "react";

type Cliente = {
  id: string;
  nome: string;
};

type TipoPratica = {
  id: number;
  ente: string;
  nome: string;
  codice: string;
};

type Utente = {
  id: string;
  nome: string;
};

export default function NuovaPraticaPage() {
  const [loading, setLoading] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [tipiPratica, setTipiPratica] = useState<TipoPratica[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);

  const [form, setForm] = useState({
    cliente_id: "",
    tipo_pratica_id: "",
    titolo: "",
    priorita: "normale",
    assegnato_a: "",
    note: "",
  });

  const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
  color: "#374151",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

  useEffect(() => {
    async function caricaDati() {
      const [clientiRes, tipiRes, utentiRes] = await Promise.all([
        fetch("/api/clienti"),
        fetch("/api/pratiche/tipi"),
        fetch("/api/utenti"),
      ]);

      setClienti(await clientiRes.json());
      setTipiPratica(await tipiRes.json());
      setUtenti(await utentiRes.json());
    }

    caricaDati();
  }, []);

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function creaPratica(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessaggio("");

    try {
     const payload = {
  cliente_id: form.cliente_id,
  tipo_pratica_id: Number(form.tipo_pratica_id),
  titolo: form.titolo,
  priorita: form.priorita,
  assegnato_a: form.assegnato_a || null,
  note: form.note || null,
};

      const res = await fetch("/api/pratiche", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore creazione pratica");
      }

      setMessaggio(`Pratica creata correttamente: ${data.pratica.numero_pratica}`);
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
  className="font-sans"
  style={{ padding: 28, background: "#f8fafc", minHeight: "100vh" }}
>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
    <div style={{ marginBottom: 24 }}>
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
    Nuova pratica
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
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 24,
  marginBottom: 16,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}}
            >
              <div>
            <h2
  style={{
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }}
>
  Dati pratica
</h2>
               <p className="mt-1 text-sm text-slate-500">
                  Seleziona cliente, tipo pratica e informazioni principali.
                </p>
              </div>

          <div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    width: "100%",
  }}
>
  <a
    href="/pratiche"
    style={{
      border: "1px solid #d1d5db",
      borderRadius: 8,
      padding: "9px 16px",
      background: "#fff",
      color: "#111827",
      fontSize: 14,
      fontWeight: 700,
      textDecoration: "none",
    }}
  >
    Torna alle pratiche
  </a>
</div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <label style={labelStyle}>Cliente</label>
                <select
                  style={inputStyle}
                  value={form.cliente_id}
                  onChange={(e) => aggiornaCampo("cliente_id", e.target.value)}
                  required
                >
                  <option value="">Seleziona cliente</option>
                  {clienti.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Tipo pratica</label>
                <select
                  style={inputStyle}
                  value={form.tipo_pratica_id}
                  onChange={(e) => aggiornaCampo("tipo_pratica_id", e.target.value)}
                  required
                >
                  <option value="">Seleziona pratica</option>
                  {tipiPratica.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.ente} - {tipo.nome}
                    </option>
                  ))}
                </select>
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
                <label style={labelStyle}>Assegnata a</label>
                <select
                  style={inputStyle}
                  value={form.assegnato_a}
                  onChange={(e) => aggiornaCampo("assegnato_a", e.target.value)}
                >
                  <option value="">Non assegnata</option>
                  {utenti.map((utente) => (
                    <option key={utente.id} value={utente.id}>
                      {utente.nome}
                    </option>
                  ))}
                </select>
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
  marginBottom: 16,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}}
          >
         <h2
  style={{
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    marginTop: 0,
    marginBottom: 0,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }}
>
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

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
