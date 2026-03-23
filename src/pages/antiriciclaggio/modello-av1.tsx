import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudioId } from "@/services/getStudioId";
import { useRouter } from "next/router";
import FormStickyHeader from "@/components/antiriciclaggio/FormStickyHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BUCKET_NAME = "allegati";

type Cliente = {
  id: string;
  ragione_sociale?: string | null;
  denominazione?: string | null;
  nominativo?: string | null;
  nome?: string | null;
  cognome?: string | null;
};

type PrestazioneAR = {
  id: number;
  TipoPrestazioneAR: string;
  RischioTipoPrestAR: string;
  PunteggioPrestAR: number;
};

type ResponsabileAV = {
  id: string;
  cognome_nome: string;
  codice_fiscale?: string | null;
  TipoSoggetto?: string | null;
};

type FormDataType = {
  id?: string;
  studio_id: string;
  cliente_id: string;
  Prestazione: string;
  ValRischioIner: string;
  DataVerifica: string;
  ScadenzaVerifica: string;
  AV1Conferma?: boolean;
  AV4Generato?: boolean;
  allegato_av1_firmato?: string;
  incaricato_adeguata_verifica_id?: string;

  A1: number;
  A2: number;
  A3: number;
  A4: number;
  B1: number;
  B2: number;
  B3: number;
  B4: number;
  B5: number;
  B6: number;

  [key: string]: any;
};

const sectionTitles: Record<string, string> = {
  A1: "A.1 - Natura giuridica",
  A2: "A.2 - Prevalente attività svolta",
  A3: "A.3 - Comportamento tenuto al momento del conferimento dell’incarico",
  A4: "A.4 - Area geografica di residenza del cliente",
  B1: "B.1 - Tipologia",
  B2: "B.2 - Modalità di svolgimento",
  B3: "B.3 - Ammontare dell’operazione",
  B4: "B.4 - Frequenza e volume delle operazioni/durata della prestazione professionale",
  B5: "B.5 - Ragionevolezza",
  B6: "B.6 - Area geografica di destinazione",
};

