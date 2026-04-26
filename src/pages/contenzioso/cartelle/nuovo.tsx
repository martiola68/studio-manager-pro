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

type AvvisoBonario = {
  id: string;
  numero_atto: string | null;
  anno_riferimento: number | null;
  tipo_atto_id: string | null;
  importo_dovuto: number | null;
};

const BUCKET = "messaggi-allegati";

export default function NuovaCartella() {
  const router = useRouter();

  const [studioId, setStudioId] = useState("");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [tipiAtto, setTipiAtto] = useState<TipoAtto[]>([]);
  const [avvisi, setAvvisi] = useState<AvvisoBonario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errore, setErrore] = useState("");

  const [form, setForm] = useState({
    cliente_id: "",
    numero_cartella: "",
    avviso_bonario_id: "",
    tipo_atto_id: "",
    anno_riferimento: "",
    data_ruolo: "",
    data_ricezione: "",
    importo_dovuto: "",
    note: "",
    contestabile: "No",
    modalita_contestazione: "",
    data_invio: "",
    esito_contestazione: "",
    genera_ricorso: false,
    note_motivazione_ricorso: "",
    allegato_cartella: "",
    allegato_autotutela: "",
    allegato_esito: "",
  });

  const tipoSelezionato = useMemo(() => {
    return tipiAtto.find((t) => t.id === form.tipo_atto_id) || null;
  }, [tipiAtto, form.tipo_atto_id]);

  const dataScadenza = useMemo(() => {
    if (!form.data_ricezione || !tipoSelezionato?.giorni_scadenza) return "";

    const d = new Date(form.data_ricezione);
    d.setDate(d.getDate() + tipoSelezionato.giorni_scadenza);

    return d.toISOString().split("T")[0];
  }, [form.data_ricezione, tipoSelezionato]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (form.cliente_id) {
      loadAvvisiBonari(form.cliente_id);
    } else {
      setAvvisi([]);
    }
  }, [form.cliente_id]);

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
        const { data: utente } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("email", session.user.email)
          .maybeSingle();

        if ((utente as any)?.studio_id) {
          setStudioId((utente as any).studio_id);
        }
      }

      const [clientiRes, tipiRes] = await Promise.all([
        supabase
          .from("tbclienti")
          .select("id, ragione_sociale")
          .order("ragione_sociale", { ascending: true }),

        (supabase as any)
          .from("tbcontenzioso_tipi_atto")
          .select("id, descrizione, giorni_scadenza")
          .eq("attivo", true)
          .order("descrizione", { ascending: true }),
      ]);

      if (clientiRes.error) throw clientiRes.error;
      if (tipiRes.error) throw tipiRes.error;

      setClienti((clientiRes.data || []) as Cliente[]);
      setTipiAtto((tipiRes.data || []) as TipoAtto[]);
    } catch (error) {
      console.error(error);
      setErrore("Errore durante il caricamento dei dati.");
    } finally {
      setLoading(false);
    }
  };

  const loadAvvisiBonari = async (clienteId: string) => {
    const supabase = getSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("tbcontenzioso_avvisi_bonari")
      .select("id, numero_atto, anno_riferimento, tipo_atto_id, importo_dovuto")
      .eq("cliente_id", clienteId)
      .order("data_ricezione", { ascending: false });

    if (error) {
      console.error(error);
      setAvvisi([]);
      return;
    }

    setAvvisi((data || []) as AvvisoBonario[]);
  };

  const handleAvvisoChange = (avvisoId: string) => {
    const avviso = avvisi.find((a) => a.id === avvisoId);

    setForm((prev) => ({
      ...prev,
      avviso_bonario_id: avvisoId,
      anno_riferimento: avviso?.anno_riferimento
        ? String(avviso.anno_riferimento)
        : prev.anno_riferimento,
      tipo_atto_id: avviso?.tipo_atto_id || prev.tipo_atto_id,
      importo_dovuto: avviso?.importo_dovuto
        ? String(avviso.importo_dovuto)
        : prev.importo_dovuto,
    }));
  };

  const handlePdfUpload = async (
    field: "allegato_cartella" | "allegato_autotutela" | "allegato_esito",
    file: File | null
  ) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setErrore("Puoi caricare solo file PDF.");
      return;
    }

    const supabase = getSupabaseClient();
    const filePath = `contenzioso/cartelle/${field}_${Date.now()}.pdf`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error(error);
      setErrore("Errore durante il caricamento del PDF.");
      return;
    }

    handleChange(field, filePath);
  };

  const openPdf = (path: string) => {
    if (!path) return;

    const supabase = getSupabaseClient();

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    if (data?.publicUrl) {
      window.open(data.publicUrl, "_blank");
    }
  };

  const removePdf = async (
    field: "allegato_cartella" | "allegato_autotutela" | "allegato_esito",
    path: string
  ) => {
    if (!path) return;

    const supabase = getSupabaseClient();

    await supabase.storage.from(BUCKET).remove([path]);

    handleChange(field, "");
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();

    setErrore("");

    if (!studioId) {
      setErrore("Studio non trovato.");
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

    if (!form.data_ricezione) {
      setErrore("Inserisci la data ricezione.");
      return;
    }

    setSaving(true);

    const payload = {
      studio_id: studioId,
      cliente_id: form.cliente_id,
      numero_cartella: form.numero_cartella || null,
      avviso_bonario_id: form.avviso_bonario_id || null,
      tipo_atto_id: form.tipo_atto_id || null,
      anno_riferimento: form.anno_riferimento
        ? Number(form.anno_riferimento)
        : null,
      data_ruolo: form.data_ruolo || null,
      data_ricezione: form.data_ricezione,
      importo_dovuto: form.importo_dovuto ? Number(form.importo_dovuto) : null,
      note: form.note || null,
      contestabile: form.contestabile,
      modalita_contestazione: form.modalita_contestazione || null,
      data_invio: form.data_invio || null,
      esito_contestazione: form.esito_contestazione || null,
      genera_ricorso: form.genera_ricorso,
      note_motivazione_ricorso: form.note_motivazione_ricorso || null,
      allegato_cartella: form.allegato_cartella || null,
      allegato_autotutela: form.allegato_autotutela || null,
      allegato_esito: form.allegato_esito || null,
    };

    const { error } = await (supabase as any)
      .from("tbcontenzioso_cartelle")
      .insert(payload);

    setSaving(false);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio della cartella.");
      return;
    }

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
            <h1 className="text-2xl font-bold">Nuova cartella esattoriale</h1>
            <p className="text-sm text-gray-500">
              Inserimento cartella collegata al contenzioso
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/contenzioso")}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Indietro
          </button>
        </div>

        {errore && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errore}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ragione_sociale}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Rif. avviso bonario
            </label>
            <select
              value={form.avviso_bonario_id}
              onChange={(e) => handleAvvisoChange(e.target.value)}
              className="w-full rounded-lg border p-2"
              disabled={!form.cliente_id}
            >
              <option value="">Blank / Nessun avviso collegato</option>
              {avvisi.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.numero_atto || "Avviso senza numero"} -{" "}
                  {a.anno_riferimento || "-"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Numero cartella
            </label>
            <input
              value={form.numero_cartella}
              onChange={(e) => handleChange("numero_cartella", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo atto</label>
            <select
              value={form.tipo_atto_id}
              onChange={(e) => handleChange("tipo_atto_id", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleziona tipo atto</option>
              {tipiAtto.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.descrizione}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Anno riferimento
            </label>
            <input
              type="number"
              value={form.anno_riferimento}
              onChange={(e) =>
                handleChange("anno_riferimento", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data ruolo</label>
            <input
              type="date"
              value={form.data_ruolo}
              onChange={(e) => handleChange("data_ruolo", e.target.value)}
              className="w-full rounded-lg border p-2"
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
              value={dataScadenza}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Importo dovuto
            </label>
            <input
              type="number"
              step="0.01"
              value={form.importo_dovuto}
              onChange={(e) => handleChange("importo_dovuto", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Note</label>
            <textarea
              value={form.note}
              onChange={(e) => handleChange("note", e.target.value)}
              className="w-full rounded-lg border p-2"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Contestabile
            </label>
            <select
              value={form.contestabile}
              onChange={(e) => handleChange("contestabile", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="No">No</option>
              <option value="Si">Sì</option>
              <option value="Parzialmente">Parzialmente</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Modalità contestazione
            </label>
            <select
              value={form.modalita_contestazione}
              onChange={(e) =>
                handleChange("modalita_contestazione", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="">---</option>
              <option value="CIVIS">CIVIS</option>
              <option value="Autotutela PEC">Autotutela PEC</option>
              <option value="Autotutela ufficio">Autotutela ufficio</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data invio
            </label>
            <input
              type="date"
              value={form.data_invio}
              onChange={(e) => handleChange("data_invio", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Esito contestazione
            </label>
            <select
              value={form.esito_contestazione}
              onChange={(e) =>
                handleChange("esito_contestazione", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="">---</option>
              <option value="Sgravio totale">Sgravio totale</option>
              <option value="Sgravio parziale">Sgravio parziale</option>
              <option value="Respinto">Respinto</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.genera_ricorso}
                onChange={(e) =>
                  handleChange("genera_ricorso", e.target.checked)
                }
              />
              Genera ricorso
            </label>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">
              Note motivazione ricorso
            </label>
            <textarea
              value={form.note_motivazione_ricorso}
              onChange={(e) =>
                handleChange("note_motivazione_ricorso", e.target.value)
              }
              className="w-full rounded-lg border p-2"
              rows={3}
            />
          </div>

          {[
            ["allegato_cartella", "Allegato cartella"],
            ["allegato_autotutela", "Allegato autotutela"],
            ["allegato_esito", "Allegato esito"],
          ].map(([field, label]) => {
            const path = form[field as keyof typeof form] as string;

            return (
              <div key={field}>
                <label className="mb-1 block text-sm font-medium">
                  {label}
                </label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) =>
                      handlePdfUpload(
                        field as
                          | "allegato_cartella"
                          | "allegato_autotutela"
                          | "allegato_esito",
                        e.target.files?.[0] || null
                      )
                    }
                    className="w-full rounded-lg border p-2"
                  />

                  <button
                    type="button"
                    disabled={!path}
                    onClick={() => openPdf(path)}
                    className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                  >
                    Apri
                  </button>

                  <button
                    type="button"
                    disabled={!path}
                    onClick={() =>
                      removePdf(
                        field as
                          | "allegato_cartella"
                          | "allegato_autotutela"
                          | "allegato_esito",
                        path
                      )
                    }
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-40"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end gap-3">
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
            {saving ? "Salvataggio..." : "Salva cartella"}
          </button>
        </div>
      </div>
    </div>
  );
}
