import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Plus, Save, Trash2, ArrowLeft } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Cliente = {
  id: string;
  ragione_sociale: string;
};

type Utente = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

type Soggetto = {
  id?: string;
  ruolo: string;
  nome: string;
  codice_fiscale: string;
  email: string;
  principale: boolean;
  attivo: boolean;
};

const TIPI_INCARICO = [
  { value: "REVISIONE_LEGALE", label: "Revisore legale" },
  { value: "SOCIETA_REVISIONE", label: "Società di revisione" },
  { value: "SINDACO_UNICO", label: "Sindaco unico" },
  { value: "COLLEGIO_SINDACALE", label: "Collegio sindacale" },
  { value: "ORGANO_UNICO_DOPPIA_FUNZIONE", label: "Organo unico doppia funzione" },
  { value: "SINDACO_COLLEGIO_PIU_REVISORE", label: "Sindaco/Collegio + Revisore" },
];

const RUOLI_SOGGETTO = [
  { value: "REVISORE", label: "Revisore" },
  { value: "SOCIETA_REVISIONE", label: "Società di revisione" },
  { value: "SINDACO_UNICO", label: "Sindaco unico" },
  { value: "PRESIDENTE_COLLEGIO", label: "Presidente collegio" },
  { value: "SINDACO_EFFETTIVO", label: "Sindaco effettivo" },
  { value: "SINDACO_SUPPLENTE", label: "Sindaco supplente" },
];