export const av1Labels = {
  A1: {
    a1a: "Non congruità della natura giuridica prescelta in relazione all’attività svolta e alle sue dimensioni",
    a1b: "Articolazione giuridica, complessità e opacità della struttura volte ad ostacolare l’identificazione del titolare effettivo o l’attività concretamente svolta",
    a1c: "Partecipazione di persone politicamente esposte (cliente, esecutore, titolare effettivo)",
    a1d: "Incarichi in società, associazioni, fondazioni, organizzazioni non lucrative, organizzazioni non governative soprattutto se aventi sede in paesi ad alto rischio o non collaborativi",
    a1e: "Processi penali o indagini in corso per circostanze attinenti al terrorismo, al riciclaggio o all’autoriciclaggio – Misure di prevenzione o provvedimenti di sequestro - Familiarità/stretti legami con soggetti sottoposti a indagini o a procedimenti penali o provvedimenti di sequestro o censiti nelle liste delle persone o degli enti attivi nel finanziamento del terrorismo",
    a1f: "Altro",
  },

  A2: {
    a2a: "Attività esposte al rischio di infiltrazioni criminali e terroristiche secondo le periodiche pubblicazioni delle Autorità in materia, sia a livello sovranazionale (Relazione UE sulla valutazione del rischio sovranazionale), sia a livello nazionale",
    a2b: "Struttura organizzativa e dimensionale non coerente con l’attività svolta",
    a2c: "Non conformità dell’attività svolta rispetto a quella indicata nell’atto costitutivo",
    a2d: "Altro",
  },

  A3: {
    a3a: "Cliente non presente fisicamente",
    a3b: "Presenza di soggetti terzi con ruolo non definito",
    a3c: "Comportamento non trasparente e collaborativo",
    a3d: "Difficoltà nell’individuazione del titolare effettivo",
    a3e: "Altro",
  },

  A4: {
    a4a: "Residenza/localizzazione in: comune italiano a rischio a causa dell’utilizzo eccessivo di contante – Residenza in Paesi terzi ad alto rischio individuati dalle Autorità – Paesi terzi non dotati di efficaci sistemi di prevenzione del riciclaggio e del finanziamento del terrorismo coerenti con le raccomandazioni del GAFI – Paesi terzi caratterizzati da un elevato livello di corruzione o di permeabilità ad altre attività criminose – Aree di conflitto in cui sono presenti organizzazioni terroristiche o in zone limitrofe o di transito – Paese soggetto a sanzioni o embarghi o misure analoghe stabilite dall’O.N.U. o altri organismi internazionali - (vedasi le pubblicazioni periodiche delle Autorità in materia, sia a livello sovranazionale, sia a livello nazionale)",
    a4b: "Lontananza della residenza del cliente rispetto alla sede del professionista",
    a4c: "Altro",
  },

  B1: {
    b1a: "Operazione ordinaria/straordinaria rispetto al profilo soggettivo del cliente",
    b1b: "Operazione che prevede schemi negoziali che possono agevolare l’opacità delle relazioni economiche e finanziarie intercorrenti tra il cliente e la controparte",
    b1c: "Articolazione contrattuale ingiustificata",
    b1d: "Altro",
  },

  B2: {
    b2a: "Utilizzo di mezzi di pagamento non tracciati - Utilizzo di valute virtuali",
    b2b: "Utilizzo di conti non propri per trasferire/ricevere fondi",
    b2c: "Ricorso reiterato a procure",
    b2d: "Ricorso a domiciliazioni di comodo",
    b2e: "Altro",
  },

  B3: {
    b3a: "Incoerenza dell’ammontare rispetto al profilo economico e finanziario del cliente",
    b3b: "Presenza di frazionamenti artificiosi",
    b3c: "Altro",
  },

  B4: {
    b4a: "Non congruità della frequenza dell’operazione rispetto all’attività esercitata – Operatività improvvisa e poco giustificata rispetto all’ordinaria attività – Operazioni di ammontare consistente, concentrate in un ristretto arco temporale",
    b4b: "Rapporto professionale continuativo o occasionale",
    b4c: "Altro",
  },

  B5: {
    b5a: "Irragionevolezza dell’operazione rispetto all’attività svolta dal cliente",
    b5b: "Irragionevolezza dell’operazione rispetto all’entità delle risorse economiche nella disponibilità del cliente",
    b5c: "Non congruità dell’operazione rispetto alle finalità dichiarate",
    b5d: "Altro",
  },

  B6: {
    b6a: "Destinazione in: comune italiano a rischio a causa dell’utilizzo eccessivo di contante – Paesi terzi ad alto rischio individuati dalle Autorità – Paesi terzi non dotati di efficaci sistemi di prevenzione del riciclaggio e del finanziamento del terrorismo coerenti con le raccomandazioni del GAFI – Paesi terzi caratterizzati da un elevato livello di corruzione o di permeabilità ad altre attività criminose - Aree di conflitto in cui sono presenti organizzazioni terroristiche o in zone limitrofe o di transito - Paese soggetto a sanzioni o embarghi o misure analoghe stabilite dall'O.N.U. o altri organismi internazionali - (vedasi pubblicazioni periodiche delle Autorità in materia, sia a livello sovranazionale, sia a livello nazionale)",
    b6b: "Inesistenza di riferimenti tradizionali nell’area geografica di destinazione (ad es. assenza di organismi equivalenti alle Camere di Commercio che detengono registri pubblici)",
    b6c: "Irragionevolezza e non congruità della ricerca di interazione con altre aree geografiche (ad es. vendita di determinati prodotti in aree geografiche nelle quali notoriamente gli stessi non risultano utilizzati)",
    b6d: "Altro",
  },
} as const;

const defaultSectionScores = {
  A1: 0,
  A2: 0,
  A3: 0,
  A4: 0,
  B1: 0,
  B2: 0,
  B3: 0,
  B4: 0,
  B5: 0,
  B6: 0,
};

const initialFormData: FormDataType = {
  id: "",
  studio_id: "",
  cliente_id: "",
  Prestazione: "",
  ValRischioIner: "",
  DataVerifica: "",
  ScadenzaVerifica: "",
  AV1Conferma: false,
  AV4Generato: false,
  allegato_av1_firmato: "",
  incaricato_adeguata_verifica_id: "",
  ...defaultSectionScores,
};

function addMonths(dateString: string, months: number) {
  if (!dateString) return "";

  const date = new Date(dateString);
  date.setMonth(date.getMonth() + months);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  const str = String(value);
  return str.includes("T") ? str.split("T")[0] : str;
}

