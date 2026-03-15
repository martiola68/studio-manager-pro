import { useEffect, useState } from "react";
import supabase from "@/lib/supabaseClient";

type Props = {
  sezione: "domanda7" | "domanda8" | "domanda9";
  av4_id?: string;
  studio_id: string;
  cliente_id: string;
};

export default function TitolariEffettiviForm({
  sezione,
  av4_id,
  studio_id,
  cliente_id
}: Props) {
  const [rappresentanti, setRappresentanti] = useState<any[]>([]);
  const [righe, setRighe] = useState<any[]>([]);

  useEffect(() => {
    loadRappresentanti();
  }, []);

  async function loadRappresentanti() {
    const { data, error } = await supabase
      .from("rapp_legali")
      .select("*")
      .order("nome_cognome");

    if (error) {
      console.error("Errore caricamento rappresentanti:", error);
      return;
    }

    setRappresentanti(data || []);
  }

  function aggiungiRiga() {
    setRighe((prev) => [
      ...prev,
      {
        rapp_legale_id: "",
        nome_cognome: "",
        codice_fiscale: "",
        luogo_nascita: "",
        data_nascita: "",
        indirizzo_residenza: "",
        citta_residenza: "",
        cap_residenza: "",
        nazionalita: ""
      }
    ]);
  }

  function eliminaRiga(index: number) {
    setRighe((prev) => prev.filter((_, i) => i !== index));
  }

  function selezionaRappresentante(index: number, id: string) {
    const rapp = rappresentanti.find((r) => r.id === id);
    if (!rapp) return;

    setRighe((prev) => {
      const nuovaLista = [...prev];
      nuovaLista[index] = {
        ...nuovaLista[index],
        rapp_legale_id: rapp.id || "",
        nome_cognome: rapp.nome_cognome || "",
        codice_fiscale: rapp.codice_fiscale || "",
        luogo_nascita: rapp.luogo_nascita || "",
        data_nascita: rapp.data_nascita || "",
        indirizzo_residenza: rapp.indirizzo_residenza || "",
        citta_residenza: rapp.citta_residenza || "",
        cap_residenza: rapp.cap_residenza || "",
        nazionalita: rapp.nazionalita || ""
      };
      return nuovaLista;
    });
  }

  async function salvaTitolari() {
    if (!av4_id) {
      alert("Salva prima il modello AV4");
      return;
    }

    if (!righe.length) {
      alert("Inserisci almeno un titolare effettivo");
      return;
    }

    const records = righe.map((r) => ({
      av4_id,
      studio_id,
      cliente_id,
      sezione,
      rapp_legale_id: r.rapp_legale_id || null,
      nome_cognome: r.nome_cognome || "",
      codice_fiscale: r.codice_fiscale || "",
      luogo_nascita: r.luogo_nascita || "",
      data_nascita: r.data_nascita || null,
      indirizzo_residenza: r.indirizzo_residenza || "",
      citta_residenza: r.citta_residenza || "",
      cap_residenza: r.cap_residenza || "",
      nazionalita: r.nazionalita || ""
    }));

    const { error } = await supabase
      .from("tbAV4_titolari")
      .insert(records);

    if (error) {
      console.error("Errore salvataggio titolari:", error);
      alert("Errore salvataggio titolari");
      return;
    }

    alert("Titolari salvati correttamente");
  }

  return (
    <div className="border p-4 mt-4 rounded">
      <h3 className="font-semibold mb-3">Titolari effettivi</h3>

      {righe.map((riga, index) => (
        <div key={index} className="border p-3 mb-3 rounded">
          <div className="mb-2">
            <label className="block text-sm mb-1">Seleziona nominativo</label>

            <select
              value={riga.rapp_legale_id}
              onChange={(e) => selezionaRappresentante(index, e.target.value)}
              className="border p-2 w-full rounded"
            >
              <option value="">Seleziona</option>

              {rappresentanti.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome_cognome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={riga.nome_cognome}
              placeholder="Nome e cognome"
              className="border p-2 rounded"
              readOnly
            />

            <input
              value={riga.codice_fiscale}
              placeholder="Codice fiscale"
              className="border p-2 rounded"
              readOnly
            />

            <input
              value={riga.luogo_nascita}
              placeholder="Luogo nascita"
              className="border p-2 rounded"
              readOnly
            />

            <input
              value={riga.data_nascita}
              placeholder="Data nascita"
              className="border p-2 rounded"
              readOnly
            />

            <input
              value={riga.indirizzo_residenza}
              placeholder="Indirizzo residenza"
              className="border p-2 rounded"
              readOnly
            />

            <input
              value={riga.citta_residenza}
              placeholder="Città residenza"
              className="border p-2 rounded"
              readOnly
            />

            <input
              value={riga.cap_residenza}
              placeholder="CAP residenza"
              className="border p-2 rounded"
              readOnly
            />

            <input
              value={riga.nazionalita}
              placeholder="Nazionalità"
              className="border p-2 rounded"
              readOnly
            />
          </div>

          <button
            type="button"
            onClick={() => eliminaRiga(index)}
            className="mt-3 text-red-600"
          >
            Elimina
          </button>
        </div>
      ))}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={aggiungiRiga}
          className="bg-gray-200 px-3 py-1 rounded"
        >
          + Aggiungi titolare
        </button>

        <button
          type="button"
          onClick={salvaTitolari}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Salva titolari
        </button>
      </div>
    </div>
  );
}
