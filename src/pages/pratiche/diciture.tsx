"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

type Dicitura = {
  id: string;
  codice: string;
  titolo: string;
  categoria: string;
  testo: string;
  attiva: boolean;
};

const font =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #9ca3af",
  borderRadius: 7,
  padding: "9px 10px",
  fontSize: 14,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: font,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
  fontFamily: font,
};

const emptyForm = {
  codice: "",
  titolo: "",
  categoria: "verbale",
  testo: "",
  attiva: true,
};

export default function DiciturePratichePage() {
  const [diciture, setDiciture] = useState<Dicitura[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState("");

  const [form, setForm] = useState(emptyForm);

  async function caricaDiciture() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tbpratiche_dicitura_documenti" as any)
      .select("*")
      .order("categoria")
      .order("titolo");

    if (error) {
      setMessaggio(error.message);
    } else {
     setDiciture((data || []) as unknown as Dicitura[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    caricaDiciture();
  }, []);

  function aggiornaCampo(campo: string, valore: string | boolean) {
    setForm((prev) => ({
      ...prev,
      [campo]: valore,
    }));
  }

  function nuovaDicitura() {
    setEditingId(null);
    setForm(emptyForm);
    setMessaggio("");
  }

  function modificaDicitura(dicitura: Dicitura) {
    setEditingId(dicitura.id);
    setForm({
      codice: dicitura.codice || "",
      titolo: dicitura.titolo || "",
      categoria: dicitura.categoria || "verbale",
      testo: dicitura.testo || "",
      attiva: dicitura.attiva ?? true,
    });
    setMessaggio("");
  }

  async function salvaDicitura(e: React.FormEvent) {
    e.preventDefault();

    if (!form.codice.trim() || !form.titolo.trim() || !form.testo.trim()) {
      setMessaggio("Codice, titolo e testo sono obbligatori.");
      return;
    }

    setSaving(true);
    setMessaggio("");

    const supabase = getSupabaseClient();

  const payload = {
  codice: form.codice.trim(),
  titolo: form.codice.trim(),
  categoria: "verbale",
  testo: form.testo,
  attiva: true,
  updated_at: new Date().toISOString(),
};
    const result = editingId
      ? await supabase
          .from("tbpratiche_dicitura_documenti" as any)
          .update(payload)
          .eq("id", editingId)
      : await supabase
          .from("tbpratiche_dicitura_documenti" as any)
          .insert(payload);

    if (result.error) {
      setMessaggio(result.error.message);
    } else {
      setMessaggio("Dicitura salvata correttamente.");
      nuovaDicitura();
      await caricaDiciture();
    }

    setSaving(false);
  }

  async function eliminaDicitura(id: string) {
    if (!confirm("Eliminare questa dicitura?")) return;

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("tbpratiche_dicitura_documenti" as any)
      .delete()
      .eq("id", id);

    if (error) {
      setMessaggio(error.message);
      return;
    }

    await caricaDiciture();
  }

  return (
    <main
      style={{
        padding: 28,
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily: font,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/pratiche"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Torna alle pratiche
          </Link>

          <h1
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: "#0f172a",
              margin: "14px 0 0",
              lineHeight: 1.1,
            }}
          >
            Diciture documenti
          </h1>

          <p style={{ marginTop: 8, fontSize: 15, color: "#64748b" }}>
            Gestione testi standard da usare nei verbali, atti e documenti delle pratiche.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <form
            onSubmit={salvaDicitura}
            style={{
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
              }}
            >
              {editingId ? "Modifica dicitura" : "Nuova dicitura"}
            </h2>

            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>Codice</label>
              <input
                style={inputStyle}
                value={form.codice}
                onChange={(e) => aggiornaCampo("codice", e.target.value)}
                placeholder="Es. CONFORMITA_VERBALE_LIBRO_SOCI"
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Titolo</label>
              <input
                style={inputStyle}
                value={form.titolo}
                onChange={(e) => aggiornaCampo("titolo", e.target.value)}
                placeholder="Es. Dichiarazione conformità verbale"
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Categoria</label>
              <select
                style={inputStyle}
                value={form.categoria}
                onChange={(e) => aggiornaCampo("categoria", e.target.value)}
              >
                <option value="verbale">Verbale</option>
                <option value="presentazione">Presentazione</option>
                <option value="atto">Atto</option>
                <option value="generale">Generale</option>
              </select>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Testo</label>
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 180,
                  resize: "vertical",
                }}
                value={form.testo}
                onChange={(e) => aggiornaCampo("testo", e.target.value)}
                placeholder="Usa [PROFESSIONISTA_NOME] come variabile automatica."
              />
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                id="attiva"
                type="checkbox"
                checked={form.attiva}
                onChange={(e) => aggiornaCampo("attiva", e.target.checked)}
              />
              <label htmlFor="attiva" style={{ fontSize: 14 }}>
                Dicitura attiva
              </label>
            </div>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={nuovaDicitura}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: "#fff",
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: font,
                }}
              >
                Pulisci
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  border: 0,
                  borderRadius: 8,
                  background: "#2563eb",
                  color: "#fff",
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  fontFamily: font,
                }}
              >
                {saving ? "Salvataggio..." : "Salva dicitura"}
              </button>
            </div>

            {messaggio && (
              <div
                style={{
                  marginTop: 16,
                  fontSize: 14,
                  color: messaggio.includes("Errore") ? "#dc2626" : "#64748b",
                }}
              >
                {messaggio}
              </div>
            )}
          </form>

          <div
            style={{
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 20,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0,
                }}
              >
                Elenco diciture
              </h2>
              <p style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>
                {diciture.length} diciture presenti
              </p>
            </div>

            {loading ? (
              <div style={{ padding: 24, color: "#64748b" }}>
                Caricamento...
              </div>
            ) : diciture.length === 0 ? (
              <div style={{ padding: 24, color: "#64748b" }}>
                Nessuna dicitura presente.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <th style={thStyle}>Titolo</th>
                    <th style={thStyle}>Categoria</th>
                    <th style={thStyle}>Stato</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {diciture.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          {d.titolo}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            color: "#64748b",
                            fontSize: 12,
                            fontFamily: "monospace",
                          }}
                        >
                          {d.codice}
                        </div>
                      </td>

                      <td style={tdStyle}>{d.categoria}</td>

                      <td style={tdStyle}>
                        {d.attiva ? "Attiva" : "Disattiva"}
                      </td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => modificaDicitura(d)}
                          style={actionButtonStyle}
                        >
                          Modifica
                        </button>

                        <button
                          type="button"
                          onClick={() => eliminaDicitura(d.id)}
                          style={{
                            ...actionButtonStyle,
                            color: "#dc2626",
                          }}
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: 16,
  fontSize: 14,
  color: "#334155",
  verticalAlign: "top",
};

const actionButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#2563eb",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  marginLeft: 10,
  fontFamily: font,
};
