import { useEffect, useMemo, useState } from "react";

type Utente = {
  id: string;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
  settore?: string | null;
  tipo_rapporto?: string | null;
};

type Gruppo = {
  id: string;
  settore: string;
  tipo_rapporto?: string | null;
  nome_gruppo: string;
  giorno_fisso: number;
  presenze_settimanali: number;
  utenti?: {
    id: string;
    utente_id: string;
    ordine: number;
    utente?: Utente;
  }[];
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
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [utentiSelezionati, setUtentiSelezionati] = useState<string[]>([]);
  const [utenteDaAggiungere, setUtenteDaAggiungere] = useState("");

  const [form, setForm] = useState({
    settore: "Lavoro",
    tipo_rapporto: "Dipendente",
    nome_gruppo: "Turnazione smart working",
    giorno_fisso: 2,
    presenze_settimanali: 2,
  });

  const [gruppoSelezionato, setGruppoSelezionato] = useState("");
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [calendario, setCalendario] = useState<RigaCalendario[]>([]);
  const [loading, setLoading] = useState(false);

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

  async function loadUtenti() {
    const params = new URLSearchParams();

    if (form.settore) params.set("settore", form.settore);
    if (form.tipo_rapporto) params.set("tipo_rapporto", form.tipo_rapporto);

    const res = await fetch(`/api/presenze/smart/utenti?${params.toString()}`);
    const data = await res.json();

    setUtenti(Array.isArray(data) ? data : []);
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
    loadUtenti();
  }, [form.settore, form.tipo_rapporto]);

  useEffect(() => {
    loadCalendario();
  }, [gruppoSelezionato, anno, mese]);

  const utentiDisponibili = useMemo(() => {
    return utenti.filter((u) => !utentiSelezionati.includes(u.id));
  }, [utenti, utentiSelezionati]);

  const utentiNelGruppo = useMemo(() => {
    return utentiSelezionati
      .map((id) => utenti.find((u) => u.id === id))
      .filter(Boolean) as Utente[];
  }, [utenti, utentiSelezionati]);

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

  function aggiungiUtente() {
    if (!utenteDaAggiungere) return;

    setUtentiSelezionati((prev) => [...prev, utenteDaAggiungere]);
    setUtenteDaAggiungere("");
  }

  function rimuoviUtente(id: string) {
    setUtentiSelezionati((prev) => prev.filter((x) => x !== id));
  }

  async function creaGruppo() {
    if (!form.settore || !form.nome_gruppo) {
      alert("Settore e nome gruppo sono obbligatori");
      return;
    }

    if (utentiSelezionati.length === 0) {
      alert("Seleziona almeno un utente");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/presenze/smart/gruppi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          utenti: utentiSelezionati,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Errore creazione gruppo");
        return;
      }

      setUtentiSelezionati([]);
      setGruppoSelezionato(data.id);
      await loadGruppi();
    } finally {
      setLoading(false);
    }
  }

  async function generaMese() {
    if (!gruppoSelezionato) {
      alert("Seleziona un gruppo");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/presenze/smart/genera-mese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gruppo_id: gruppoSelezionato,
          anno,
          mese,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Errore generazione mese");
        return;
      }

      await loadCalendario();
    } finally {
      setLoading(false);
    }
  }

  async function eliminaMese() {
  if (!gruppoSelezionato) return;

  if (!confirm("Eliminare la generazione del mese selezionato?")) return;

  const res = await fetch("/api/presenze/smart/elimina-mese", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gruppo_id: gruppoSelezionato,
      anno,
      mese,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Errore eliminazione mese");
    return;
  }

  await loadCalendario();
}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Smart working - Presenze</h1>
        <p className="text-sm text-gray-600">
          Gestione turnazioni smart working divise per settore e tipo rapporto.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-start">
        <div className="space-y-4">
          <div className="border rounded-lg bg-white p-4 space-y-4">
            <h2 className="font-semibold">Configura gruppo</h2>

            <input
              className="border p-2 rounded w-full"
              placeholder="Nome gruppo"
              value={form.nome_gruppo}
              onChange={(e) =>
                setForm({ ...form, nome_gruppo: e.target.value })
              }
            />

            <select
              className="border p-2 rounded w-full"
              value={form.settore}
              onChange={(e) =>
                setForm({ ...form, settore: e.target.value })
              }
            >
              <option value="Lavoro">Lavoro</option>
              <option value="Fiscale">Fiscale</option>
              <option value="Consulenza">Consulenza</option>
              <option value="Amministrazione">Amministrazione</option>
            </select>

            <select
              className="border p-2 rounded w-full"
              value={form.tipo_rapporto}
              onChange={(e) =>
                setForm({ ...form, tipo_rapporto: e.target.value })
              }
            >
              <option value="">Tutti i rapporti</option>
              <option value="Dipendente">Dipendente</option>
              <option value="Collaboratore">Collaboratore</option>
              <option value="Praticante">Praticante</option>
            </select>

            <select
              className="border p-2 rounded w-full"
              value={form.giorno_fisso}
              onChange={(e) =>
                setForm({ ...form, giorno_fisso: Number(e.target.value) })
              }
            >
              {giorni.map((g) => (
                <option key={g.value} value={g.value}>
                  Giorno fisso: {g.label}
                </option>
              ))}
            </select>

            <select
              className="border p-2 rounded w-full"
              value={form.presenze_settimanali}
              onChange={(e) =>
                setForm({
                  ...form,
                  presenze_settimanali: Number(e.target.value),
                })
              }
            >
              <option value={1}>1 giorno presenza/settimana</option>
              <option value={2}>2 giorni presenza/settimana</option>
              <option value={3}>3 giorni presenza/settimana</option>
            </select>

            <div className="border rounded p-3 space-y-3">
              <h3 className="font-semibold text-sm">Utenti gruppo</h3>

              <div className="flex gap-2">
                <select
                  className="border p-2 rounded flex-1"
                  value={utenteDaAggiungere}
                  onChange={(e) => setUtenteDaAggiungere(e.target.value)}
                >
                  <option value="">Seleziona utente</option>
                  {utentiDisponibili.map((u) => (
                    <option key={u.id} value={u.id}>
                      {nomeUtente(u)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={aggiungiUtente}
                  className="border px-3 py-2 rounded bg-gray-100"
                >
                  Aggiungi
                </button>
              </div>

              {utentiNelGruppo.map((u) => (
                <div
                  key={u.id}
                  className="flex justify-between items-center border rounded px-3 py-2 bg-white"
                >
                  <span>{nomeUtente(u)}</span>

                  <button
                    type="button"
                    onClick={() => rimuoviUtente(u.id)}
                    className="text-red-600 text-sm"
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={creaGruppo}
              disabled={loading}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? "Salvataggio..." : "Crea gruppo"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg bg-white p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[260px]">
                <label className="block text-sm font-medium mb-1">
                  Gruppo
                </label>
                <select
                  className="border p-2 rounded w-full"
                  value={gruppoSelezionato}
                  onChange={(e) => setGruppoSelezionato(e.target.value)}
                >
                  <option value="">Seleziona gruppo</option>
                  {gruppi.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome_gruppo} - {g.settore}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Mese
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Anno
                </label>
                <input
                  type="number"
                  className="border p-2 rounded w-28"
                  value={anno}
                  onChange={(e) => setAnno(Number(e.target.value))}
                />
              </div>

              <button
                type="button"
                onClick={generaMese}
                disabled={loading || !gruppoSelezionato}
                className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
              >
                Genera mese
              </button>

              <button
  type="button"
  onClick={eliminaMese}
  disabled={!gruppoSelezionato}
  className="border border-red-600 text-red-600 px-4 py-2 rounded disabled:opacity-50"
>
  Elimina mese
</button>
            </div>

            {gruppoCorrente && (
              <div className="text-sm text-gray-600">
                Giorno fisso:{" "}
                <strong>{giornoLabel(gruppoCorrente.giorno_fisso)}</strong> ·
                Presenze settimanali:{" "}
                <strong>{gruppoCorrente.presenze_settimanali}</strong>
              </div>
            )}
          </div>

          <div className="border rounded-lg bg-white overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border p-2 text-left min-w-[120px]">
                    Data
                  </th>
                  <th className="border p-2 text-left min-w-[120px]">
                    Giorno
                  </th>
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
                    <tr key={data}>
                      <td className="border p-2 font-medium">
                        {formatDateIT(data)}
                      </td>
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
                              (r?.presenza
                                ? "bg-green-50 font-semibold"
                                : "text-gray-400")
                            }
                          >
                            {r?.presenza ? "Presenza" : ""}
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
      </div>
    </div>
  );
}
