import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";

type Utente = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  settore: string | null;
  tipo_rapporto: string | null;
};

type Presenza = {
  id: string;
  utente_id: string;
  data_presenza: string;
  codice_presenza: string;
  note: string | null;
  tbpresenze_codici?: {
    codice: string;
    descrizione: string;
    tipo: string;
  } | null;
};

function toDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDay(date: Date) {
  return date.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function AssenzeSettimanaliPage() {
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState("");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [presenze, setPresenze] = useState<Presenza[]>([]);
  const [settoreFilter, setSettoreFilter] = useState("tutti");
  const [soloAssenti, setSoloAssenti] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const presenzeByUserDate = useMemo(() => {
    const map = new Map<string, Presenza>();

    for (const presenza of presenze) {
      map.set(`${presenza.utente_id}_${presenza.data_presenza}`, presenza);
    }

    return map;
  }, [presenze]);

  const utentiFiltrati = useMemo(() => {
    return utenti.filter((utente) => {
      if (settoreFilter !== "tutti" && utente.settore !== settoreFilter) {
        return false;
      }

      if (!soloAssenti) return true;

      return days.some((day) => {
        const key = `${utente.id}_${toDateInput(day)}`;
        const presenza = presenzeByUserDate.get(key);
        const tipo = presenza?.tbpresenze_codici?.tipo;
        return tipo === "assenza" || tipo === "permesso";
      });
    });
  }, [utenti, settoreFilter, soloAssenti, days, presenzeByUserDate]);

  const riepilogoOggi = useMemo(() => {
    const oggi = toDateInput(new Date());

    let assenze = 0;
    let permessi = 0;
    let presenti = 0;

    for (const utente of utenti) {
      const presenza = presenzeByUserDate.get(`${utente.id}_${oggi}`);
      const tipo = presenza?.tbpresenze_codici?.tipo;

      if (tipo === "assenza") assenze++;
      else if (tipo === "permesso") permessi++;
      else presenti++;
    }

    return {
      presenti,
      assenze,
      permessi,
      totale: utenti.length,
    };
  }, [utenti, presenzeByUserDate]);

  async function loadData(currentStudioId: string, start: Date) {
    const supabase = getSupabaseClient() as any;

    const startStr = toDateInput(start);
    const endStr = toDateInput(addDays(start, 6));

    setLoading(true);

    try {
      const [{ data: utentiData, error: utentiError }, { data: presenzeData, error: presenzeError }] =
        await Promise.all([
          supabase
            .from("tbutenti")
            .select("id, nome, cognome, email, settore, tipo_rapporto")
              .eq("studio_id", currentStudioId)
              .eq("attivo", true)
                .eq("tipo_rapporto", "Dipendente")
              .order("cognome", { ascending: true })

          supabase
            .from("tbpresenze_dipendenti")
            .select(`
              id,
              utente_id,
              data_presenza,
              codice_presenza,
              note,
              tbpresenze_codici (
                codice,
                descrizione,
                tipo
              )
            `)
            .eq("studio_id", currentStudioId)
            .gte("data_presenza", startStr)
            .lte("data_presenza", endStr),
        ]);

      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;

      setUtenti(utentiData || []);
      setPresenze(presenzeData || []);
    } catch (error: any) {
      console.error("Errore caricamento assenze settimanali:", error);
      alert(error?.message || "Errore caricamento assenze settimanali.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const init = async () => {
      const id = await getStudioId();

      if (!id) {
        alert("Studio non trovato.");
        setLoading(false);
        return;
      }

      setStudioId(id);
      await loadData(id, weekStart);
    };

    void init();
  }, []);

  useEffect(() => {
    if (!studioId) return;
    void loadData(studioId, weekStart);
  }, [weekStart, studioId]);

  function getCellClass(tipo?: string) {
    if (tipo === "assenza") return "bg-red-100 text-red-800 border-red-200";
    if (tipo === "permesso") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (tipo === "festivo") return "bg-slate-100 text-slate-600 border-slate-200";
    if (tipo === "presenza") return "bg-green-50 text-green-700 border-green-200";
    return "bg-white text-slate-400 border-slate-200";
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assenze settimanali</h1>
          <p className="text-sm text-slate-500">
            Ferie, permessi e assenze dal{" "}
            <strong>{weekStart.toLocaleDateString("it-IT")}</strong> al{" "}
            <strong>{weekEnd.toLocaleDateString("it-IT")}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            className="rounded border px-4 py-2 hover:bg-slate-50"
          >
            Settimana precedente
          </button>

          <button
            type="button"
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Oggi
          </button>

          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            className="rounded border px-4 py-2 hover:bg-slate-50"
          >
            Settimana successiva
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-slate-500">Dipendenti</div>
          <div className="text-2xl font-bold">{riepilogoOggi.totale}</div>
        </div>

        <div className="rounded-lg border bg-green-50 p-4">
          <div className="text-sm text-green-700">Presenti oggi</div>
          <div className="text-2xl font-bold text-green-700">{riepilogoOggi.presenti}</div>
        </div>

        <div className="rounded-lg border bg-red-50 p-4">
          <div className="text-sm text-red-700">Assenti oggi</div>
          <div className="text-2xl font-bold text-red-700">{riepilogoOggi.assenze}</div>
        </div>

        <div className="rounded-lg border bg-yellow-50 p-4">
          <div className="text-sm text-yellow-700">Permessi oggi</div>
          <div className="text-2xl font-bold text-yellow-700">{riepilogoOggi.permessi}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={settoreFilter}
          onChange={(e) => setSettoreFilter(e.target.value)}
          className="rounded border px-3 py-2"
        >
          <option value="tutti">Tutti i settori</option>
          <option value="Fiscale">Fiscale</option>
          <option value="Lavoro">Lavoro</option>
          <option value="Consulenza">Consulenza</option>
        </select>

        <label className="flex items-center gap-2 rounded border px-3 py-2">
          <input
            type="checkbox"
            checked={soloAssenti}
            onChange={(e) => setSoloAssenti(e.target.checked)}
          />
          Solo chi ha assenze/permessi
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-100 p-3 text-left">
                Dipendente
              </th>

              {days.map((day) => (
                <th key={toDateInput(day)} className="p-3 text-center">
                  {formatDay(day)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center">
                  Caricamento...
                </td>
              </tr>
            ) : utentiFiltrati.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500">
                  Nessun dato per la settimana selezionata.
                </td>
              </tr>
            ) : (
              utentiFiltrati.map((utente) => (
                <tr key={utente.id} className="border-t">
                  <td className="sticky left-0 z-10 bg-white p-3 font-medium">
                    {utente.cognome} {utente.nome}
                    <div className="text-xs font-normal text-slate-500">
                      {utente.settore || "-"} · {utente.tipo_rapporto || "-"}
                    </div>
                  </td>

                  {days.map((day) => {
                    const dateStr = toDateInput(day);
                    const presenza = presenzeByUserDate.get(`${utente.id}_${dateStr}`);
                    const codice = presenza?.codice_presenza || "-";
                    const descrizione = presenza?.tbpresenze_codici?.descrizione || "Nessun dato";
                    const tipo = presenza?.tbpresenze_codici?.tipo;

                    return (
                      <td key={dateStr} className="p-2 text-center">
                        <div
                          className={`rounded border px-2 py-2 text-xs font-semibold ${getCellClass(
                            tipo
                          )}`}
                          title={presenza?.note || descrizione}
                        >
                          <div>{codice}</div>
                          <div className="mt-1 truncate font-normal">
                            {descrizione}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
