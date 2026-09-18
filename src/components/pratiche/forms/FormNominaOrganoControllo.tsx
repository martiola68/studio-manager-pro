"use client";

// PERSISTENZA_NOMINE_V2: le delibere salvano i dati anagrafici nei metadati della pratica

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Download, Trash2, Upload } from "lucide-react";
import { generaDocumentoPratica } from "@/lib/pratiche/generaDocumentoPratica";

const font =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
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

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginTop: 18,
};

const subCardStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 18,
  marginTop: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
  color: "#111827",
};

const blueButton: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#2563eb",
  color: "#fff",
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: font,
  whiteSpace: "nowrap",
};

const secondaryButton: React.CSSProperties = {
  border: "1px solid #2563eb",
  borderRadius: 8,
  background: "#fff",
  color: "#2563eb",
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: font,
  whiteSpace: "nowrap",
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
  verticalAlign: "top",
};

type TipoDurata = "DATA_FINE" | "APPROVAZIONE_BILANCIO" | "ANNI";
type AzioneOrgano = "NESSUNA" | "CONFERMA" | "RIMOZIONE";

type DecisioneOrgano = {
  azione: AzioneOrgano;
  data_effetto: string;
  motivo: string;
};

type NuovaNomina = {
  id: string;
  nominativo_id: string;
  nome: string;
  codice_fiscale: string;
  partita_iva: string;
  qualifica: string;
  carica: string;
  data_inizio: string;
  durata_tipo: TipoDurata;
  data_fine: string;
  bilancio_chiuso_al: string;
  durata_anni: string;
  compenso_lordo: string;
  source_organo_id?: string;
  origine_azione?: "nomina" | "conferma";
};

type MetaSoggetto = {
  workflow?: string;
  azione?: "conferma" | "rimozione" | "nomina";
  source_organo_id?: string;
  partita_iva?: string;
  qualifica?: string;
  data_inizio?: string;
  data_effetto?: string;
  motivo?: string;
  durata_tipo?: TipoDurata;
  data_fine?: string;
  bilancio_chiuso_al?: string;
  durata_anni?: string;
  compenso_lordo?: string;
  nominativo_nome?: string;
  nominativo_codice_fiscale?: string;
  nominativo_partita_iva?: string;
  nominativo_indirizzo?: string;
  nominativo_cap?: string;
  nominativo_citta?: string;
  nominativo_provincia?: string;
  source_cliente_id?: string;
};

