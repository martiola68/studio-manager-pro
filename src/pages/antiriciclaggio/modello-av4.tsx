import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ModelloAV4() {

  const [clienti, setClienti] = useState<any[]>([]);
  const [rappresentanti, setRappresentanti] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    cliente_id: "",
    rapp_legale_id: "",
    natura_prestazione: "",
    domanda1: false,
    domanda2: false
  });

  useEffect(() => {
    loadClienti();
    loadRappresentanti();
  }, []);

  async function loadClienti() {
    const { data } = await supabase
      .from("tbclienti")
      .select("id, cognome_nome");

    if (data) setClienti(data);
  }

  async function loadRappresentanti() {
    const { data } = await supabase
      .from("rapp_legali")
      .select("*");

    if (data) setRappresentanti(data);
  }

  function handleChange(e: any) {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value
    });
  }

  async function salvaAV4() {

    const { error } = await supabase
      .from("tbAV4")
      .insert([form]);

    if (error) {
      alert("Errore salvataggio");
      console.log(error);
    } else {
      alert("AV4 salvato");
    }

  }

  return (
    <div className="p-6">

      <h1 className="text-xl font-bold mb-6">
        Modello AV4 - Dichiarazione Cliente
      </h1>

      {/* CLIENTE */}

      <div className="mb-4">
        <label className="block font-medium">Cliente</label>

        <select
          name="cliente_id"
          value={form.cliente_id}
          onChange={handleChange}
          className="border p-2 w-full"
        >

          <option value="">Seleziona cliente</option>

          {clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.cognome_nome}
            </option>
          ))}

        </select>
      </div>

      {/* RAPPRESENTANTE */}

      <div className="mb-4">
        <label className="block font-medium">Rappresentante</label>

        <select
          name="rapp_legale_id"
          value={form.rapp_legale_id}
          onChange={handleChange}
          className="border p-2 w-full"
        >

          <option value="">Seleziona rappresentante</option>

          {rappresentanti.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome_cognome}
            </option>
          ))}

        </select>
      </div>

      {/* NATURA PRESTAZIONE */}

      <div className="mb-4">
        <label className="block font-medium">
          Natura della prestazione
        </label>

        <textarea
          name="natura_prestazione"
          value={form.natura_prestazione}
          onChange={handleChange}
          className="border p-2 w-full"
        />
      </div>

      {/* DOMANDA 1 */}

      <div className="mb-4">
        <label>

          <input
            type="checkbox"
            name="domanda1"
            checked={form.domanda1}
            onChange={handleChange}
          />

          {" "}Dati di nascita e residenza come da documento allegato

        </label>
      </div>

      {/* DOMANDA 2 */}

      <div className="mb-6">
        <label>

          <input
            type="checkbox"
            name="domanda2"
            checked={form.domanda2}
            onChange={handleChange}
          />

          {" "}Domicilio diverso rispetto al documento

        </label>
      </div>

      {/* SALVA */}

      <button
        onClick={salvaAV4}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Salva AV4
      </button>

    </div>
  );
}
