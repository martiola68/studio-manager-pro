"use client";

import { Edit, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { getSupabaseClient } from "@/lib/supabase/client";

type Modello = {
  id: string;
  codice: string;
  titolo: string;
  tipo_pratica: string | null;
  attivo: boolean;
  file_name: string | null;
  file_path: string | null;
  storage_bucket: string | null;
  created_at: string;
  updated_at: string | null;
};

const tipiPratica = [
  { label: "Tutti i tipi pratica", value: "" },
  { label: "Distribuzione utili", value: "distribuzione_utili", codice: "VERBALE_UTILI" },
  { label: "Determina AU / CDA", value: "determina_au_cda", codice: "DETERMINA_AU_CDA" },
  { label: "Messa in liquidazione", value: "messa_liquidazione", codice: "VERBALE_LIQUIDAZIONE" },
  { label: "Modifica/Nomina amministratore/i", value: "nomina_amministratori", codice: "NOMINA_AMMINISTRATORI" },
  { label: "Modifica/Nomina Revisore unico", value: "nomina_revisore_unico", codice: "NOMINA_REVISORE_UNICO" },
  { label: "Modifica/Nomina Collegio sindacale", value: "nomina_collegio_sindacale", codice: "NOMINA_COLLEGIO_SINDACALE" },
  { label: "Accettazione carica/che", value: "accettazione_cariche", codice: "ACCETTAZIONE_CARICHE" },
];

const variabiliPratiche = [
  "[CLIENTE]",
  "[CODICE_FISCALE]",
  "[PARTITA_IVA]",
  "[SEDE]",
  "[INDIRIZZO]",
  "[CAP]",
  "[CITTA]",
  "[PROVINCIA]",
  "[DATA_VERBALE]",
  "[NUMERO_PRATICA]",
  "[TIPO_PRATICA]",
  "[PROFESSIONISTA_NOME]",
  "[LIQUIDATORE_NOME]",
  "[LIQUIDATORE_CF]",
  "[SOCI]",
  "[SOCI_ELENCO]",
  "[SOCI_TABELLA]",
  "[PERCENTUALE_CAPITALE]",
  "[AMMINISTRATORE_NOME]",
  "[AMMINISTRATORE_CF]",
  "[REVISORE_NOME]",
  "[COLLEGIO_SINDACALE]",
  "[DICHIARAZIONE_CONFORMITA]",
];

const font =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const emptyForm = {
  codice: "",
  titolo: "",
  tipo_pratica: "",
  attivo: true,
};

export default function ModelliPratichePage() {
  const [modelli, setModelli] = useState<Modello[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

async function verificaAdmin() {
  const supabase = getSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    setIsAdmin(false);
    setCheckingAdmin(false);
    return;
  }

 const { data, error } = await supabase
  .from("tbutenti" as any)
  .select("tipo_utente")
  .eq("email", user.email)
  .maybeSingle();

const utente = data as unknown as { tipo_utente?: string } | null;

if (error || utente?.tipo_utente !== "Admin") {
  setIsAdmin(false);
} else {
  setIsAdmin(true);
}

setCheckingAdmin(false);
}

async function caricaModelli() {
    setLoading(true);
    setMessaggio("");

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tbpratiche_modelli" as any)
      .select("*")
      .order("codice", { ascending: true });

    if (error) {
      setMessaggio(error.message);
    } else {
      setModelli((data || []) as unknown as Modello[]);
    }

    setLoading(false);
  }

 useEffect(() => {
  verificaAdmin();
  caricaModelli();
}, []);

  function aggiornaTipoPratica(value: string) {
    const tipo = tipiPratica.find((t) => t.value === value);

    setForm((prev) => ({
      ...prev,
      tipo_pratica: value,
      codice: tipo?.codice || prev.codice,
      titolo: tipo?.label && value ? tipo.label : prev.titolo,
    }));
  }

  async function salvaModello(e: React.FormEvent) {
    e.preventDefault();

    if (!isAdmin) {
  setMessaggio("Non autorizzato. Solo gli amministratori possono modificare i modelli.");
  return;
}

    if (!form.codice.trim()) {
      setMessaggio("Il codice modello è obbligatorio.");
      return;
    }

    if (!form.titolo.trim()) {
      setMessaggio("Il titolo modello è obbligatorio.");
      return;
    }

    if (!editingId && !file) {
      setMessaggio("Il file DOCX è obbligatorio per un nuovo modello.");
      return;
    }

    setSaving(true);
    setMessaggio("");

    try {
      const supabase = getSupabaseClient();

      let filePath: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        fileName = safeName;
        filePath = `${form.codice}/${Date.now()}-${safeName}`;

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
      }

      const payload: any = {
        codice: form.codice.trim().toUpperCase(),
        titolo: form.titolo.trim(),
        tipo_pratica: form.tipo_pratica || null,
        attivo: form.attivo,
        storage_bucket: "pratiche-modelli",
        updated_at: new Date().toISOString(),
      };

      if (filePath) payload.file_path = filePath;
      if (fileName) payload.file_name = fileName;

      let dbError;

      if (editingId) {
        const { error } = await supabase
          .from("tbpratiche_modelli" as any)
          .update(payload)
          .eq("id", editingId);

        dbError = error;
      } else {
        const { error } = await supabase
          .from("tbpratiche_modelli" as any)
          .upsert(payload, { onConflict: "codice" });

        dbError = error;
      }

      if (dbError) throw new Error(dbError.message);

      setMessaggio("Modello salvato correttamente.");
      setForm(emptyForm);
      setFile(null);
      setEditingId(null);
      await caricaModelli();
    } catch (error: any) {
      setMessaggio(error.message || "Errore salvataggio modello.");
    } finally {
      setSaving(false);
    }
  }

  function modificaModello(m: Modello) {
    if (!isAdmin) {
  setMessaggio("Non autorizzato. Solo gli amministratori possono modificare i modelli.");
  return;
}
    setEditingId(m.id);
    setFile(null);
    setForm({
      codice: m.codice || "",
      titolo: m.titolo || "",
      tipo_pratica: m.tipo_pratica || "",
      attivo: Boolean(m.attivo),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFile(null);
    setMessaggio("");
  }

  async function eliminaModello(id: string) {
    const supabase = getSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

if (!isAdmin) {
  alert("Non autorizzato. Solo gli amministratori possono eliminare i modelli.");
  return;
}

    if (!confirm("Eliminare questo modello pratiche?")) return;

    const { error } = await supabase
      .from("tbpratiche_modelli" as any)
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
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <Link href="/pratiche" style={{ color: "#2563eb", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
              ← Torna alle pratiche
            </Link>

            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#020617", margin: "14px 0 0" }}>
              Modelli pratiche
            </h1>

            <p style={{ marginTop: 6, fontSize: 15, color: "#64748b" }}>
              Gestione testi e modelli DOCX per verbali, determine e documenti societari.
            </p>
          </div>

          <button type="button" onClick={caricaModelli} style={secondaryButtonStyle}>
            <RefreshCw size={16} />
            Aggiorna
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.9fr", gap: 18, alignItems: "start" }}>
         {isAdmin ? (
  <form onSubmit={salvaModello} style={cardStyle}>
            <h2 style={titleStyle}>{editingId ? "Modifica modello" : "Nuovo modello"}</h2>

            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>Tipo pratica</label>
              <select
                style={inputStyle}
                value={form.tipo_pratica}
                onChange={(e) => aggiornaTipoPratica(e.target.value)}
              >
                {tipiPratica.map((t) => (
                  <option key={t.value || "tutti"} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Codice</label>
              <input
                style={inputStyle}
                value={form.codice}
                onChange={(e) => setForm((prev) => ({ ...prev, codice: e.target.value.toUpperCase() }))}
                placeholder="VERBALE_LIQUIDAZIONE"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Titolo</label>
              <input
                style={inputStyle}
                value={form.titolo}
                onChange={(e) => setForm((prev) => ({ ...prev, titolo: e.target.value }))}
                placeholder="Verbale messa in liquidazione"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={form.attivo}
                  onChange={(e) => setForm((prev) => ({ ...prev, attivo: e.target.checked }))}
                />
                Modello attivo
              </label>
            </div>

            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>File DOCX</label>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {editingId && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                  Se non scegli un nuovo file, resta collegato il DOCX attuale.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button type="submit" disabled={saving} style={buttonStyle}>
                <Upload size={16} />
                {saving ? "Salvataggio..." : editingId ? "Aggiorna modello" : "Salva modello"}
              </button>

              {editingId && (
                <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                  Annulla
                </button>
              )}
            </div>

            {messaggio && (
              <div style={{ marginTop: 16, fontSize: 14, color: messaggio.toLowerCase().includes("errore") ? "#dc2626" : "#475569" }}>
                {messaggio}
              </div>
            )}
            </form>
) : (
  <div style={cardStyle}>
    <h2 style={titleStyle}>Accesso riservato</h2>
    <p style={{ marginTop: 10, color: "#64748b", fontSize: 14 }}>
      Solo gli amministratori possono creare o modificare i modelli pratiche.
    </p>
  </div>
)}

          <div style={{ display: "grid", gap: 18 }}>
            <div style={cardStyle}>
              <h2 style={titleStyle}>Variabili disponibili</h2>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                {variabiliPratiche.map((v) => (
                  <span key={v} style={variableBadgeStyle}>
                    {v}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflowX: "auto" }}>
              <div style={{ padding: 18, borderBottom: "1px solid #e5e7eb" }}>
                <h2 style={titleStyle}>Archivio modelli</h2>
              </div>

              {loading ? (
                <div style={{ padding: 24, color: "#64748b" }}>Caricamento...</div>
              ) : modelli.length === 0 ? (
                <div style={{ padding: 24, color: "#64748b" }}>Nessun modello caricato.</div>
              ) : (
                <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      <th style={thStyle}>Codice</th>
                      <th style={thStyle}>Titolo</th>
                      <th style={thStyle}>Tipo pratica</th>
                      <th style={thStyle}>File</th>
                      <th style={thStyle}>Attivo</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {modelli.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: "monospace", fontSize: 12 }}>{m.codice}</span>
                        </td>

                        <td style={tdStyle}>
                          <strong>{m.titolo}</strong>
                        </td>

                        <td style={tdStyle}>
                          {tipiPratica.find((t) => t.value === m.tipo_pratica)?.label || "Tutti"}
                        </td>

                        <td style={tdStyle}>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            {m.file_name || "—"}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                            {m.file_path || "—"}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <span style={m.attivo ? activeBadgeStyle : inactiveBadgeStyle}>
                            {m.attivo ? "Sì" : "No"}
                          </span>
                        </td>

                        <td style={{ ...tdStyle, textAlign: "right" }}>
                         {isAdmin && (
  <>
    <button type="button" title="Modifica" onClick={() => modificaModello(m)} style={iconButtonStyle}>
      <Edit size={17} />
    </button>

    <button type="button" title="Elimina" onClick={() => eliminaModello(m.id)} style={{ ...iconButtonStyle, color: "#dc2626" }}>
      <Trash2 size={17} />
    </button>
  </>
)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 20,
};

const titleStyle: React.CSSProperties = {
  fontSize: 19,
  fontWeight: 800,
  color: "#020617",
  margin: 0,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 7,
  padding: "10px 12px",
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
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#2563eb",
  color: "#fff",
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: font,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#fff",
  color: "#111827",
  padding: "9px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: font,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const variableBadgeStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  borderRadius: 6,
  padding: "5px 9px",
  fontFamily: "monospace",
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 800,
  color: "#334155",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: 14,
  fontSize: 14,
  color: "#0f172a",
  verticalAlign: "middle",
};

const activeBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "4px 9px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 800,
};

const inactiveBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "4px 9px",
  background: "#fee2e2",
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 800,
};

const iconButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  borderRadius: 7,
  padding: 7,
  cursor: "pointer",
  marginLeft: 6,
  display: "inline-flex",
  alignItems: "center",
};
