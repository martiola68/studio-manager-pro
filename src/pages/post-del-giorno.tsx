import { useEffect, useState } from "react";
import Head from "next/head";
import { supabase } from "@/lib/supabase/client";
import { Plus, Check, Trash2, RefreshCw } from "lucide-react";

type PostGiorno = {
  id: string;
  titolo: string;
  descrizione: string | null;
  priorita: string | null;
  data_scadenza: string | null;
  working_progress: string | null;
  destinatario_id: string | null;
  operatore_id: string | null;
  tipo: string | null;
};

export default function PostDelGiornoPage() {
  const [posts, setPosts] = useState<PostGiorno[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [priorita, setPriorita] = useState("Media");
  const [dataRiferimento, setDataRiferimento] = useState(
    new Date().toISOString().slice(0, 10)
  );

  async function loadPosts() {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        window.location.href = "/login";
        return;
      }

      setUserId(session.user.id);

      const { data, error } = await supabase
        .from("tbpromemoria")
        .select("*")
       .eq("tipo", "POST_GIORNO")
.eq("destinatario_id", session.user.id)
.neq("working_progress", "Completato")
.eq("data_scadenza", new Date().toISOString().slice(0, 10))
.order("priorita", { ascending: true })

      if (error) throw error;

      setPosts(((data || []) as unknown) as PostGiorno[]);
    } catch (error: any) {
      alert(error.message || "Errore caricamento post");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  async function creaPost() {
    if (!userId) return;

    if (!titolo.trim()) {
      alert("Inserisci un titolo.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("tbpromemoria").insert({
        tipo: "POST_GIORNO",
        titolo: titolo.trim(),
        descrizione: descrizione.trim() || null,
        priorita,
        data_scadenza: dataRiferimento,
        working_progress: "Aperto",
        destinatario_id: userId,
        operatore_id: userId,
      });

      if (error) throw error;

      setTitolo("");
      setDescrizione("");
      setPriorita("Media");
      setDataRiferimento(new Date().toISOString().slice(0, 10));

      await loadPosts();
    } catch (error: any) {
      alert(error.message || "Errore creazione post");
    } finally {
      setSaving(false);
    }
  }

  async function completaPost(id: string) {
    if (!userId) return;

    const { error } = await supabase
      .from("tbpromemoria")
      .update({
        working_progress: "Completato",
      })
      .eq("id", id)
      .eq("destinatario_id", userId)
      .eq("tipo", "POST_GIORNO");

    if (error) {
      alert(error.message);
      return;
    }

    await loadPosts();
  }

  async function eliminaPost(id: string) {
    if (!userId) return;

    if (!confirm("Eliminare questo post?")) return;

    const { error } = await supabase
      .from("tbpromemoria")
      .delete()
      .eq("id", id)
      .eq("destinatario_id", userId)
      .eq("tipo", "POST_GIORNO");

    if (error) {
      alert(error.message);
      return;
    }

    await loadPosts();
  }

const colorePriorita = (p?: string | null) => {
  if (p === "Alta") {
    return "border-red-700 bg-red-500 text-white";
  }

  if (p === "Bassa") {
    return "border-green-700 bg-green-500 text-black";
  }

  return "border-yellow-700 bg-yellow-300 text-black";
};

  return (
    <>
      <Head>
        <title>Post del giorno</title>
      </Head>

      <div className="w-full max-w-[96vw] mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Post del giorno
            </h1>
            <p className="text-gray-500 mt-1">
              Bacheca personale delle attività operative giornaliere.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPosts}
            className="border rounded px-4 py-2 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Aggiorna
          </button>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuovo post
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="border rounded px-3 py-2 md:col-span-2"
              placeholder="Titolo attività..."
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
            />

            <select
              className="border rounded px-3 py-2"
              value={priorita}
              onChange={(e) => setPriorita(e.target.value)}
            >
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Bassa">Bassa</option>
            </select>

            <input
              type="date"
              className="border rounded px-3 py-2"
              value={dataRiferimento}
              onChange={(e) => setDataRiferimento(e.target.value)}
            />
          </div>

          <textarea
            className="border rounded px-3 py-2 w-full mt-3 min-h-[80px]"
            placeholder="Descrizione / note operative..."
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
          />

          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={creaPost}
              disabled={saving}
              className="bg-black text-white rounded px-5 py-2 disabled:opacity-50"
            >
              {saving ? "Salvataggio..." : "Salva post"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Caricamento...</div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
            Nessun post attivo per oggi.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className={`rounded-lg border-l-4 p-4 shadow-sm ${colorePriorita(
                  post.priorita
                )}`}
              >
                <div className="flex justify-between gap-2">
                  <div>
                   <div className="text-xs uppercase font-bold opacity-90">
  {post.priorita || "Media"}
</div>
                    <h3 className="font-bold text-lg mt-1">{post.titolo}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => eliminaPost(post.id)}
                    className="bg-white/90 text-red-600 hover:text-red-800 rounded p-2"
                    title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {post.descrizione && (
                 <p className="text-sm font-medium mt-3 whitespace-pre-wrap">
  {post.descrizione}
</p>
                )}

                <div className="text-xs font-semibold mt-4 opacity-90">
                  Data:{" "}
                  {post.data_scadenza
                    ? new Date(post.data_scadenza).toLocaleDateString("it-IT")
                    : "-"}
                </div>

    <button
  type="button"
  onClick={() => completaPost(post.id)}
  className="mt-4 w-full rounded bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-900 px-3 py-2 flex items-center justify-center gap-2 font-semibold"
>
  <Check className="h-4 w-4" />
  Completato
</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
