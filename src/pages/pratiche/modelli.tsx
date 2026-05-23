"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Modello = {
  id: string;
  nome: string;
  codice: string;
  categoria: string;
  file_path: string;
  attivo: boolean;
  created_at: string;
};

const categorie = [
  { label: "Distribuzione utili", value: "distribuzione_utili", codice: "VERBALE_UTILI" },
  { label: "Determina AU / CDA", value: "determina_au_cda", codice: "DETERMINA_AU_CDA" },
  { label: "Modifica/Nomina amministratore/i", value: "nomina_amministratori", codice: "NOMINA_AMMINISTRATORI" },
  { label: "Modifica/Nomina Revisore unico", value: "nomina_revisore_unico", codice: "NOMINA_REVISORE_UNICO" },
  { label: "Modifica/Nomina Collegio sindacale", value: "nomina_collegio_sindacale", codice: "NOMINA_COLLEGIO_SINDACALE" },
  { label: "Accettazione carica/che", value: "accettazione_cariche", codice: "ACCETTAZIONE_CARICHE" },
];

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

export default function ModelliUtilitaPage() {
  const [modelli, setModelli] = useState<Modello[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categoria, setCategoria] = useState("distribuzione_utili");
  const [file, setFile] = useState<File | null>(null);
  const [messaggio, setMessaggio] = useState("");

  async function caricaModelli() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tbpratiche_modelli_utilita" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessaggio(error.message);
    } else {
      setModelli((data || []) as unknown as Modello[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    caricaModelli();
  }, []);

  async function salvaModello(e: React.FormEvent) {
    e.preventDefault();

    if (!file) {
      setMessaggio("Il file DOCX è obbligatorio.");
      return;
    }

    const categoriaScelta = categorie.find((c) => c.value === categoria);

    if (!categoriaScelta) {
      setMessaggio("Categoria non valida.");
      return;
    }

    setSaving(true);
    setMessaggio("");

    try {
      const supabase = getSupabaseClient();

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${categoriaScelta.codice}/${Date.now()}-${safeName}`;

      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("pratiche-modelli")
        .upload(filePath, arrayBuffer, {
          contentType:
            file.type ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const payload = {
        nome: categoriaScelta.label,
        codice: categoriaScelta.codice,
        categoria: categoriaScelta.value,
        tipo_pratica_id: null,
        file_path: filePath,
        attivo: true,
        updated_at: new Date().toISOString(),
      };

      const { error: dbError } = await supabase
        .from("tbpratiche_modelli_utilita" as any)
        .upsert(payload, { onConflict: "codice" });

      if (dbError) throw new Error(dbError.message);

      setMessaggio("Modello caricato correttamente.");
      setFile(null);
      await caricaModelli();
    } catch (error: any) {
      setMessaggio(error.message || "Errore caricamento modello");
    } finally {
      setSaving(false);
    }
  }

  async function eliminaModello(id: string) {
    const supabase = getSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email?.toLowerCase() !== "m.artiola@revisionicommerciali.it") {
      alert("Non autorizzato.");
      return;
    }

    if (!confirm("Eliminare questo modello?")) return;

    const { error } = await supabase
      .from("tbpratiche_modelli_utilita" as any)
      .delete()
      .eq("id", id);

    if (error) {
      setMessaggio(error.message);
      return;
    }

    await caricaModelli();
  }

  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/pratiche" style={{ color: "#2563eb", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            ← Torna alle pratiche
          </Link>

          <h1 style={{ fontSize: 34, fontWeight: 700, color: "#0f172a", margin: "14px 0 0" }}>
            Modelli di utilità
          </h1>

          <p style={{ marginTop: 8, fontSize: 15, color: "#64748b" }}>
            Carica bozze Word DOCX da compilare automaticamente nelle pratiche.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
          <form onSubmit={salvaModello} style={cardStyle}>
            <h2 style={titleStyle}>Carica modello</h2>

            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>Categoria modello</label>
              <select style={inputStyle} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {categorie.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 14, fontSize: 13, color: "#64748b" }}>
              Codice automatico:{" "}
              <strong>
                {categorie.find((c) => c.value === categoria)?.codice}
              </strong>
            </div>

            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>File DOCX</label>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <button type="submit" disabled={saving} style={buttonStyle}>
              {saving ? "Caricamento..." : "Carica modello"}
            </button>

            {messaggio && (
              <div style={{ marginTop: 16, fontSize: 14, color: messaggio.includes("Errore") ? "#dc2626" : "#64748b" }}>
                {messaggio}
              </div>
            )}
          </form>

          <div style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: 20, borderBottom: "1px solid #e5e7eb" }}>
              <h2 style={titleStyle}>Modelli caricati</h2>
              <p style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>
                {modelli.length} modelli presenti
              </p>
            </div>

            {loading ? (
              <div style={{ padding: 24, color: "#64748b" }}>Caricamento...</div>
            ) : modelli.length === 0 ? (
              <div style={{ padding: 24, color: "#64748b" }}>Nessun modello caricato.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <th style={thStyle}>Nome</th>
                    <th style={thStyle}>Categoria</th>
                    <th style={thStyle}>Codice</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {modelli.map((m) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{m.nome}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{m.file_path}</div>
                      </td>

                      <td style={tdStyle}>{m.categoria}</td>

                      <td style={tdStyle}>
                        <span style={{ fontFamily: "monospace", fontSize: 12 }}>{m.codice}</span>
                      </td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          type="button"
                          title="Elimina modello"
                          onClick={() => eliminaModello(m.id)}
                          style={{
                            border: 0,
                            background: "transparent",
                            color: "#dc2626",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
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
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 24,
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#0f172a",
  margin: 0,
};

const buttonStyle: React.CSSProperties = {
  marginTop: 20,
  border: 0,
  borderRadius: 8,
  background: "#2563eb",
  color: "#fff",
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: font,
};

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
