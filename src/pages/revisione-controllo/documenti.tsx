import { useEffect, useState } from "react";
import Head from "next/head";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Documento = {
  id: string;
  studio_id: string;
  controllo_id: string;
  relazione_id: string | null;
  nome_file: string;
  tipo_file: string;
  testo_documento: string | null;
  generato_at: string;
};

export default function DocumentiRevisionePage() {
  const [studioId, setStudioId] = useState("");
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
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
      .select("studio_id")
      .eq("email", email)
      .single();

    if (error) throw error;
    if (!data?.studio_id) throw new Error("Studio utente non trovato.");

    setStudioId(data.studio_id);
    return data.studio_id as string;
  }

  async function loadDocumenti(studio?: string) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const sid = studio || studioId || (await loadCurrentUser());

      const res = await fetch(`/api/revisione-controllo/documenti?studio_id=${sid}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento documenti.");
      }

      setDocumenti(json.data || []);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento documenti.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocumenti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scaricaDocumento(doc: Documento) {
    const blob = new Blob([doc.testo_documento || ""], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = doc.nome_file || "documento_revisione.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  async function eliminaDocumento(id: string) {
    const ok = window.confirm("Confermi l'eliminazione del documento?");
    if (!ok) return;

    try {
      setError("");
      setSuccess("");

      const res = await fetch(`/api/revisione-controllo/documenti?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore eliminazione documento.");
      }

      setSuccess("Documento eliminato.");
      await loadDocumenti(studioId);
    } catch (err: any) {
      setError(err?.message || "Errore eliminazione documento.");
    }
  }

  return (
    <>
      <Head>
        <title>Documenti revisione</title>
      </Head>

      <div className="mx-auto max-w-[1500px] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Documenti revisione</h1>
            <p className="text-sm text-gray-500">
              Archivio dei verbali e delle relazioni generate.
            </p>
          </div>

          <button
            onClick={() => loadDocumenti(studioId)}
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Aggiorna
          </button>
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
              Caricamento documenti...
            </div>
          ) : documenti.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Nessun documento generato.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Nome file</th>
                    <th className="p-3 text-center">Tipo</th>
                    <th className="p-3 text-center">Generato il</th>
                    <th className="p-3 text-center">Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {documenti.map((doc) => (
                    <tr key={doc.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{doc.nome_file}</td>

                      <td className="p-3 text-center">
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                          {doc.tipo_file}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {new Date(doc.generato_at).toLocaleString("it-IT")}
                      </td>

                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => scaricaDocumento(doc)}
                            className="rounded-md border bg-white p-2 text-blue-700 hover:bg-blue-50"
                            title="Scarica"
                          >
                            <Download size={16} />
                          </button>

                          <button
                            onClick={() => eliminaDocumento(doc.id)}
                            className="rounded-md border bg-white p-2 text-red-600 hover:bg-red-50"
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
