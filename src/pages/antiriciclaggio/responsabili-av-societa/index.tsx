import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Societa = {
  id: string;
  Denominazione: string;
  codice_fiscale: string;
};

export default function ResponsabiliAVSocietaIndex() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [societa, setSocieta] = useState<Societa[]>([]);
  const [loading, setLoading] = useState(true);

  const [studioId, setStudioId] = useState<string | null>(null);

  // 🔹 Recupero studio_id (stessa logica usata nel progetto)
  const loadStudio = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;

    if (!userId) return;

    const { data } = await supabase
      .from("tb_studi") // ⚠️ usa lo stesso nome tabella che già utilizzi nel progetto
      .select("id")
      .eq("user_id", userId)
      .single();

    if (data) {
      setStudioId(data.id);
      loadSocieta(data.id);
    }
  };

  // 🔹 Caricamento elenco società
  const loadSocieta = async (studio_id: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("tbRespAVSocieta")
      .select("id, Denominazione, codice_fiscale")
      .eq("studio_id", studio_id)
      .order("Denominazione", { ascending: true });

    if (error) {
      toast.error("Errore caricamento società");
      console.error(error);
    } else {
      setSocieta(data || []);
    }

    setLoading(false);
  };

  // 🔹 Elimina società
  const handleDelete = async (id: string) => {
    if (!confirm("Vuoi eliminare questa società?")) return;

    const { error } = await supabase
      .from("tbRespAVSocieta")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Errore eliminazione");
      console.error(error);
    } else {
      toast.success("Società eliminata");
      if (studioId) loadSocieta(studioId);
    }
  };

  useEffect(() => {
    loadStudio();
  }, []);

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">
          Società Responsabili Adeguata Verifica
        </h1>

        <Button
          onClick={() =>
            router.push(
              "/antiriciclaggio/responsabili-av-societa/nuovo"
            )
          }
        >
          + Nuova società
        </Button>
      </div>

      {/* TABELLA */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-3">Denominazione</th>
              <th className="text-left p-3">Codice Fiscale</th>
              <th className="text-right p-3">Azioni</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-4 text-center">
                  Caricamento...
                </td>
              </tr>
            ) : societa.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-center">
                  Nessuna società presente
                </td>
              </tr>
            ) : (
              societa.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">{s.Denominazione}</td>
                  <td className="p-3">{s.codice_fiscale}</td>

                  <td className="p-3 text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/antiriciclaggio/responsabili-av-societa/nuovo?id=${s.id}`
                        )
                      }
                    >
                      Modifica
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(s.id)}
                    >
                      Elimina
                    </Button>
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