function normalizeScore(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 4) return 4;

  return Math.trunc(n);
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function calcolaScadenzaFinale(dataVerifica: string, adeguataVerifica: string) {
  if (!dataVerifica || !adeguataVerifica) return "";

  if (adeguataVerifica === "SEMPLIFICATE") return addMonths(dataVerifica, 36);
  if (adeguataVerifica === "ORDINARIE") return addMonths(dataVerifica, 24);
  if (adeguataVerifica === "RAFFORZATE") return addMonths(dataVerifica, 6);

  return "";
}

function calcolaLivelloRischio(mediaPunteggio: number) {
  if (mediaPunteggio <= 1.5) return "Non significativo";
  if (mediaPunteggio >= 1.6 && mediaPunteggio <= 2.5) return "Poco significativo";
  if (mediaPunteggio >= 2.6 && mediaPunteggio <= 3.5) return "Abbastanza significativo";
  if (mediaPunteggio >= 3.6) return "Molto significativo";
  return "";
}

function calcolaAdeguataVerifica(rischioEffettivo: number) {
  if (rischioEffettivo <= 2.4) return "SEMPLIFICATE";
  if (rischioEffettivo > 2.4 && rischioEffettivo < 3.4) return "ORDINARIE";
  if (rischioEffettivo >= 3.4) return "RAFFORZATE";
  return "";
}

function getLivelloRischioBgClass(livello: string) {
  switch (livello) {
    case "Non significativo":
      return "bg-green-200";
    case "Poco significativo":
      return "bg-yellow-200";
    case "Abbastanza significativo":
      return "bg-orange-300";
    case "Molto significativo":
      return "bg-red-400 text-white";
    default:
      return "bg-gray-100";
  }
}

function getAdeguataVerificaBgClass(value: string) {
  switch (value) {
    case "SEMPLIFICATE":
      return "bg-green-200";
    case "ORDINARIE":
      return "bg-yellow-200";
    case "RAFFORZATE":
      return "bg-red-400 text-white";
    default:
      return "bg-gray-100";
  }
}

function getCategoriaRischio(value: number) {
  if (value <= 1.5) return "non";
  if (value <= 2.5) return "poco";
  if (value <= 3.5) return "abbastanza";
  return "molto";
}

