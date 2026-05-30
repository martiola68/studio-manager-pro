import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Utente = {
  id: string;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
  tipo_utente?: string | null;
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

type RichiestaCambio = {
  id: string;
  gruppo_id: string;
  richiedente_id: string;
  data_richiedente: string;
  sostituto_id?: string | null;
  data_sostituto?: string | null;
  stato: "aperta" | "accettata" | "annullata";
  created_at?: string | null;
  accettata_il?: string | null;
  richiedente?: Utente | null;
};

type CambioState = {
  richiedente_id: string;
  data_richiedente: string;
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

function formatDateIT(value?: string | null) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function giornoLabel(n?: number | null) {
  return giorni.find((g) => g.value === n)?.label || "";
}

function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfISOWeek(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  date.setDate(date.getDate() - isoDay + 1);
  return date;
}

function getWeekRange(value: string) {
  const start = startOfISOWeek(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: toISODate(start),
    end: toISODate(end),
  };
}

function resetCambio(): CambioState {
  return {
    richiedente_id: "",
    data_richiedente: "",
  };
}

export default function SmartWorkingPresenze() {
  const now = new Date();

  const [gruppi, setGruppi] = useState<Gruppo[]>([]);
  const [gruppoSelezionato, setGruppoSelezionato] = useState("");
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [calendario, setCalendario] = useState<RigaCalendario[]>([]);
  const [utenteLoggato, setUtenteLoggato] = useState<Utente | null>(null);
  const [richiestaAperta, setRichiestaAperta] = useState<RichiestaCambio | null>(null);
  const [cambio, setCambio] = useState<CambioState>(resetCambio());
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);

  const loadUtenteLoggato = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email;

    if (!email) {
      setUtenteLoggato(null);
      return;
    }

    const { data, error } = await supabase
      .from("tbutenti")
      .select("id,nome,cognome,email,tipo_utente")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      console.error("Errore caricamento utente loggato", error);
      setUtenteLoggato(null);
      return;
    }

    setUtenteLoggato(data || null);
  }, []);

  const loadGruppi = useCallback(async () => {
    const res = await fetch("/api/presenze/smart/gruppi");
    const data = await res.json();

    if (Array.isArray(data)) {
      setGruppi(data);
      setGruppoSelezionato((current) => current || data[0]?.id || "");
    } else {
      setGruppi([]);
    }
  }, []);

  const loadCalendario = useCallback(async () => {
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
  }, [gruppoSelezionato, anno, mese]);

  const loadRichiestaAperta = useCallback(async () => {
    if (!gruppoSelezionato) {
      setRichiestaAperta(null);
      return;
    }

    const params = new URLSearchParams({ gruppo_id: gruppoSelezionato });
    const res = await fetch(`/api/presenze/smart/richiesta-aperta?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      console.error("Errore caricamento richiesta aperta", data);
      setRichiestaAperta(null);
      return;
    }

    setRichiestaAperta(data?.richiesta || data || null);
  }, [gruppoSelezionato]);

  useEffect(() => {
    async function init() {
      setLoadingPage(true);
      try {
        await Promise.all([loadUtenteLoggato(), loadGruppi()]);
      } finally {
        setLoadingPage(false);
      }
    }

    init();
  }, [loadUtenteLoggato, loadGruppi]);

  useEffect(() => {
    loadCalendario();
    loadRichiestaAperta();
    setCambio(resetCambio());
  }, [loadCalendario, loadRichiestaAperta]);

  const gruppoCorrente = useMemo(() => {
    return gruppi.find((g) => g.id === gruppoSelezionato) || null;
  }, [gruppi, gruppoSelezionato]);

  const utentiCalendario = useMemo(() => {
    const map = new Map<string, Utente>();

    calendario.forEach((r) => {
      if (r.utente) map.set(r.utente_id, { ...r.utente, id: r.utente_id });
    });

    return Array.from(map.values()).sort((a, b) =>
      nomeUtente(a).localeCompare(nomeUtente(b))
    );
  }, [calendario]);

  const utenteLoggatoNelGruppo = useMemo(() => {
    if (!utenteLoggato) return false;
    return utentiCalendario.some((u) => u.id === utenteLoggato.id);
  }, [utentiCalendario, utenteLoggato]);

  const giorniCalendario = useMemo(() => {
    const map = new Map<string, RigaCalendario[]>();

    calendario.forEach((r) => {
      if (!map.has(r.data)) map.set(r.data, []);
      map.get(r.data)!.push(r);
    });

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [calendario]);

  const presenzeRichiedente = useMemo(() => {
    return calendario
      .filter(
        (r) =>
          r.utente_id === cambio.richiedente_id &&
          r.presenza &&
          r.giorno_settimana !== 2
      )
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [calendario, cambio.richiedente_id]);

  const richiedenteRichiesta = useMemo(() => {
    if (!richiestaAperta) return null;

    return (
      richiestaAperta.richiedente ||
      utentiCalendario.find((u) => u.id === richiestaAperta.richiedente_id) ||
      null
    );
  }, [richiestaAperta, utentiCalendario]);

  const rigaRichiesta = useMemo(() => {
    if (!richiestaAperta) return null;
    return calendario.find(
      (r) =>
        r.utente_id === richiestaAperta.richiedente_id &&
        r.data === richiestaAperta.data_richiedente
    );
  }, [calendario, richiestaAperta]);

  const calcolaDataSostitutoProposta = useCallback(() => {
    if (!richiestaAperta || !utenteLoggato) return "";
    if (utenteLoggato.id === richiestaAperta.richiedente_id) return "";

    const range = getWeekRange(richiestaAperta.data_richiedente);

    const presenzeUtili = calendario
      .filter(
        (r) =>
          r.utente_id === utenteLoggato.id &&
          r.presenza &&
          r.giorno_settimana !== 2 &&
          r.data >= range.start &&
          r.data <= range.end &&
          r.data !== richiestaAperta.data_richiedente
      )
      .sort((a, b) => a.data.localeCompare(b.data));

    return presenzeUtili[0]?.data || "";
  }, [calendario, richiestaAperta, utenteLoggato]);

  const dataSostitutoProposta = useMemo(() => {
    return calcolaDataSostitutoProposta();
  }, [calcolaDataSostitutoProposta]);

  const puoRichiedereCambio = Boolean(
    !richiestaAperta && utenteLoggato && utenteLoggatoNelGruppo
  );

  const confermaAbilitata = Boolean(
    richiestaAperta &&
      utenteLoggato &&
      utenteLoggatoNelGruppo &&
      utenteLoggato.id !== richiestaAperta.richiedente_id &&
      dataSostitutoProposta
  );

  async function richiediCambioTurno() {
    if (!gruppoSelezionato || !cambio.richiedente_id || !cambio.data_richiedente) {
      alert("Seleziona dipendente richiedente e giorno da cambiare.");
      return;
    }

    const riga = calendario.find(
      (r) => r.utente_id === cambio.richiedente_id && r.data === cambio.data_richiedente
    );

    if (!riga?.presenza) {
      alert("Il richiedente deve essere presente nel giorno selezionato.");
      return;
    }

    if (riga.giorno_settimana === 2) {
      alert("Il martedì fisso non può essere cambiato.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/presenze/smart/richiedi-cambio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gruppo_id: gruppoSelezionato,
          richiedente_id: cambio.richiedente_id,
          data_richiedente: cambio.data_richiedente,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Errore durante la richiesta di cambio turno.");
        return;
      }

      setCambio(resetCambio());
      await Promise.all([loadRichiestaAperta(), loadCalendario()]);
    } finally {
      setLoading(false);
    }
  }

  async function confermaCambioTurno() {
    if (!richiestaAperta || !utenteLoggato || !dataSostitutoProposta) {
      alert("Non ci sono le condizioni per confermare il cambio turno.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/presenze/smart/cambio-turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          richiesta_id: richiestaAperta.id,
          sostituto_id: utenteLoggato.id,
          data_sostituto: dataSostitutoProposta,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Errore durante la conferma del cambio turno.");
        return;
      }

      setCambio(resetCambio());
      await Promise.all([loadRichiestaAperta(), loadCalendario()]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Smart working - Presenze</h1>
        <p className="text-sm text-gray-600">
          Calendario presenze smart working e workflow richiesta/accettazione cambio turno.
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
            Giorno fisso: <strong>{giornoLabel(gruppoCorrente.giorno_fisso)}</strong> ·{" "}
            Presenze settimanali: <strong>{gruppoCorrente.presenze_settimanali}</strong>
          </div>
        )}
      </div>

      <div className="border rounded-lg bg-white p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Cambio turno</h2>
            <p className="text-sm text-gray-600">
              Il cambio passa da richiesta aperta e viene confermato da un altro membro del gruppo.
            </p>
          </div>

          {utenteLoggato && (
            <div className="text-sm text-gray-600 text-right">
              Utente loggato:
              <div className="font-medium text-gray-900">{nomeUtente(utenteLoggato)}</div>
            </div>
          )}
        </div>

        {!richiestaAperta && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Dipendente richiedente</label>
              <select
                className="border p-2 rounded w-full disabled:bg-gray-100 disabled:text-gray-500"
                value={cambio.richiedente_id}
                onChange={(e) =>
                  setCambio({
                    richiedente_id: e.target.value,
                    data_richiedente: "",
                  })
                }
                disabled={!puoRichiedereCambio}
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
              <label className="block text-sm font-medium mb-1">Giorno da cambiare</label>
              <select
                className="border p-2 rounded w-full disabled:bg-gray-100 disabled:text-gray-500"
                value={cambio.data_richiedente}
                onChange={(e) => setCambio({ ...cambio, data_richiedente: e.target.value })}
                disabled={!puoRichiedereCambio || !cambio.richiedente_id}
              >
                <option value="">Seleziona</option>
                {presenzeRichiedente.map((r) => (
                  <option key={r.id} value={r.data}>
                    {formatDateIT(r.data)} - {giornoLabel(r.giorno_settimana)}
                    {r.festivo ? " - festivo" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={richiediCambioTurno}
              disabled={loading || !puoRichiedereCambio || !gruppoSelezionato || !cambio.richiedente_id || !cambio.data_richiedente}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Richiedi cambio
            </button>
          </div>
        )}

        {!richiestaAperta && utenteLoggato && !utenteLoggatoNelGruppo && (
          <div className="text-sm text-gray-600">
            Non fai parte del gruppo selezionato: puoi consultare il calendario, ma non puoi richiedere cambi turno.
          </div>
        )}

        {richiestaAperta && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              È presente una richiesta aperta. Il primo membro del gruppo disponibile può confermarla.
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Richiedente</label>
                <input
                  className="border p-2 rounded w-full bg-gray-100"
                  value={nomeUtente(richiedenteRichiesta)}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Giorno richiesto</label>
                <input
                  className="border p-2 rounded w-full bg-gray-100"
                  value={`${formatDateIT(richiestaAperta.data_richiedente)}${
                    rigaRichiesta?.giorno_settimana
                      ? ` - ${giornoLabel(rigaRichiesta.giorno_settimana)}`
                      : ""
                  }`}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Sostituto</label>
                <input
                  className="border p-2 rounded w-full bg-gray-100"
                  value={utenteLoggato ? nomeUtente(utenteLoggato) : "Utente non riconosciuto"}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Giorno sostituto</label>
                <input
                  className="border p-2 rounded w-full bg-gray-100"
                  value={dataSostitutoProposta ? formatDateIT(dataSostitutoProposta) : "Nessun giorno utile"}
                  readOnly
                />
              </div>

              <button
                type="button"
                onClick={confermaCambioTurno}
                disabled={loading || !confermaAbilitata}
                className="bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                Conferma cambio
              </button>
            </div>

            {!confermaAbilitata && (
              <div className="text-sm text-gray-600">
                Il cambio è confermabile solo da un membro del gruppo diverso dal richiedente e con una presenza utile nella stessa settimana, escluso il martedì.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border rounded-lg bg-white overflow-auto max-h-[70vh]">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="border p-2 text-left min-w-[120px] bg-gray-100">Data</th>
              <th className="border p-2 text-left min-w-[150px] bg-gray-100">Giorno</th>
              {utentiCalendario.map((u) => (
                <th key={u.id} className="border p-2 text-center min-w-[150px] bg-gray-100">
                  {nomeUtente(u)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loadingPage && (
              <tr>
                <td colSpan={2 + utentiCalendario.length} className="p-6 text-center text-gray-500">
                  Caricamento...
                </td>
              </tr>
            )}

            {!loadingPage && giorniCalendario.length === 0 && (
              <tr>
                <td colSpan={2 + utentiCalendario.length} className="p-6 text-center text-gray-500">
                  Nessun calendario generato per il mese selezionato.
                </td>
              </tr>
            )}

            {!loadingPage &&
              giorniCalendario.map(([data, righe]) => {
                const first = righe[0];
                const festivo = righe.some((r) => r.festivo);
                const notaFestivo = righe.find((r) => r.festivo && r.nota)?.nota;

                return (
                  <tr key={data}>
                    <td className={`border p-2 font-medium ${festivo ? "bg-gray-800 text-white" : ""}`}>
                      {formatDateIT(data)}
                    </td>
                    <td className={`border p-2 ${festivo ? "bg-gray-800 text-white" : ""}`}>
                      {giornoLabel(first.giorno_settimana)}
                      {festivo && (
                        <div className="text-xs text-red-300 font-semibold">
                          {notaFestivo || "Festivo"}
                        </div>
                      )}
                    </td>

                    {utentiCalendario.map((u) => {
                      const r = righe.find((x) => x.utente_id === u.id);
                      const presente = Boolean(r?.presenza);

                      return (
                        <td
                          key={u.id}
                          className={
                            "border p-2 text-center " +
                            (festivo
                              ? "bg-gray-800 text-white"
                              : presente
                              ? "bg-green-100 text-green-900 font-semibold"
                              : "bg-gray-100 text-gray-400")
                          }
                        >
                          {presente ? "Presenza" : ""}
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
