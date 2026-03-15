                        import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStudioId } from "@/services/getStudioId";
import { useRouter } from "next/router";

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
  studio_id: string;
  cliente_id: string;
  Prestazione: string;
  ValRischioIner: string;
  DataVerifica: string;
  ScadenzaVerifica: string;
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
  studio_id: "",
  cliente_id: "",
  Prestazione: "",
  ValRischioIner: "",
  DataVerifica: "",
  ScadenzaVerifica: "",
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

function calcolaScadenzaFinale(dataVerifica: string, adeguataVerifica: string) {
  if (!dataVerifica || !adeguataVerifica) return "";

  if (adeguataVerifica === "SEMPLIFICATE") return addMonths(dataVerifica, 36);
  if (adeguataVerifica === "ORDINARIE") return addMonths(dataVerifica, 24);
  if (adeguataVerifica === "RAFFORZATE") return addMonths(dataVerifica, 12);

  return "";
}

function calcolaLivelloRischio(mediaPunteggio: number) {
  if (mediaPunteggio <= 1.5) return "Non significativo";
  if (mediaPunteggio >= 1.6 && mediaPunteggio <= 2.5) return "Poco significativo";
  if (mediaPunteggio >= 2.6 && mediaPunteggio <= 3.5) return "Abbastanza significativo";
  if (mediaPunteggio >= 3.6) return "Molto significativo";
  return "";
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [prestazioni, setPrestazioni] = useState<PrestazioneAR[]>([]);
  const [formData, setFormData] = useState<FormDataType & Record<string, any>>({
    ...initialFormData,
    A1: 1,
    A2: 1,
    A3: 1,
    A4: 1,
    B1: 1,
    B2: 1,
    B3: 1,
    B4: 1,
    B5: 1,
    B6: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const punteggioPrestazione =
    prestazioni.find((p) => p.TipoPrestazioneAR === formData.Prestazione)?.PunteggioPrestAR || 0;

  const TotA =
    toNumber(formData.A1) +
    toNumber(formData.A2) +
    toNumber(formData.A3) +
    toNumber(formData.A4);

  const TotB =
    toNumber(formData.B1) +
    toNumber(formData.B2) +
    toNumber(formData.B3) +
    toNumber(formData.B4) +
    toNumber(formData.B5) +
    toNumber(formData.B6);

  const MediaPunteggio = Number(((TotA + TotB) / 10).toFixed(2));
  const LivelloRischio = calcolaLivelloRischio(MediaPunteggio);
  const RisInerentePonderato = Number((punteggioPrestazione * 0.4).toFixed(2));
  const RisSpecificoPonderato = Number((MediaPunteggio * 0.6).toFixed(2));
  const RischioEffettivo = Number((RisInerentePonderato + RisSpecificoPonderato).toFixed(2));
  const LivelloRischioEffettivo = calcolaLivelloRischio(RischioEffettivo);
  const AdeguataVerifica = calcolaAdeguataVerifica(RischioEffettivo);
  const ScadenzaVerificaCalcolata = calcolaScadenzaFinale(formData.DataVerifica, AdeguataVerifica);

  const categoriaInerente = getCategoriaRischio(RisInerentePonderato);
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

    setFormData((prev) => ({
      ...prev,
      studio_id: studioId || "",
    }));

    if (clientiError) setError(clientiError.message);
    if (prestazioniError) setError(prestazioniError.message);

    setClienti((clientiData || []) as Cliente[]);
    setPrestazioni((prestazioniData || []) as PrestazioneAR[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleNuovo = () => {
    setFormData((prev) => ({
      ...initialFormData,
      studio_id: prev.studio_id,
      A1: 1,
      A2: 1,
      A3: 1,
      A4: 1,
      B1: 1,
      B2: 1,
      B3: 1,
      B4: 1,
      B5: 1,
      B6: 1,
    }));
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
      A1: formData.A1,
      A2: formData.A2,
      A3: formData.A3,
      A4: formData.A4,
      B1: formData.B1,
      B2: formData.B2,
      B3: formData.B3,
      B4: formData.B4,
      B5: formData.B5,
      B6: formData.B6,
      TotA,
      TotB,
      MediaPunteggio,
      LivelloRischio,
      RisInerentePonderato,
      RisSpecificoPonderato,
      RischioEffettivo,
      AdeguataVerifica,
    };

    const { error } = await (supabase as any).from("tbAV1").insert([payload]);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    alert("Record AV1 salvato correttamente.");
    setSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Modello AV1</h1>
        <p className="text-gray-500 mt-1">Inserimento verifica antiriciclaggio</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dati principali</CardTitle>
          <Button type="button" variant="outline" onClick={handleNuovo}>
            Nuovo AV1
          </Button>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p>Caricamento...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select
                  className="w-full border rounded-md px-3 py-2"
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
                <label className="block text-sm font-medium mb-1">Prestazione</label>
                <select
                  className="w-full border rounded-md px-3 py-2"
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
                <label className="block text-sm font-medium mb-1">Valore rischio inerente</label>
                <input
                  type="text"
                  className={`w-full border rounded-md px-3 py-2 ${getLivelloRischioBgClass(formData.ValRischioIner)}`}
                  value={formData.ValRischioIner}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Data verifica</label>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2"
                  value={formData.DataVerifica}
                  onChange={(e) => handleDataVerificaChange(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Scadenza verifica</label>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2 bg-gray-100"
                  value={ScadenzaVerificaCalcolata}
                  readOnly
                />
              </div>

              {error && (
                <div className="md:col-span-2">
                  <p className="text-red-600 text-sm">Errore: {error}</p>
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

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3 gap-4">
                      <h3 className="text-lg font-semibold">
                        {sectionTitles[sectionKey]}
                      </h3>

                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium whitespace-nowrap">
                          Valore {sectionKey}
                        </label>
                        <select
                          className="border rounded-md px-3 py-2 w-24 bg-sky-100"
                          value={formData[sectionKey] ?? 1}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              [sectionKey]: Number(e.target.value),
                            }))
                          }
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {Object.entries(fields as Record<string, string>).map(([fieldKey, label]) => (
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
                      ))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">TotA</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 bg-gray-100"
                value={TotA}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">TotB</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 bg-gray-100"
                value={TotB}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Media punteggio</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 bg-gray-100"
                value={MediaPunteggio}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Livello rischio</label>
              <input
                type="text"
                className={`w-full border rounded-md px-3 py-2 ${getLivelloRischioBgClass(LivelloRischio)}`}
                value={LivelloRischio}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Rischio inerente ponderato</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 bg-gray-100"
                value={RisInerentePonderato}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Rischio specifico ponderato</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 bg-gray-100"
                value={RisSpecificoPonderato}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Rischio effettivo</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 bg-gray-100"
                value={RischioEffettivo}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Adeguata verifica</label>
              <input
                type="text"
                className={`w-full border rounded-md px-3 py-2 ${getAdeguataVerificaBgClass(AdeguataVerifica)}`}
                value={AdeguataVerifica}
                readOnly
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-3">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvataggio..." : "Salva AV1"}
              </Button>

            <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            router.push(
                              `/antiriciclaggio/modello-av4?studio_id=${formData.studio_id ?? ""}&av1_id=${router.query.id ?? ""}&cliente_id=${formData.cliente_id ?? ""}`
                               )
                                }
                               >
                          Crea AV4
                        </Button>
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
                <div className="border border-gray-400 p-4 flex items-center justify-center font-bold text-center bg-white">
                  RISCHIO INERENTE 40%
                </div>

                <div className="border border-gray-400 p-3 text-center font-semibold bg-green-200">
                  Non significativo
                  <div className="text-sm font-normal">1 - 1,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-yellow-200">
                  Poco significativo
                  <div className="text-sm font-normal">1,6 - 2,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-orange-300">
                  Abbastanza significativo
                  <div className="text-sm font-normal">2,6 - 3,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-red-400 text-white">
                  Molto significativo
                  <div className="text-sm font-normal">3,6 - 4</div>
                </div>

                <div className="border border-gray-400 p-3 text-center font-semibold bg-red-400 text-white">
                  Molto significativo
                  <div className="text-sm font-normal">3,6 - 4</div>
                </div>
                <div className={`border border-gray-400 h-24 bg-yellow-200 ${isActiveCell("molto", "non")}`} />
                <div className={`border border-gray-400 h-24 bg-yellow-200 ${isActiveCell("molto", "poco")}`} />
                <div className={`border border-gray-400 h-24 bg-orange-300 ${isActiveCell("molto", "abbastanza")}`} />
                <div className={`border border-gray-400 h-24 bg-red-400 ${isActiveCell("molto", "molto")}`} />

                <div className="border border-gray-400 p-3 text-center font-semibold bg-orange-300">
                  Abbastanza significativo
                  <div className="text-sm font-normal">2,6 - 3,5</div>
                </div>
                <div className={`border border-gray-400 h-24 bg-yellow-200 ${isActiveCell("abbastanza", "non")}`} />
                <div className={`border border-gray-400 h-24 bg-yellow-200 ${isActiveCell("abbastanza", "poco")}`} />
                <div className={`border border-gray-400 h-24 bg-orange-300 ${isActiveCell("abbastanza", "abbastanza")}`} />
                <div className={`border border-gray-400 h-24 bg-orange-300 ${isActiveCell("abbastanza", "molto")}`} />

                <div className="border border-gray-400 p-3 text-center font-semibold bg-yellow-200">
                  Poco significativo
                  <div className="text-sm font-normal">1,6 - 2,5</div>
                </div>
                <div className={`border border-gray-400 h-24 bg-green-300 ${isActiveCell("poco", "non")}`} />
                <div className={`border border-gray-400 h-24 bg-yellow-200 ${isActiveCell("poco", "poco")}`} />
                <div className={`border border-gray-400 h-24 bg-orange-300 ${isActiveCell("poco", "abbastanza")}`} />
                <div className={`border border-gray-400 h-24 bg-orange-300 ${isActiveCell("poco", "molto")}`} />

                <div className="border border-gray-400 p-3 text-center font-semibold bg-green-300">
                  Non significativo
                  <div className="text-sm font-normal">1 - 1,5</div>
                </div>
                <div className={`border border-gray-400 h-24 bg-green-300 ${isActiveCell("non", "non")}`} />
                <div className={`border border-gray-400 h-24 bg-yellow-200 ${isActiveCell("non", "poco")}`} />
                <div className={`border border-gray-400 h-24 bg-yellow-200 ${isActiveCell("non", "abbastanza")}`} />
                <div className={`border border-gray-400 h-24 bg-orange-300 ${isActiveCell("non", "molto")}`} />
              </div>

              <div className="grid grid-cols-5 gap-0 border-l border-r border-b border-gray-400">
                <div className="border border-gray-400 p-4 bg-white" />
                <div className="border border-gray-400 p-3 text-center font-semibold bg-green-200">
                  Non significativa
                  <div className="text-sm font-normal">1 - 1,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-yellow-200">
                  Poco significativa
                  <div className="text-sm font-normal">1,6 - 2,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-orange-300">
                  Abbastanza significativa
                  <div className="text-sm font-normal">2,6 - 3,5</div>
                </div>
                <div className="border border-gray-400 p-3 text-center font-semibold bg-red-400 text-white">
                  Molto significativa
                  <div className="text-sm font-normal">3,6 - 4</div>
                </div>

                <div className="col-span-5 border border-gray-400 p-4 text-center text-xl font-bold bg-white">
                  VULNERABILITÀ 60%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