const caricheNomina = [
  "Revisore legale",
  "Società di revisione",
  "Sindaco unico",
  "Presidente del collegio sindacale",
  "Sindaco effettivo",
  "Sindaco supplente",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function safeJson(value: unknown): MetaSoggetto {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatDateIt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("it-IT");
}

function isSocio(organo: any) {
  return (
    String(organo?.tipo_ruolo || "").toUpperCase() === "S" ||
    String(organo?.ruolo || "").toLowerCase() === "socio"
  );
}

function isOrganoControllo(organo: any) {
  const testo = String(
    `${organo?.tipo_ruolo || ""} ${organo?.ruolo || ""} ${organo?.carica || ""}`
  ).toLowerCase();
  return (
    String(organo?.tipo_ruolo || "").toUpperCase() === "C" ||
    testo.includes("sindac") ||
    testo.includes("revisor") ||
    testo.includes("organo di controllo") ||
    testo.includes("società di revisione") ||
    testo.includes("societa di revisione")
  );
}

function descrizioneScadenza(n: NuovaNomina) {
  if (n.durata_tipo === "DATA_FINE") return `fino al ${formatDateIt(n.data_fine)}`;
  if (n.durata_tipo === "ANNI") return `${n.durata_anni || "—"} anni`;
  return `fino all'approvazione del bilancio chiuso al ${formatDateIt(n.bilancio_chiuso_al)}`;
}

function nuovaNominaVuota(): NuovaNomina {
  return {
    id: "",
    nominativo_id: "",
    nome: "",
    codice_fiscale: "",
    partita_iva: "",
    qualifica: "",
    carica: "Revisore legale",
    data_inizio: "",
    durata_tipo: "APPROVAZIONE_BILANCIO",
    data_fine: "",
    bilancio_chiuso_al: "",
    durata_anni: "",
    compenso_lordo: "",
    source_organo_id: "",
    origine_azione: "nomina",
  };
}

export default function FormNominaOrganoControllo({ pratica }: any) {
  const router = useRouter();
  const praticaId = String(router.query.id || pratica?.id || "");

  const sedeSocieta = [
    pratica?.cliente?.indirizzo,
    pratica?.cliente?.cap,
    pratica?.cliente?.citta,
    pratica?.cliente?.provincia,
  ]
    .filter(Boolean)
    .join(" ");

  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");
  const [documenti, setDocumenti] = useState<any[]>([]);
  const [soci, setSoci] = useState<any[]>([]);
  const [organiArchivio, setOrganiArchivio] = useState<any[]>([]);
  const [decisioni, setDecisioni] = useState<Record<string, DecisioneOrgano>>({});
  const [nomine, setNomine] = useState<NuovaNomina[]>([]);
  const [nuovaNomina, setNuovaNomina] = useState<NuovaNomina>(nuovaNominaVuota());
  const [nominativi, setNominativi] = useState<any[]>([]);
  const [professionisti, setProfessionisti] = useState<any[]>([]);
  const [diciture, setDiciture] = useState<any[]>([]);

  const [nuovoSocio, setNuovoSocio] = useState({
    nominativo_id: "",
    nome_cognome: "",
    codice_fiscale: "",
    percentuale_partecipazione: "",
    presenza: "Presente",
  });

  const [form, setForm] = useState({
    societa_denominazione:
      pratica?.dati_documento?.societa_denominazione || pratica?.cliente?.ragione_sociale || "",
    societa_sede: pratica?.dati_documento?.societa_sede || sedeSocieta || "",
    societa_codice_fiscale:
      pratica?.dati_documento?.societa_codice_fiscale || pratica?.cliente?.codice_fiscale || "",
    societa_partita_iva:
      pratica?.dati_documento?.societa_partita_iva || pratica?.cliente?.partita_iva || "",
    societa_rea: pratica?.dati_documento?.societa_rea || pratica?.cliente?.numero_rea || "",
    data_atto:
      pratica?.dati_documento?.data_atto ||
      pratica?.data_atto_variazione ||
      "",
    ora_inizio: pratica?.dati_documento?.ora_inizio || "",
    ora_chiusura: pratica?.dati_documento?.ora_chiusura || "",
    luogo_assemblea: pratica?.dati_documento?.luogo_assemblea || sedeSocieta || "",
    presidente:
      pratica?.dati_documento?.presidente ||
      pratica?.amministratore_principale?.nome_cognome ||
      "",
    segretario: pratica?.dati_documento?.segretario || "",
    professionista_nome: pratica?.dati_documento?.professionista_nome || "",
    professionista_codice_fiscale:
      pratica?.dati_documento?.professionista_codice_fiscale || "",
    professionista_qualifica: pratica?.dati_documento?.professionista_qualifica || "",
    dicitura_presentazione: pratica?.dati_documento?.dicitura_presentazione || "",
    verbale_definitivo: Boolean(pratica?.dati_documento?.verbale_definitivo),
  });

  const sociArchivio = useMemo(() => organiArchivio.filter(isSocio), [organiArchivio]);
  const organiControllo = useMemo(
    () => organiArchivio.filter((o) => o.attivo !== false && isOrganoControllo(o)),
    [organiArchivio]
  );

  const capitalePresente = soci.reduce(
    (totale: number, socio: any) => totale + Number(socio.percentuale_partecipazione || 0),
    0
  );

  const numeroConferme = Object.values(decisioni).filter((d) => d.azione === "CONFERMA").length;
  const numeroRimozioni = Object.values(decisioni).filter((d) => d.azione === "RIMOZIONE").length;
  const nuoveNomineEffettive = nomine.filter((n) => n.origine_azione !== "conferma");
  const numeroRevisoriNuovi = nuoveNomineEffettive.filter((n) =>
    String(n.carica).toLowerCase().includes("revisor")
  ).length;

  useEffect(() => {
    if (!praticaId) return;
    void caricaTutto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  function aggiornaCampo(campo: string, valore: any) {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function caricaTutto() {
    await Promise.all([
      caricaDocumenti(),
      caricaSoci(),
      caricaOrganiArchivio(),
      caricaNominativi(),
      caricaProfessionisti(),
      caricaDiciture(),
      caricaDecisioniSalvate(),
    ]);
  }

  async function caricaDocumenti() {
    const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/documenti`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setDocumenti(data.documenti || []);
  }

  async function caricaSoci() {
    const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soci`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) setSoci(data.soci || []);
  }

  async function caricaOrganiArchivio() {
    if (!pratica?.cliente_id) return;
    const res = await fetch(
      `/api/clienti-organi?cliente_id=${encodeURIComponent(String(pratica.cliente_id))}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (res.ok) setOrganiArchivio(data.organi || []);
  }

  async function caricaNominativi() {
    const res = await fetch("/api/clienti/import-nominativi", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setNominativi(Array.isArray(data) ? data : data.clienti || []);
  }

  async function caricaProfessionisti() {
    const res = await fetch("/api/pratiche/professionisti", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setProfessionisti(data.professionisti || []);
  }

  async function caricaDiciture() {
    const res = await fetch("/api/pratiche/diciture-documenti", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setDiciture(data.diciture || []);
  }

  async function caricaDecisioniSalvate() {
    const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soggetti`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) return;

    const nuoveDecisioni: Record<string, DecisioneOrgano> = {};
    const nomineSalvate: NuovaNomina[] = [];

    for (const row of data.soggetti || []) {
      if (String(row.tipo_soggetto || "") !== "organo_controllo") continue;
      const meta = safeJson(row.note);
      if (meta.workflow !== "nomina_organo_controllo") continue;

      const nominativo = row.nominativo || {};
      const nome = nominativo.nome_cognome || nominativo.ragione_sociale || meta.nominativo_nome || "";
      const codiceFiscale = nominativo.codice_fiscale || meta.nominativo_codice_fiscale || "";
      const partitaIva = nominativo.partita_iva || meta.nominativo_partita_iva || meta.partita_iva || "";

      if ((meta.azione === "conferma" || meta.azione === "rimozione") && meta.source_organo_id) {
        nuoveDecisioni[String(meta.source_organo_id)] = {
          azione: meta.azione === "conferma" ? "CONFERMA" : "RIMOZIONE",
          data_effetto: meta.data_effetto || "",
          motivo: meta.motivo || "",
        };
      }

      if (meta.azione === "conferma") {
        nomineSalvate.push({
          id: String(row.id),
          nominativo_id: meta.source_cliente_id || "",
          nome,
          codice_fiscale: codiceFiscale,
          partita_iva: partitaIva,
          qualifica: meta.qualifica || "",
          carica: row.carica || "",
          data_inizio: meta.data_inizio || "",
          durata_tipo: meta.durata_tipo || "APPROVAZIONE_BILANCIO",
          data_fine: meta.data_fine || "",
          bilancio_chiuso_al: meta.bilancio_chiuso_al || "",
          durata_anni: meta.durata_anni || "",
          compenso_lordo: meta.compenso_lordo || "",
          source_organo_id: meta.source_organo_id || "",
          origine_azione: "conferma",
        });
      }

      if (meta.azione === "nomina") {
        nomineSalvate.push({
          id: String(row.id),
          nominativo_id: meta.source_cliente_id || "",
          nome,
          codice_fiscale: codiceFiscale,
          partita_iva: partitaIva,
          qualifica: meta.qualifica || "",
          carica: row.carica || "",
          data_inizio: meta.data_inizio || "",
          durata_tipo: meta.durata_tipo || "APPROVAZIONE_BILANCIO",
          data_fine: meta.data_fine || "",
          bilancio_chiuso_al: meta.bilancio_chiuso_al || "",
          durata_anni: meta.durata_anni || "",
          compenso_lordo: meta.compenso_lordo || "",
          source_organo_id: "",
          origine_azione: "nomina",
        });
      }
    }

    setDecisioni(nuoveDecisioni);
    setNomine(nomineSalvate);
  }

  function setDecisione(organoId: string, patch: Partial<DecisioneOrgano>) {
    setDecisioni((prev) => ({
      ...prev,
      [organoId]: {
        azione: prev[organoId]?.azione || "NESSUNA",
        data_effetto: prev[organoId]?.data_effetto || form.data_atto || "",
        motivo: prev[organoId]?.motivo || "",
        ...patch,
      },
    }));
  }

  function normalizzaCaricaEsistente(organo: any) {
    const testo = String(`${organo?.carica || ""} ${organo?.ruolo || ""}`).toLowerCase();
    if (testo.includes("presidente") && testo.includes("sindac")) return "Presidente del collegio sindacale";
    if (testo.includes("supplente")) return "Sindaco supplente";
    if (testo.includes("sindaco unico")) return "Sindaco unico";
    if (testo.includes("sindac")) return "Sindaco effettivo";
    if ((testo.includes("società") || testo.includes("societa")) && testo.includes("revis")) return "Società di revisione";
    if (testo.includes("revis")) return "Revisore legale";
    return organo?.carica || organo?.ruolo || "Revisore legale";
  }

  function precompilaConferma(organo: any) {
    const sourceId = String(organo?.id || "");
    const giaInserita = nomine.find(
      (item) => item.origine_azione === "conferma" && item.source_organo_id === sourceId
    );
    if (giaInserita) {
      setNuovaNomina(giaInserita);
      return;
    }

    const durataAnni = organo?.durata_carica_anni ? String(organo.durata_carica_anni) : "";
    const dataScadenza = organo?.data_scadenza || "";
    setNuovaNomina({
      id: "",
      nominativo_id: String(organo?.soggetto_cliente_id || ""),
      nome: organo?.nominativo_nome || organo?.soggetto_cliente?.ragione_sociale || "",
      codice_fiscale: organo?.nominativo_codice_fiscale || organo?.soggetto_cliente?.codice_fiscale || "",
      partita_iva: organo?.soggetto_cliente?.partita_iva || "",
      qualifica: organo?.qualifica || "",
      carica: normalizzaCaricaEsistente(organo),
      data_inizio: organo?.data_nomina || form.data_atto || "",
      durata_tipo: durataAnni ? "ANNI" : dataScadenza ? "DATA_FINE" : "APPROVAZIONE_BILANCIO",
      data_fine: dataScadenza,
      bilancio_chiuso_al: "",
      durata_anni: durataAnni,
      compenso_lordo: organo?.compenso_lordo ? String(organo.compenso_lordo) : "",
      source_organo_id: sourceId,
      origine_azione: "conferma",
    });
  }

  function handleDecisioneOrganoChange(organo: any, azione: AzioneOrgano) {
    const organoId = String(organo.id);
    const precedente = decisioni[organoId];
    setDecisione(organoId, {
      azione,
      data_effetto:
        azione === "RIMOZIONE"
          ? precedente?.data_effetto || form.data_atto || ""
          : precedente?.data_effetto || "",
    });

    if (azione === "CONFERMA") precompilaConferma(organo);
  }

  function applicaNominativo(id: string) {
    const selected = nominativi.find((n: any) => String(n.id) === String(id));
    setNuovaNomina((prev) => ({
      ...prev,
      nominativo_id: id,
      nome: selected?.ragione_sociale || selected?.nome_cognome || "",
      codice_fiscale: selected?.codice_fiscale || "",
      partita_iva: selected?.partita_iva || "",
    }));
  }

  function aggiungiNomina() {
    const identificativo = nuovaNomina.codice_fiscale.trim() || nuovaNomina.partita_iva.trim();
    if (!nuovaNomina.nome.trim()) return alert("Inserisci il nominativo o la denominazione.");
    if (!identificativo) return alert("Inserisci codice fiscale o partita IVA.");
    if (!nuovaNomina.carica) return alert("Seleziona la carica.");
    if (!nuovaNomina.data_inizio) return alert("Inserisci la data di inizio incarico.");
    if (nuovaNomina.durata_tipo === "DATA_FINE" && !nuovaNomina.data_fine) {
      return alert("Inserisci la data di fine incarico.");
    }
    if (
      nuovaNomina.durata_tipo === "APPROVAZIONE_BILANCIO" &&
      !nuovaNomina.bilancio_chiuso_al
    ) {
      return alert("Inserisci la data di chiusura del bilancio di riferimento.");
    }
    if (nuovaNomina.durata_tipo === "ANNI" && Number(nuovaNomina.durata_anni || 0) <= 0) {
      return alert("Inserisci la durata in anni.");
    }

    const voce = { ...nuovaNomina, id: nuovaNomina.id || crypto.randomUUID() };

    if (voce.origine_azione === "conferma" && voce.source_organo_id) {
      setNomine((prev) => [
        ...prev.filter(
          (item) =>
            !(item.origine_azione === "conferma" && item.source_organo_id === voce.source_organo_id)
        ),
        voce,
      ]);
    } else {
      setNomine((prev) => [...prev, voce]);
    }

    setNuovaNomina(nuovaNominaVuota());
  }

  async function assicuraNominativo(nome: string, codiceFiscale: string) {
    const res = await fetch("/api/pratiche/nominativi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome_cognome: nome.trim(),
        codice_fiscale: codiceFiscale.trim().toUpperCase(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.nominativo?.id) {
      throw new Error(data.error || `Impossibile salvare il nominativo ${nome}`);
    }
    return data.nominativo.id as string;
  }

  async function salvaRigheDelibera() {
    const currentRes = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soggetti`, {
      cache: "no-store",
    });
    const currentData = await currentRes.json();
    if (!currentRes.ok) throw new Error(currentData.error || "Errore lettura soggetti pratica");

    const righePrecedenti = (currentData.soggetti || []).filter((row: any) => {
      const meta = safeJson(row.note);
      return (
        String(row.tipo_soggetto || "") === "organo_controllo" &&
        meta.workflow === "nomina_organo_controllo"
      );
    });

    for (const row of righePrecedenti) {
      const del = await fetch(
        `/api/pratiche/${encodeURIComponent(praticaId)}/soggetti/${encodeURIComponent(String(row.id))}`,
        { method: "DELETE" }
      );
      if (!del.ok) throw new Error("Errore aggiornamento delibere precedenti");
    }

    let ordine = 1;

    for (const organo of organiControllo) {
      const decisione = decisioni[String(organo.id)];
      if (!decisione || decisione.azione === "NESSUNA") continue;

      const dettaglioConferma = nomine.find(
        (item) =>
          item.origine_azione === "conferma" &&
          item.source_organo_id === String(organo.id)
      );

      const nome = dettaglioConferma?.nome || organo.nominativo_nome || organo.soggetto_cliente?.ragione_sociale || "";
      const cf = dettaglioConferma?.codice_fiscale || organo.nominativo_codice_fiscale || organo.soggetto_cliente?.codice_fiscale || "";
      const piva = dettaglioConferma?.partita_iva || organo.soggetto_cliente?.partita_iva || "";

      if (!nome || (!cf && !piva)) {
        throw new Error(`Dati anagrafici incompleti per ${nome || organo.carica || "componente"}`);
      }

      const meta: MetaSoggetto = {
        workflow: "nomina_organo_controllo",
        azione: decisione.azione === "CONFERMA" ? "conferma" : "rimozione",
        source_organo_id: String(organo.id),
        source_cliente_id: String(organo.soggetto_cliente_id || ""),
        nominativo_nome: nome,
        nominativo_codice_fiscale: cf,
        nominativo_partita_iva: piva,
        nominativo_indirizzo: organo.soggetto_cliente?.indirizzo || "",
        nominativo_cap: organo.soggetto_cliente?.cap || "",
        nominativo_citta: organo.soggetto_cliente?.citta || "",
        nominativo_provincia: organo.soggetto_cliente?.provincia || "",
        partita_iva: piva,
        qualifica: dettaglioConferma?.qualifica || organo?.qualifica || "",
        data_inizio: dettaglioConferma?.data_inizio || organo.data_nomina || "",
        data_effetto:
          decisione.azione === "RIMOZIONE"
            ? decisione.data_effetto || form.data_atto || ""
            : "",
        motivo: decisione.motivo || "",
        durata_tipo:
          dettaglioConferma?.durata_tipo ||
          (organo.durata_carica_anni
            ? "ANNI"
            : organo.data_scadenza
            ? "DATA_FINE"
            : undefined),
        data_fine: dettaglioConferma?.data_fine || organo.data_scadenza || "",
        bilancio_chiuso_al: dettaglioConferma?.bilancio_chiuso_al || "",
        durata_anni:
          dettaglioConferma?.durata_anni ||
          (organo.durata_carica_anni ? String(organo.durata_carica_anni) : ""),
        compenso_lordo: dettaglioConferma?.compenso_lordo || "",
      };

      const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soggetti`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_soggetto: "organo_controllo",
          nominativo_id: null,
          carica: dettaglioConferma?.carica || organo.carica || organo.ruolo || "Componente organo di controllo",
          note: JSON.stringify(meta),
          ordine: ordine++,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore salvataggio conferma/rimozione");
    }

    for (const nomina of nomine.filter((item) => item.origine_azione !== "conferma")) {
      const cf = nomina.codice_fiscale.trim();
      const piva = nomina.partita_iva.trim();
      const selected = nominativi.find((n: any) => String(n.id) === String(nomina.nominativo_id));

      const meta: MetaSoggetto = {
        workflow: "nomina_organo_controllo",
        azione: "nomina",
        source_cliente_id: nomina.nominativo_id || "",
        nominativo_nome: nomina.nome,
        nominativo_codice_fiscale: cf,
        nominativo_partita_iva: piva,
        nominativo_indirizzo: selected?.indirizzo || "",
        nominativo_cap: selected?.cap || "",
        nominativo_citta: selected?.citta || "",
        nominativo_provincia: selected?.provincia || "",
        partita_iva: piva,
        qualifica: nomina.qualifica,
        data_inizio: nomina.data_inizio,
        durata_tipo: nomina.durata_tipo,
        data_fine: nomina.data_fine,
        bilancio_chiuso_al: nomina.bilancio_chiuso_al,
        durata_anni: nomina.durata_anni,
        compenso_lordo: nomina.compenso_lordo,
      };

      const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soggetti`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_soggetto: "organo_controllo",
          nominativo_id: null,
          carica: nomina.carica,
          note: JSON.stringify(meta),
          ordine: ordine++,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore salvataggio nuova nomina");
    }
  }

  async function salvaDatiDocumento(e?: React.FormEvent) {
    if (e) e.preventDefault();

    const haDecisioni = Object.values(decisioni).some((d) => d.azione !== "NESSUNA");
    if (!haDecisioni && nomine.length === 0) {
      alert("Conferma, rimuovi almeno un componente oppure inserisci una nuova nomina.");
      return false;
    }

    const rimozioneSenzaData = Object.entries(decisioni).some(
      ([, d]) => d.azione === "RIMOZIONE" && !(d.data_effetto || form.data_atto)
    );
    if (rimozioneSenzaData) {
      alert("Inserisci la data di effetto delle rimozioni.");
      return false;
    }

    setSaving(true);
    setMessaggio("");
    try {
      const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          percentuale_soci_presenti: capitalePresente,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore salvataggio dati verbale");

      await salvaRigheDelibera();
      await caricaDecisioniSalvate();
      setMessaggio("Verbale di nomina salvato correttamente.");
      return true;
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function generaVerbale() {
    const salvato = await salvaDatiDocumento();
    if (!salvato) return;

    const res = await fetch(
      `/api/pratiche/${encodeURIComponent(String(praticaId))}/genera-documento`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice_modello: "VERBALE_NOMINA_ORGANO_CONTROLLO" }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Errore generazione verbale di nomina");
      return;
    }
    alert("Verbale di nomina generato correttamente");
    await caricaDocumenti();
  }

  async function generaAccettazioni() {
    const haCariche =
      nuoveNomineEffettive.length > 0 ||
      Object.values(decisioni).some((d) => d.azione === "CONFERMA");

    if (!haCariche) {
      alert("Non ci sono cariche per le quali generare l'accettazione.");
      return;
    }

    const ok = confirm("Generare il documento di accettazione carica/cariche?");
    if (!ok) return;

    const salvato = await salvaDatiDocumento();
    if (!salvato) return;

    const res = await fetch(
      `/api/pratiche/${encodeURIComponent(String(praticaId))}/genera-documento`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice_modello: "ACCETTAZIONE_CARICHE" }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Errore generazione accettazione carica/cariche");
      return;
    }
    alert("Accettazione carica/cariche generata correttamente");
    await caricaDocumenti();
  }

  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh", fontFamily: font }}>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={() => router.push("/pratiche/variazioni")} style={secondaryButton}>
          ← Torna a elenco pratiche
        </button>
      </div>

      <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>{pratica?.numero_pratica}</h1>
      <p style={{ marginTop: 6, fontSize: 18, color: "#64748b" }}>
        Verbale di nomina / modifica organo di controllo e revisione legale
      </p>

      <form onSubmit={salvaDatiDocumento}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati società</h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 18 }}>
            <Field label="Denominazione"><input style={inputStyle} value={form.societa_denominazione} onChange={(e) => aggiornaCampo("societa_denominazione", e.target.value)} /></Field>
            <Field label="Codice fiscale"><input style={inputStyle} value={form.societa_codice_fiscale} onChange={(e) => aggiornaCampo("societa_codice_fiscale", e.target.value)} /></Field>
            <Field label="Partita IVA"><input style={inputStyle} value={form.societa_partita_iva} onChange={(e) => aggiornaCampo("societa_partita_iva", e.target.value)} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 14 }}>
            <Field label="Sede"><input style={inputStyle} value={form.societa_sede} onChange={(e) => aggiornaCampo("societa_sede", e.target.value)} /></Field>
            <Field label="REA"><input style={inputStyle} value={form.societa_rea} onChange={(e) => aggiornaCampo("societa_rea", e.target.value)} /></Field>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dati assemblea</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 12, marginTop: 18 }}>
            <Field label="Data assemblea"><input type="date" style={inputStyle} value={form.data_atto} onChange={(e) => aggiornaCampo("data_atto", e.target.value)} /></Field>
            <Field label="Ora inizio"><input type="time" style={inputStyle} value={form.ora_inizio} onChange={(e) => aggiornaCampo("ora_inizio", e.target.value)} /></Field>
            <Field label="Ora chiusura"><input type="time" style={inputStyle} value={form.ora_chiusura} onChange={(e) => aggiornaCampo("ora_chiusura", e.target.value)} /></Field>
            <Field label="Luogo assemblea"><input style={inputStyle} value={form.luogo_assemblea} onChange={(e) => aggiornaCampo("luogo_assemblea", e.target.value)} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
            <Field label="Presidente"><input style={inputStyle} value={form.presidente} onChange={(e) => aggiornaCampo("presidente", e.target.value)} /></Field>
            <Field label="Segretario"><input style={inputStyle} value={form.segretario} onChange={(e) => aggiornaCampo("segretario", e.target.value)} /></Field>
            <Field label="Percentuale capitale presente"><input style={{ ...inputStyle, background: "#f1f5f9", fontWeight: 700 }} value={capitalePresente.toFixed(2)} disabled /></Field>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Soci presenti</h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, marginTop: 18, alignItems: "end" }}>
            <Field label="Socio">
              <select style={inputStyle} value={nuovoSocio.nominativo_id} onChange={(e) => {
                const selected = sociArchivio.find((o: any) => String(o.soggetto_cliente_id) === String(e.target.value));
                setNuovoSocio({
                  nominativo_id: selected?.soggetto_cliente_id || "",
                  nome_cognome: selected?.soggetto_cliente?.ragione_sociale || selected?.nominativo_nome || "",
                  codice_fiscale: selected?.soggetto_cliente?.codice_fiscale || selected?.soggetto_cliente?.partita_iva || selected?.nominativo_codice_fiscale || "",
                  percentuale_partecipazione: selected?.percentuale_partecipazione ? String(selected.percentuale_partecipazione) : "",
                  presenza: nuovoSocio.presenza || "Presente",
                });
              }}>
                <option value="">Seleziona socio</option>
                {sociArchivio.map((o: any) => <option key={o.id} value={o.soggetto_cliente_id || ""}>{o.soggetto_cliente?.ragione_sociale || o.nominativo_nome || "-"}</option>)}
              </select>
            </Field>
            <Field label="% partecipazione"><input type="number" step="0.01" style={inputStyle} value={nuovoSocio.percentuale_partecipazione} onChange={(e) => setNuovoSocio({ ...nuovoSocio, percentuale_partecipazione: e.target.value })} /></Field>
            <Field label="Presenza / delega"><input style={inputStyle} value={nuovoSocio.presenza} onChange={(e) => setNuovoSocio({ ...nuovoSocio, presenza: e.target.value })} /></Field>
            <button type="button" style={blueButton} onClick={async () => {
              if (!nuovoSocio.nome_cognome) return alert("Seleziona un socio.");
              if (capitalePresente + Number(nuovoSocio.percentuale_partecipazione || 0) > 100) return alert("La percentuale totale non può superare il 100%.");
              const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soci`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuovoSocio) });
              if (!res.ok) return alert("Errore inserimento socio");
              setNuovoSocio({ nominativo_id: "", nome_cognome: "", codice_fiscale: "", percentuale_partecipazione: "", presenza: "Presente" });
              await caricaSoci();
            }}>Aggiungi</button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
            <thead><tr><th style={thStyle}>Socio</th><th style={thStyle}>CF</th><th style={thStyle}>Quota</th><th style={thStyle}>Presenza / delega</th><th style={thStyle}>Azioni</th></tr></thead>
            <tbody>{soci.map((s: any) => <tr key={s.id}><td style={tdStyle}>{s.nome_cognome}</td><td style={tdStyle}>{s.codice_fiscale}</td><td style={tdStyle}>{Number(s.percentuale_partecipazione || 0).toFixed(2)}%</td><td style={tdStyle}>{s.presenza || "Presente"}</td><td style={tdStyle}><button type="button" style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 600 }} onClick={async () => { if (!confirm("Eliminare il socio?")) return; await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/soci/${encodeURIComponent(String(s.id))}`, { method: "DELETE" }); await caricaSoci(); }}>Elimina</button></td></tr>)}</tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Organi di controllo / revisione già presenti</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>Per ogni componente già presente indica se resta invariato, viene confermato espressamente nel verbale oppure viene rimosso/revocato.</p>
          {organiControllo.length === 0 ? <div style={{ ...subCardStyle, color: "#64748b" }}>Nessun sindaco o revisore attivo trovato nell'archivio della società.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
              <thead><tr><th style={thStyle}>Nominativo</th><th style={thStyle}>Carica</th><th style={thStyle}>Decorrenza / scadenza</th><th style={thStyle}>Decisione assemblea</th></tr></thead>
              <tbody>{organiControllo.map((o: any) => {
                const decisione = decisioni[String(o.id)] || { azione: "NESSUNA" as AzioneOrgano, data_effetto: form.data_atto || "", motivo: "" };
                return <tr key={o.id}><td style={tdStyle}><strong>{o.nominativo_nome || o.soggetto_cliente?.ragione_sociale || "—"}</strong><div style={{ color: "#64748b", fontSize: 12 }}>{o.nominativo_codice_fiscale || o.soggetto_cliente?.codice_fiscale || ""}</div></td><td style={tdStyle}>{o.carica || o.ruolo || "—"}</td><td style={tdStyle}><div>Dal: {formatDateIt(o.data_nomina)}</div><div>Scadenza: {formatDateIt(o.data_scadenza)}</div></td><td style={tdStyle}><select style={inputStyle} value={decisione.azione} onChange={(e) => handleDecisioneOrganoChange(o, e.target.value as AzioneOrgano)}><option value="NESSUNA">Nessuna modifica</option><option value="CONFERMA">Conferma in carica</option><option value="RIMOZIONE">Revoca / rimozione</option></select>{decisione.azione === "RIMOZIONE" && <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 8 }}><input type="date" style={inputStyle} value={decisione.data_effetto || form.data_atto} onChange={(e) => setDecisione(String(o.id), { data_effetto: e.target.value })} /><input style={inputStyle} placeholder="Motivo / nota (facoltativo)" value={decisione.motivo} onChange={(e) => setDecisione(String(o.id), { motivo: e.target.value })} /></div>}</td></tr>;
              })}</tbody>
            </table>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Nuove nomine</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>Inserisci qui Sindaco unico, membri del Collegio sindacale, Revisore legale o Società di revisione. La stessa pratica può contenere più nomine.</p>
          <div style={subCardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <Field label="Seleziona nominativo / società già presente in anagrafica"><select style={inputStyle} value={nuovaNomina.nominativo_id} onChange={(e) => applicaNominativo(e.target.value)}><option value="">Inserimento manuale</option>{nominativi.map((n: any) => <option key={n.id} value={n.id}>{n.ragione_sociale || n.nome_cognome}</option>)}</select></Field>
              <Field label="Carica / incarico"><select style={inputStyle} value={nuovaNomina.carica} onChange={(e) => setNuovaNomina({ ...nuovaNomina, carica: e.target.value })}>{caricheNomina.map((carica) => <option key={carica} value={carica}>{carica}</option>)}</select></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              <Field label="Nominativo / denominazione"><input style={inputStyle} value={nuovaNomina.nome} onChange={(e) => setNuovaNomina({ ...nuovaNomina, nome: e.target.value })} /></Field>
              <Field label="Codice fiscale"><input style={inputStyle} value={nuovaNomina.codice_fiscale} onChange={(e) => setNuovaNomina({ ...nuovaNomina, codice_fiscale: e.target.value.toUpperCase() })} /></Field>
              <Field label="Partita IVA"><input style={inputStyle} value={nuovaNomina.partita_iva} onChange={(e) => setNuovaNomina({ ...nuovaNomina, partita_iva: e.target.value })} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 14 }}>
              <Field label="Qualifica professionale"><input style={inputStyle} placeholder="es. Dottore Commercialista / Revisore Legale" value={nuovaNomina.qualifica} onChange={(e) => setNuovaNomina({ ...nuovaNomina, qualifica: e.target.value })} /></Field>
              <Field label="Data inizio incarico"><input type="date" style={inputStyle} value={nuovaNomina.data_inizio} onChange={(e) => setNuovaNomina({ ...nuovaNomina, data_inizio: e.target.value })} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              <Field label="Durata incarico"><select style={inputStyle} value={nuovaNomina.durata_tipo} onChange={(e) => setNuovaNomina({ ...nuovaNomina, durata_tipo: e.target.value as TipoDurata, data_fine: "", bilancio_chiuso_al: "", durata_anni: "" })}><option value="APPROVAZIONE_BILANCIO">Fino all'approvazione del bilancio</option><option value="DATA_FINE">Fino a data</option><option value="ANNI">Durata in anni</option></select></Field>
              {nuovaNomina.durata_tipo === "APPROVAZIONE_BILANCIO" && <Field label="Bilancio chiuso al"><input type="date" style={inputStyle} value={nuovaNomina.bilancio_chiuso_al} onChange={(e) => setNuovaNomina({ ...nuovaNomina, bilancio_chiuso_al: e.target.value })} /></Field>}
              {nuovaNomina.durata_tipo === "DATA_FINE" && <Field label="Data fine"><input type="date" style={inputStyle} value={nuovaNomina.data_fine} onChange={(e) => setNuovaNomina({ ...nuovaNomina, data_fine: e.target.value })} /></Field>}
              {nuovaNomina.durata_tipo === "ANNI" && <Field label="Durata (anni)"><input type="number" min="1" step="1" style={inputStyle} value={nuovaNomina.durata_anni} onChange={(e) => setNuovaNomina({ ...nuovaNomina, durata_anni: e.target.value })} /></Field>}
              <Field label="Compenso annuo lordo (€)"><input type="number" min="0" step="0.01" style={inputStyle} value={nuovaNomina.compenso_lordo} onChange={(e) => setNuovaNomina({ ...nuovaNomina, compenso_lordo: e.target.value })} /></Field>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button type="button" style={blueButton} onClick={aggiungiNomina}>{nuovaNomina.origine_azione === "conferma" ? "Aggiorna conferma" : "Aggiungi nomina"}</button></div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
            <thead><tr><th style={thStyle}>Nominato</th><th style={thStyle}>Carica</th><th style={thStyle}>Decorrenza</th><th style={thStyle}>Durata</th><th style={thStyle}>Compenso</th><th style={thStyle}>Azioni</th></tr></thead>
            <tbody>{nomine.length === 0 ? <tr><td colSpan={6} style={{ ...tdStyle, color: "#64748b" }}>Nessuna nuova nomina inserita.</td></tr> : nomine.map((n) => <tr key={n.id}><td style={tdStyle}><strong>{n.nome}</strong><div style={{ color: "#64748b", fontSize: 12 }}>{n.codice_fiscale || n.partita_iva}</div>{n.qualifica && <div style={{ color: "#64748b", fontSize: 12 }}>{n.qualifica}</div>}</td><td style={tdStyle}>{n.carica}</td><td style={tdStyle}>{formatDateIt(n.data_inizio)}</td><td style={tdStyle}>{descrizioneScadenza(n)}</td><td style={tdStyle}>{n.compenso_lordo ? `${Number(n.compenso_lordo).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}</td><td style={tdStyle}><button type="button" style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 600 }} onClick={() => setNomine((prev) => prev.filter((x) => x.id !== n.id))}>Elimina</button></td></tr>)}</tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Riepilogo deliberazioni</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 18 }}>
            <div style={subCardStyle}><div style={{ fontSize: 12, color: "#64748b" }}>CONFERME</div><div style={{ fontSize: 28, fontWeight: 800 }}>{numeroConferme}</div></div>
            <div style={subCardStyle}><div style={{ fontSize: 12, color: "#64748b" }}>RIMOZIONI / REVOCHE</div><div style={{ fontSize: 28, fontWeight: 800 }}>{numeroRimozioni}</div></div>
            <div style={subCardStyle}><div style={{ fontSize: 12, color: "#64748b" }}>NUOVE NOMINE</div><div style={{ fontSize: 28, fontWeight: 800 }}>{nuoveNomineEffettive.length}</div></div>
            <div style={subCardStyle}><div style={{ fontSize: 12, color: "#64748b" }}>REVISORI / SOCIETÀ REVISIONE</div><div style={{ fontSize: 28, fontWeight: 800 }}>{numeroRevisoriNuovi}</div></div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={titleStyle}>Dichiarazione di conformità</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            <Field label="Professionista incaricato"><select style={inputStyle} value={professionisti.find((p: any) => p.ragione_sociale === form.professionista_nome)?.id || ""} onChange={(e) => { const prof = professionisti.find((p: any) => String(p.id) === String(e.target.value)); setForm((prev) => ({ ...prev, professionista_nome: prof?.ragione_sociale || "", professionista_codice_fiscale: prof?.codice_fiscale || "" })); }}><option value="">Seleziona professionista</option>{professionisti.map((p: any) => <option key={p.id} value={p.id}>{p.ragione_sociale}</option>)}</select></Field>
            <Field label="Tipo dicitura"><select style={inputStyle} onChange={(e) => { const d = diciture.find((x: any) => String(x.id) === String(e.target.value)); if (!d) return; aggiornaCampo("dicitura_presentazione", String(d.testo || "").replaceAll("[PROFESSIONISTA_NOME]", form.professionista_nome || "")); }}><option value="">Seleziona dicitura</option>{diciture.map((d: any) => <option key={d.id} value={d.id}>{d.titolo}</option>)}</select></Field>
          </div>
          <div style={{ marginTop: 14 }}><Field label="Dicitura presentazione"><textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical", background: "#f8fafc" }} value={form.dicitura_presentazione} onChange={(e) => aggiornaCampo("dicitura_presentazione", e.target.value)} /></Field></div>
          <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 14, color: messaggio.toLowerCase().includes("errore") ? "#dc2626" : "#64748b" }}>{messaggio}</div><button type="submit" disabled={saving} style={blueButton}>{saving ? "Salvataggio..." : "Salva dati verbale"}</button></div>
        </div>
      </form>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Documenti</h2>
        <div style={{ marginTop: 18 }}><Field label="Modello verbale"><input style={{ ...inputStyle, background: "#f1f5f9" }} value="VERBALE_NOMINA_ORGANO_CONTROLLO" disabled /></Field></div>
        <div style={{ display: "flex", gap: 28, marginTop: 18, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}><input type="checkbox" checked={form.verbale_definitivo} onChange={(e) => aggiornaCampo("verbale_definitivo", e.target.checked)} /> Verbale definitivo</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}><input type="checkbox" disabled checked={documenti.some((d: any) => d.tipo_documento === "VERBALE_NOMINA_ORGANO_CONTROLLO")} /> Verbale di nomina generato</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}><input type="checkbox" disabled checked={documenti.some((d: any) => d.tipo_documento === "ACCETTAZIONE_CARICHE")} /> Accettazione carica/cariche generata</label>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}><button type="button" style={blueButton} onClick={generaVerbale}>Genera verbale di nomina</button><button type="button" style={blueButton} onClick={generaAccettazioni}>Genera accettazione carica/cariche</button></div>

        {documenti.length > 0 && <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}><thead><tr><th style={thStyle}>Documento</th><th style={thStyle}>Tipo</th><th style={thStyle}>Data</th><th style={thStyle}>Azioni</th></tr></thead><tbody>{documenti.map((doc: any) => <tr key={doc.id}><td style={tdStyle}>{doc.nome_file}</td><td style={tdStyle}>{doc.tipo_documento}</td><td style={tdStyle}>{doc.created_at ? new Date(doc.created_at).toLocaleString("it-IT") : "—"}</td><td style={tdStyle}><div style={{ display: "flex", gap: 14 }}><a href={`/api/pratiche/${praticaId}/documenti/${doc.id}/download`} download style={{ color: "#2563eb", display: "flex", alignItems: "center" }}><Download size={18} /></a><label style={{ color: "#16a34a", display: "flex", alignItems: "center", cursor: "pointer" }}><Upload size={18} /><input type="file" accept=".docx" style={{ display: "none" }} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append("file", file); fd.append("documento_id", doc.id); const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/documento-modificato`, { method: "POST", body: fd }); if (!res.ok) return alert("Errore upload documento"); await caricaDocumenti(); }} /></label><button type="button" style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }} onClick={async () => { if (!confirm("Eliminare documento?")) return; const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/documenti/${encodeURIComponent(String(doc.id))}`, { method: "DELETE" }); if (!res.ok) return alert("Errore eliminazione documento"); await caricaDocumenti(); }}><Trash2 size={18} /></button></div></td></tr>)}</tbody></table>}
      </div>
    </main>
  );
}
