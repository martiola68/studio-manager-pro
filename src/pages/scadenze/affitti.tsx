import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const studioId = "f9d3ca10-6134-4061-a2b4-0be74e8c7654";

type ClienteOption = {
  id: string;
  nominativo: string;
};

type UtenteOption = {
  id: string;
  nome: string;
  cognome: string;
};

type ContrattoAffitto = {
  id: string;
  studio_id: string;
  cliente_id: string;
  utente_operatore_id?: string | null;
  nominativo: string;
  descrizione_immobile_locato?: string | null;
  data_registrazione_atto: string;
  durata_contratto_anni: number;
  codice_identificativo_registrazione?: string | null;
  importo_registrazione?: number | null;
  contatore_anni: number;
  data_prossima_scadenza: string;
  alert1_inviato: boolean;
  alert2_inviato: boolean;
  alert3_inviato: boolean;
  attivo: boolean;
  contratto_concluso: boolean;
  created_at?: string;
  updated_at?: string;
};

type FormDataType = {
  cliente_id: string;
  utente_operatore_id: string;
  descrizione_immobile_locato: string;
  data_registrazione_atto: string;
  durata_contratto_anni: string;
  codice_identificativo_registrazione: string;
  importo_registrazione: string;
};

const initialForm: FormDataType = {
  cliente_id: "",
  utente_operatore_id: "",
  descrizione_immobile_locato: "",
  data_registrazione_atto: "",
  durata_contratto_anni: "",
  codice_identificativo_registrazione: "",
  importo_registrazione: "",
};

