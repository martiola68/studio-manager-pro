import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Cliente = {
  id: string;
  ragione_sociale: string | null;
};

type TipoAtto = {
  id: string;
  descrizione: string;
  giorni_scadenza: number;
};

type Utente = {
  id: string;
  nome: string | null;
  cognome: string | null;
};

type TributoConstatazione = {
  id: string;
  descrizione: string;
};

type Tributo = {
  id: string;
  tributo: string;
  descrizione: string;
};

type RigaTributo = {
  anno: string;
  codice_tributo_id: string;
  importo: string;
  imposta: boolean;
};

export default function NuovoAtto() {
  const router = useRouter();

  const [studioId, setStudioId] = useState("");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [tipiAtto, setTipiAtto] = useState<TipoAtto[]>([]);
  const [tributiConstatazione, setTributiConstatazione] = useState<
    TributoConstatazione[]
  >([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [tributi, setTributi] = useState<Tributo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

  const [form, setForm] = useState({
    cliente_id: "",
    tipo_atto_id: "",
    tributo_constatazione_id: "",
    numero_atto: "",
    anno_riferimento: "",
    data_ricezione: "",
    professionista_incaricato_id: "",
    referente_id: "",
    descrizione: "",
    valore_pratica: "",
    note: "",
    esito: "Pratica aperta",
    errore_studio: false,
    comunicato: false,
    pratica_chiusa: false,
    data_comunicazione: "",
  });

  const [righe, setRighe] = useState<RigaTributo[]>([]);

  const tipoSelezionato = useMemo(() => {
    return tipiAtto.find((t) => t.id === form.tipo_atto_id) || null;
  }, [tipiAtto, form.tipo_atto_id]);

  const dataScadenzaCalcolata = useMemo(() => {
    if (!form.data_ricezione || !tipoSelezionato?.giorni_scadenza) return "";

    const data = new Date(form.data_ricezione);
    data.setDate(data.getDate() + tipoSelezionato.giorni_scadenza);

    return data.toISOString().split("T")[0];
  }, [form.data_ricezione, tipoSelezionato]);

  useEffect(() => {
    loadData();
  }, []);

  const getUtenteLabel = (utente: Utente) => {
    return `${utente.nome || ""} ${utente.cognome || ""}`.trim() || "Utente";
  };

  const handleChange = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const loadData = async () => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.email) {
        const { data: utente, error: utenteError } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("email", session.user.email)
          .maybeSingle();

        if (utenteError) {
          console.error(utenteError);
        }

        if ((utente as any)?.studio_id) {
          setStudioId((utente as any).studio_id);
        }
      }

      const [
        clientiRes,
        tipiRes,
        tributiConstatazioneRes,
        utentiRes,
        tributiRes,
      ] = await Promise.all([
        supabase
          .from("tbclienti")
          .select("id, ragione_sociale")
          .order("ragione_sociale", { ascending: true }),

        (supabase as any)
          .from("tbcontenzioso_tipi_atto")
          .select("id, descrizione, giorni_scadenza")
          .eq("attivo", true)
          .order("descrizione", { ascending: true }),

        (supabase as any)
          .from("tbcontenzioso_tributi_constatazione")
          .select("id, descrizione")
          .eq("attivo", true)
          .order("ordine", { ascending: true }),

        supabase
          .from("tbutenti")
          .select("id, nome, cognome")
          .order("cognome", { ascending: true }),

        (supabase as any)
          .from("tbcontenzioso_codici_tributo")
          .select("id, tributo, descrizione")
          .eq("attivo", true)
          .order("tributo", { ascending: true }),
      ]);

      if (clientiRes.error) throw clientiRes.error;
      if (tipiRes.error) throw tipiRes.error;
      if (tributiConstatazioneRes.error) throw tributiConstatazioneRes.error;
      if (utentiRes.error) throw utentiRes.error;
      if (tributiRes.error) throw tributiRes.error;

      setClienti((clientiRes.data || []) as Cliente[]);
      setTipiAtto((tipiRes.data || []) as TipoAtto[]);
      setTributiConstatazione(
        (tributiConstatazioneRes.data || []) as TributoConstatazione[]
      );
      setUtenti((utentiRes.data || []) as Utente[]);
      setTributi((tributiRes.data || []) as Tributo[]);
    } catch (error) {
      console.error(error);
      setErrore("Errore durante il caricamento dei dati.");
    } finally {
      setLoading(false);
    }
  };

  const addRiga = () => {
    setRighe((prev) => [
      ...prev,
      {
        anno: "",
        codice_tributo_id: "",
        importo: "",
        imposta: false,
      },
    ]);
  };

  const updateRiga = (
    index: number,
    field: keyof RigaTributo,
    value: string | boolean
  ) => {
    setRighe((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const removeRiga = (index: number) => {
    setRighe((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();

    setErrore("");
    setSuccesso("");

    if (!studioId) {
      setErrore("Studio non trovato. Verifica l'utente collegato.");
      return;
    }

    if (!form.cliente_id) {
      setErrore("Seleziona il contribuente.");
      return;
    }

    if (!form.tipo_atto_id) {
      setErrore("Seleziona il tipo atto.");
      return;
    }

    if (!form.tributo_constatazione_id) {
      setErrore("Seleziona il tributo/contributo.");
      return;
    }

    if (!form.data_ricezione) {
      setErrore("Inserisci la data di ricezione.");
      return;
    }

    setSaving(true);

    const payload = {
      studio_id: studioId,
      cliente_id: form.cliente_id,
      tipo_atto_id: form.tipo_atto_id,
      tributo_constatazione_id: form.tributo_constatazione_id || null,
      numero_atto: form.numero_atto || null,
      anno_riferimento: form.anno_riferimento
        ? Number(form.anno_riferimento)
        : null,
      data_ricezione: form.data_ricezione,
      data_scadenza: dataScadenzaCalcolata || null,
      professionista_incaricato_id:
        form.professionista_incaricato_id || null,
      referente_id: form.referente_id || null,
      descrizione: form.descrizione || null,
      valore_pratica: form.valore_pratica
        ? Number(form.valore_pratica.replace(",", "."))
        : null,
      note: form.note || null,
      esito: form.esito,
      errore_studio: form.errore_studio,
      comunicato: form.comunicato,
      pratica_chiusa: form.pratica_chiusa,
      data_comunicazione: form.data_comunicazione || null,
    };

    const { data: atto, error } = await (supabase as any)
      .from("tbcontenzioso_cartelle")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio dell'atto.");
      setSaving(false);
      return;
    }

    const righeValide = righe.filter(
      (r) => r.anno || r.codice_tributo_id || r.importo
    );

    if (righeValide.length > 0) {
      const tributiPayload = righeValide.map((r) => ({
        esattoriale_id: atto.id,
        anno: r.anno ? Number(r.anno) : null,
        codice_tributo_id: r.codice_tributo_id || null,
        importo: r.importo ? Number(r.importo.replace(",", ".")) : null,
        imposta: r.imposta,
      }));

      const { error: tributiError } = await (supabase as any)
        .from("tbcontenzioso_esattoriale_tributi")
        .insert(tributiPayload);

      if (tributiError) {
        console.error(tributiError);
        setErrore("Atto salvato, ma errore nel salvataggio dei tributi.");
        setSaving(false);
        return;
      }
    }

    setSuccesso("Atto salvato correttamente.");
    router.push("/contenzioso");
  };

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuovo atto</h1>
            <p className="text-sm text-gray-500">
              Inserimento atto esattoriale / accertamento
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/contenzioso")}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
          >
            Indietro
          </button>
        </div>

        {errore && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errore}
          </div>
        )}

        {successo && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successo}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Contribuente
            </label>
            <select
              value={form.cliente_id}
              onChange={(e) => handleChange("cliente_id", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleziona contribuente</option>
              {clienti.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.ragione_sociale || "Cliente senza nome"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo atto</label>
            <select
              value={form.tipo_atto_id}
              onChange={(e) => handleChange("tipo_atto_id", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleziona tipo atto</option>
              {tipiAtto
                .filter((tipo) => {
                  const descrizione = tipo.descrizione?.toLowerCase().trim();

                  return (
                    descrizione !== "avviso bonario" &&
                    descrizione !== "cartella esattoriale"
                  );
                })
                .map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.descrizione}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Numero atto
            </label>
            <input
              value={form.numero_atto}
              onChange={(e) => handleChange("numero_atto", e.target.value)}
              className="w-full rounded-lg border p-2"
              placeholder="Numero atto"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tributo / contributo oggetto della constatazione
            </label>
            <select
              value={form.tributo_constatazione_id}
              onChange={(e) =>
                handleChange("tributo_constatazione_id", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleziona tributo/contributo</option>
              {tributiConstatazione.map((tributo) => (
                <option key={tributo.id} value={tributo.id}>
                  {tributo.descrizione}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Anno riferimento
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={form.anno_riferimento}
              onChange={(e) =>
                handleChange(
                  "anno_riferimento",
                  e.target.value.replace(/\D/g, "").slice(0, 4)
                )
              }
              className="w-full rounded-lg border p-2"
              placeholder="Es. 2024"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data ricezione
            </label>
            <input
              type="date"
              value={form.data_ricezione}
              onChange={(e) => handleChange("data_ricezione", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data scadenza
            </label>
            <input
              type="date"
              value={dataScadenzaCalcolata}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calcolata da data ricezione + giorni del tipo atto
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Professionista incaricato
            </label>
            <select
              value={form.professionista_incaricato_id}
              onChange={(e) =>
                handleChange("professionista_incaricato_id", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleziona professionista</option>
              {utenti.map((utente) => (
                <option key={utente.id} value={utente.id}>
                  {getUtenteLabel(utente)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Referente</label>
            <select
              value={form.referente_id}
              onChange={(e) => handleChange("referente_id", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleziona referente</option>
              {utenti.map((utente) => (
                <option key={utente.id} value={utente.id}>
                  {getUtenteLabel(utente)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Valore pratica
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.valore_pratica}
              onChange={(e) =>
                handleChange(
                  "valore_pratica",
                  e.target.value.replace(/[^0-9.,]/g, "")
                )
              }
              className="w-full rounded-lg border p-2"
              placeholder="Importo"
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">
              Descrizione
            </label>
            <textarea
              value={form.descrizione}
              onChange={(e) => handleChange("descrizione", e.target.value)}
              className="w-full rounded-lg border p-2"
              rows={3}
              placeholder="Descrizione della pratica"
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Note</label>
            <textarea
              value={form.note}
              onChange={(e) => handleChange("note", e.target.value)}
              className="w-full rounded-lg border p-2"
              rows={3}
              placeholder="Note interne"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Esito</label>
            <select
              value={form.esito}
              onChange={(e) => handleChange("esito", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="Pratica aperta">Pratica aperta</option>
              <option value="Dovuta">Dovuta</option>
              <option value="Parzialmente dovuta">
                Parzialmente dovuta
              </option>
              <option value="Non dovuta">Non dovuta</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data comunicazione
            </label>
            <input
              type="date"
              value={form.data_comunicazione}
              onChange={(e) =>
                handleChange("data_comunicazione", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.errore_studio}
                onChange={(e) =>
                  handleChange("errore_studio", e.target.checked)
                }
              />
              Errore studio
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.comunicato}
                onChange={(e) => handleChange("comunicato", e.target.checked)}
              />
              Comunicato
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pratica_chiusa}
                onChange={(e) =>
                  handleChange("pratica_chiusa", e.target.checked)
                }
              />
              Pratica chiusa
            </label>
          </div>
        </div>

        <div className="mb-8 rounded-xl border p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tributi</h2>

            <button
              type="button"
              onClick={addRiga}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
            >
              + Aggiungi riga
            </button>
          </div>

          {righe.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              Nessun tributo inserito.
            </div>
          ) : (
            <div className="space-y-3">
              {righe.map((riga, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-5"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Anno
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={riga.anno}
                      onChange={(e) =>
                        updateRiga(
                          index,
                          "anno",
                          e.target.value.replace(/\D/g, "").slice(0, 4)
                        )
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium">
                      Tributo
                    </label>
                    <select
                      value={riga.codice_tributo_id}
                      onChange={(e) =>
                        updateRiga(
                          index,
                          "codice_tributo_id",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border p-2"
                    >
                      <option value="">Seleziona tributo</option>
                      {tributi.map((tributo) => (
                        <option key={tributo.id} value={tributo.id}>
                          {tributo.tributo} - {tributo.descrizione}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Importo
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={riga.importo}
                      onChange={(e) =>
                        updateRiga(
                          index,
                          "importo",
                          e.target.value.replace(/[^0-9.,]/g, "")
                        )
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={riga.imposta}
                        onChange={(e) =>
                          updateRiga(index, "imposta", e.target.checked)
                        }
                      />
                      Imposta
                    </label>

                    <button
                      type="button"
                      onClick={() => removeRiga(index)}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/contenzioso")}
            className="rounded-lg border px-5 py-2 hover:bg-gray-100"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : "Salva atto"}
          </button>
        </div>
      </div>
    </div>
  );
}
