import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudioId } from "@/services/getStudioId";
import { useRouter } from "next/router";
import FormStickyHeader from "@/components/antiriciclaggio/FormStickyHeader";

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

export default function ModelloAV1Page() {
  const router = useRouter();
  const { id } = router.query;

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [prestazioni, setPrestazioni] = useState<PrestazioneAR[]>([]);
  const [formData, setFormData] = useState<FormDataType & Record<string, any>>({
    ...initialFormData,
    ...defaultSectionScores,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const punteggioPrestazione = normalizeScore(
    prestazioni.find((p) => p.TipoPrestazioneAR === formData.Prestazione)?.PunteggioPrestAR || 0
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
  const ScadenzaVerificaCalcolata = calcolaScadenzaFinale(
    formData.DataVerifica,
    AdeguataVerifica
  );

  const categoriaInerente = getCategoriaRischio(punteggioPrestazione);
  const categoriaVulnerabilita = getCategoriaRischio(MediaPunteggio);

  const isActiveCell = (row: string, col: string) => {
    if (categoriaInerente === row && categoriaVulnerabilita === col) {
      return "ring-4 ring-blue-700";
    }
    return "";
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const { data: clientiData, error: clientiError } = await (supabase as any)
      .from("tbclienti")
      .select("*");

    const { data: prestazioniData, error: prestazioniError } = await (supabase as any)
      .from("tbElencoPrestAR")
      .select("id, TipoPrestazioneAR, RischioTipoPrestAR, PunteggioPrestAR")
      .order("TipoPrestazioneAR", { ascending: true });

    const studioId = await getStudioId();

    if (clientiError) setError(clientiError.message);
    if (prestazioniError) setError(prestazioniError.message);

    setClienti((clientiData || []) as Cliente[]);
    setPrestazioni((prestazioniData || []) as PrestazioneAR[]);

    setFormData((prev) => ({
      ...prev,
      studio_id: prev.studio_id || studioId || "",
    }));

    setLoading(false);
  };

  const loadRecordById = async (recordId: string) => {
    setError(null);

    const { data, error } = await (supabase as any)
      .from("tbAV1")
      .select("*")
      .eq("id", recordId)
      .single();

    if (error) {
      setError(error.message);
      return;
    }

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
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    if (!id || typeof id !== "string") return;

    loadRecordById(id);
  }, [router.isReady, id]);

  const getClienteLabel = (cliente: Cliente) => {
    return (
      cliente.ragione_sociale ||
      cliente.denominazione ||
      cliente.nominativo ||
      `${cliente.nome || ""} ${cliente.cognome || ""}`.trim() ||
      cliente.id
    );
  };

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
    router.push("/antiriciclaggio");
  };

  const handlePrint = () => {
    const av1Id = router.query.id || formData.id;
    if (!av1Id) {
      alert("Salva prima il record AV1, poi potrai stamparlo.");
      return;
    }
    router.push(`/antiriciclaggio/stampa-av1?id=${av1Id}`);
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

    setSaving(true);
    setError(null);

    const payload = {
      studio_id: formData.studio_id,
      cliente_id: formData.cliente_id,
      Prestazione: formData.Prestazione,
      ValRischioIner: formData.ValRischioIner,
      DataVerifica: formData.DataVerifica,
      ScadenzaVerifica: ScadenzaVerificaCalcolata,
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
      AV1Conferma: true,
      AV4Generato: normalizeBoolean(formData.AV4Generato),
    };

    let savedId = formData.id || "";

    if (formData.id) {
      const { error } = await (supabase as any)
        .from("tbAV1")
        .update(payload)
        .eq("id", formData.id);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await (supabase as any)
        .from("tbAV1")
        .insert([payload])
        .select("id")
        .single();

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      savedId = String(data.id);
    }

    setFormData((prev) => ({
      ...prev,
      id: savedId,
      AV1Conferma: true,
      AV4Generato: normalizeBoolean(prev.AV4Generato),
      A1: normalizeScore(prev.A1),
      A2: normalizeScore(prev.A2),
      A3: normalizeScore(prev.A3),
      A4: normalizeScore(prev.A4),
      B1: normalizeScore(prev.B1),
      B2: normalizeScore(prev.B2),
      B3: normalizeScore(prev.B3),
      B4: normalizeScore(prev.B4),
      B5: normalizeScore(prev.B5),
      B6: normalizeScore(prev.B6),
    }));

    alert("Record AV1 salvato correttamente.");
    setSaving(false);

    if (savedId) {
      router.replace(`/antiriciclaggio/modello-av1?id=${savedId}`);
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
