import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStudioId } from "@/services/getStudioId";

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

function calcolaScadenzaFinale(dataVerifica: string, livelloRischio: string) {
  if (!dataVerifica || !livelloRischio) return "";

  if (livelloRischio === "Non significativo") return addMonths(dataVerifica, 36);
  if (livelloRischio === "Poco significativo") return addMonths(dataVerifica, 24);
  if (livelloRischio === "Abbastanza significativo") return addMonths(dataVerifica, 12);
  if (livelloRischio === "Molto significativo") return addMonths(dataVerifica, 6);

  return "";
}

function calcolaLivelloRischio(mediaPunteggio: number) {

  if (mediaPunteggio <= 1.5) {
    return "Non significativo";
  }

  if (mediaPunteggio <= 2.5) {
    return "Poco significativo";
  }

  if (mediaPunteggio <= 3.5) {
    return "Abbastanza significativo";
  }

  return "Molto significativo";
}

export default function ModelloAV1Page() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [prestazioni, setPrestazioni] = useState<PrestazioneAR[]>([]);
  const [formData, setFormData] = useState<FormDataType>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const { data: clientiData, error: clientiError } = await (supabase as any)
      .from("tbclienti")
      .select("*");

    const { data: prestazioniData, error: prestazioniError } = await (supabase as any)
      .from("tbElencoPrestAR")
      .select('id, TipoPrestazioneAR, RischioTipoPrestAR, PunteggioPrestAR')
      .order("TipoPrestazioneAR", { ascending: true });
  
 const studioId = await getStudioId();

    if (clientiError) {
      setError(clientiError.message);
    }

    if (prestazioniError) {
      setError(prestazioniError.message);
    }

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

alert("Record AV1 salvato correttamente.");
setSaving(false);

const handleDataVerificaChange = (dataVerifica: string) => {
  setFormData((prev) => ({
    ...prev,
    DataVerifica: dataVerifica,
    ScadenzaVerifica: "",
  }));
};

const handleNuovo = () => {
  setFormData((prev) => ({
    ...initialFormData,
    studio_id: prev.studio_id
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
      ScadenzaVerifica: null,
    };

    const { error } = await (supabase as any)
      .from("tbAV1")
      .insert([payload]);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    alert("Record AV1 salvato correttamente.");

    setFormData((prev) => ({
      ...initialFormData,
      studio_id: prev.studio_id,
    }));

    setSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Modello AV1</h1>
        <p className="text-gray-500 mt-1">
          Inserimento verifica antiriciclaggio
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dati principali</CardTitle>
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
                <label className="block text-sm font-medium mb-1">
                  Valore rischio inerente
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 bg-gray-100"
                  value={formData.ValRischioIner}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Data verifica
                </label>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2"
                  value={formData.DataVerifica}
                  onChange={(e) => handleDataVerificaChange(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Scadenza verifica
                </label>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2 bg-gray-100"
                  value={formData.ScadenzaVerifica}
                  readOnly
                />
              </div>

              {error && (
                <div className="md:col-span-2">
                  <p className="text-red-600 text-sm">Errore: {error}</p>
                </div>
              )}

             <div className="md:col-span-2 flex gap-3 pt-2">
  <Button type="button" variant="outline" onClick={handleNuovo}>
    Nuovo
  </Button>

  <Button onClick={handleSave} disabled={saving}>
    {saving ? "Salvataggio..." : "Salva AV1"}
  </Button>
</div>
            </div>
          )}
        </CardContent>
      </Card>

       <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sezioni A1 - B6</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {Object.entries(av1Labels).map(([sectionKey, fields]) => (
              <div key={sectionKey} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3 gap-4">
                  <h3 className="text-lg font-semibold">{sectionKey}</h3>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium whitespace-nowrap">
                      Valore {sectionKey}
                    </label>
                    <select
                      className="border rounded-md px-3 py-2 w-24"
                      value={(formData as any)[sectionKey] ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [sectionKey]:
                            e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                    >
                      <option value="">--</option>
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
                          checked={Boolean((formData as any)[fieldKey])}
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