function addOneYear(dateString: string) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ScadenzarioAffittiPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [utenti, setUtenti] = useState<UtenteOption[]>([]);
  const [contratti, setContratti] = useState<ContrattoAffitto[]>([]);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState<FormDataType>(initialForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const [clientiRes, utentiRes, contrattiRes] = await Promise.all([
        (supabase as any)
          .from("tbclienti")
          .select("id, ragione_sociale, nominativo, nome, cognome")
          .eq("studio_id", studioId)
          .order("ragione_sociale", { ascending: true }),
        (supabase as any)
          .from("tbutenti")
          .select("id, nome, cognome")
          .order("cognome", { ascending: true }),
        (supabase as any)
          .from("tbscadaffitti")
          .select("*")
          .eq("studio_id", studioId)
          .order("nominativo", { ascending: true }),
      ]);

      if (clientiRes.error) throw clientiRes.error;
      if (utentiRes.error) throw utentiRes.error;
      if (contrattiRes.error) throw contrattiRes.error;

      const clientiOptions: ClienteOption[] = (clientiRes.data || []).map((c: any) => ({
        id: c.id,
        nominativo:
          c.ragione_sociale ||
          c.nominativo ||
          [c.cognome, c.nome].filter(Boolean).join(" ").trim() ||
          c.id,
      }));

      setClienti(clientiOptions);
      setUtenti((utentiRes.data || []) as UtenteOption[]);
      setContratti((contrattiRes.data || []) as ContrattoAffitto[]);
    } catch (error) {
      console.error("Errore caricamento scadenzario affitti:", error);
      alert("Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  }

  const clientiMap = useMemo(() => {
    const map: Record<string, string> = {};
    clienti.forEach((c) => {
      map[c.id] = c.nominativo;
    });
    return map;
  }, [clienti]);

  const utentiMap = useMemo(() => {
    const map: Record<string, string> = {};
    utenti.forEach((u) => {
      map[u.id] = [u.cognome, u.nome].filter(Boolean).join(" ").trim();
    });
    return map;
  }, [utenti]);

  const filteredContratti = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contratti;

    return contratti.filter((c) => {
      return (
        (c.nominativo || "").toLowerCase().includes(q) ||
        (c.descrizione_immobile_locato || "").toLowerCase().includes(q) ||
        (c.codice_identificativo_registrazione || "").toLowerCase().includes(q)
      );
    });
  }, [contratti, search]);

  function handleChange<K extends keyof FormDataType>(field: K, value: FormDataType[K]) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.cliente_id) {
      alert("Seleziona il cliente");
      return;
    }

    if (!formData.data_registrazione_atto) {
      alert("Inserisci la data registrazione atto");
      return;
    }

    if (!formData.durata_contratto_anni || Number(formData.durata_contratto_anni) < 1) {
      alert("Inserisci una durata contratto valida");
      return;
    }

    const nominativo = clientiMap[formData.cliente_id] || "";

    if (!nominativo) {
      alert("Impossibile determinare il nominativo del cliente");
      return;
    }

    const dataProssimaScadenza = addOneYear(formData.data_registrazione_atto);

    try {
      setSaving(true);
      const supabase = getSupabaseClient();

      const payload = {
        studio_id: studioId,
        cliente_id: formData.cliente_id,
        utente_operatore_id: formData.utente_operatore_id || null,
        nominativo,
        descrizione_immobile_locato: formData.descrizione_immobile_locato || null,
        data_registrazione_atto: formData.data_registrazione_atto,
        durata_contratto_anni: Number(formData.durata_contratto_anni),
        codice_identificativo_registrazione:
          formData.codice_identificativo_registrazione || null,
        importo_registrazione: formData.importo_registrazione
          ? Number(formData.importo_registrazione)
          : null,
        contatore_anni: 1,
        data_prossima_scadenza: dataProssimaScadenza,
        alert1_inviato: false,
        alert2_inviato: false,
        alert3_inviato: false,
        attivo: true,
        contratto_concluso: false,
      };

      const { error } = await (supabase as any).from("tbscadaffitti").insert(payload);

      if (error) throw error;

      setFormData(initialForm);
      await loadData();
      alert("Contratto di affitto registrato correttamente");
    } catch (error) {
      console.error("Errore salvataggio contratto affitto:", error);
      alert("Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAttivo(record: ContrattoAffitto) {
    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase as any)
        .from("tbscadaffitti")
        .update({
          attivo: !record.attivo,
          contratto_concluso: record.attivo ? true : false,
        })
        .eq("id", record.id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error("Errore aggiornamento stato contratto:", error);
      alert("Errore aggiornamento stato contratto");
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div>Caricamento scadenzario affitti...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scadenzario Contratti di Affitto</h1>
        <p className="text-sm text-gray-600 mt-1">
          Registrazione contratti e gestione rinnovi annuali F24
        </p>
      </div>

      <div className="border rounded bg-white p-4">
        <h2 className="text-lg font-semibold mb-4">Nuovo contratto</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Cliente</label>
            <select
              value={formData.cliente_id}
              onChange={(e) => handleChange("cliente_id", e.target.value)}
              className="border rounded px-3 py-2"
              required
            >
              <option value="">Seleziona cliente</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nominativo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Operatore</label>
            <select
              value={formData.utente_operatore_id}
              onChange={(e) => handleChange("utente_operatore_id", e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">Seleziona operatore</option>
              {utenti.map((u) => (
                <option key={u.id} value={u.id}>
                  {[u.cognome, u.nome].filter(Boolean).join(" ").trim()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-sm font-medium mb-1">Descrizione immobile locato</label>
            <input
              type="text"
              value={formData.descrizione_immobile_locato}
              onChange={(e) =>
                handleChange("descrizione_immobile_locato", e.target.value)
              }
              className="border rounded px-3 py-2"
              placeholder="Es. Appartamento via Roma 10, interno 3"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Data registrazione atto</label>
            <input
              type="date"
              value={formData.data_registrazione_atto}
              onChange={(e) => handleChange("data_registrazione_atto", e.target.value)}
              className="border rounded px-3 py-2"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Durata contratto (anni)</label>
            <input
              type="number"
              min="1"
              value={formData.durata_contratto_anni}
              onChange={(e) => handleChange("durata_contratto_anni", e.target.value)}
              className="border rounded px-3 py-2"
              placeholder="Es. 4"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">
              Codice identificativo registrazione
            </label>
            <input
              type="text"
              value={formData.codice_identificativo_registrazione}
              onChange={(e) =>
                handleChange("codice_identificativo_registrazione", e.target.value)
              }
              className="border rounded px-3 py-2"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Importo registrazione</label>
            <input
              type="number"
              step="0.01"
              value={formData.importo_registrazione}
              onChange={(e) => handleChange("importo_registrazione", e.target.value)}
              className="border rounded px-3 py-2"
              placeholder="Es. 120.00"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {saving ? "Salvataggio..." : "Salva contratto"}
            </button>
          </div>
        </form>
      </div>

      <div className="border rounded bg-white p-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Contratti registrati</h2>
            <p className="text-sm text-gray-600">
              Totale risultati: {filteredContratti.length}
            </p>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Cerca</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded px-3 py-2 min-w-[260px]"
              placeholder="Cliente, immobile o codice registrazione..."
            />
          </div>
        </div>

        {filteredContratti.length === 0 ? (
          <div className="text-sm text-gray-600">Nessun contratto trovato.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left">Operatore</th>
                  <th className="p-2 text-left">Immobile</th>
                  <th className="p-2 text-center">Data registrazione</th>
                  <th className="p-2 text-center">Durata</th>
                  <th className="p-2 text-center">Anno</th>
                  <th className="p-2 text-center">Prossima scadenza</th>
                  <th className="p-2 text-left">Codice registrazione</th>
                  <th className="p-2 text-right">Importo</th>
                  <th className="p-2 text-center">Stato</th>
                  <th className="p-2 text-center">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredContratti.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.nominativo}</td>
                    <td className="p-2">
                      {c.utente_operatore_id
                        ? utentiMap[c.utente_operatore_id] || c.utente_operatore_id
                        : ""}
                    </td>
                    <td className="p-2">{c.descrizione_immobile_locato || ""}</td>
                    <td className="p-2 text-center">{c.data_registrazione_atto || ""}</td>
                    <td className="p-2 text-center">{c.durata_contratto_anni}</td>
                    <td className="p-2 text-center">{c.contatore_anni}</td>
                    <td className="p-2 text-center">{c.data_prossima_scadenza}</td>
                    <td className="p-2">
                      {c.codice_identificativo_registrazione || ""}
                    </td>
                    <td className="p-2 text-right">
                      {c.importo_registrazione !== null &&
                      c.importo_registrazione !== undefined
                        ? Number(c.importo_registrazione).toFixed(2)
                        : ""}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          c.attivo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.attivo ? "Attivo" : "Chiuso"}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleAttivo(c)}
                        className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                      >
                        {c.attivo ? "Chiudi" : "Riattiva"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