export default function NuovoIncaricoRevisionePage() {
  const router = useRouter();
  const incaricoId = typeof router.query.id === "string" ? router.query.id : null;

  const [studioId, setStudioId] = useState("");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);

  const [clienteId, setClienteId] = useState("");
  const [tipoIncarico, setTipoIncarico] = useState("");
  const [dataNomina, setDataNomina] = useState("");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [responsabileId, setResponsabileId] = useState("");
  const [attivo, setAttivo] = useState(true);
  const [note, setNote] = useState("");

  const [soggetti, setSoggetti] = useState<Soggetto[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadBaseData() {
    const supabase = getSupabaseClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const email = session?.user?.email;
    if (!email) throw new Error("Sessione non trovata.");

    const { data: utente, error: utenteError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("email", email)
      .single();

    if (utenteError) throw utenteError;
    if (!utente?.studio_id) throw new Error("Studio utente non trovato.");

    setStudioId(utente.studio_id);

    const [{ data: clientiData, error: clientiError }, { data: utentiData, error: utentiError }] =
      await Promise.all([
        supabase
          .from("tbclienti")
          .select("id, ragione_sociale")
          .eq("studio_id", utente.studio_id)
          .order("ragione_sociale", { ascending: true }),
        supabase
          .from("tbutenti")
          .select("id, nome, cognome, email")
          .eq("studio_id", utente.studio_id)
          .eq("attivo", true)
          .order("cognome", { ascending: true }),
      ]);

    if (clientiError) throw clientiError;
    if (utentiError) throw utentiError;

    setClienti(clientiData || []);
    setUtenti(utentiData || []);

    return utente.studio_id as string;
  }

  async function loadIncarico(id: string) {
    const res = await fetch(`/api/revisione-controllo/${id}`);
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || "Errore caricamento incarico.");
    }

    const item = json.data;

    setClienteId(item.cliente_id || "");
    setTipoIncarico(item.tipo_incarico || "");
    setDataNomina(item.data_nomina || "");
    setDataInizio(item.data_inizio || "");
    setDataFine(item.data_fine || "");
    setResponsabileId(item.responsabile_id || "");
    setAttivo(item.attivo !== false);
    setNote(item.note || "");

    const soggettiRes = await fetch(`/api/revisione-controllo/soggetti?incarico_id=${id}`);
    const soggettiJson = await soggettiRes.json();

    if (!soggettiRes.ok || !soggettiJson.success) {
      throw new Error(soggettiJson.error || "Errore caricamento soggetti.");
    }

    setSoggetti(
      (soggettiJson.data || []).map((s: any) => ({
        id: s.id,
        ruolo: s.ruolo || "",
        nome: s.nome || "",
        codice_fiscale: s.codice_fiscale || "",
        email: s.email || "",
        principale: !!s.principale,
        attivo: s.attivo !== false,
      }))
    );
  }

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError("");

        await loadBaseData();

        if (incaricoId) {
          await loadIncarico(incaricoId);
        } else {
          setSoggetti([
            {
              ruolo: "",
              nome: "",
              codice_fiscale: "",
              email: "",
              principale: true,
              attivo: true,
            },
          ]);
        }
      } catch (err: any) {
        setError(err?.message || "Errore caricamento pagina.");
      } finally {
        setLoading(false);
      }
    }

    if (router.isReady) init();
  }, [router.isReady, incaricoId]);

  function addSoggetto() {
    setSoggetti((prev) => [
      ...prev,
      {
        ruolo: "",
        nome: "",
        codice_fiscale: "",
        email: "",
        principale: false,
        attivo: true,
      },
    ]);
  }

  function updateSoggetto(index: number, field: keyof Soggetto, value: any) {
    setSoggetti((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeSoggetto(index: number) {
    setSoggetti((prev) => prev.filter((_, i) => i !== index));
  }

  async function salva() {
    try {
      setSaving(true);
      setError("");

      if (!studioId) throw new Error("Studio non trovato.");
      if (!clienteId) throw new Error("Seleziona una società.");
      if (!tipoIncarico) throw new Error("Seleziona il tipo incarico.");
      if (!dataInizio) throw new Error("Inserisci la data inizio.");

      const payload = {
        studio_id: studioId,
        cliente_id: clienteId,
        tipo_incarico: tipoIncarico,
        data_nomina: dataNomina || null,
        data_inizio: dataInizio,
        data_fine: dataFine || null,
        responsabile_id: responsabileId || null,
        attivo,
        note: note || null,
      };

      const res = await fetch(
        incaricoId ? `/api/revisione-controllo/${incaricoId}` : "/api/revisione-controllo",
        {
          method: incaricoId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore salvataggio incarico.");
      }

      const savedId = incaricoId || json.data.id;

      const soggettiRes = await fetch("/api/revisione-controllo/soggetti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incarico_id: savedId,
          soggetti,
        }),
      });

      const soggettiJson = await soggettiRes.json();

      if (!soggettiRes.ok || !soggettiJson.success) {
        throw new Error(soggettiJson.error || "Errore salvataggio soggetti.");
      }

      router.push("/revisione-controllo");
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>{incaricoId ? "Modifica incarico" : "Nuovo incarico"} - Revisione</title>
      </Head>

      <div className="mx-auto max-w-[1400px] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {incaricoId ? "Modifica incarico" : "Nuovo incarico"}
            </h1>
            <p className="text-sm text-gray-500">
              Gestione incarichi di revisione legale, sindaco unico e collegio sindacale.
            </p>
          </div>

          <button
            onClick={() => router.push("/revisione-controllo")}
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Indietro
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">
            Caricamento...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold">Dati incarico</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Società / Cliente
                  </label>
                  <select
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    disabled={!!incaricoId}
                    className="h-10 w-full rounded-md border px-3 text-sm disabled:bg-gray-100"
                  >
                    <option value="">Seleziona società</option>
                    {clienti.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.ragione_sociale}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Tipo incarico
                  </label>
                  <select
                    value={tipoIncarico}
                    onChange={(e) => setTipoIncarico(e.target.value)}
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Seleziona tipo incarico</option>
                    {TIPI_INCARICO.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Data nomina
                  </label>
                  <input
                    type="date"
                    value={dataNomina}
                    onChange={(e) => setDataNomina(e.target.value)}
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Data inizio
                  </label>
                  <input
                    type="date"
                    value={dataInizio}
                    onChange={(e) => setDataInizio(e.target.value)}
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Data fine
                  </label>
                  <input
                    type="date"
                    value={dataFine}
                    onChange={(e) => setDataFine(e.target.value)}
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Responsabile interno
                  </label>
                  <select
                    value={responsabileId}
                    onChange={(e) => setResponsabileId(e.target.value)}
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Nessun responsabile</option>
                    {utenti.map((u) => (
                      <option key={u.id} value={u.id}>
                        {`${u.cognome || ""} ${u.nome || ""}`.trim() || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="attivo"
                    type="checkbox"
                    checked={attivo}
                    onChange={(e) => setAttivo(e.target.checked)}
                  />
                  <label htmlFor="attivo" className="text-sm">
                    Incarico attivo
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Soggetti incaricati</h2>

                <button
                  onClick={addSoggetto}
                  className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Plus size={16} />
                  Aggiungi soggetto
                </button>
              </div>

              <div className="overflow-auto rounded-md border">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Ruolo</th>
                      <th className="p-2 text-left">Nome / Ragione sociale</th>
                      <th className="p-2 text-left">Codice fiscale</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-center">Principale</th>
                      <th className="p-2 text-center">Attivo</th>
                      <th className="p-2 text-center">Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {soggetti.map((s, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">
                          <select
                            value={s.ruolo}
                            onChange={(e) => updateSoggetto(index, "ruolo", e.target.value)}
                            className="h-9 w-full rounded-md border px-2 text-sm"
                          >
                            <option value="">Ruolo</option>
                            {RUOLI_SOGGETTO.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2">
                          <input
                            value={s.nome}
                            onChange={(e) => updateSoggetto(index, "nome", e.target.value)}
                            className="h-9 w-full rounded-md border px-2 text-sm"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            value={s.codice_fiscale}
                            onChange={(e) =>
                              updateSoggetto(index, "codice_fiscale", e.target.value)
                            }
                            className="h-9 w-full rounded-md border px-2 text-sm"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            value={s.email}
                            onChange={(e) => updateSoggetto(index, "email", e.target.value)}
                            className="h-9 w-full rounded-md border px-2 text-sm"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={s.principale}
                            onChange={(e) =>
                              updateSoggetto(index, "principale", e.target.checked)
                            }
                          />
                        </td>

                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={s.attivo}
                            onChange={(e) => updateSoggetto(index, "attivo", e.target.checked)}
                          />
                        </td>

                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeSoggetto(index)}
                            className="rounded-md border bg-white p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => router.push("/revisione-controllo")}
                className="rounded-md border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              >
                Annulla
              </button>

              <button
                onClick={salva}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Salvataggio..." : "Salva incarico"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
