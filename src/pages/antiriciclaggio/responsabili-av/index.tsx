import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RespAVRow = {
  id: string;
  studio_id: string;
  cognome_nome: string;
  codice_fiscale: string;
  TipoSoggetto: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function ResponsabiliAVPage() {
  const router = useRouter();

  const [rows, setRows] = useState<RespAVRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;
      const studioId = await getStudioId();

      if (!studioId) {
        setRows([]);
        throw new Error("Studio non disponibile.");
      }

      const { data, error } = await supabase
        .from("tbRespAV")
        .select("id, studio_id, cognome_nome, codice_fiscale, TipoSoggetto, created_at, updated_at")
        .eq("studio_id", studioId)
        .order("cognome_nome", { ascending: true });

      if (error) {
        throw new Error(error.message || "Errore caricamento responsabili.");
      }

      setRows((data || []) as RespAVRow[]);
    } catch (err: any) {
      setError(err?.message || "Errore durante il caricamento dei responsabili.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((row) => {
      const values = [row.cognome_nome, row.codice_fiscale, row.TipoSoggetto]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      return values.some((v) => v.includes(q));
    });
  }, [rows, search]);

  const handleDelete = async (id: string) => {
    const ok = window.confirm("Vuoi eliminare questo responsabile adeguata verifica?");
    if (!ok) return;

    setDeletingId(id);
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;

      const { error } = await supabase.from("tbRespAV").delete().eq("id", id);

      if (error) {
        throw new Error(error.message || "Errore eliminazione responsabile.");
      }

      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (err: any) {
      setError(err?.message || "Errore durante l'eliminazione.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Responsabili adeguata verifica</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Elenco dei soggetti incaricati dell’adeguata verifica.
            </p>
          </div>

          <Button asChild>
            <Link href="/antiriciclaggio/responsabili-av/nuovo">
              Nuovo responsabile
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Cerca per nominativo, codice fiscale o tipo soggetto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!!error && (
            <p className="text-sm text-red-600">
              Errore: {error}
            </p>
          )}

          <div className="overflow-hidden rounded-md border">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Cognome e nome</th>
                  <th className="px-4 py-3 font-medium">Codice fiscale</th>
                  <th className="px-4 py-3 font-medium">Tipo soggetto</th>
                  <th className="px-4 py-3 text-right font-medium">Azioni</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      Caricamento...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      Nessun responsabile trovato.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3">{row.cognome_nome}</td>
                      <td className="px-4 py-3">{row.codice_fiscale}</td>
                      <td className="px-4 py-3">{row.TipoSoggetto}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              void router.push(
                                `/antiriciclaggio/responsabili-av/nuovo?id=${row.id}`
                              )
                            }
                          >
                            Modifica
                          </Button>

                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void handleDelete(row.id)}
                            disabled={deletingId === row.id}
                          >
                            {deletingId === row.id ? "Eliminazione..." : "Elimina"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
