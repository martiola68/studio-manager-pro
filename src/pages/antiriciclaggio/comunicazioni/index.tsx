import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ComunicazioneRow = {
  id: string;
  studio_id: string;
  tipo_comunicazione: "richiesta_documento" | "invio_av4";
  cliente_id?: string | null;
  rapp_legale_id?: string | null;
  av4_id?: string | null;
  destinatario_email?: string | null;
  oggetto?: string | null;
  body_preview?: string | null;
  stato_invio: "inviata" | "errore";
  data_invio: string;
  utente_id?: string | null;
  public_token?: string | null;
  note?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("it-IT");
}

function getTipoLabel(tipo: ComunicazioneRow["tipo_comunicazione"]) {
  if (tipo === "richiesta_documento") return "Richiesta documento";
  if (tipo === "invio_av4") return "Invio AV4";
  return tipo;
}

export default function ComunicazioniAMLPage() {
  const [rows, setRows] = useState<ComunicazioneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;
      const studioId = await getStudioId();

      if (!studioId) {
        throw new Error("Studio non disponibile.");
      }

      const { data, error } = await supabase
        .from("tbAMLComunicazioni")
        .select("*")
        .eq("studio_id", studioId)
        .order("data_invio", { ascending: false });

      if (error) throw new Error(error.message);

      setRows((data || []) as ComunicazioneRow[]);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento comunicazioni.");
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

    return rows.filter((row) => {
      const matchTipo = !tipoFiltro || row.tipo_comunicazione === tipoFiltro;

      const matchSearch =
        !q ||
        [
          row.destinatario_email,
          row.oggetto,
          row.body_preview,
          row.note,
          row.stato_invio,
          row.tipo_comunicazione,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));

      return matchTipo && matchSearch;
    });
  }, [rows, search, tipoFiltro]);

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Antiriciclaggio • Comunicazioni inviate</CardTitle>
          <p className="text-sm text-muted-foreground">
            Storico email inviate per richiesta documenti e compilazione AV4.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              type="text"
              placeholder="Cerca per email, oggetto, note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="w-full rounded-md border px-3 py-2"
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
            >
              <option value="">Tutti i tipi</option>
              <option value="richiesta_documento">Richiesta documento</option>
              <option value="invio_av4">Invio AV4</option>
            </select>
          </div>

          {!!error && <p className="text-sm text-red-600">Errore: {error}</p>}

          <div className="overflow-hidden rounded-md border">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Data invio</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Destinatario</th>
                  <th className="px-4 py-3 font-medium">Oggetto</th>
                  <th className="px-4 py-3 font-medium">Stato</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Caricamento...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Nessuna comunicazione trovata.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3">{formatDateTime(row.data_invio)}</td>
                      <td className="px-4 py-3">{getTipoLabel(row.tipo_comunicazione)}</td>
                      <td className="px-4 py-3">{row.destinatario_email || "-"}</td>
                      <td className="px-4 py-3">{row.oggetto || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={row.stato_invio === "inviata" ? "text-green-600" : "text-red-600"}>
                          {row.stato_invio}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.note || row.body_preview || "-"}</td>
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
