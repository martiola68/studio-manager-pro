import { useEffect, useState } from "react";

type Richiesta = {
  id: string;
  numero_richiesta: string | null;
  submitted_at: string | null;
  azienda: string | null;
  cognome_nome: string;
  codice_fiscale: string;
  decorrenza_assunzione: string;
  tipologia_contratto: string;
  stato: string;
  tbclienti?: {
    ragione_sociale?: string | null;
  } | null;
};

export default function RichiesteAreaClientePage() {
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    caricaRichieste();
  }, []);

  async function caricaRichieste() {
    try {
      const res = await fetch("/api/payroll/richieste-area-cliente");
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento richieste");
      }

      setRichieste(json.richieste || []);
    } catch (error) {
      console.error(error);
      alert("Errore caricamento richieste area cliente.");
    } finally {
      setLoading(false);
    }
  }

 async function apriDettaglio(id: string) {
  const res = await fetch(`/api/payroll/richieste-area-cliente?id=${id}`);
  const json = await res.json();

  if (!res.ok || !json.success) {
    alert(json.error || "Errore apertura dettaglio");
    return;
  }

  setSelected({
    ...json.richiesta,
    allegati: json.allegati || [],
  });
}
  function formatDate(value?: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("it-IT");
  }

  async function apriDocumento(allegato: any) {
  try {
    const res = await fetch("/api/payroll/richieste-area-cliente", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        azione: "signed_url",
        file_path: allegato.file_path,
        storage_bucket: allegato.storage_bucket,
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || "Errore apertura documento");
    }

    window.open(json.signedUrl, "_blank");
  } catch (error: any) {
    alert(error.message || "Errore apertura documento");
  }
}

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ marginTop: 0 }}>Richieste Area Cliente</h1>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Numero</th>
              <th style={th}>Tipo</th>
              <th style={th}>Cliente</th>
              <th style={th}>Lavoratore</th>
              <th style={th}>Decorrenza</th>
              <th style={th}>Stato</th>
              <th style={th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {richieste.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.numero_richiesta || "-"}</td>
                <td style={td}>Assunzione</td>
                <td style={td}>
                  {r.tbclienti?.ragione_sociale || r.azienda || "-"}
                </td>
                <td style={td}>{r.cognome_nome}</td>
                <td style={td}>{formatDate(r.decorrenza_assunzione)}</td>
                <td style={td}>
                  <strong>{r.stato || "inviata"}</strong>
                </td>
                <td style={td}>
                  <button onClick={() => apriDettaglio(r.id)}>
                    Apri
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div style={modalOverlay}>
          <div style={modal}>
            <button style={closeBtn} onClick={() => setSelected(null)}>
              ×
            </button>

            <h2>Dettaglio richiesta</h2>
            <p>
              <strong>{selected.numero_richiesta}</strong> —{" "}
              {selected.tbclienti?.ragione_sociale || selected.azienda}
            </p>

            <Section title="Dati lavoratore">
              <Row label="Cognome e nome" value={selected.cognome_nome} />
              <Row label="Codice fiscale" value={selected.codice_fiscale} />
              <Row label="Luogo nascita" value={selected.luogo_nascita} />
              <Row label="Data nascita" value={formatDate(selected.data_nascita)} />
              <Row label="Cittadinanza" value={selected.cittadinanza} />
              <Row label="Extra UE" value={selected.extra_ue ? "Sì" : "No"} />
              <Row label="Residenza" value={selected.indirizzo_residenza} />
              <Row label="Domicilio" value={selected.indirizzo_domicilio} />
              <Row label="Telefono" value={selected.telefono} />
              <Row label="Email" value={selected.email} />
              <Row label="Stato civile" value={selected.stato_civile} />
              <Row label="IBAN" value={selected.iban} />
            </Section>

            <Section title="Dati assunzione">
              <Row label="Decorrenza" value={formatDate(selected.decorrenza_assunzione)} />
              <Row label="Sede lavoro" value={selected.sede_lavoro} />
              <Row label="Contratto" value={selected.tipologia_contratto} />
              <Row label="Durata" value={selected.durata} />
              <Row label="Mansione" value={selected.mansione} />
              <Row label="Livello" value={selected.livello} />
              <Row label="Orario" value={selected.orario_lavoro} />
              <Row label="Distribuzione oraria" value={selected.distribuzione_oraria} />
              <Row label="Retribuzione" value={selected.retribuzione} />
              <Row label="Centro costo" value={selected.centro_costo} />
              <Row label="NASPI" value={selected.percettore_naspi ? "Sì" : "No"} />
              <Row label="Note cliente" value={selected.note_cliente} />
            </Section>

            <Section title="Documenti allegati">
<DocumentoRow
  label="Documento identità - fronte"
  allegato={trovaAllegato(selected, "documento_fronte")}
  onApri={apriDocumento}
/>
  <DocumentoRow
    label="Documento identità - retro"
    allegato={trovaAllegato(selected, "documento_retro")}
  />
  <DocumentoRow
    label="Codice fiscale / tessera sanitaria"
    allegato={trovaAllegato(selected, "codice_fiscale")}
  />
  <DocumentoRow
    label="Permesso di soggiorno"
    allegato={selected.extra_ue ? trovaAllegato(selected, "permesso_soggiorno") : null}
    nonRichiesto={!selected.extra_ue}
  />
  <DocumentoRow
    label="Curriculum vitae"
    allegato={
      selected.tipologia_contratto === "stage" ||
      selected.tipologia_contratto === "apprendistato"
        ? trovaAllegato(selected, "curriculum")
        : null
    }
    nonRichiesto={
      selected.tipologia_contratto !== "stage" &&
      selected.tipologia_contratto !== "apprendistato"
    }
  />
</Section>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button>Prendi in carico</button>
              <button>Richiedi documenti</button>
              <button>Concludi pratica</button>
              <button>Stampa PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: any) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value || "-"}</div>
    </div>
  );
}

function trovaAllegato(richiesta: any, tipo: string) {
  return (richiesta.allegati || []).find(
    (a: any) => a.tipo_documento === tipo
  );
}

function DocumentoRow({
  label,
  allegato,
  nonRichiesto,
  onApri,
}: {
  label: string;
  allegato?: any;
  nonRichiesto?: boolean;
  onApri?: (allegato: any) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
        {label}
      </div>

      {nonRichiesto ? (
        <div style={{ fontWeight: 700, color: "#6b7280" }}>Non richiesto</div>
      ) : allegato ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, color: "#16a34a" }}>
            ✅ {allegato.file_name}
          </span>
          <button
            type="button"
            onClick={() => onApri?.(allegato)}
            style={{
              border: "1px solid #d1d5db",
              background: "#fff",
              borderRadius: 8,
              padding: "5px 9px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Apri
          </button>
        </div>
      ) : (
        <div style={{ fontWeight: 700, color: "#dc2626" }}>Mancante</div>
      )}
    </div>
  );
}

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: 30,
  overflow: "auto",
  zIndex: 9999,
};

const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 24,
  maxWidth: 1100,
  width: "100%",
  position: "relative",
};

const closeBtn: React.CSSProperties = {
  position: "absolute",
  right: 16,
  top: 12,
  border: "none",
  background: "transparent",
  fontSize: 28,
  cursor: "pointer",
};
