import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type RappLegale = {
  id: string;
  nome_cognome?: string | null;
  codice_fiscale?: string | null;
  luogo_nascita?: string | null;
  data_nascita?: string | null;
  indirizzo_residenza?: string | null;
  citta_residenza?: string | null;
  cap_residenza?: string | null;
  nazionalita?: string | null;
};

type Props = {
  av4_id: string;
  studio_id: string;
  cliente_id: string;
  sezione: "domanda7" | "domanda8" | "domanda9";
};

type RigaSalvata = {
  id: number;
  nome_cognome?: string | null;
  codice_fiscale?: string | null;
  luogo_nascita?: string | null;
  data_nascita?: string | null;
  indirizzo_residenza?: string | null;
  citta_residenza?: string | null;
  cap_residenza?: string | null;
  nazionalita?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const onlyDate = String(value).slice(0, 10);
  const [y, m, d] = onlyDate.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function TitolariDaRappLegaliForm({
  av4_id,
  studio_id,
  cliente_id,
  sezione,
}: Props) {
  const [rappresentanti, setRappresentanti] = useState<RappLegale[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [righe, setRighe] = useState<RigaSalvata[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = rappresentanti.find((r) => String(r.id) === selectedId);

  async function loadRappresentanti() {
    const supabase = getSupabaseClient() as any;

    const { data, error } = await supabase
      .from("rapp_legali")
      .select(`
        id,
        nome_cognome,
        codice_fiscale,
        luogo_nascita,
        data_nascita,
        indirizzo_residenza,
        citta_residenza,
        cap_residenza,
        nazionalita
      `)
      .order("nome_cognome", { ascending: true });

    if (error) {
      console.error("Errore caricamento rapp_legali:", error);
      return;
    }

    setRappresentanti((data || []) as RappLegale[]);
  }

  async function loadSalvati() {
    const supabase = getSupabaseClient() as any;

    const { data, error } = await supabase
      .from("tbAV4_titolari")
      .select(`
        id,
        nome_cognome,
        codice_fiscale,
        luogo_nascita,
        data_nascita,
        indirizzo_residenza,
        citta_residenza,
        cap_residenza,
        nazionalita
      `)
      .eq("av4_id", Number(av4_id))
      .eq("sezione", sezione)
      .order("id", { ascending: true });

    if (error) {
      console.error("Errore caricamento titolari salvati:", error);
      return;
    }

    setRighe((data || []) as RigaSalvata[]);
  }

  useEffect(() => {
    if (!av4_id) return;
    void loadRappresentanti();
    void loadSalvati();
  }, [av4_id, sezione]);

  async function handleAggiungi() {
    if (!selectedId) {
      alert("Seleziona un nominativo.");
      return;
    }

    const selectedRow = rappresentanti.find((r) => String(r.id) === selectedId);
    if (!selectedRow) {
      alert("Nominativo non trovato.");
      return;
    }

    const giaPresente = righe.some(
      (r) =>
        r.nome_cognome === selectedRow.nome_cognome &&
        r.codice_fiscale === selectedRow.codice_fiscale
    );

    if (giaPresente) {
      alert("Questo nominativo è già presente nella sezione.");
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabaseClient() as any;

      const payload = {
        av4_id: Number(av4_id),
        studio_id,
        cliente_id,
        sezione,
        nome_cognome: selectedRow.nome_cognome || null,
        codice_fiscale: selectedRow.codice_fiscale || null,
        luogo_nascita: selectedRow.luogo_nascita || null,
        data_nascita: selectedRow.data_nascita || null,
        indirizzo_residenza: selectedRow.indirizzo_residenza || null,
        citta_residenza: selectedRow.citta_residenza || null,
        cap_residenza: selectedRow.cap_residenza || null,
        nazionalita: selectedRow.nazionalita || null,
      };

      const { error } = await supabase.from("tbAV4_titolari").insert([payload]);

      if (error) {
        console.error("Errore inserimento titolare:", error);
        alert("Errore durante l'inserimento del nominativo.");
        return;
      }

      setSelectedId("");
      await loadSalvati();
    } finally {
      setLoading(false);
    }
  }

  async function handleElimina(id: number) {
    const conferma = window.confirm("Vuoi eliminare questo nominativo?");
    if (!conferma) return;

    try {
      setLoading(true);
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase
        .from("tbAV4_titolari")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Errore eliminazione nominativo:", error);
        alert("Errore durante l'eliminazione.");
        return;
      }

      await loadSalvati();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-medium mb-1">
          Seleziona nominativo da rappresentanti legali
        </label>

        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">Seleziona nominativo</option>
            {rappresentanti.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome_cognome || "-"} {r.codice_fiscale ? `- ${r.codice_fiscale}` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAggiungi}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
          >
            Aggiungi
          </button>
        </div>

        {selected && (
          <div className="mt-3 border rounded p-3 bg-gray-50">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium">Nome:</span> {selected.nome_cognome || "-"}
              </div>
              <div>
                <span className="font-medium">Codice fiscale:</span> {selected.codice_fiscale || "-"}
              </div>
              <div>
                <span className="font-medium">Luogo nascita:</span> {selected.luogo_nascita || "-"}
              </div>
              <div>
                <span className="font-medium">Data nascita:</span> {formatDate(selected.data_nascita)}
              </div>
              <div>
                <span className="font-medium">Città:</span> {selected.citta_residenza || "-"}
              </div>
              <div>
                <span className="font-medium">Nazionalità:</span> {selected.nazionalita || "-"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Nome e cognome</th>
              <th className="p-2 text-left">Codice fiscale</th>
              <th className="p-2 text-left">Data nascita</th>
              <th className="p-2 text-left">Città</th>
              <th className="p-2 text-center">Azioni</th>
            </tr>
          </thead>

          <tbody>
            {righe.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-center text-gray-500">
                  Nessun nominativo inserito
                </td>
              </tr>
            ) : (
              righe.map((riga) => (
                <tr key={riga.id} className="border-t">
                  <td className="p-2">{riga.nome_cognome || "-"}</td>
                  <td className="p-2">{riga.codice_fiscale || "-"}</td>
                  <td className="p-2">{formatDate(riga.data_nascita)}</td>
                  <td className="p-2">{riga.citta_residenza || "-"}</td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleElimina(riga.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
