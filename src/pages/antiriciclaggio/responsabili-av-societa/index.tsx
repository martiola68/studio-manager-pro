import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SocietaRow = {
  id: string;
  Denominazione: string;
  codice_fiscale: string;
};

export default function ResponsabiliAVSocietaIndexPage() {
  const [rows, setRows] = useState<SocietaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const studioId = await getStudioId();

      if (!studioId) {
        throw new Error("Studio non disponibile.");
      }

      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase
        .from("tbRespAVSocieta")
        .select("id, Denominazione, codice_fiscale")
        .eq("studio_id", studioId)
        .order("Denominazione", { ascending: true });

      if (error) throw new Error(error.message);

      setRows(data || []);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento società.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const conferma = window.confirm("Vuoi eliminare questa società?");
    if (!conferma) return;

    setError(null);

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase
        .from("tbRespAVSocieta")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);

      await loadRows();
    } catch (err: any) {
      setError(err?.message || "Errore eliminazione società.");
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Società responsabili adeguata verifica</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Elenco delle società collegate ai responsabili dell’adeguata verifica.
            </p>
          </div>

          <Button asChild>
            <Link href="/antiriciclaggio/responsabili-av-societa/nuovo">
              Nuova società
            </Link>
          </Button>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p>Caricamento...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna società presente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-4 py-3 text-sm font-medium">Denominazione</th>
                    <th className="px-4 py-3 text-sm font-medium">Codice fiscale</th>
                    <th className="px-4 py-3 text-sm font-medium text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-4 py-3 text-sm">{row.Denominazione}</td>
                      <td className="px-4 py-3 text-sm">{row.codice_fiscale}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild type="button" variant="outline" size="sm">
                            <Link
                              href={`/antiriciclaggio/responsabili-av-societa/nuovo?id=${row.id}`}
                            >
                              Modifica
                            </Link>
                          </Button>

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDelete(row.id)}
                          >
                            Elimina
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600">
              Errore: {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
