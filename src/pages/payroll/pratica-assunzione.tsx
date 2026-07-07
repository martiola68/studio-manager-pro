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

  async function abilitaAccesso(cliente: Cliente) {
    const emailDefault = cliente.email || cliente.pec || "";
    const emailAccesso = window.prompt(
      "Email accesso cliente:",
      emailDefault
    );

    if (!emailAccesso) return;

    setAzioneId(cliente.id);
    setPasswordGenerata(null);

    try {
      const res = await fetch("/api/payroll/accessi-clienti/abilita", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cliente_id: cliente.id,
          email_accesso: emailAccesso,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Errore abilitazione accesso");
      }

      setPasswordGenerata(json.password_generata || null);
      await caricaDati();

      alert(
        `Accesso abilitato.\n\nPassword generata: ${
          json.password_generata || "non disponibile"
        }\n\nConservala solo per invio credenziali.`
      );
    } catch (error: any) {
      alert(error.message || "Errore abilitazione accesso");
    } finally {
      setAzioneId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-3 text-blue-700">
            <Users className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold">Pratica assunzione</h1>
            <p className="text-sm text-gray-600">
              Gestione accessi clienti per richieste assunzione online.
            </p>
          </div>
        </div>
      </div>

      {passwordGenerata && (
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          <strong>Password appena generata:</strong>{" "}
          <span className="font-mono text-base">{passwordGenerata}</span>
          <div className="mt-1">
            La password non viene salvata in chiaro. Dopo aver cambiato pagina
            non sarà più visibile.
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
                            onClick={() => abilitaAccesso(cliente)}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <KeyRound className="h-4 w-4" />
                            Abilita
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-400"
                              title="Prossimo step"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Reimposta
                            </button>

                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-400"
                              title="Prossimo step"
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
    </div>
  );
}
