import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import { useRef } from "react";

type ClienteRow = {
  id: string;
  ragione_sociale?: string | null;
  cod_cliente?: string | null;
};

type DocumentoRow = {
  id: string;
  av1_id?: string | null;
  cliente_id?: string | null;
  tipo_documento?: string | null;
  nome_file?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  dimensione?: number | null;
  origine?: string | null;
  note?: string | null;
  created_at?: string | null;
};

export default function FascicoloDocumentiPage() {
  const router = useRouter();
  const { av1_id, cliente_id } = router.query;

  const [loading, setLoading] = useState(true);
  const [clienteNome, setClienteNome] = useState("Cliente");
  const [documenti, setDocumenti] = useState<DocumentoRow[]>([]);

  const [uploading, setUploading] = useState(false);
const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleString("it-IT");
  };

  const formatSize = (value?: number | null) => {
    if (!value || value <= 0) return "-";

    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!router.isReady || !av1_id) return;

        setLoading(true);

        const handleUploadFile = async (file: File) => {
  try {
    if (!file || !av1_id) return;

    setUploading(true);

    const studioId = await getStudioId();
    if (!studioId) {
      alert("Studio non trovato");
      return;
    }

    const supabase = getSupabaseClient() as any;

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const filePath = `antiriciclaggio/fascicoli/${studioId}/${av1_id}/${fileName}`;

    // upload su storage
    const { error: uploadError } = await supabase.storage
      .from("allegati")
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    // salvataggio DB
    const { error: insertError } = await supabase
      .from("tbAVFascicoliDocumenti")
      .insert({
        studio_id: studioId,
        av1_id: Number(av1_id),
        cliente_id: cliente_id || null,
        nome_file: file.name,
        storage_path: filePath,
        mime_type: file.type,
        dimensione: file.size,
        origine: "manuale",
        tipo_documento: "Documento generico",
      });

    if (insertError) {
      throw insertError;
    }

    alert("Documento caricato con successo");

    // ricarica lista
    window.location.reload();
  } catch (err: any) {
    console.error("Errore upload:", err);
    alert(err?.message || "Errore upload documento");
  } finally {
    setUploading(false);
  }
};

        const studioId = await getStudioId();
        if (!studioId) {
          setLoading(false);
          return;
        }

        const supabase = getSupabaseClient() as any;

        if (cliente_id) {
          const { data: clienteData, error: clienteError } = await supabase
            .from("tbclienti")
            .select("id, ragione_sociale, cod_cliente")
            .eq("id", cliente_id)
            .maybeSingle();

          if (!clienteError && clienteData) {
            const cliente = clienteData as ClienteRow;
            setClienteNome(
              cliente.ragione_sociale || cliente.cod_cliente || "Cliente"
            );
          }
        }

        const { data, error } = await supabase
          .from("tbAVFascicoliDocumenti")
          .select(`
            id,
            av1_id,
            cliente_id,
            tipo_documento,
            nome_file,
            storage_path,
            mime_type,
            dimensione,
            origine,
            note,
            created_at
          `)
          .eq("studio_id", studioId)
          .eq("av1_id", av1_id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Errore caricamento documenti:", error);
          alert(`Errore caricamento documenti: ${error.message}`);
          setDocumenti([]);
          return;
        }

        setDocumenti(data || []);
      } catch (err: any) {
        console.error("Errore loadData fascicolo:", err);
        alert(err?.message || "Errore caricamento fascicolo documenti");
        setDocumenti([]);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [router.isReady, av1_id, cliente_id]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fascicolo documenti</h1>
         <p className="mt-1 text-gray-700">
  Cliente:
</p>

<p className="text-lg font-bold text-gray-900">
  {clienteNome}
</p>
          <p className="mt-1 text-sm text-gray-600">
            AV1 ID: <span className="font-semibold">{String(av1_id || "-")}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/antiriciclaggio")}
          className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Torna all'elenco
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Qui poi inseriremo upload, apertura ed eliminazione documenti.
        </div>

       <button
  type="button"
  onClick={() => fileInputRef.current?.click()}
  disabled={uploading}
  className={`rounded px-4 py-2 text-white ${
    uploading
      ? "cursor-not-allowed bg-gray-400"
      : "bg-blue-600 hover:bg-blue-700"
  }`}
>
  {uploading ? "Caricamento..." : "Carica documento"}
</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Tipo documento</th>
              <th className="p-3 text-left">Nome file</th>
              <th className="p-3 text-left">Origine</th>
              <th className="p-3 text-left">Formato</th>
              <th className="p-3 text-left">Dimensione</th>
              <th className="p-3 text-left">Data caricamento</th>
              <th className="p-3 text-center">Azioni</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-center">
                  Caricamento...
                </td>
              </tr>
            ) : documenti.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center">
                  Nessun documento presente nel fascicolo
                </td>
              </tr>
            ) : (
              documenti.map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="p-3">{doc.tipo_documento || "-"}</td>
                  <td className="p-3">{doc.nome_file || "-"}</td>
                  <td className="p-3">{doc.origine || "-"}</td>
                  <td className="p-3">{doc.mime_type || "-"}</td>
                  <td className="p-3">{formatSize(doc.dimensione)}</td>
                  <td className="p-3">{formatDateTime(doc.created_at)}</td>
                  <td className="p-3 text-center">-</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
