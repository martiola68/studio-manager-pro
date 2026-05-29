import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

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

function giornoLabel(n: number) {
  return giorni.find((g) => g.value === n)?.label || "";
}

export default function SmartGruppi() {
  const now = new Date();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [gruppi, setGruppi] = useState<Gruppo[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [utentiSelezionati, setUtentiSelezionati] = useState<string[]>([]);
  const [utenteDaAggiungere, setUtenteDaAggiungere] = useState("");

  const [gruppoSelezionato, setGruppoSelezionato] = useState("");
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    settore: "Fiscale",
    tipo_rapporto: "Dipendente",
    nome_gruppo: "Turnazione smart working",
    giorno_fisso: 2,
    presenze_settimanali: 2,
  });

  useEffect(() => {
    async function checkAdmin() {
      const supabase = getSupabaseClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }

      const { data } = await supabase
        .from("tbutenti")
        .select("tipo_utente")
        .eq("email", session.user.email)
        .single();

      setIsAdmin(data?.tipo_utente === "Admin");
      setCheckingAdmin(false);
    }

    checkAdmin();
  }, []);

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

  useEffect(() => {
    if (!isAdmin) return;
    loadGruppi();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    loadUtenti();
  }, [isAdmin, form.settore, form.tipo_rapporto]);

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

      alert("Gruppo creato correttamente");
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

      alert("Mese generato correttamente");
    } finally {
      setLoading(false);
    }
  }

  async function eliminaMese() {
    if (!gruppoSelezionato) {
      alert("Seleziona un gruppo");
      return;
    }

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

    alert("Mese eliminato correttamente");
  }

  async function eliminaGruppo() {
    if (!gruppoSelezionato) {
      alert("Seleziona un gruppo");
      return;
    }

    if (
      !confirm(
        "Eliminare definitivamente questo gruppo smart working?\n\nVerranno eliminati anche calendario generato e utenti collegati al gruppo."
      )
    ) {
      return;
    }

    const res = await fetch("/api/presenze/smart/elimina-gruppo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gruppo_id: gruppoSelezionato,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Errore eliminazione gruppo");
      return;
    }

    setGruppoSelezionato("");
    await loadGruppi();

    alert("Gruppo eliminato correttamente");
  }

  if (checkingAdmin) {
    return <div className="p-6">Verifica permessi...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Accesso non autorizzato</h1>
        <p>Questa sezione è riservata agli amministratori.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Creazione gruppi smart working</h1>
        <p className="text-sm text-gray-600">
          Configurazione gruppi, generazione mesi ed eliminazione turnazioni smart.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_1fr] gap-6 items-start">
        <div className="border rounded-lg bg-white p-4 space-y-4">
          <h2 className="font-semibold">Nuovo gruppo</h2>

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
            onChange={(e) => {
              setForm({ ...form, settore: e.target.value });
              setUtentiSelezionati([]);
            }}
          >
            <option value="Fiscale">Fiscale</option>
            <option value="Lavoro">Lavoro</option>
            <option value="Consulenza">Consulenza</option>
            <option value="Amministrazione">Amministrazione</option>
          </select>

          <select
            className="border p-2 rounded w-full"
            value={form.tipo_rapporto}
            onChange={(e) => {
              setForm({ ...form, tipo_rapporto: e.target.value });
              setUtentiSelezionati([]);
            }}
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

        <div className="space-y-4">
          <div className="border rounded-lg bg-white p-4 space-y-4">
            <h2 className="font-semibold">Gestione gruppo esistente</h2>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px_120px_auto_auto_auto] gap-3 items-end">
              <div>
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
                      {g.nome_gruppo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mese</label>
                <select
                  className="border p-2 rounded w-full"
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
                  className="border p-2 rounded w-full"
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
                disabled={loading || !gruppoSelezionato}
                className="border border-red-600 text-red-600 px-4 py-2 rounded disabled:opacity-50"
              >
                Elimina mese
              </button>

              <button
                type="button"
                onClick={eliminaGruppo}
                disabled={loading || !gruppoSelezionato}
                className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                Elimina gruppo
              </button>
            </div>

            {gruppoCorrente && (
              <div className="text-sm text-gray-600">
                Settore: <strong>{gruppoCorrente.settore}</strong> · Giorno fisso:{" "}
                <strong>{giornoLabel(gruppoCorrente.giorno_fisso)}</strong> ·
                Presenze settimanali:{" "}
                <strong>{gruppoCorrente.presenze_settimanali}</strong>
              </div>
            )}
          </div>

          <div className="border rounded-lg bg-white p-4">
            <h2 className="font-semibold mb-3">Gruppi configurati</h2>

            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2 text-left">Nome gruppo</th>
                  <th className="border p-2 text-left">Settore</th>
                  <th className="border p-2 text-left">Tipo rapporto</th>
                  <th className="border p-2 text-left">Giorno fisso</th>
                  <th className="border p-2 text-left">Presenze</th>
                  <th className="border p-2 text-left">Utenti</th>
                </tr>
              </thead>
              <tbody>
                {gruppi.map((g) => (
                  <tr key={g.id}>
                    <td className="border p-2">{g.nome_gruppo}</td>
                    <td className="border p-2">{g.settore}</td>
                    <td className="border p-2">{g.tipo_rapporto || "-"}</td>
                    <td className="border p-2">{giornoLabel(g.giorno_fisso)}</td>
                    <td className="border p-2">{g.presenze_settimanali}</td>
                    <td className="border p-2">
                      {(g.utenti || [])
                        .map((u) => nomeUtente(u.utente))
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                  </tr>
                ))}

                {gruppi.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">
                      Nessun gruppo configurato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
