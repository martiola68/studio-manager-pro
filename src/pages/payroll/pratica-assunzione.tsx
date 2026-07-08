import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldOff,
  Users,
} from "lucide-react";

type Cliente = {
  id: string;
  studio_id: string | null;
  ragione_sociale: string | null;
  email: string | null;
  pec: string | null;
  utente_payroll_id?: string | null;
  attivo?: boolean | null;
};

type Accesso = {
  id: string;
  studio_id: string | null;
  cliente_id: string;
  email_accesso: string;
  attivo: boolean;
  data_attivazione: string | null;
  ultimo_accesso: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default function PraticaAssunzionePage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [accessi, setAccessi] = useState<Accesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [azioneId, setAzioneId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [passwordGenerata, setPasswordGenerata] = useState<string | null>(null);

  const [clienteDaAbilitare, setClienteDaAbilitare] = useState<Cliente | null>(null);
const [emailAccessoModal, setEmailAccessoModal] = useState("");

  async function caricaDati() {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll/accessi-clienti");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Errore caricamento dati");
      }

      setClienti(json.clienti || []);
      setAccessi(json.accessi || []);
    } catch (error: any) {
      alert(error.message || "Errore caricamento dati");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    caricaDati();
  }, []);

  const accessiByCliente = useMemo(() => {
    const map = new Map<string, Accesso>();
    accessi.forEach((a) => map.set(a.cliente_id, a));
    return map;
  }, [accessi]);

  const clientiFiltrati = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return clienti;

    return clienti.filter((c) => {
      return (
        c.ragione_sociale?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.pec?.toLowerCase().includes(q)
      );
    });
  }, [clienti, search]);

function apriModaleAbilita(cliente: Cliente) {
  setClienteDaAbilitare(cliente);
  setEmailAccessoModal(cliente.email || cliente.pec || "");
  setPasswordGenerata(null);
}

  function apriModaleModificaEmail(cliente: Cliente, accesso: Accesso) {
  setClienteDaAbilitare(cliente);
  setEmailAccessoModal(accesso.email_accesso || "");
  setPasswordGenerata(null);
}

function chiudiModaleAbilita() {
  setClienteDaAbilitare(null);
  setEmailAccessoModal("");
}

async function confermaAbilitaAccesso() {
  if (!clienteDaAbilitare) return;

  if (!emailAccessoModal.trim()) {
    alert("Inserire email di accesso.");
    return;
  }

  setAzioneId(clienteDaAbilitare.id);
  setPasswordGenerata(null);

  try {
    const accessoEsistente = accessiByCliente.get(clienteDaAbilitare.id);

    const res = await fetch(
  accessoEsistente
    ? "/api/payroll/accessi-clienti/modifica-email"
    : "/api/payroll/accessi-clienti/abilita",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      accessoEsistente
        ? {
            accesso_id: accessoEsistente.id,
            email_accesso: emailAccessoModal.trim(),
          }
        : {
            cliente_id: clienteDaAbilitare.id,
            email_accesso: emailAccessoModal.trim(),
          }
    ),
  }
);

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Errore abilitazione accesso");
    }

        await caricaDati();
    chiudiModaleAbilita();

   alert("Credenziali generate e inviate correttamente al cliente.");
  } catch (error: any) {
    alert(error.message || "Errore abilitazione accesso");
  } finally {
    setAzioneId(null);
  }
}

  async function reimpostaPassword(accesso: Accesso) {
  const conferma = window.confirm(
    "Vuoi reimpostare la password di accesso per questo cliente?"
  );

  if (!conferma) return;

  setAzioneId(accesso.cliente_id);
  setPasswordGenerata(null);

  try {
    const res = await fetch("/api/payroll/accessi-clienti/reimposta-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accesso_id: accesso.id,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Errore reimpostazione password");
    }

 
    await caricaDati();

  alert(
  "Password rigenerata e nuove credenziali inviate al cliente."
);
  } catch (error: any) {
    alert(error.message || "Errore reimpostazione password");
  } finally {
    setAzioneId(null);
  }
}

