import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Trash2 } from "lucide-react";

type Cliente = {
  id: string;
  cod_cliente?: string | null;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
};

type AV4Info = {
  id?: string;
  av1_id?: string | null;
  Av4InviatoCL?: boolean | null;
  public_sent_at?: string | null;
  compilato_da_cliente?: boolean | null;
};

type AV1Row = {
  id: string;
  studio_id?: string | null;
  cliente_id?: string | null;
  DataVerifica?: string | null;
  ScadenzaVerifica?: string | null;
  AV1Conferma?: boolean | null;
  AV2Generato?: boolean | null;
  AV4Generato?: boolean | null;
  tbclienti?: Cliente | Cliente[] | null;
  av4_info?: AV4Info | AV4Info[] | null;
};

export default function AntiriciclaggioPage() {
  const router = useRouter();

  const [rows, setRows] = useState<AV1Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";

    const normalized = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;

    const [y, m, d] = normalized.split("-");
    if (!y || !m || !d) return dateString;

    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return "-";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("it-IT");
  };

  const getScadenzaStatus = (dateString?: string | null) => {
    if (!dateString) return "none";

    const normalized = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scadenza = new Date(normalized);
    scadenza.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (scadenza.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return "expired";
    if (diffDays <= 90) return "warning";
    return "ok";
  };

  const getAV4Info = (row: AV1Row): AV4Info | null => {
    if (!row.av4_info) return null;
    return Array.isArray(row.av4_info) ? row.av4_info[0] : row.av4_info;
  };

  const getRowClassName = (row: AV1Row) => {
    const scadenzaStatus = getScadenzaStatus(row.ScadenzaVerifica);

    if (scadenzaStatus === "expired") return "bg-red-100";
    if (scadenzaStatus === "warning") return "bg-orange-50";
    if (!row.AV1Conferma || !row.AV2Generato || !row.AV4Generato) {
      return "bg-red-50";
    }

    return "";
  };

  const getScadenzaCellClassName = (dateString?: string | null) => {
    const status = getScadenzaStatus(dateString);

    if (status === "expired") return "text-red-700 font-bold";
    if (status === "warning") return "text-orange-600 font-semibold";

    return "";
  };

  const getStatoInfo = (row: AV1Row) => {
    const scadenzaStatus = getScadenzaStatus(row.ScadenzaVerifica);

    if (scadenzaStatus === "expired") {
      return {
        dotClass: "bg-red-500",
        text: "Scaduta",
        className: "text-red-700 font-bold",
      };
    }

    if (scadenzaStatus === "warning") {
      return {
        dotClass: "bg-orange-500",
        text: "In scadenza",
        className: "text-orange-600 font-semibold",
      };
    }

    if (!row.AV1Conferma) {
      return {
        dotClass: "bg-orange-500",
        text: "AV1 da confermare",
        className: "text-orange-700 font-semibold",
      };
    }

    if (!row.AV2Generato) {
      return {
        dotClass: "bg-red-500",
        text: "AV2 da generare",
        className: "text-red-700 font-semibold",
      };
    }

    if (!getAV4Info(row)?.Av4InviatoCL) {
      return {
        dotClass: "bg-red-500",
        text: "AV4 da generare",
        className: "text-red-700 font-semibold",
      };
    }

    return {
      dotClass: "bg-green-500",
      text: "Completa",
      className: "text-green-700 font-semibold",
    };
  };

  const getIconBorderClass = (enabled: boolean) => {
    return enabled
      ? "border-2 border-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.9)]"
      : "border-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
  };

  const loadRows = async () => {
    try {
      setLoading(true);

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data, error } = await supabaseAny
        .from("tbAV1")
        .select(`
          id,
          studio_id,
          cliente_id,
          DataVerifica,
          ScadenzaVerifica,
          AV1Conferma,
          AV2Generato,
          AV4Generato,
          tbclienti (
            id,
            cod_cliente,
            ragione_sociale,
            codice_fiscale
          ),
          av4_info:tbAV4 (
            id,
            av1_id,
            Av4InviatoCL,
            public_sent_at,
            compilato_da_cliente
          )
        `)
        .order("DataVerifica", { ascending: false });

      if (error) {
        console.error("Errore caricamento tbAV1:", error);
        alert(`Errore caricamento tbAV1: ${error.message}`);
        setRows([]);
        return;
      }

      setRows((data as AV1Row[]) || []);
    } catch (err: any) {
      console.error("Errore loadRows:", err);
      alert(`Errore loadRows: ${err?.message || "errore sconosciuto"}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const getCliente = (row: AV1Row): Cliente | null => {
    if (!row.tbclienti) return null;
    return Array.isArray(row.tbclienti) ? row.tbclienti[0] : row.tbclienti;
  };

  const handleNuovoAV1 = () => {
    router.push("/antiriciclaggio/modello-av1");
  };

  const handleApriAV1 = (id: string) => {
    router.push(`/antiriciclaggio/modello-av1?id=${id}`);
  };

  const handleApriAV2 = async (row: AV1Row) => {
    try {
      setWorkingId(row.id);

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data: av2, error: av2Error } = await supabaseAny
        .from("tbAV2")
        .select("id")
        .eq("av1_id", row.id)
        .maybeSingle();

      if (av2Error) {
        console.error("Errore ricerca AV2:", av2Error);
        alert("Errore durante la ricerca del modello AV2.");
        return;
      }

      if (!row.AV2Generato) {
        const { error: updateError } = await supabaseAny
          .from("tbAV1")
          .update({ AV2Generato: true })
          .eq("id", row.id);

        if (updateError) {
          console.error("Errore aggiornamento AV2Generato:", updateError);
          alert("Errore durante l'aggiornamento del flag AV2.");
          return;
        }
      }

      await loadRows();

      if (av2?.id) {
        router.push(
          `/antiriciclaggio/modello-av2?id=${av2.id}&av1_id=${row.id}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`
        );
      } else {
        router.push(
          `/antiriciclaggio/modello-av2?av1_id=${row.id}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`
        );
      }
    } catch (err: any) {
      console.error("Errore apertura AV2:", err);
      alert(
        `Errore durante l'apertura del modello AV2: ${
          err?.message || "errore sconosciuto"
        }`
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleApriAV4 = async (row: AV1Row) => {
    try {
      setWorkingId(row.id);

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data: av4, error: av4Error } = await supabaseAny
        .from("tbAV4")
        .select("id")
        .eq("av1_id", row.id)
        .maybeSingle();

      if (av4Error) {
        console.error("Errore ricerca AV4:", av4Error);
        alert("Errore durante la ricerca del modello AV4.");
        return;
      }

      if (!row.AV4Generato) {
        const { error: updateError } = await supabaseAny
          .from("tbAV1")
          .update({ AV4Generato: true })
          .eq("id", row.id);

        if (updateError) {
          console.error("Errore aggiornamento AV4Generato:", updateError);
          alert("Errore durante l'aggiornamento del flag AV4.");
          return;
        }
      }

      await loadRows();

      if (av4?.id) {
        router.push(
          `/antiriciclaggio/modello-av4?id=${av4.id}&av1_id=${row.id}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`
        );
      } else {
        router.push(
          `/antiriciclaggio/modello-av4?av1_id=${row.id}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`
        );
      }
    } catch (err: any) {
      console.error("Errore apertura AV4:", err);
      alert(
        `Errore durante l'apertura del modello AV4: ${
          err?.message || "errore sconosciuto"
        }`
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleEliminaCompleto = async (av1Id: string) => {
    const conferma = window.confirm(
      "Vuoi eliminare AV1 e gli eventuali AV2/AV4 collegati?"
    );
    if (!conferma) return;

    try {
      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data: av4Rows, error: av4Error } = await supabaseAny
        .from("tbAV4")
        .select("id")
        .eq("av1_id", av1Id);

      if (av4Error) throw av4Error;

      const av4Ids = (av4Rows || []).map((r: any) => r.id);

      if (av4Ids.length > 0) {
        const { error: titolariError } = await supabaseAny
          .from("tbAV4_titolari")
          .delete()
          .in("av4_id", av4Ids);

        if (titolariError) throw titolariError;

        const { error: deleteAV4Error } = await supabaseAny
          .from("tbAV4")
          .delete()
          .in("id", av4Ids);

        if (deleteAV4Error) throw deleteAV4Error;
      }

      const { error: deleteAV2Error } = await supabaseAny
        .from("tbAV2")
        .delete()
        .eq("av1_id", av1Id);

      if (deleteAV2Error) throw deleteAV2Error;

      const { error: deleteAV1Error } = await supabaseAny
        .from("tbAV1")
        .delete()
        .eq("id", av1Id);

      if (deleteAV1Error) throw deleteAV1Error;

      await loadRows();
    } catch (err: any) {
      console.error("Errore eliminazione completa:", err);
      alert(
        `Errore durante l'eliminazione del record: ${
          err?.message || "errore sconosciuto"
        }`
      );
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Elenco Antiriciclaggio</h1>

        <button
          type="button"
          onClick={handleNuovoAV1}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Nuova pratica
        </button>
      </div>

      {loading ? (
        <div>Caricamento...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Stato</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Codice fiscale</th>
                <th className="p-3 text-left">Data verifica</th>
                <th className="p-3 text-left">Scadenza verifica</th>
                <th className="p-3 text-center">AV1 conferma</th>
                <th className="p-3 text-center">AV2 generato</th>
                <th className="p-2 text-center w-[90px] leading-tight">
  AV4<br />inviato
</th>
                <th className="p-3 text-center">Data invio AV4</th>
                <th className="p-3 text-center">AV4 confermato</th>
                <th className="p-3 text-center">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center">
                    Nessuna pratica presente
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cliente = getCliente(row);
                  const av4Info = getAV4Info(row);
                  const nomeCliente =
                    cliente?.ragione_sociale || cliente?.cod_cliente || "-";
                  const statoInfo = getStatoInfo(row);

                  return (
                    <tr
                      key={row.id}
                      className={`border-t ${getRowClassName(row)}`}
                    >
                      <td className={`p-3 ${statoInfo.className}`}>
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-block h-5 w-5 rounded-full ${statoInfo.dotClass} shadow`}
                          />
                          <span>{statoInfo.text}</span>
                        </div>
                      </td>

                      <td className="p-3">{nomeCliente}</td>
                      <td className="p-3">{cliente?.codice_fiscale || "-"}</td>
                      <td className="p-3">{formatDate(row.DataVerifica)}</td>
                      <td
                        className={`p-3 ${getScadenzaCellClassName(
                          row.ScadenzaVerifica
                        )}`}
                      >
                        {formatDate(row.ScadenzaVerifica)}
                      </td>

                      <td
                          className={`p-2 text-center text-xs font-semibold ${
                          row.AV1Conferma ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {row.AV1Conferma ? "Sì" : "No"}
                      </td>

                      <td
                        className={`p-3 text-center font-semibold ${
                          row.AV2Generato ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {row.AV2Generato ? "Sì" : "No"}
                      </td>

                      <td
                        className={`p-3 text-center font-semibold ${
                          av4Info?.Av4InviatoCL ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {av4Info?.Av4InviatoCL ? "✔" : "✖"}
                      </td>

                      <td className="p-3 text-center">
                        {formatDateTime(av4Info?.public_sent_at)}
                      </td>

                      <td
                        className={`p-3 text-center font-semibold ${
                          av4Info?.compilato_da_cliente ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {av4Info?.compilato_da_cliente ? "Sì" : "No"}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleApriAV1(row.id)}
                            className={`rounded-[28px] bg-white p-1 transition hover:scale-105 ${getIconBorderClass(
                              !!row.AV1Conferma
                            )}`}
                            title="Apri AV1"
                          >
                            <span className="text-blue-600 text-xs font-semibold">
                              AV1
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApriAV2(row)}
                            disabled={workingId === row.id}
                            className={`rounded-[28px] bg-white p-1 transition hover:scale-105 disabled:opacity-60 ${getIconBorderClass(
                              !!row.AV2Generato
                            )}`}
                            title="Apri AV2"
                          >
                            <span className="text-blue-600 text-xs font-semibold">
                              AV2
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApriAV4(row)}
                            disabled={workingId === row.id}
                            className={`rounded-[28px] bg-white p-1 transition hover:scale-105 disabled:opacity-60 ${getIconBorderClass(
                              !!row.AV4Generato
                            )}`}
                            title="Apri AV4"
                          >
                            <span className="text-blue-600 text-xs font-semibold">
                              AV4
                            </span>
                          </button>

                          <button
  type="button"
  onClick={() => handleEliminaCompleto(row.id)}
  className="flex h-8 w-8 items-center justify-center rounded-full bg-white transition hover:scale-105 ml-2"
  title="Elimina record completo"
>
                            <Trash2 className="h-4 w-4 text-red-500" strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