export default function ModelloAV1Page() {
  const router = useRouter();
  const { id } = router.query;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [prestazioni, setPrestazioni] = useState<PrestazioneAR[]>([]);
  const [responsabiliAV, setResponsabiliAV] = useState<ResponsabileAV[]>([]);
  const [formData, setFormData] = useState<FormDataType>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFirmato, setUploadingFirmato] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const punteggioPrestazione = useMemo(
    () =>
      normalizeScore(
        prestazioni.find((p) => p.TipoPrestazioneAR === formData.Prestazione)?.PunteggioPrestAR || 0
      ),
    [prestazioni, formData.Prestazione]
  );

  const TotA =
    normalizeScore(formData.A1) +
    normalizeScore(formData.A2) +
    normalizeScore(formData.A3) +
    normalizeScore(formData.A4);

  const TotB =
    normalizeScore(formData.B1) +
    normalizeScore(formData.B2) +
    normalizeScore(formData.B3) +
    normalizeScore(formData.B4) +
    normalizeScore(formData.B5) +
    normalizeScore(formData.B6);

  const MediaPunteggio = Number(((TotA + TotB) / 10).toFixed(2));
  const LivelloRischio = calcolaLivelloRischio(MediaPunteggio);
  const RisInerentePonderato = Number((punteggioPrestazione * 0.3).toFixed(2));
  const RisSpecificoPonderato = Number((MediaPunteggio * 0.7).toFixed(2));
  const RischioEffettivo = Number((RisInerentePonderato + RisSpecificoPonderato).toFixed(2));
  const LivelloRischioEffettivo = calcolaLivelloRischio(RischioEffettivo);
  const AdeguataVerifica = calcolaAdeguataVerifica(RischioEffettivo);
  const ScadenzaVerificaCalcolata = calcolaScadenzaFinale(formData.DataVerifica, AdeguataVerifica);

  const categoriaInerente = getCategoriaRischio(punteggioPrestazione);
  const categoriaVulnerabilita = getCategoriaRischio(MediaPunteggio);

  const isActiveCell = (row: string, col: string) => {
    if (categoriaInerente === row && categoriaVulnerabilita === col) {
      return "ring-4 ring-blue-700";
    }
    return "";
  };

  const getClienteLabel = (cliente: Cliente) => {
    return (
      cliente.ragione_sociale ||
      cliente.denominazione ||
      cliente.nominativo ||
      `${cliente.nome || ""} ${cliente.cognome || ""}`.trim() ||
      cliente.id
    );
  };

  const getResponsabileAVLabel = (responsabile: ResponsabileAV) => {
    const nome = responsabile.cognome_nome || "";
    const tipo = responsabile.TipoSoggetto || "";
    const cf = responsabile.codice_fiscale || "";

    if (tipo && cf) return `${nome} - ${tipo} - ${cf}`;
    if (tipo) return `${nome} - ${tipo}`;
    if (cf) return `${nome} - ${cf}`;
    return nome || responsabile.id;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;
      const studioId = await getStudioId();

      const [
        { data: clientiData, error: clientiError },
        { data: prestazioniData, error: prestazioniError },
        { data: responsabiliData, error: responsabiliError },
      ] = await Promise.all([
        supabase.from("tbclienti").select("*"),
        supabase
          .from("tbElencoPrestAR")
          .select("id, TipoPrestazioneAR, RischioTipoPrestAR, PunteggioPrestAR")
          .order("TipoPrestazioneAR", { ascending: true }),
        studioId
          ? supabase
              .from("tbRespAV")
              .select("id, cognome_nome, codice_fiscale, TipoSoggetto")
              .eq("studio_id", studioId)
              .order("cognome_nome", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (clientiError) throw new Error(clientiError.message);
      if (prestazioniError) throw new Error(prestazioniError.message);
      if (responsabiliError) throw new Error(responsabiliError.message);

      setClienti((clientiData || []) as Cliente[]);
      setPrestazioni((prestazioniData || []) as PrestazioneAR[]);
      setResponsabiliAV((responsabiliData || []) as ResponsabileAV[]);

      setFormData((prev) => ({
        ...prev,
        studio_id: prev.studio_id || studioId || "",
      }));
    } catch (err: any) {
      setError(err?.message || "Errore caricamento dati.");
    } finally {
      setLoading(false);
    }
  };

  const loadRecordById = async (recordId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase.from("tbAV1").select("*").eq("id", recordId).single();

      if (error) throw new Error(error.message);
      if (!data) return;

      setFormData((prev) => ({
        ...prev,
        ...data,
        id: String(data.id),
        studio_id: data.studio_id ?? prev.studio_id ?? "",
        cliente_id: data.cliente_id ?? "",
        Prestazione: data.Prestazione ?? "",
        ValRischioIner: data.ValRischioIner ?? "",
        DataVerifica: normalizeDateValue(data.DataVerifica),
        ScadenzaVerifica: normalizeDateValue(data.ScadenzaVerifica),
        AV1Conferma: normalizeBoolean(data.AV1Conferma),
        AV4Generato: normalizeBoolean(data.AV4Generato),
        allegato_av1_firmato: data.allegato_av1_firmato ?? "",
        incaricato_adeguata_verifica_id: data.incaricato_adeguata_verifica_id ?? "",
        A1: normalizeScore(data.A1),
        A2: normalizeScore(data.A2),
        A3: normalizeScore(data.A3),
        A4: normalizeScore(data.A4),
        B1: normalizeScore(data.B1),
        B2: normalizeScore(data.B2),
        B3: normalizeScore(data.B3),
        B4: normalizeScore(data.B4),
        B5: normalizeScore(data.B5),
        B6: normalizeScore(data.B6),
      }));
    } catch (err: any) {
      setError(err?.message || "Errore caricamento record.");
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    if (!id || typeof id !== "string") return;

    void loadRecordById(id);
  }, [router.isReady, id]);

  const handlePrestazioneChange = (prestazioneValue: string) => {
    const prestazioneSelezionata = prestazioni.find(
      (p) => p.TipoPrestazioneAR === prestazioneValue
    );

    const livello = prestazioneSelezionata?.RischioTipoPrestAR || "";

    setFormData((prev) => ({
      ...prev,
      Prestazione: prestazioneValue,
      ValRischioIner: livello,
    }));
  };

  const handleDataVerificaChange = (dataVerifica: string) => {
    setFormData((prev) => ({
      ...prev,
      DataVerifica: dataVerifica,
    }));
  };

  const handleScoreChange = (sectionKey: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [sectionKey]: normalizeScore(value),
    }));
  };

  const handleChiudiModello = () => {
    void router.push("/antiriciclaggio");
  };

  const handlePrint = () => {
    const av1Id = router.query.id || formData.id;
    if (!av1Id) {
      alert("Salva prima il record AV1, poi potrai stamparlo.");
      return;
    }
    void router.push(`/antiriciclaggio/stampa-av1?id=${av1Id}`);
  };

  const handleUploadFirmato = async (file: File) => {
    try {
      if (!formData.studio_id) {
        alert("Studio non disponibile.");
        return;
      }

      setUploadingFirmato(true);
      setError(null);

      const supabase = getSupabaseClient() as any;
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `av1_firmati/${formData.studio_id}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
        upsert: true,
      });

      if (uploadError) {
        throw new Error(uploadError.message || "Errore caricamento file firmato.");
      }

      setFormData((prev) => ({
        ...prev,
        allegato_av1_firmato: path,
      }));
    } catch (err: any) {
      setError(err?.message || "Errore caricamento file firmato.");
    } finally {
      setUploadingFirmato(false);
    }
  };

  const handleOpenFirmato = async () => {
    try {
      if (!formData.allegato_av1_firmato) return;

      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(formData.allegato_av1_firmato, 60);

      if (error) {
        throw new Error(error.message || "Errore apertura file.");
      }

      if (!data?.signedUrl) {
        throw new Error("URL firmato non disponibile.");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError(err?.message || "Errore apertura file.");
    }
  };

  const handleRemoveFirmato = () => {
    setFormData((prev) => ({
      ...prev,
      allegato_av1_firmato: "",
    }));
  };

  const handleRinnovoVerifica = async () => {
    const today = new Date().toISOString().split("T")[0];
    const rischioInerentePonderatoReset = Number((punteggioPrestazione * 0.3).toFixed(2));
    const adeguataReset = calcolaAdeguataVerifica(rischioInerentePonderatoReset);

    setFormData((prev) => ({
      ...prev,
      DataVerifica: today,
      ScadenzaVerifica: "",
      AV1Conferma: false,
      ...defaultSectionScores,
    }));

    if (!formData.id) return;

    try {
      setSaving(true);
      setError(null);

      const supabase = getSupabaseClient() as any;

      const payload = {
        DataVerifica: today,
        ScadenzaVerifica: null,
        AV1Conferma: false,
        A1: 0,
        A2: 0,
        A3: 0,
        A4: 0,
        B1: 0,
        B2: 0,
        B3: 0,
        B4: 0,
        B5: 0,
        B6: 0,
        TotA: 0,
        TotB: 0,
        MediaPunteggio: 0,
        LivelloRischio: "Non significativo",
        RisInerentePonderato: rischioInerentePonderatoReset,
        RisSpecificoPonderato: 0,
        RischioEffettivo: rischioInerentePonderatoReset,
        AdeguataVerifica: adeguataReset,
      };

      const { error } = await supabase.from("tbAV1").update(payload).eq("id", formData.id);

      if (error) throw new Error(error.message);

      alert("Rinnovo verifica eseguito correttamente.");
    } catch (err: any) {
      setError(err?.message || "Errore durante il rinnovo verifica.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.studio_id) {
      alert("Studio non disponibile.");
      return;
    }

    if (!formData.cliente_id) {
      alert("Seleziona un cliente.");
      return;
    }

    if (!formData.Prestazione) {
      alert("Seleziona una prestazione.");
      return;
    }

    if (!formData.DataVerifica) {
      alert("Inserisci la data verifica.");
      return;
    }

    if (!formData.incaricato_adeguata_verifica_id) {
    alert("Seleziona l'incaricato adeguata verifica.");
      return;
        }

    setSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;

      const payload = {
        studio_id: formData.studio_id,
        cliente_id: formData.cliente_id,
        Prestazione: formData.Prestazione,
        ValRischioIner: formData.ValRischioIner,
        DataVerifica: formData.DataVerifica,
        ScadenzaVerifica: ScadenzaVerificaCalcolata || null,
        allegato_av1_firmato: formData.allegato_av1_firmato || null,
        incaricato_adeguata_verifica_id: formData.incaricato_adeguata_verifica_id || null,
        A1: normalizeScore(formData.A1),
        A2: normalizeScore(formData.A2),
        A3: normalizeScore(formData.A3),
        A4: normalizeScore(formData.A4),
        B1: normalizeScore(formData.B1),
        B2: normalizeScore(formData.B2),
        B3: normalizeScore(formData.B3),
        B4: normalizeScore(formData.B4),
        B5: normalizeScore(formData.B5),
        B6: normalizeScore(formData.B6),
        TotA,
        TotB,
        MediaPunteggio,
        LivelloRischio,
        RisInerentePonderato,
        RisSpecificoPonderato,
        RischioEffettivo,
        AdeguataVerifica,
        AV1Conferma: normalizeBoolean(formData.AV1Conferma),
        AV4Generato: normalizeBoolean(formData.AV4Generato),
      };

      let savedId = formData.id || "";

      if (formData.id) {
        const { error } = await supabase.from("tbAV1").update(payload).eq("id", formData.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("tbAV1").insert([payload]).select("id").single();
        if (error) throw new Error(error.message);
        savedId = String(data.id);
      }

      setFormData((prev) => ({
        ...prev,
        id: savedId,
        ScadenzaVerifica: ScadenzaVerificaCalcolata,
      }));

      alert("Record AV1 salvato correttamente.");

      if (savedId) {
        void router.replace(`/antiriciclaggio/modello-av1?id=${savedId}`);
      }
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio AV1.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background">
      <FormStickyHeader
        title="Modello AV1"
        subtitle={
          formData.id
            ? "Modifica verifica antiriciclaggio"
            : "Inserimento verifica antiriciclaggio"
        }
        onSave={handleSave}
        onPrint={handlePrint}
        onClose={handleChiudiModello}
        saving={saving}
        showSendToClient={false}
        beforeSaveSlot={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(formData.AV1Conferma)}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    AV1Conferma: e.target.checked,
                  }))
                }
              />
              <span>Conferma AV1</span>
            </label>

            <Button
              type="button"
              variant="outline"
              onClick={handleRinnovoVerifica}
              disabled={saving || loading}
            >
              Rinnovo verifica
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 pb-32 pt-4 md:px-8 md:pb-40 md:pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Dati principali</CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <p>Caricamento...</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium">Cliente</label>
                      <select
                         className="w-full rounded-md border px-3 py-2"
                        value={formData.cliente_id}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            cliente_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">Seleziona cliente</option>
                        {clienti.map((cliente) => (
                          <option key={cliente.id} value={cliente.id}>
                            {getClienteLabel(cliente)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Prestazione</label>
                      <select
                        className="w-full rounded-md border px-3 py-2"
                        value={formData.Prestazione}
                        onChange={(e) => handlePrestazioneChange(e.target.value)}
                      >
                        <option value="">Seleziona prestazione</option>
                        {prestazioni.map((prestazione) => (
                          <option key={prestazione.id} value={prestazione.TipoPrestazioneAR}>
                            {prestazione.TipoPrestazioneAR}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Valore rischio inerente
                      </label>
                      <input
                        type="text"
                        className={`w-full rounded-md border px-3 py-2 ${getLivelloRischioBgClass(
                          formData.ValRischioIner
                        )}`}
                        value={formData.ValRischioIner}
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Data verifica</label>
                      <input
                        type="date"
                        className="w-full rounded-md border px-3 py-2"
                        value={formData.DataVerifica}
                        onChange={(e) => handleDataVerificaChange(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Scadenza verifica</label>
                      <input
                        type="date"
                        className="w-full rounded-md border bg-gray-100 px-3 py-2"
                        value={ScadenzaVerificaCalcolata}
                        readOnly
                      />
                    </div>

                    {error && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-red-600">Errore: {error}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>A - Aspetti connessi al cliente</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-6">
                  {Object.entries(av1Labels).map(([sectionKey, fields]) => {
                    const isBStart = sectionKey === "B1";

                    return (
                      <div key={sectionKey}>
                        {isBStart && (
                          <div className="mb-6">
                            <h3 className="text-xl font-semibold">
                              B. Aspetti connessi all’operazione e/o prestazione professionale
                            </h3>
                          </div>
                        )}

                        <div className="rounded-lg border p-4">
                          <div className="mb-3 flex items-center justify-between gap-4">
                            <h3 className="text-lg font-semibold">{sectionTitles[sectionKey]}</h3>

                            <div className="flex items-center gap-2">
                              <label className="whitespace-nowrap text-sm font-medium">
                                Valore {sectionKey}
                              </label>
                              <select
                                className="w-24 rounded-md border bg-sky-100 px-3 py-2"
                                value={normalizeScore(formData[sectionKey])}
                                onChange={(e) => handleScoreChange(sectionKey, e.target.value)}
                              >
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {Object.entries(fields as Record<string, string>).map(
                              ([fieldKey, label]) => (
                                <label key={fieldKey} className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={Boolean(formData[fieldKey])}
                                    onChange={(e) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        [fieldKey]: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span className="text-sm text-gray-800">{label}</span>
                                </label>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Incaricato adeguata verifica</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-red-600">
                      Responsabile adeguata verifica
                    </label>
                    <select
                      <select
                      className="w-full rounded-md border-2 border-red-500 px-3 py-2 focus:border-red-600 focus:outline-none"
                      value={formData.incaricato_adeguata_verifica_id || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          incaricato_adeguata_verifica_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleziona responsabile</option>
                      {responsabiliAV.map((responsabile) => (
                        <option key={responsabile.id} value={responsabile.id}>
                          {getResponsabileAVLabel(responsabile)}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Campo collegato alla tabella dei responsabili adeguata verifica.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Calcoli finali</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">TotA</label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-gray-100 px-3 py-2"
                      value={TotA}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">TotB</label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-gray-100 px-3 py-2"
                      value={TotB}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Media punteggio</label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-gray-100 px-3 py-2"
                      value={MediaPunteggio}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Livello rischio</label>
                    <input
                      type="text"
                      className={`w-full rounded-md border px-3 py-2 ${getLivelloRischioBgClass(
                        LivelloRischio
                      )}`}
                      value={LivelloRischio}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Rischio inerente ponderato
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-gray-100 px-3 py-2"
                      value={RisInerentePonderato}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Rischio specifico ponderato
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-gray-100 px-3 py-2"
                      value={RisSpecificoPonderato}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Rischio effettivo</label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-gray-100 px-3 py-2"
                      value={RischioEffettivo}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Adeguata verifica</label>
                    <input
                      type="text"
                      className={`w-full rounded-md border px-3 py-2 ${getAdeguataVerificaBgClass(
                        AdeguataVerifica
                      )}`}
                      value={AdeguataVerifica}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">AV1 confermato</label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-gray-100 px-3 py-2"
                      value={formData.AV1Conferma ? "SI" : "NO"}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">AV4 generato</label>
                    <input
                      type="text"
                      className="w-full rounded-md border bg-gray-100 px-3 py-2"
                      value={formData.AV4Generato ? "SI" : "NO"}
                      readOnly
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Allegato AV1 firmato</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  <label className="block text-sm font-medium">
                    File firmato (digitale o autografo)
                  </label>

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.p7m,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleUploadFirmato(file);
                      }
                      e.currentTarget.value = "";
                    }}
                  />

                  <Input
                    type="text"
                    readOnly
                    value={formData.allegato_av1_firmato ? "File allegato" : ""}
                    placeholder="Nessun file allegato"
                    className="cursor-default"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingFirmato}
                    >
                      {uploadingFirmato ? "Caricamento..." : "Allega file"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOpenFirmato}
                      disabled={!formData.allegato_av1_firmato}
                    >
                      Apri
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleRemoveFirmato}
                      disabled={!formData.allegato_av1_firmato || uploadingFirmato}
                    >
                      Rimuovi
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Formati consentiti: PDF, P7M, JPG, JPEG, PNG
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Matrice del rischio</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-5 gap-0 border border-gray-400">
                      <div className="flex items-center justify-center border border-gray-400 bg-white p-4 text-center font-bold">
                        RISCHIO INERENTE 30%
                      </div>

                      <div className="border border-gray-400 bg-green-200 p-3 text-center font-semibold">
                        Non significativo
                        <div className="text-sm font-normal">1 - 1,5</div>
                      </div>
                      <div className="border border-gray-400 bg-yellow-200 p-3 text-center font-semibold">
                        Poco significativo
                        <div className="text-sm font-normal">1,6 - 2,5</div>
                      </div>
                      <div className="border border-gray-400 bg-orange-300 p-3 text-center font-semibold">
                        Abbastanza significativo
                        <div className="text-sm font-normal">2,6 - 3,5</div>
                      </div>
                      <div className="border border-gray-400 bg-red-400 p-3 text-center font-semibold text-white">
                        Molto significativo
                        <div className="text-sm font-normal">3,6 - 4</div>
                      </div>

                      <div className="border border-gray-400 bg-red-400 p-3 text-center font-semibold text-white">
                        Molto significativo
                        <div className="text-sm font-normal">3,6 - 4</div>
                      </div>
                      <div
                        className={`h-24 border border-gray-400 bg-yellow-200 ${isActiveCell(
                          "molto",
                          "non"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-yellow-200 ${isActiveCell(
                          "molto",
                          "poco"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-orange-300 ${isActiveCell(
                          "molto",
                          "abbastanza"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-red-400 ${isActiveCell(
                          "molto",
                          "molto"
                        )}`}
                      />

                      <div className="border border-gray-400 bg-orange-300 p-3 text-center font-semibold">
                        Abbastanza significativo
                        <div className="text-sm font-normal">2,6 - 3,5</div>
                      </div>
                      <div
                        className={`h-24 border border-gray-400 bg-yellow-200 ${isActiveCell(
                          "abbastanza",
                          "non"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-yellow-200 ${isActiveCell(
                          "abbastanza",
                          "poco"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-orange-300 ${isActiveCell(
                          "abbastanza",
                          "abbastanza"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-orange-300 ${isActiveCell(
                          "abbastanza",
                          "molto"
                        )}`}
                      />

                      <div className="border border-gray-400 bg-yellow-200 p-3 text-center font-semibold">
                        Poco significativo
                        <div className="text-sm font-normal">1,6 - 2,5</div>
                      </div>
                      <div
                        className={`h-24 border border-gray-400 bg-green-300 ${isActiveCell(
                          "poco",
                          "non"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-yellow-200 ${isActiveCell(
                          "poco",
                          "poco"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-orange-300 ${isActiveCell(
                          "poco",
                          "abbastanza"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-orange-300 ${isActiveCell(
                          "poco",
                          "molto"
                        )}`}
                      />

                      <div className="border border-gray-400 bg-green-300 p-3 text-center font-semibold">
                        Non significativo
                        <div className="text-sm font-normal">1 - 1,5</div>
                      </div>
                      <div
                        className={`h-24 border border-gray-400 bg-green-300 ${isActiveCell(
                          "non",
                          "non"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-yellow-200 ${isActiveCell(
                          "non",
                          "poco"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-yellow-200 ${isActiveCell(
                          "non",
                          "abbastanza"
                        )}`}
                      />
                      <div
                        className={`h-24 border border-gray-400 bg-orange-300 ${isActiveCell(
                          "non",
                          "molto"
                        )}`}
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-0 border-b border-l border-r border-gray-400">
                      <div className="border border-gray-400 bg-white p-4" />
                      <div className="border border-gray-400 bg-green-200 p-3 text-center font-semibold">
                        Non significativa
                        <div className="text-sm font-normal">1 - 1,5</div>
                      </div>
                      <div className="border border-gray-400 bg-yellow-200 p-3 text-center font-semibold">
                        Poco significativa
                        <div className="text-sm font-normal">1,6 - 2,5</div>
                      </div>
                      <div className="border border-gray-400 bg-orange-300 p-3 text-center font-semibold">
                        Abbastanza significativa
                        <div className="text-sm font-normal">2,6 - 3,5</div>
                      </div>
                      <div className="border border-gray-400 bg-red-400 p-3 text-center font-semibold text-white">
                        Molto significativa
                        <div className="text-sm font-normal">3,6 - 4</div>
                      </div>

                      <div className="col-span-5 border border-gray-400 bg-white p-4 text-center text-xl font-bold">
                        VULNERABILITÀ 70%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  Livello rischio effettivo calcolato: <strong>{LivelloRischioEffettivo}</strong>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
