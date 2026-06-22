import { useEffect, useState } from "react";
import Head from "next/head";
import { CheckCircle, RefreshCw, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Followup = {
  id: string;
  studio_id: string;
  controllo_id: string;
  checklist_id: string;
  cliente_id: string;
  descrizione: string;
  gravita: string | null;
  data_scadenza: string | null;
  completato: boolean;
  completato_da: string | null;
  completato_at: string | null;
  note: string | null;
  created_at: string;
};

function formatDateIT(value?: string | null) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT");
}

function gravitaClass(value?: string | null) {
  if (value === "ALTA") return "bg-red-100 text-red-700";
  if (value === "MEDIA") return "bg-orange-100 text-orange-700";
  if (value === "BASSA") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

export default function FollowupRevisionePage() {
  const [studioId, setStudioId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [followup, setFollowup] = useState<Followup[]>([]);

  const [filtro, setFiltro] = useState("aperti");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCurrentUser() {
    const supabase = getSupabaseClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const email = session?.user?.email;
    if (!email) throw new Error("Sessione non trovata.");

    const { data, error } = await supabase
      .from("tbutenti")
      .select("id, studio_id")
      .eq("email", email)
      .single();

    if (error) throw error;
    if (!data?.studio_id) throw new Error("Studio utente non trovato.");

    setStudioId(data.studio_id);
    setCurrentUserId(data.id);

    return data;
  }

  async function loadFollowup() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const user =
        studioId && currentUserId
          ? { studio_id: studioId, id: currentUserId }
          : await loadCurrentUser();

      const params = new URLSearchParams();
      params.set("studio_id", String(user.studio_id));

      if (filtro === "aperti") params.set("completato", "false");
      if (filtro === "completati") params.set("completato", "true");

      const res = await fetch(`/api/revisione-controllo/followup?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento follow-up.");
      }

      let rows = json.data || [];

      if (filtro === "critici") {
        rows = rows.filter((r: Followup) => r.gravita === "ALTA" && !r.completato);
      }

      setFollowup(rows);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento follow-up.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFollowup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function completaFollowup(item: Followup) {
    try {
      setSavingId(item.id);
      setError("");
      setSuccess("");

      const res = await fetch("/api/revisione-controllo/followup", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          completato: true,
          completato_da: currentUserId || null,
          note: item.note || null,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore completamento follow-up.");
      }

      setSuccess("Follow-up completato.");
      await loadFollowup();
    } catch (err: any) {
      setError(err?.message || "Errore completamento follow-up.");
    } finally {
      setSavingId(null);
    }
  }

  async function eliminaFollowup(id: string) {
    const ok = window.confirm("Confermi l'eliminazione del follow-up?");
    if (!ok) return;

    try {
      setSavingId(id);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/revisione-controllo/followup?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore eliminazione follow-up.");
      }

      setSuccess("Follow-up eliminato.");
      await loadFollowup();
    } catch (err: any) {
      setError(err?.message || "Errore eliminazione follow-up.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Follow-up revisione</title>
      </Head>

      <div className="mx-auto max-w-[1500px] p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Follow-up revisione</h1>
            <p className="text-sm text-gray-500">
              Monitoraggio delle criticità e delle raccomandazioni emerse dalle checklist.
            </p>
          </div>

          <button
            onClick={loadFollowup}
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Aggiorna
          </button>
        </div>

        <div className="mb-4 rounded-lg border bg-white p-4">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Filtro
          </label>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="h-10 rounded-md border px-3 text-sm"
          >
            <option value="aperti">Aperti</option>
            <option value="completati">Completati</option>
            <option value="critici">Critici</option>
            <option value="tutti">Tutti</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border bg-white">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Caricamento follow-up...
            </div>
          ) : followup.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Nessun follow-up trovato.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Descrizione</th>
                    <th className="p-3 text-center">Gravità</th>
                    <th className="p-3 text-center">Scadenza</th>
                    <th className="p-3 text-center">Stato</th>
                    <th className="p-3 text-left">Note</th>
                    <th className="p-3 text-center">Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {followup.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.descrizione}</td>

                      <td className="p-3 text-center">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${gravitaClass(
                            item.gravita
                          )}`}
                        >
                          {item.gravita || "-"}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {formatDateIT(item.data_scadenza)}
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            item.completato
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {item.completato ? "Completato" : "Aperto"}
                        </span>
                      </td>

                      <td className="p-3">{item.note || "-"}</td>

                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          {!item.completato && (
                            <button
                              onClick={() => completaFollowup(item)}
                              disabled={savingId === item.id}
                              className="rounded-md border bg-white p-2 text-green-700 hover:bg-green-50 disabled:opacity-50"
                              title="Completa"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => eliminaFollowup(item.id)}
                            disabled={savingId === item.id}
                            className="rounded-md border bg-white p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                            title="Elimina"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
