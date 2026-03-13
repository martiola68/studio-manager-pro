import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStudioId } from "@/services/studioService";

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

setFormData((prev) => ({
  ...prev,
  studio_id: studioId,
}));
    
    if (resolvedStudioId) {
  setFormData((prev) => ({
    ...prev,
    studio_id: resolvedStudioId
  }));
} else {
  setError("Studio non trovato per l'utente loggato.");
}

    if (clientiError) {
      setError(clientiError.message);
    }

    if (prestazioniError) {
      setError(prestazioniError.message);
    }

    setClienti((clientiData || []) as Cliente[]);
    setPrestazioni((prestazioniData || []) as PrestazioneAR[]);

   if (resolvedStudioId) {
  setFormData((prev) => ({
    ...prev,
    studio_id: resolvedStudioId,
  }));
} else {
  setError("studio_id non trovato nel profilo utente.");
}

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
    ScadenzaVerifica: "",
  }));
};

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
      ScadenzaVerifica: formData.ScadenzaVerifica,
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
    </div>
  );
}