async function toggleAccesso(accesso: Accesso) {
  const nuovoStato = !accesso.attivo;

  const conferma = window.confirm(
    nuovoStato
      ? "Vuoi riattivare l'accesso cliente?"
      : "Vuoi disattivare l'accesso cliente?"
  );

  if (!conferma) return;

  setAzioneId(accesso.cliente_id);

  try {
    const res = await fetch("/api/payroll/accessi-clienti/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accesso_id: accesso.id,
        attivo: nuovoStato,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Errore aggiornamento accesso");
    }

    await caricaDati();
  } catch (error: any) {
    alert(error.message || "Errore aggiornamento accesso");
  } finally {
    setAzioneId(null);
  }
}

  async function inviaCredenziali(accesso: Accesso) {
  const conferma = window.confirm(
    `Vuoi inviare le credenziali a ${accesso.email_accesso}?`
  );

  if (!conferma) return;

  setAzioneId(accesso.cliente_id);

  try {
    const res = await fetch("/api/payroll/accessi-clienti/invia-credenziali", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accesso_id: accesso.id,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Errore invio credenziali");
    }

    alert("Credenziali inviate correttamente.");
  } catch (error: any) {
    alert(error.message || "Errore invio credenziali");
  } finally {
    setAzioneId(null);
  }
}

  return (
   <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-3 text-blue-700">
            <Users className="h-6 w-6" />
          </div>

          <div>
          <h1 className="text-2xl font-bold">
          Attivazione credenziali pratiche Payroll
          </h1>
            <p className="text-sm text-gray-600">
              Gestione credenziali di accesso all'Area Cliente per le pratiche Payroll.
            </p>
          </div>
        </div>
      </div>

      {passwordGenerata && (
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          <strong>Password appena generata:</strong>{" "}
          <span className="font-mono text-base">{passwordGenerata}</span>
          <div className="mt-1">
            La password è salvata in forma cifrata e potrà essere recuperata solo dalle funzioni interne autorizzate.
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Accessi clienti</h2>
          <p className="text-sm text-gray-600">
            I clienti sono recuperati da <strong>tbclienti</strong>.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca cliente..."
            className="w-72 rounded-md border px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={caricaDati}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Aggiorna
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Email cliente</th>
              <th className="px-4 py-3 font-semibold">Email accesso</th>
              <th className="px-4 py-3 font-semibold">Stato</th>
              <th className="px-4 py-3 font-semibold">Ultimo accesso</th>
              <th className="px-4 py-3 text-right font-semibold">Azioni</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Caricamento...
                </td>
              </tr>
            ) : clientiFiltrati.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Nessun cliente trovato.
                </td>
              </tr>
            ) : (
              clientiFiltrati.map((cliente) => {
                const accesso = accessiByCliente.get(cliente.id);
                const busy = azioneId === cliente.id;

                return (
                  <tr key={cliente.id} className="border-t">
                    <td className="px-4 py-3 font-medium">
                      {cliente.ragione_sociale || "-"}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {cliente.email || cliente.pec || "-"}
                    </td>

                    <td className="px-4 py-3">
                      {accesso?.email_accesso || "-"}
                    </td>

                    <td className="px-4 py-3">
                      {accesso ? (
                        accesso.attivo ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                            <ShieldCheck className="h-3 w-3" />
                            Attivo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                            <ShieldOff className="h-3 w-3" />
                            Disattivato
                          </span>
                        )
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                          Non abilitato
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {accesso?.ultimo_accesso
                        ? new Date(accesso.ultimo_accesso).toLocaleString("it-IT")
                        : "-"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!accesso ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => apriModaleAbilita(cliente)}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <KeyRound className="h-4 w-4" />
                            Abilita
                          </button>
                        ) : (
                          <>
                            <button
  type="button"
  disabled={busy}
  onClick={() => reimpostaPassword(accesso)}
  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
>
  <RefreshCw className="h-4 w-4" />
  Reimposta
</button>

<button
  type="button"
  disabled={busy}
  onClick={() => toggleAccesso(accesso)}
  className={
    accesso.attivo
      ? "inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
      : "inline-flex items-center gap-2 rounded-md border border-green-300 px-3 py-2 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
  }
>
  {accesso.attivo ? (
    <>
      <ShieldOff className="h-4 w-4" />
      Disattiva
    </>
  ) : (
    <>
      <ShieldCheck className="h-4 w-4" />
      Riattiva
    </>
  )}
</button>

 <button
  type="button"
  disabled={busy}
  onClick={() => apriModaleModificaEmail(cliente, accesso)}
  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
>
  Modifica email
</button>

<button
  type="button"
  disabled={busy || !accesso.attivo}
  onClick={() => inviaCredenziali(accesso)}
  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
>
  <Send className="h-4 w-4" />
  Invia credenziali
</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {clienteDaAbilitare && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
      <h2 className="mb-2 text-xl font-bold">
        Abilita accesso area richieste
      </h2>

      <p className="mb-6 text-sm text-gray-600">
        Imposta l’email che il cliente userà per accedere alla pagina pubblica
        delle richieste di assunzione.
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-semibold">Cliente</label>
        <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
          {clienteDaAbilitare.ragione_sociale || "-"}
        </div>
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-semibold">
          Email accesso
        </label>
        <input
          type="email"
          value={emailAccessoModal}
          onChange={(e) => setEmailAccessoModal(e.target.value)}
          placeholder="email@cliente.it"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Puoi usare un indirizzo diverso da quello presente in anagrafica.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        La password verrà generata automaticamente e le credenziali saranno inviate immediatamente al cliente via email.
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={chiudiModaleAbilita}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Annulla
        </button>

        <button
          type="button"
          disabled={azioneId === clienteDaAbilitare.id}
          onClick={confermaAbilitaAccesso}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Abilita accesso
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
