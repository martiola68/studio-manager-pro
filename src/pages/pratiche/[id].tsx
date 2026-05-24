"use client";
import { Trash2, Download } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import FormDistribuzioneUtili from "@/components/pratiche/forms/FormDistribuzioneUtili";
import FormMessaLiquidazione from "@/components/pratiche/forms/FormMessaLiquidazione";
import FormNominaAmministratore from "@/components/pratiche/forms/FormNominaAmministratore";
import FormCambioAmministratore from "@/components/pratiche/forms/FormCambioAmministratore";
import FormDeterminaLiquidazione from "@/components/pratiche/forms/FormDeterminaLiquidazione";

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
    classe_form?: string;
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
  const [clientiTrovatiImport, setClientiTrovatiImport] = useState<any[]>([]);
const [clienteImportSelezionato, setClienteImportSelezionato] = useState<any | null>(null);
const [mostraClientiImport, setMostraClientiImport] = useState(false);
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
  importo_dividendo_totale: "",
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

  if (pratica?.tipo?.classe_form === "distribuzione_utili") {
  return <FormDistribuzioneUtili pratica={pratica} />;
}

  if (pratica?.tipo?.classe_form === "determina_liquidazione") {
  return <FormDeterminaLiquidazione pratica={pratica} />;
}

if (pratica?.tipo?.classe_form === "messa_liquidazione") {
  return <FormMessaLiquidazione pratica={pratica} />;
}

if (pratica?.tipo?.classe_form === "nomina_amministratore") {
  return <FormNominaAmministratore pratica={pratica} />;
}

if (pratica?.tipo?.classe_form === "cambio_amministratore") {
  return <FormCambioAmministratore pratica={pratica} />;
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
