import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ModelloAV4() {

  const [clienti, setClienti] = useState<any[]>([]);
  const [rappresentanti, setRappresentanti] = useState<any[]>([]);

const [form, setForm] = useState({
  cliente_id: "",
  rapp_legale_id: "",
  natura_prestazione: "",

  domanda1: false,
  domanda2: false,

  domanda3: false,
  domanda4: false,
  domanda5: false,
  spec_domanda5: "",

  domanda6: false,
  domanda7: false,
  domanda8: false,
  domanda9: false,

  nome_soc: "",
  sede_legale: "",
  indirizzo_sede: "",
  reg_imprese: "",
  num_reg_imprese: "",
  cod_fiscale_soc: ""
});

  useEffect(() => {
    loadClienti();
    loadRappresentanti();
  }, []);

  async function loadClienti() {

    const { data, error } = await supabase
      .from("tbclienti")
      .select("id, cognome_nome")
      .order("cognome_nome");

    if (error) {
      console.error("Errore caricamento clienti:", error);
      return;
    }

    setClienti(data || []);
  }

  async function loadRappresentanti() {

    const { data, error } = await supabase
      .from("rapp_legali")
      .select("id, nome_cognome")
      .order("nome_cognome");

    if (error) {
      console.error("Errore caricamento rappresentanti:", error);
      return;
    }

    setRappresentanti(data || []);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {

    const { name, value, type } = e.target;

    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function salvaAV4() {

    const { error } = await supabase
      .from("tbAV4")
      .insert([form]);

    if (error) {
      console.error("Errore salvataggio AV4:", error);
      alert("Errore durante il salvataggio");
      return;
    }

    alert("AV4 salvato correttamente");

    setForm({
      cliente_id: "",
      rapp_legale_id: "",
      natura_prestazione: "",
      domanda1: false,
      domanda2: false
    });
  }

  return (
    <div className="p-6 max-w-3xl">

      <h1 className="text-xl font-bold mb-6">
        Modello AV4 – Dichiarazione Cliente
      </h1>

      {/* CLIENTE */}

      <div className="mb-4">

        <label className="block font-medium mb-1">
          Cliente
        </label>

        <select
          name="cliente_id"
          value={form.cliente_id}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        >

          <option value="">
            Seleziona cliente
          </option>

          {clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.cognome_nome}
            </option>
          ))}

        </select>

      </div>

      {/* RAPPRESENTANTE */}

      <div className="mb-4">

        <label className="block font-medium mb-1">
          Rappresentante
        </label>

        <select
          name="rapp_legale_id"
          value={form.rapp_legale_id}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        >

          <option value="">
            Seleziona rappresentante
          </option>

          {rappresentanti.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome_cognome}
            </option>
          ))}

        </select>

      </div>

      {/* NATURA PRESTAZIONE */}

      <div className="mb-4">

        <label className="block font-medium mb-1">
          Natura della prestazione
        </label>

        <textarea
          name="natura_prestazione"
          value={form.natura_prestazione}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          rows={4}
        />

      </div>

      {/* DOMANDA 1 */}

      <div className="mb-3">

        <label className="flex items-center gap-2">

          <input
            type="checkbox"
            name="domanda1"
            checked={form.domanda1}
            onChange={handleChange}
          />

          Dati di nascita e residenza come da documento di identificazione allegato

        </label>

      </div>

      {/* DOMANDA 2 */}

      <div className="mb-6">

        <label className="flex items-center gap-2">

          <input
            type="checkbox"
            name="domanda2"
            checked={form.domanda2}
            onChange={handleChange}
          />

          Domicilio diverso rispetto al documento di identificazione allegato

        </label>

      </div>

{/* PPE CLIENTE */}

<div className="mt-6 font-semibold">
  Persona politicamente esposta
</div>

<div className="mb-3">

  <label className="flex items-center gap-2">

    <input
      type="checkbox"
      name="domanda3"
      checked={form.domanda3}
      onChange={handleChange}
    />

    di non costituire persona politicamente esposta

  </label>

</div>

<div className="mb-3">

  <label className="flex items-center gap-2">

    <input
      type="checkbox"
      name="domanda4"
      checked={form.domanda4}
      onChange={handleChange}
    />

    di non rivestire lo status di PPE da più di un anno

  </label>

</div>

<div className="mb-3">

  <label className="flex items-center gap-2">

    <input
      type="checkbox"
      name="domanda5"
      checked={form.domanda5}
      onChange={handleChange}
    />

    di costituire persona politicamente esposta

  </label>

</div>

      {form.domanda5 && (

  <div className="mb-4">

    <label className="block font-medium mb-1">
      Specificare carica pubblica / relazione
    </label>

    <textarea
      name="spec_domanda5"
      value={form.spec_domanda5}
      onChange={handleChange}
      className="border p-2 w-full rounded"
      rows={3}
    />

  </div>

)}
      
      {/* SALVA */}

      <button
        onClick={salvaAV4}
        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded"
      >
        Salva AV4
      </button>

    </div>
  );
}
