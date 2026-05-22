"use client";
import { Trash2, Download } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type PraticaDettaglio = {
  id: string;
  numero_pratica: string;
  titolo: string;
  stato: string;
  priorita: string;
  data_apertura: string;
  cliente?: {
    ragione_sociale?: string;
    codice_fiscale?: string;
    partita_iva?: string;
    indirizzo?: string;
    cap?: string;
    citta?: string;
    provincia?: string;
    numero_rea?: string;
  };
  tipo?: {
    ente?: string;
    nome?: string;
  };
  assegnatario?: {
    nome?: string;
    cognome?: string;
  };
dati_documento?: any;
rappresentante_legale?: {
  nome_cognome?: string;
  codice_fiscale?: string;
};
};

type Professionista = {
  id: string;
  ragione_sociale: string;
  codice_fiscale?: string | null;
};

type MotivoLiquidazione = {
  id: string;
  titolo: string;
  testo_verbale: string;
};

type Dicitura = {
  id: string;
  titolo: string;
  testo: string;
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

export default function DettaglioPraticaPage() {
  const router = useRouter();
const praticaId = router.query.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");
  const [pratica, setPratica] = useState<PraticaDettaglio | null>(null);

  const [professionisti, setProfessionisti] = useState<Professionista[]>([]);
  const [motiviLiquidazione, setMotiviLiquidazione] = useState<MotivoLiquidazione[]>([]);
  
const [diciture, setDiciture] = useState<Dicitura[]>([]);
const [rappresentantiLegali, setRappresentantiLegali] = useState<any[]>([]);
const [mostraNuovoLiquidatore, setMostraNuovoLiquidatore] = useState(false);
const [nuovoLiquidatore, setNuovoLiquidatore] = useState({
  nome_cognome: "",
  codice_fiscale: "",
});

const [documenti, setDocumenti] = useState<any[]>([]);
const [soggetti, setSoggetti] = useState<any[]>([]);
  const [soci, setSoci] = useState<any[]>([]);
  const [nominativi, setNominativi] = useState<any[]>([]);
  const [clientiImport, setClientiImport] = useState<any[]>([]);
const [modelli, setModelli] = useState<any[]>([]);
const [modelloSelezionato, setModelloSelezionato] =
  useState("");
  
const [uploadingDocumento, setUploadingDocumento] = useState(false);
const [tipoDocumento, setTipoDocumento] = useState("altro");
const [fileDocumento, setFileDocumento] = useState<File | null>(null);

const [nuovoSoggetto, setNuovoSoggetto] = useState({
  tipo_soggetto: "amministratore",
  nominativo_id: "",
  nome_cognome: "",
  codice_fiscale: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  carica: "Amministratore",
});

const [nuovoSocio, setNuovoSocio] = useState({
  nominativo_id: "",
  nome_cognome: "",
  codice_fiscale: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  percentuale_partecipazione: "",
  importo_utile: "",
  percentuale_ritenuta: "26",
  importo_ritenuta: "",
  importo_netto: "",
  tipo_pagamento: "",
});

  const [form, setForm] = useState({
    societa_denominazione: "",
    societa_sede: "",
    societa_codice_fiscale: "",
    societa_partita_iva: "",
    societa_rea: "",
    data_atto: "",
    ora_inizio: "",
    luogo_assemblea: "",
    presidente: "",
    segretario: "",
    motivo_liquidazione: "",
    motivo_liquidazione_altro: "",
    ora_chiusura: "",
    professionista_nome: "",
    professionista_codice_fiscale: "",
    professionista_qualifica: "",
    dicitura_presentazione: "",
rappresentante_legale_nome: "",
rappresentante_legale_codice_fiscale: "",
liquidatore_nome: "",
liquidatore_codice_fiscale: "",
percentuale_soci_presenti: "100",
  });

  useEffect(() => {
    async function caricaPratica() {
      try {
        const res = await fetch(`/api/pratiche/${praticaId}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Errore caricamento pratica");
        }

        const p = data.pratica;
        setPratica(p);

        setProfessionisti(data.professionisti || []);
        setMotiviLiquidazione(data.motivi_liquidazione || []);
        setDiciture(data.diciture || []);
        setRappresentantiLegali(data.rappresentanti_legali || []);

        const sede = [
          p.cliente?.indirizzo,
          p.cliente?.cap,
          p.cliente?.citta,
          p.cliente?.provincia,
        ]
          .filter(Boolean)
          .join(" ");

        setForm({
          societa_denominazione:
            p.dati_documento?.societa_denominazione ||
            p.cliente?.ragione_sociale ||
            "",
          societa_sede:
            p.dati_documento?.societa_sede || sede || "",
          societa_codice_fiscale:
            p.dati_documento?.societa_codice_fiscale ||
            p.cliente?.codice_fiscale ||
            "",
          societa_partita_iva:
            p.dati_documento?.societa_partita_iva ||
            p.cliente?.partita_iva ||
            "",
          societa_rea:
            p.dati_documento?.societa_rea ||
            p.cliente?.numero_rea ||
            "",
          data_atto: p.dati_documento?.data_atto || "",
          ora_inizio: p.dati_documento?.ora_inizio || "",
          luogo_assemblea: p.dati_documento?.luogo_assemblea || sede || "",
          presidente: p.dati_documento?.presidente || "",
          segretario: p.dati_documento?.segretario || "",
          motivo_liquidazione:
            p.dati_documento?.motivo_liquidazione || "",
          motivo_liquidazione_altro:
            p.dati_documento?.motivo_liquidazione_altro || "",
          ora_chiusura: p.dati_documento?.ora_chiusura || "",
          professionista_nome:
            p.dati_documento?.professionista_nome || "",
          professionista_codice_fiscale:
            p.dati_documento?.professionista_codice_fiscale || "",
          professionista_qualifica:
            p.dati_documento?.professionista_qualifica || "",
         dicitura_presentazione:
  p.dati_documento?.dicitura_presentazione || "",

rappresentante_legale_nome:
  p.dati_documento?.rappresentante_legale_nome ||
  p.rappresentante_legale?.nome_cognome ||
  "",

rappresentante_legale_codice_fiscale:
  p.dati_documento?.rappresentante_legale_codice_fiscale ||
  p.rappresentante_legale?.codice_fiscale ||
  "",

liquidatore_nome:
  p.dati_documento?.liquidatore_nome || "",

liquidatore_codice_fiscale:
  p.dati_documento?.liquidatore_codice_fiscale || "",

percentuale_soci_presenti:
  String(p.dati_documento?.percentuale_soci_presenti || 100),
        });
      } catch (error: any) {
        setMessaggio(error.message || "Errore caricamento pratica");
      } finally {
        setLoading(false);
      }
    }

if (praticaId) {
  caricaPratica();
  caricaDocumenti();
  caricaSoggetti();
  caricaSoci();
  caricaModelli();
  caricaNominativi();
  caricaClientiImport();
}


    
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function caricaModelli() {
  try {
    const res = await fetch(
      `/api/pratiche/${praticaId}/modelli`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (res.ok) {
      setModelli(data.modelli || []);
    }
  } catch (error) {
    console.error(error);
  }
}

async function caricaSoci() {
  try {
    const res = await fetch(`/api/pratiche/${praticaId}/soci`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (res.ok) {
      setSoci(data.soci || []);
    }
  } catch (error) {
    console.error(error);
  }
}

  async function caricaNominativi() {
  try {
    const res = await fetch("/api/pratiche/nominativi", {
      cache: "no-store",
    });

    const data = await res.json();

    if (res.ok) {
      setNominativi(data.nominativi || []);
    }
  } catch (error) {
    console.error(error);
  }
}

  async function caricaClientiImport() {
  try {
const res = await fetch("/api/clienti/import-nominativi", {
      cache: "no-store",
    });

    const data = await res.json();

if (res.ok) {
  setClientiImport(Array.isArray(data) ? data : data.clienti || []);
}
  } catch (error) {
    console.error(error);
  }
}
  
  async function caricaSoggetti() {
  try {
    const res = await fetch(
      `/api/pratiche/${praticaId}/soggetti`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (res.ok) {
      setSoggetti(data.soggetti || []);
    }
  } catch (error) {
    console.error(error);
  }
}
  
  async function caricaDocumenti() {
  try {
    const res = await fetch(
      `/api/pratiche/${praticaId}/documenti`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (res.ok) {
      setDocumenti(data.documenti || []);
    }
  } catch (error) {
    console.error(error);
  }
}

async function uploadDocumento() {
  if (!fileDocumento) return;

  try {
    setUploadingDocumento(true);

    const formData = new FormData();

    formData.append("file", fileDocumento);
    formData.append("tipo_documento", tipoDocumento);

    const res = await fetch(
      `/api/pratiche/${praticaId}/documenti`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || "Errore upload documento"
      );
    }

    setFileDocumento(null);
    await caricaDocumenti();
  } catch (error: any) {
    alert(error.message);
  } finally {
    setUploadingDocumento(false);
  }
}

  async function salvaDatiDocumento(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessaggio("");

    try {
      const res = await fetch(`/api/pratiche/${praticaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore salvataggio dati documento");
      }

      setMessaggio("Dati documento salvati correttamente.");
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
        Caricamento pratica...
      </main>
    );
  }

  if (!pratica) {
    return (
      <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
        Pratica non trovata.
      </main>
    );
  }

  const modelloCorrente = modelli.find(
  (m) => m.codice === modelloSelezionato
);

const mostraOrganiCariche =
  soggetti.length > 0 ||
  [
    "cda",
    "consiglio",
    "collegio",
    "sindacale",
    "amministratore",
    "legale_rappresentante",
    "cariche",
  ].some((chiave) =>
    String(modelloCorrente?.nome || modelloCorrente?.categoria || "")
      .toLowerCase()
      .includes(chiave)
  );

  const isDistribuzioneUtili =
  String(
    modelloCorrente?.nome ||
    modelloCorrente?.codice ||
    ""
  )
    .toLowerCase()
    .includes("distribuzione utili");

const percentualeSociPresentiCalcolata = soci.reduce(
  (totale, socio) =>
    totale + Number(socio.percentuale_partecipazione || 0),
  0
);

const nuovaPercentuale = Number(
  nuovoSocio.percentuale_partecipazione || 0
);

const percentualeTotaleConNuovo =
  percentualeSociPresentiCalcolata + nuovaPercentuale;

const percentualeSuperata =
  percentualeTotaleConNuovo > 100;

  const importoLordoNuovoSocio = Number(nuovoSocio.importo_utile || 0);
const percentualeRitenutaNuovoSocio = Number(nuovoSocio.percentuale_ritenuta || 0);

const importoRitenutaNuovoSocio =
  importoLordoNuovoSocio * percentualeRitenutaNuovoSocio / 100;

const importoNettoNuovoSocio =
  importoLordoNuovoSocio - importoRitenutaNuovoSocio;

  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
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
            {pratica.numero_pratica}
          </h1>

          <p style={{ marginTop: 8, fontSize: 15, color: "#64748b" }}>
            {pratica.titolo}
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0f172a" }}>
            Riepilogo pratica
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 14,
              marginTop: 18,
              fontSize: 14,
            }}
          >
            <div>
              <strong>Cliente</strong>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {pratica.cliente?.ragione_sociale || "—"}
              </div>
            </div>

            <div>
              <strong>Tipo pratica</strong>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {pratica.tipo
                  ? `${pratica.tipo.ente} - ${pratica.tipo.nome}`
                  : "—"}
              </div>
            </div>

            <div>
              <strong>Stato</strong>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {pratica.stato}
              </div>
            </div>

            <div>
              <strong>Priorità</strong>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {pratica.priorita}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={salvaDatiDocumento}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Dati per documenti
            </h2>

            <p style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>
              Questi dati verranno usati per compilare automaticamente bozze,
              verbali, atti e documenti collegati alla pratica.
            </p>

            <h3 style={{ marginTop: 24, fontSize: 16, fontWeight: 700 }}>
              Dati società
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Denominazione società</label>
                <input style={inputStyle} value={form.societa_denominazione} onChange={(e) => aggiornaCampo("societa_denominazione", e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Codice fiscale</label>
                <input style={inputStyle} value={form.societa_codice_fiscale} onChange={(e) => aggiornaCampo("societa_codice_fiscale", e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Partita IVA</label>
                <input style={inputStyle} value={form.societa_partita_iva} onChange={(e) => aggiornaCampo("societa_partita_iva", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 14 }}>
              <div>
                <label style={labelStyle}>Sede società</label>
                <input style={inputStyle} value={form.societa_sede} onChange={(e) => aggiornaCampo("societa_sede", e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>REA</label>
                <input style={inputStyle} value={form.societa_rea} onChange={(e) => aggiornaCampo("societa_rea", e.target.value)} />
              </div>
            </div>

            <h3 style={{ marginTop: 28, fontSize: 16, fontWeight: 700 }}>
              Dati verbale / atto
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Data atto</label>
                <input type="date" style={inputStyle} value={form.data_atto} onChange={(e) => aggiornaCampo("data_atto", e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Ora inizio</label>
                <input type="time" style={inputStyle} value={form.ora_inizio} onChange={(e) => aggiornaCampo("ora_inizio", e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Luogo assemblea</label>
                <input style={inputStyle} value={form.luogo_assemblea} onChange={(e) => aggiornaCampo("luogo_assemblea", e.target.value)} />
              </div>
            </div>

           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
  <div>
    <label style={labelStyle}>Rappresentante legale</label>
    <input
      style={inputStyle}
      value={form.rappresentante_legale_nome}
      onChange={(e) =>
        aggiornaCampo("rappresentante_legale_nome", e.target.value)
      }
    />
  </div>

  <div>
    <label style={labelStyle}>CF rappresentante legale</label>
    <input
      style={inputStyle}
      value={form.rappresentante_legale_codice_fiscale}
      onChange={(e) =>
        aggiornaCampo("rappresentante_legale_codice_fiscale", e.target.value)
      }
    />
  </div>

  <div>
    <label style={labelStyle}>% soci presenti</label>
  <input
  type="number"
  min="0"
  max="100"
  style={{
    ...inputStyle,
    background:
      percentualeSociPresentiCalcolata > 100
        ? "#dc2626"
        : "#fff",

    color:
      percentualeSociPresentiCalcolata > 100
        ? "#fff"
        : "#111827",

    borderColor:
      percentualeSociPresentiCalcolata > 100
        ? "#dc2626"
        : "#9ca3af",

    fontWeight:
      percentualeSociPresentiCalcolata > 100
        ? 700
        : 500,
  }}
  value={percentualeSociPresentiCalcolata}
  disabled
/>
  </div>
</div>



<div
  style={{
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 24,
    marginTop: 16,
  }}
>
  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0f172a" }}>
    Soci presenti / Distribuzione utili
  </h2>

 <div
  style={{
    display: "grid",
  gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr",
    gap: 12,
    marginTop: 18,
    alignItems: "end",
  }}
>
 
<div>
  <label style={labelStyle}>
    Cognome e nome
  </label>

  <select
    style={inputStyle}
    value={nuovoSocio.nominativo_id}
    onChange={(e) => {
      const value = e.target.value;

      if (value === "__nuovo__") {
        setNuovoSocio({
          ...nuovoSocio,
          nominativo_id: "__nuovo__",
          nome_cognome: "",
          codice_fiscale: "",
        });
        return;
      }

      const selected = nominativi.find(
        (n) => n.id === value
      );

     setNuovoSocio({
  ...nuovoSocio,
  nominativo_id: selected?.id || "",
  nome_cognome: selected?.nome_cognome || "",
  codice_fiscale: selected?.codice_fiscale || "",
  indirizzo: selected?.indirizzo || "",
  cap: selected?.cap || "",
  citta: selected?.citta || "",
  provincia: selected?.provincia || "",
});
    }}
  >
    <option value="">
      Seleziona nominativo
    </option>

    {nominativi.map((n) => (
      <option key={n.id} value={n.id}>
        {n.nome_cognome}
      </option>
    ))}

    <option value="__nuovo__">
      + Inserisci nuovo nominativo
    </option>
  </select>
</div>
    
{nuovoSocio.nominativo_id === "__nuovo__" && (
  <>
    <div>
      <label style={labelStyle}>Nuovo nominativo</label>
   <input
  style={inputStyle}
  placeholder="Nome e cognome"
  value={nuovoSocio.nome_cognome}
  onChange={(e) =>
    setNuovoSocio({
      ...nuovoSocio,
      nome_cognome: e.target.value,
    })
  }
/>
    </div>

    <div>
      <label style={labelStyle}>
        Cod. fisc.
      </label>

      <input
        style={inputStyle}
        placeholder="Codice fiscale"
        value={nuovoSocio.codice_fiscale}
        onChange={(e) =>
          setNuovoSocio({
            ...nuovoSocio,
            codice_fiscale: e.target.value,
          })
        }
      />
    </div>
    <div>
      <label style={labelStyle}>Indirizzo</label>
      <input
        style={inputStyle}
        placeholder="Indirizzo"
        value={nuovoSocio.indirizzo}
        onChange={(e) =>
          setNuovoSocio({
            ...nuovoSocio,
            indirizzo: e.target.value,
          })
        }
      />
    </div>

    <div>
      <label style={labelStyle}>CAP</label>
      <input
        style={inputStyle}
        placeholder="CAP"
        value={nuovoSocio.cap}
        onChange={(e) =>
          setNuovoSocio({
            ...nuovoSocio,
            cap: e.target.value,
          })
        }
      />
    </div>

    <div>
      <label style={labelStyle}>Città</label>
      <input
        style={inputStyle}
        placeholder="Città"
        value={nuovoSocio.citta}
        onChange={(e) =>
          setNuovoSocio({
            ...nuovoSocio,
            citta: e.target.value,
          })
        }
      />
    </div>

    <div>
      <label style={labelStyle}>Provincia</label>
      <input
        style={inputStyle}
        placeholder="Provincia"
        value={nuovoSocio.provincia}
        onChange={(e) =>
          setNuovoSocio({
            ...nuovoSocio,
            provincia: e.target.value,
          })
        }
      />
    </div>
  </>
)}
    
<div>
  <label
    style={{
      ...labelStyle,
      color: percentualeSuperata
        ? "#dc2626"
        : "#374151",
    }}
  >
    % Partec.
  </label>

  <input
    style={{
      ...inputStyle,
      borderColor: percentualeSuperata
        ? "#dc2626"
        : "#9ca3af",
      color: percentualeSuperata
        ? "#dc2626"
        : undefined,
    }}
    placeholder="% quota"
    value={nuovoSocio.percentuale_partecipazione}
    onChange={(e) =>
      setNuovoSocio({
        ...nuovoSocio,
        percentuale_partecipazione:
          e.target.value,
      })
    }
  />
</div>

<div>
  <label style={labelStyle}>
    Importo lordo
  </label>

  <input
    style={inputStyle}
    placeholder="Lordo"
   
    value={nuovoSocio.importo_utile}
    onChange={(e) =>
      setNuovoSocio({
        ...nuovoSocio,
        importo_utile: e.target.value,
      })
    }
  />
</div>

<div>
  <label style={labelStyle}>
    % ritenuta
  </label>

  <input
    style={inputStyle}
    placeholder="% rit."
    
    value={nuovoSocio.percentuale_ritenuta}
    onChange={(e) =>
      setNuovoSocio({
        ...nuovoSocio,
        percentuale_ritenuta: e.target.value,
      })
    }
  />
</div>

   <div>
  <label style={labelStyle}>
    Importo ritenuta
  </label>

  <input
    style={inputStyle}
    placeholder="Ritenuta"
    disabled
    value={importoRitenutaNuovoSocio.toFixed(2)}
  />
</div>

<div>
  <label style={labelStyle}>
    Importo netto
  </label>

  <input
  style={inputStyle}
  placeholder="Netto"
  disabled
  value={importoNettoNuovoSocio.toFixed(2)}
/>
</div>

<div>
  <label style={labelStyle}>
    Mod. pagamento
  </label>

  <select
    style={inputStyle}
    value={nuovoSocio.tipo_pagamento}
    onChange={(e) =>
      setNuovoSocio({
        ...nuovoSocio,
        tipo_pagamento: e.target.value,
      })
    }
  >
    <option value="">Seleziona</option>
    <option value="Bonifico">Bonifico</option>
    <option value="Assegno bancario">Assegno bancario</option>
    <option value="Assegno circolare">Assegno circolare</option>
    <option value="Altra modalità">Altra modalità</option>
  </select>
</div>

<div
  style={{
    display: "flex",
    gap: 8,
    alignItems: "end",
  }}
>
  <button
    type="button"
    onClick={async () => {
      if (!nuovoSocio.nome_cognome.trim()) {
        alert("Il nominativo è obbligatorio.");
        return;
      }

      if (!nuovoSocio.codice_fiscale.trim()) {
        alert("Il codice fiscale è obbligatorio.");
        return;
      }

      if (nuovoSocio.nominativo_id === "__nuovo__") {
        const saveNomRes = await fetch(
          "/api/pratiche/nominativi",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nome_cognome: nuovoSocio.nome_cognome,
              codice_fiscale: nuovoSocio.codice_fiscale,
              indirizzo: nuovoSocio.indirizzo,
              cap: nuovoSocio.cap,
              citta: nuovoSocio.citta,
              provincia: nuovoSocio.provincia,
            }),
          }
        );

        const saveNomData = await saveNomRes.json();

        if (!saveNomRes.ok) {
          alert(
            saveNomData.error ||
              "Errore salvataggio nominativo"
          );
          return;
        }

        await caricaNominativi();

        nuovoSocio.nominativo_id =
          saveNomData.nominativo.id;
      }

      const res = await fetch(
        `/api/pratiche/${praticaId}/soci`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...nuovoSocio,
            importo_ritenuta:
              importoRitenutaNuovoSocio,
            importo_netto:
              importoNettoNuovoSocio,
          }),
        }
      );
    
      await caricaSoci();
    }}
    style={{
      border: 0,
      borderRadius: 8,
      background: "#2563eb",
      color: "#fff",
      padding: "10px 18px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: font,
    }}
  >
    Aggiungi
  </button>

  <button
    type="button"
    onClick={() => {
      const normalizza = (v: any) =>
        String(v || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");

      const valore = normalizza(
        nuovoSocio.nome_cognome
      );

      const cliente = clientiImport.find((c) => {
        return (
          normalizza(c.ragione_sociale) === valore
        );
      });

      if (!cliente) {
        alert(
          "Nominativo non trovato in Anagrafica Clienti."
        );
        return;
      }

      setNuovoSocio({
        ...nuovoSocio,
        nome_cognome:
          cliente.ragione_sociale || "",
        codice_fiscale:
          cliente.codice_fiscale || "",
        indirizzo: cliente.indirizzo || "",
        cap: cliente.cap || "",
        citta: cliente.citta || "",
        provincia: cliente.provincia || "",
      });
    }}
    style={{
      border: "1px solid #d1d5db",
      borderRadius: 8,
      background: "#f3f4f6",
      color: "#111827",
      padding: "10px 14px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: font,
      whiteSpace: "nowrap",
    }}
  >
    Importa
  </button>
</div>

  if (!res.ok) {
    const data = await res.json();
    alert(data.error || "Errore inserimento socio");
    return;
  }

setNuovoSocio({
  nominativo_id: "",
  nome_cognome: "",
  codice_fiscale: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  percentuale_partecipazione: "",
  importo_utile: "",
  percentuale_ritenuta: "26",
  importo_ritenuta: "",
  importo_netto: "",
  tipo_pagamento: "",
});

  await caricaSoci();
}}
      style={{
        border: 0,
        borderRadius: 8,
        background: "#2563eb",
        color: "#fff",
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: font,
      }}
    >
      Aggiungi
</button>

<button
    type="button"
  onClick={() => {
const normalizza = (v: any) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const valore = normalizza(nuovoSocio.nome_cognome);

const cliente = clientiImport.find((c) => {
  return normalizza(c.ragione_sociale) === valore;
});

      if (!cliente) {
        alert("Nominativo non trovato in Anagrafica Clienti.");
        return;
      }

     setNuovoSocio({
  ...nuovoSocio,
  nome_cognome: cliente.ragione_sociale || "",
  codice_fiscale: cliente.codice_fiscale || "",
  indirizzo: cliente.indirizzo || "",
  cap: cliente.cap || "",
  citta: cliente.citta || "",
  provincia: cliente.provincia || "",
});
    }}
    style={{
      border: "1px solid #d1d5db",
      borderRadius: 8,
      background: "#f3f4f6",
      color: "#111827",
      padding: "10px 14px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: font,
      whiteSpace: "nowrap",
    }}
  >
    Importa
    </button>
</div>
</div>
</div>

  <div style={{ marginTop: 24 }}>
    {soci.length === 0 ? (
      <div style={{ fontSize: 14, color: "#64748b" }}>
        Nessun socio inserito.
      </div>
    ) : (
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Socio</th>
            <th style={thStyle}>CF</th>
            <th style={thStyle}>%</th>
            <th style={thStyle}>Lordo</th>
            <th style={thStyle}>Ritenuta</th>
            <th style={thStyle}>Netto</th>
            <th style={thStyle}>Pagamento</th>
            <th style={thStyle}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {soci.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={tdStyle}>{s.nome_cognome}</td>
              <td style={tdStyle}>{s.codice_fiscale}</td>
              <td style={tdStyle}>{s.percentuale_partecipazione}%</td>
              <td style={tdStyle}>{s.importo_utile}</td>
              <td style={tdStyle}>{s.importo_ritenuta}</td>
              <td style={tdStyle}>{s.importo_netto}</td>
              <td style={tdStyle}>{s.tipo_pagamento}</td>
              <td style={tdStyle}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Eliminare il socio?")) return;

                    await fetch(`/api/pratiche/${praticaId}/soci/${s.id}`, {
                      method: "DELETE",
                    });

                    await caricaSoci();
                  }}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#dc2626",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: font,
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

<h3 style={{ marginTop: 28, fontSize: 16, fontWeight: 700 }}>
              Motivo messa in liquidazione
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Motivo</label>
                <select
                  style={inputStyle}
                  value={form.motivo_liquidazione}
                  onChange={(e) => aggiornaCampo("motivo_liquidazione", e.target.value)}
                >
                  <option value="">Seleziona motivo</option>

                  {motiviLiquidazione.map((m) => (
                    <option key={m.id} value={m.testo_verbale}>
                      {m.titolo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Altro motivo</label>
                <input
                  style={inputStyle}
                  value={form.motivo_liquidazione_altro}
                  onChange={(e) => aggiornaCampo("motivo_liquidazione_altro", e.target.value)}
                  placeholder="Compilare solo se necessario"
                />
              </div>
            </div>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
  <div>
  <label style={labelStyle}>
    Liquidatore / Amministratore / Legale rappresentante
  </label>

  <select
    style={inputStyle}
    value={form.liquidatore_nome}
    onChange={(e) => {
      const value = e.target.value;

      if (value === "__nuovo__") {
        setMostraNuovoLiquidatore(true);
        return;
      }

      const selected = rappresentantiLegali.find(
        (r) => r.nome_cognome === value
      );

      setForm((prev) => ({
        ...prev,
        liquidatore_nome: value,
        liquidatore_codice_fiscale: selected?.codice_fiscale || "",
      }));
    }}
  >
    <option value="">Seleziona soggetto</option>

    {rappresentantiLegali.map((r) => (
      <option key={r.id} value={r.nome_cognome}>
        {r.nome_cognome}
      </option>
    ))}

    <option value="__nuovo__">
      + Inserisci nuovo soggetto
    </option>
  </select>
</div>

  <div>
    <label style={labelStyle}>CF liquidatore</label>
    <input
      style={inputStyle}
      value={form.liquidatore_codice_fiscale}
      onChange={(e) =>
        aggiornaCampo("liquidatore_codice_fiscale", e.target.value)
      }
    />
  </div>
</div>

            {mostraNuovoLiquidatore && (
  <div
    style={{
      gridColumn: "1 / -1",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: 16,
      background: "#f8fafc",
      marginTop: 4,
    }}
  >
    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
      Nuovo soggetto
    </h4>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: 12,
        marginTop: 12,
        alignItems: "end",
      }}
    >
      <div>
        <label style={labelStyle}>Nome e cognome</label>
        <input
          style={inputStyle}
          value={nuovoLiquidatore.nome_cognome}
          onChange={(e) =>
            setNuovoLiquidatore((prev) => ({
              ...prev,
              nome_cognome: e.target.value,
            }))
          }
        />
      </div>

      <div>
        <label style={labelStyle}>Codice fiscale</label>
        <input
          style={inputStyle}
          value={nuovoLiquidatore.codice_fiscale}
          onChange={(e) =>
            setNuovoLiquidatore((prev) => ({
              ...prev,
              codice_fiscale: e.target.value,
            }))
          }
        />
      </div>

      <button
        type="button"
        onClick={async () => {
           if (
    !nuovoSocio.nome_cognome.trim() &&
    !nuovoSocio.codice_fiscale.trim()
  ) {
    alert("Inserire almeno nominativo o codice fiscale.");
    return;
  }
          const res = await fetch("/api/rapp-legali", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(nuovoLiquidatore),
          });

          const data = await res.json();

          if (!res.ok) {
            alert(data.error || "Errore creazione soggetto");
            return;
          }

          const nuovo = data.rappresentante;

          setRappresentantiLegali((prev) => [...prev, nuovo]);

          setForm((prev) => ({
            ...prev,
            liquidatore_nome: nuovo.nome_cognome,
            liquidatore_codice_fiscale: nuovo.codice_fiscale || "",
          }));

          setNuovoLiquidatore({
            nome_cognome: "",
            codice_fiscale: "",
          });

          setMostraNuovoLiquidatore(false);
        }}
        style={{
          border: 0,
          borderRadius: 8,
          background: "#2563eb",
          color: "#fff",
          padding: "10px 16px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: font,
        }}
      >
        Salva
      </button>
    </div>
  </div>
)}

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
  <div>
    <label style={labelStyle}>Presidente</label>
    <input style={inputStyle} value={form.presidente} onChange={(e) => aggiornaCampo("presidente", e.target.value)} />
  </div>

              <div>
                <label style={labelStyle}>Segretario</label>
                <input style={inputStyle} value={form.segretario} onChange={(e) => aggiornaCampo("segretario", e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Ora chiusura verbale</label>
                <input type="time" style={inputStyle} value={form.ora_chiusura} onChange={(e) => aggiornaCampo("ora_chiusura", e.target.value)} />
              </div>
            </div>

<h3 style={{ marginTop: 28, fontSize: 16, fontWeight: 700 }}>
  Professionista / presentazione
</h3>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
  <div>
    <label style={labelStyle}>Nome professionista</label>

    <select
      style={inputStyle}
      value={form.professionista_nome}
      onChange={(e) => {
        const nomeProfessionista = e.target.value;

        const selected = professionisti.find(
          (p) => p.ragione_sociale === nomeProfessionista
        );

        setForm((prev) => ({
          ...prev,
          professionista_nome: nomeProfessionista,
          professionista_codice_fiscale: selected?.codice_fiscale || "",
          dicitura_presentazione: prev.dicitura_presentazione
            .replaceAll("{{professionista_nome}}", nomeProfessionista)
            .replaceAll("[professionista_nome]", nomeProfessionista)
            .replaceAll("[PROFESSIONISTA_NOME]", nomeProfessionista),
        }));
      }}
    >
      <option value="">Seleziona professionista</option>

      {professionisti.map((p) => (
        <option key={p.id} value={p.ragione_sociale}>
          {p.ragione_sociale}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label style={labelStyle}>Codice fiscale professionista</label>
    <input
      style={inputStyle}
      value={form.professionista_codice_fiscale}
      onChange={(e) =>
        aggiornaCampo("professionista_codice_fiscale", e.target.value)
      }
    />
  </div>

  <div>
    <label style={labelStyle}>Qualifica</label>

    <select
      style={inputStyle}
      value={form.professionista_qualifica}
      onChange={(e) =>
        aggiornaCampo("professionista_qualifica", e.target.value)
      }
    >
      <option value="">Seleziona qualifica</option>
      <option value="Dottore Commercialista">Dottore Commercialista</option>
      <option value="Ragioniere Commercialista">Ragioniere Commercialista</option>
    </select>
  </div>
</div>

<div style={{ marginTop: 14 }}>
  <label style={labelStyle}>Dicitura presentazione pratica</label>

  <select
    style={{ ...inputStyle, marginBottom: 10 }}
    onChange={(e) => {
      const selected = diciture.find((d) => d.testo === e.target.value);

      if (selected) {
        aggiornaCampo(
          "dicitura_presentazione",
          selected.testo
            .replaceAll("{{professionista_nome}}", form.professionista_nome)
            .replaceAll("[professionista_nome]", form.professionista_nome)
            .replaceAll("[PROFESSIONISTA_NOME]", form.professionista_nome)
        );
      }
    }}
  >
    <option value="">Seleziona dicitura predefinita</option>

    {diciture.map((d) => (
      <option key={d.id} value={d.testo}>
        {d.titolo}
      </option>
    ))}
  </select>

  <textarea
    style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
    value={form.dicitura_presentazione}
    onChange={(e) =>
      aggiornaCampo("dicitura_presentazione", e.target.value)
    }
    placeholder="Inserire la dicitura da integrare nei documenti per la presentazione."
  />
</div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, color: messaggio.includes("Errore") ? "#dc2626" : "#64748b" }}>
              {messaggio}
            </div>

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
              {saving ? "Salvataggio..." : "Salva dati documento"}
            </button>
          </div>
          
   {mostraOrganiCariche && (
  <div
    style={{
      background: "#fff",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: 24,
      marginTop: 16,
    }}
  >
    <h2
      style={{
        fontSize: 20,
        fontWeight: 700,
        margin: 0,
        color: "#0f172a",
      }}
    >
      Organi / Cariche
    </h2>

    <p
      style={{
        marginTop: 6,
        fontSize: 14,
        color: "#64748b",
      }}
    >
      Amministratori, consiglieri, sindaci,
      liquidatori e altri soggetti collegati.
    </p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "1fr 1fr 1fr 1fr 1fr 1fr auto",
        gap: 12,
        marginTop: 18,
        alignItems: "end",
      }}
    >
      <div>
        <label style={labelStyle}>
          Tipo soggetto
        </label>

        <select
          style={inputStyle}
          value={nuovoSoggetto.tipo_soggetto}
          onChange={(e) =>
            setNuovoSoggetto((prev) => ({
              ...prev,
              tipo_soggetto: e.target.value,
            }))
          }
        >
          <option value="amministratore">
            Amministratore
          </option>

          <option value="presidente_cda">
            Presidente CDA
          </option>

          <option value="consigliere">
            Consigliere
          </option>

          <option value="amministratore_delegato">
            Amministratore Delegato
          </option>

          <option value="liquidatore">
            Liquidatore
          </option>

          <option value="presidente_collegio_sindacale">
            Presidente Collegio Sindacale
          </option>

          <option value="sindaco_effettivo">
            Sindaco Effettivo
          </option>

          <option value="sindaco_supplente">
            Sindaco Supplente
          </option>
        </select>
      </div>

      <div>
        <label style={labelStyle}>
          Nome e cognome
        </label>

        <input
          style={inputStyle}
          value={nuovoSoggetto.nome_cognome}
          onChange={(e) =>
            setNuovoSoggetto((prev) => ({
              ...prev,
              nome_cognome: e.target.value,
            }))
          }
        />
      </div>

      <div>
        <label style={labelStyle}>
          Codice fiscale
        </label>

        <input
          style={inputStyle}
          value={nuovoSoggetto.codice_fiscale}
          onChange={(e) =>
            setNuovoSoggetto((prev) => ({
              ...prev,
              codice_fiscale: e.target.value,
            }))
          }
        />
      </div>

      <div>
        <label style={labelStyle}>
          Indirizzo
        </label>

        <input
          style={inputStyle}
          value={nuovoSoggetto.indirizzo}
          onChange={(e) =>
            setNuovoSoggetto((prev) => ({
              ...prev,
              indirizzo: e.target.value,
            }))
          }
        />
      </div>

      <div>
        <label style={labelStyle}>
          Città
        </label>

        <input
          style={inputStyle}
          value={nuovoSoggetto.citta}
          onChange={(e) =>
            setNuovoSoggetto((prev) => ({
              ...prev,
              citta: e.target.value,
            }))
          }
        />
      </div>

      <div>
        <label style={labelStyle}>
          Carica
        </label>

        <select
          style={inputStyle}
          value={nuovoSoggetto.carica}
          onChange={(e) =>
            setNuovoSoggetto((prev) => ({
              ...prev,
              carica: e.target.value,
            }))
          }
        >
          <option value="Amministratore">
            Amministratore
          </option>

          <option value="Amministratore Delegato">
            Amministratore Delegato
          </option>

          <option value="Amministratore Unico">
            Amministratore Unico
          </option>

          <option value="Consigliere">
            Consigliere
          </option>

          <option value="Liquidatore">
            Liquidatore
          </option>

          <option value="Presidente CDA">
            Presidente CDA
          </option>

          <option value="Presidente Collegio Sindacale">
            Presidente Collegio Sindacale
          </option>

          <option value="Revisore Legale">
            Revisore Legale
          </option>

          <option value="Sindaco Effettivo">
            Sindaco Effettivo
          </option>

          <option value="Sindaco Supplente">
            Sindaco Supplente
          </option>

          <option value="Sindaco Unico">
            Sindaco Unico
          </option>
        </select>
      </div>

      <button
        type="button"
        onClick={async () => {
          const res = await fetch(
            `/api/pratiche/${praticaId}/soggetti`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                nuovoSoggetto
              ),
            }
          );

          const data = await res.json();

          if (!res.ok) {
            alert(
              data.error ||
                "Errore inserimento"
            );
            return;
          }

       setNuovoSoggetto({
  tipo_soggetto: "amministratore",
  nominativo_id: "",
  nome_cognome: "",
  codice_fiscale: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  carica: "Amministratore",
});
          await caricaSoggetti();
        }}
        style={{
          border: 0,
          borderRadius: 8,
          background: "#2563eb",
          color: "#fff",
          padding: "10px 18px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: font,
        }}
      >
        Aggiungi
      </button>
    </div>

    <div style={{ marginTop: 24 }}>
      {soggetti.length === 0 ? (
        <div
          style={{
            fontSize: 14,
            color: "#64748b",
          }}
        >
          Nessun soggetto inserito.
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>CF</th>
              <th style={thStyle}>Indirizzo</th>
              <th style={thStyle}>Città</th>
              <th style={thStyle}>Carica</th>
              <th style={thStyle}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {soggetti.map((s) => (
              <tr
                key={s.id}
                style={{
                  borderBottom:
                    "1px solid #f1f5f9",
                }}
              >
                <td style={tdStyle}>
                  {s.tipo_soggetto}
                </td>

                <td style={tdStyle}>
                  {s.nome_cognome}
                </td>

                <td style={tdStyle}>
                  {s.codice_fiscale}
                </td>

                <td style={tdStyle}>
                  {s.indirizzo}
                </td>

                <td style={tdStyle}>
                  {s.citta}
                </td>

                <td style={tdStyle}>
                  {s.carica}
                </td>

                <td style={tdStyle}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Eliminare il soggetto?"
                        )
                      )
                        return;

                      const res =
                        await fetch(
                          `/api/pratiche/${praticaId}/soggetti/${s.id}`,
                          {
                            method:
                              "DELETE",
                          }
                        );

                      if (res.ok) {
                        await caricaSoggetti();
                      }
                    }}
                    style={{
                      border: 0,
                      background:
                        "transparent",
                      color: "#dc2626",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: font,
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
)}

<div
  style={{
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 24,
    marginTop: 16,
  }}
>
  <h2
    style={{
      fontSize: 20,
      fontWeight: 700,
      margin: 0,
      color: "#0f172a",
    }}
  >
    Documenti pratica
  </h2>

<div
  style={{
    display: "flex",
    gap: 12,
    alignItems: "end",
    marginTop: 12,
  }}
>
  <div style={{ minWidth: 320 }}>
    <label style={labelStyle}>
      Modello da generare
    </label>

    <select
      style={inputStyle}
      value={modelloSelezionato}
      onChange={(e) =>
        setModelloSelezionato(e.target.value)
      }
    >
      <option value="">
        Seleziona modello
      </option>

      {modelli.map((m) => (
        <option key={m.id} value={m.codice}>
          {m.nome}
        </option>
      ))}
    </select>
  </div>

  <button
    type="button"
    onClick={async () => {
      try {
        if (!modelloSelezionato) {
          alert("Seleziona un modello");
          return;
        }

        const res = await fetch(
          `/api/pratiche/${praticaId}/genera-documento`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              codice_modello:
                modelloSelezionato,
            }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ||
              "Errore generazione documento"
          );
        }

        await caricaDocumenti();

        alert("Documento generato");
      } catch (error: any) {
        alert(
          error.message ||
            "Errore generazione documento"
        );
      }
    }}
    style={{
      border: 0,
      borderRadius: 8,
      background: "#16a34a",
      color: "#fff",
      padding: "10px 18px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: font,
    }}
  >
    Genera documento
  </button>
</div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr auto",
      gap: 12,
      marginTop: 18,
      alignItems: "end",
    }}
  >
    <div>
      <label style={labelStyle}>
        Tipo documento
      </label>

      <select
        style={inputStyle}
        value={tipoDocumento}
        onChange={(e) =>
          setTipoDocumento(e.target.value)
        }
      >
        <option value="verbale_assemblea">
          Verbale assemblea
        </option>

        <option value="nomina_liquidatore">
          Nomina liquidatore
        </option>

        <option value="accettazione_liquidatore">
          Accettazione liquidatore
        </option>

        <option value="dichiarazione_conformita">
          Dichiarazione conformità
        </option>

        <option value="ricevuta_deposito">
          Ricevuta deposito
        </option>

        <option value="visura_evasione">
          Visura evasione
        </option>

        <option value="altro">
          Altro
        </option>
      </select>
    </div>

    <div style={{ gridColumn: "span 2" }}>
      <label style={labelStyle}>
        File
      </label>

      <input
        type="file"
        onChange={(e) =>
          setFileDocumento(
            e.target.files?.[0] || null
          )
        }
      />
    </div>

    <button
      type="button"
      onClick={uploadDocumento}
      disabled={
        uploadingDocumento || !fileDocumento
      }
      style={{
        border: 0,
        borderRadius: 8,
        background: "#2563eb",
        color: "#fff",
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        opacity:
          uploadingDocumento || !fileDocumento
            ? 0.6
            : 1,
        fontFamily: font,
      }}
    >
      {uploadingDocumento
        ? "Upload..."
        : "Carica"}
    </button>
  </div>

  <div style={{ marginTop: 24 }}>
    {documenti.length === 0 ? (
      <div
        style={{
          fontSize: 14,
          color: "#64748b",
        }}
      >
        Nessun documento caricato.
      </div>
    ) : (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom:
                "1px solid #e5e7eb",
            }}
          >
            <th style={thStyle}>Documento</th>
            <th style={thStyle}>Tipo</th>
            <th style={thStyle}>Data</th>
            <th style={thStyle}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {documenti.map((doc) => (
            <tr
              key={doc.id}
              style={{
                borderBottom:
                  "1px solid #f1f5f9",
              }}
            >
              <td style={tdStyle}>
                {doc.nome_file}
              </td>

              <td style={tdStyle}>
                {doc.tipo_documento}
              </td>

              <td style={tdStyle}>
                {new Date(
                  doc.created_at
                ).toLocaleString("it-IT")}
              </td>

<td style={tdStyle}>
  <div
    style={{
      display: "flex",
      gap: 12,
      alignItems: "center",
    }}
  >
    <a
      href={`/api/pratiche/${praticaId}/documenti/${doc.id}/download`}
      target="_blank"
      rel="noreferrer"
      title="Scarica documento"
      style={{
        color: "#2563eb",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Download size={18} />
    </a>

    <button
      type="button"
      title="Elimina documento"
      onClick={async () => {
        if (!confirm("Eliminare questo documento?"))
          return;

        const res = await fetch(
          `/api/pratiche/${praticaId}/documenti/${doc.id}`,
          {
            method: "DELETE",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          alert(
            data.error ||
              "Errore eliminazione documento"
          );
          return;
        }

        await caricaDocumenti();
      }}
      style={{
        border: 0,
        background: "transparent",
        color: "#dc2626",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        padding: 0,
      }}
    >
      <Trash2 size={18} />
    </button>
  </div>
</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
</div>
        </form>
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
