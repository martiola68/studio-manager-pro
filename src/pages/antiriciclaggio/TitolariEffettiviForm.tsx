import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

    const { data } = await supabase
      .from("rapp_legali")
      .select("*")
      .order("nome_cognome");

    if (data) setRappresentanti(data);

  }

  function aggiungiRiga() {

    setRighe([
      ...righe,
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

    const nuovaLista = [...righe];
    nuovaLista.splice(index, 1);

    setRighe(nuovaLista);

  }

  function selezionaRappresentante(index: number, id: string) {

    const rapp = rappresentanti.find((r) => r.id === id);

    if (!rapp) return;

    const nuovaLista = [...righe];

    nuovaLista[index] = {
      ...nuovaLista[index],
      rapp_legale_id: rapp.id,
      nome_cognome: rapp.nome_cognome,
      codice_fiscale: rapp.codice_fiscale,
      luogo_nascita: rapp.luogo_nascita,
      data_nascita: rapp.data_nascita,
      indirizzo_residenza: rapp.indirizzo_residenza,
      citta_residenza: rapp.citta_residenza,
      cap_residenza: rapp.cap_residenza,
      nazionalita: rapp.nazionalita
    };

    setRighe(nuovaLista);

  }

  async function salvaTitolari() {

    if (!av4_id) return;

    const records = righe.map((r) => ({
      ...r,
      av4_id,
      studio_id,
      cliente_id,
      sezione
    }));

    const { error } = await supabase
      .from("tbAV4_titolari")
      .insert(records);

    if (error) {
      console.error(error);
      alert("Errore salvataggio titolari");
    } else {
      alert("Titolari salvati");
    }

  }

  return (
    <div className="border p-4 mt-4">

      <h3 className="font-semibold mb-3">
        Titolari effettivi
      </h3>

      {righe.map((riga, index) => (

        <div key={index} className="border p-3 mb-3">

          <div className="mb-2">

            <label className="block text-sm">
              Seleziona nominativo
            </label>

            <select
              onChange={(e) =>
                selezionaRappresentante(index, e.target.value)
              }
              className="border p-2 w-full"
            >

              <option value="">Seleziona</option>

              {rappresentanti.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome_cognome}
                </option>
              ))}

            </select>

          </div>

          <div className="grid grid-cols-2 gap-2">

            <input
              value={riga.nome_cognome}
              placeholder="Nome e cognome"
              className="border p-2"
              readOnly
            />

            <input
              value={riga.codice_fiscale}
              placeholder="Codice fiscale"
              className="border p-2"
              readOnly
            />

            <input
              value={riga.luogo_nascita}
              placeholder="Luogo nascita"
              className="border p-2"
              readOnly
            />

            <input
              value={riga.data_nascita}
              placeholder="Data nascita"
              className="border p-2"
              readOnly
            />

            <input
              value={riga.citta_residenza}
              placeholder="Città residenza"
              className="border p-2"
              readOnly
            />

            <input
              value={riga.cap_residenza}
              placeholder="CAP"
              className="border p-2"
              readOnly
            />

          </div>

          <button
            onClick={() => eliminaRiga(index)}
            className="mt-2 text-red-600"
          >
            Elimina
          </button>

        </div>

      ))}

      <button
        onClick={aggiungiRiga}
        className="bg-gray-200 px-3 py-1 mr-3"
      >
        + Aggiungi titolare
      </button>

      <button
        onClick={salvaTitolari}
        className="bg-blue-600 text-white px-3 py-1"
      >
        Salva titolari
      </button>

    </div>
  );
}
