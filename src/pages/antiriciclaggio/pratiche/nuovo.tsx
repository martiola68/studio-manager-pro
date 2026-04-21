import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function NuovaPraticaAML() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [clienti, setClienti] = useState<any[]>([]);
  const [societa, setSocieta] = useState<any[]>([]);

  const [clienteId, setClienteId] = useState("");
  const [societaId, setSocietaId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: clientiData } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale");

    const { data: societaData } = await supabase
      .from("tbRespAVSocieta")
      .select("id, Denominazione");

    setClienti(clientiData || []);
    setSocieta(societaData || []);
  };

  const handleCreate = async () => {
    if (!clienteId) {
      alert("Seleziona cliente");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // recupero studio_id utente
    const { data: utente } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", user?.id)
      .single();

    const { data, error } = await supabase
      .from("tbPraticheAML")
      .insert({
        studio_id: utente?.studio_id,
        cliente_id: clienteId,
        societa_id: societaId || null,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Errore creazione pratica");
      return;
    }

    // 🔥 redirect alla pratica
    router.push(`/antiriciclaggio/pratica/${data.id}`);
  };

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold mb-6">Nuova pratica AML</h1>

      <div className="space-y-4">

        {/* CLIENTE */}
        <div>
          <label className="block text-sm mb-1">Cliente *</label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="">Seleziona cliente</option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.ragione_sociale}
              </option>
            ))}
          </select>
        </div>

        {/* SOCIETA AML */}
        <div>
          <label className="block text-sm mb-1">Società AML</label>
          <select
            value={societaId}
            onChange={(e) => setSocietaId(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="">-- Default --</option>
            {societa.map((s) => (
              <option key={s.id} value={s.id}>
                {s.Denominazione}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {loading ? "Creazione..." : "Crea pratica"}
        </button>
      </div>
    </div>
  );
}
