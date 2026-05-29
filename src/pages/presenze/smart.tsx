import { useEffect, useMemo, useState } from "react";

type Utente = {
  id: string;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
};

type Gruppo = {
  id: string;
  settore: string;
  nome_gruppo: string;
  giorno_fisso: number;
  presenze_settimanali: number;
};

type RigaCalendario = {
  id: string;
  gruppo_id: string;
  utente_id: string;
  data: string;
  anno: number;
  mese: number;
  giorno_settimana: number;
  presenza: boolean;
  festivo: boolean;
  nota?: string | null;
  utente?: Utente;
};

const giorni = [
  { value: 1, label: "Lunedì" },
  { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" },
  { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" },
];

const mesi = [
  { value: 1, label: "Gennaio" },
  { value: 2, label: "Febbraio" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Aprile" },
  { value: 5, label: "Maggio" },
  { value: 6, label: "Giugno" },
  { value: 7, label: "Luglio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Settembre" },
  { value: 10, label: "Ottobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Dicembre" },
];

function nomeUtente(u?: Utente | null) {
  if (!u) return "";
  return [u.nome, u.cognome].filter(Boolean).join(" ") || u.email || "";
}

function formatDateIT(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function giornoLabel(n: number) {
  return giorni.find((g) => g.value === n)?.label || "";
}

export default function SmartWorkingPresenze() {
  const now = new Date();

  const [gruppi, setGruppi] = useState<Gruppo[]>([]);
  const [gruppoSelezionato, setGruppoSelezionato] = useState("");
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [calendario, setCalendario] = useState<RigaCalendario[]>([]);
  const [loading, setLoading] = useState(false);

  const [cambio, setCambio] = useState({
    richiedente_id: "",
    data_richiedente: "",
    sostituto_id: "",
    data_sostituto: "",
  });

  async function loadGruppi() {
    const res = await fetch("/api/presenze/smart/gruppi");
    const data = await res.json();

    if (Array.isArray(data)) {
      setGruppi(data);
      if (!gruppoSelezionato && data.length > 0) {
        setGruppoSelezionato(data[0].id);
      }
    }
  }

  async function loadCalendario() {
    if (!gruppoSelezionato) {
      setCalendario([]);
      return;
    }

    const params = new URLSearchParams({
      gruppo_id: gruppoSelezionato,
      anno: String(anno),
      mese: String(mese),
    });

    const res = await fetch(`/api/presenze/smart/calendario?${params.toString()}`);
    const data = await res.json();

    setCalendario(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadGruppi();
  }, []);

  useEffect(() => {
    loadCalendario();
  }, [gruppoSelezionato, anno, mese]);

  const gruppoCorrente = useMemo(() => {
    return gruppi.find((g) => g.id === gruppoSelezionato) || null;
  }, [gruppi, gruppoSelezionato]);

  const utentiCalendario = useMemo(() => {
    const map = new Map<string, Utente>();

    calendario.forEach((r) => {
      if (r.utente) map.set(r.utente_id, r.utente);
    });

    return Array.from(map.values()).sort((a, b) =>
      nomeUtente(a).localeCompare(nomeUtente(b))
    );
  }, [calendario]);

  const giorniCalendario = useMemo(() => {
    const map = new Map<string, RigaCalendario[]>();

    calendario.forEach((r) => {
      if (!map.has(r.data)) map.set(r.data, []);
      map.get(r.data)!.push(r);
    });

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [calendario]);

  const presenzeRichiedente = useMemo(() => {
    return calendario.filter(
      (r) => r.utente_id === cambio.richiedente_id && r.presenza && !r.festivo
    );
  }, [calendario, cambio.richiedente_id]);

  const presenzeSostituto = useMemo(() => {
    return calendario.filter(
      (r) => r.utente_id === cambio.sostituto_id && r.presenza && !r.festivo
    );
  }, [calendario, cambio.sostituto_id]);

  async function confermaCambioTurno() {
    if (
      !gruppoSelezionato ||
      !cambio.richiedente_id ||
      !cambio.data_richiedente ||
      !cambio.sostituto_id ||
      !cambio.data_sostituto
    ) {
      alert("Compila tutti i campi del cambio turno");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/presenze/smart/cambio-turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gruppo_id: gruppoSelezionato,
          ...cambio,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Errore cambio turno");
        return;
      }

      setCambio({
        richiedente_id: "",
        data_richiedente: "",
        sostituto_id: "",
        data_sostituto: "",
      });

      await loadCalendario();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Smart working - Presenze</h1>
        <p className="text-sm text-gray-600">
          Calendario presenze smart working e gestione cambi turno.
        </p>
      </div>

      <div className="border rounded-lg bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-sm font-medium mb-1">Gruppo</label>
            <select
              className="border p-2 rounded w-full"
              value={gruppoSelezionato}
              onChange={(e) => setGruppoSelezionato(e.target.value)}
            >
              <option value="">Seleziona gruppo</option>
              {gruppi.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome_gruppo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mese</label>
            <select
              className="border p-2 rounded"
              value={mese}
              onChange={(e) => setMese(Number(e.target.value))}
            >
              {mesi.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Anno</label>
            <input
              type="number"
              className="border p-2 rounded w-28"
              value={anno}
              onChange={(e) => setAnno(Number(e.target.value))}
            />
          </div>
        </div>

        {gruppoCorrente && (
          <div className="text-sm text-gray-600">
            Giorno fisso: <strong>{giornoLabel(gruppoCorrente.giorno_fisso)}</strong> ·
            Presenze settimanali: <strong>{gruppoCorrente.presenze_settimanali}</strong>
          </div>
        )}
      </div>

      <div className="border rounded-lg bg-white p-4 space-y-4">
        <h2 className="font-semibold">Cambio turno</h2>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">
              Dipendente richiedente
            </label>
            <select
              className="border p-2 rounded w-full"
              value={cambio.richiedente_id}
              onChange={(e) =>
                setCambio({
                  ...cambio,
                  richiedente_id: e.target.value,
                  data_richiedente: "",
                })
              }
            >
              <option value="">Seleziona</option>
              {utentiCalendario.map((u) => (
                <option key={u.id} value={u.id}>
                  {nomeUtente(u)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Giorno da cambiare
            </label>
            <select
              className="border p-2 rounded w-full"
              value={cambio.data_richiedente}
              onChange={(e) =>
                setCambio({ ...cambio, data_richiedente: e.target.value })
              }
            >
              <option value="">Seleziona</option>
              {presenzeRichiedente.map((r) => (
                <option key={r.id} value={r.data}>
                  {formatDateIT(r.data)} - {giornoLabel(r.giorno_settimana)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Dipendente sostituto
            </label>
            <select
              className="border p-2 rounded w-full"
              value={cambio.sostituto_id}
              onChange={(e) =>
                setCambio({
                  ...cambio,
                  sostituto_id: e.target.value,
                  data_sostituto: "",
                })
              }
            >
              <option value="">Seleziona</option>
              {utentiCalendario
                .filter((u) => u.id !== cambio.richiedente_id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {nomeUtente(u)}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Giorno del sostituto
            </label>
            <select
              className="border p-2 rounded w-full"
              value={cambio.data_sostituto}
              onChange={(e) =>
                setCambio({ ...cambio, data_sostituto: e.target.value })
              }
            >
              <option value="">Seleziona</option>
              {presenzeSostituto.map((r) => (
                <option key={r.id} value={r.data}>
                  {formatDateIT(r.data)} - {giornoLabel(r.giorno_settimana)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={confermaCambioTurno}
            disabled={loading}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Conferma cambio
          </button>
        </div>
      </div>

      <div className="border rounded-lg bg-white overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="border p-2 text-left min-w-[120px]">Data</th>
              <th className="border p-2 text-left min-w-[120px]">Giorno</th>
              {utentiCalendario.map((u) => (
                <th key={u.id} className="border p-2 text-center min-w-[140px]">
                  {nomeUtente(u)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {giorniCalendario.length === 0 && (
              <tr>
                <td
                  colSpan={2 + utentiCalendario.length}
                  className="p-6 text-center text-gray-500"
                >
                  Nessun calendario generato per il mese selezionato.
                </td>
              </tr>
            )}

            {giorniCalendario.map(([data, righe]) => {
              const first = righe[0];

              return (
                <tr key={data} className={first.festivo ? "bg-gray-100" : ""}>
                  <td className="border p-2 font-medium">{formatDateIT(data)}</td>
                  <td className="border p-2">
                    {giornoLabel(first.giorno_settimana)}
                    {first.festivo && (
                      <div className="text-xs text-red-600">
                        {first.nota || "Festivo"}
                      </div>
                    )}
                  </td>

                  {utentiCalendario.map((u) => {
                    const r = righe.find((x) => x.utente_id === u.id);

                    return (
                      <td
                        key={u.id}
                        className={
                          "border p-2 text-center " +
                          (first.festivo
                            ? "bg-gray-200 text-gray-500"
                            : r?.presenza
                            ? "bg-green-50 font-semibold"
                            : "text-gray-400")
                        }
                      >
                        {first.festivo ? "" : r?.presenza ? "Presenza" : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
