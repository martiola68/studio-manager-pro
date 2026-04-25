import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function NuovoAtto() {
  const router = useRouter();

  const [clienti, setClienti] = useState<any[]>([]);
  const [tipiAtto, setTipiAtto] = useState<any[]>([]);
  const [utenti, setUtenti] = useState<any[]>([]);
  const [tributi, setTributi] = useState<any[]>([]);

  const [form, setForm] = useState({
    cliente_id: "",
    tipo_atto_id: "",
    numero_atto: "",
    anno_riferimento: "",
    data_ricezione: "",
    professionista_incaricato_id: "",
    referente_id: "",
    descrizione: "",
    valore_pratica: "",
    note: "",
    esito: "Pratica aperta",
    errore_studio: false,
    comunicato: false,
    pratica_chiusa: false,
    data_comunicazione: "",
  });

  const [righe, setRighe] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = getSupabaseClient();

    const [c, t, u, tr] = await Promise.all([
      supabase.from("tbclienti").select("id, ragione_sociale"),
      supabase.from("tbcontenzioso_tipi_atto").select("*").eq("attivo", true),
      supabase.from("tbutenti").select("id, nome, cognome"),
      supabase.from("tbcontenzioso_codici_tributo").select("*"),
    ]);

    setClienti(c.data || []);
    setTipiAtto(t.data || []);
    setUtenti(u.data || []);
    setTributi(tr.data || []);
  };

  const addRiga = () => {
    setRighe([
      ...righe,
      {
        anno: "",
        codice_tributo_id: "",
        importo: "",
        imposta: false,
      },
    ]);
  };

  const updateRiga = (index: number, field: string, value: any) => {
    const newRighe = [...righe];
    newRighe[index][field] = value;
    setRighe(newRighe);
  };

  const removeRiga = (index: number) => {
    setRighe(righe.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();

    const { data: atto, error } = await (supabase as any)
      .from("tbcontenzioso_esattoriale")
      .insert({
        ...form,
        anno_riferimento: form.anno_riferimento || null,
        valore_pratica: form.valore_pratica || null,
      })
      .select()
      .single();

    if (error) {
      alert("Errore salvataggio atto");
      return;
    }

    if (righe.length > 0) {
      const payload = righe.map((r) => ({
        esattoriale_id: atto.id,
        anno: r.anno || null,
        codice_tributo_id: r.codice_tributo_id || null,
        importo: r.importo || null,
        imposta: r.imposta,
      }));

      await (supabase as any)
        .from("tbcontenzioso_esattoriale_tributi")
        .insert(payload);
    }

    router.push("/contenzioso");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo Atto</h1>

      {/* FORM PRINCIPALE */}
      <div className="grid grid-cols-3 gap-4 mb-6">

        <select onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
          <option>Cliente</option>
          {clienti.map(c => (
            <option key={c.id} value={c.id}>{c.ragione_sociale}</option>
          ))}
        </select>

        <select onChange={(e) => setForm({ ...form, tipo_atto_id: e.target.value })}>
          <option>Tipo atto</option>
          {tipiAtto.map(t => (
            <option key={t.id} value={t.id}>{t.descrizione}</option>
          ))}
        </select>

        <input placeholder="Numero atto"
          onChange={(e) => setForm({ ...form, numero_atto: e.target.value })}
        />

        <input type="date"
          onChange={(e) => setForm({ ...form, data_ricezione: e.target.value })}
        />

        <select onChange={(e) => setForm({ ...form, professionista_incaricato_id: e.target.value })}>
          <option>Professionista</option>
          {utenti.map(u => (
            <option key={u.id} value={u.id}>{u.nome} {u.cognome}</option>
          ))}
        </select>

        <select onChange={(e) => setForm({ ...form, referente_id: e.target.value })}>
          <option>Referente</option>
          {utenti.map(u => (
            <option key={u.id} value={u.id}>{u.nome} {u.cognome}</option>
          ))}
        </select>

        <input placeholder="Valore pratica"
          onChange={(e) => setForm({ ...form, valore_pratica: e.target.value })}
        />

      </div>

      {/* TABELLA TRIBUTI */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">Tributi</h2>

        <button onClick={addRiga} className="mb-2 border px-3 py-1">
          + Riga
        </button>

        {righe.map((r, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">

            <input placeholder="Anno"
              onChange={(e) => updateRiga(i, "anno", e.target.value)}
            />

            <select onChange={(e) => updateRiga(i, "codice_tributo_id", e.target.value)}>
              <option>Tributo</option>
              {tributi.map(t => (
                <option key={t.id} value={t.id}>
                  {t.tributo} - {t.descrizione}
                </option>
              ))}
            </select>

            <input placeholder="Importo"
              onChange={(e) => updateRiga(i, "importo", e.target.value)}
            />

            <label>
              <input type="checkbox"
                onChange={(e) => updateRiga(i, "imposta", e.target.checked)}
              />
              Imposta
            </label>

            <button onClick={() => removeRiga(i)}>X</button>

          </div>
        ))}
      </div>

      <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2">
        Salva
      </button>
    </div>
  );
}
