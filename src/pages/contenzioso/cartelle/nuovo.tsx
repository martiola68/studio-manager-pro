import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Wand2 } from "lucide-react";
import {
  calcolaGiorniResidui,
  getClasseGiorniResidui,
  getLabelGiorniResidui,
} from "@/utils/contenziosoScadenze";

type Cliente = { id: string; ragione_sociale: string | null };
type TipoAtto = { id: string; descrizione: string; giorni_scadenza: number };

type AvvisoBonario = {
  id: string;
  numero_atto: string | null;
  anno_riferimento: number | null;
  importo_dovuto: number | null;
};

const BUCKET = "messaggi-allegati";
const TIPO_ATTO_CARTELLA = "Cartella esattoriale";

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
    importo_sgravato: "",
    importo_residuo: "0",
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

  const giorniResidui = useMemo(() => {
  return calcolaGiorniResidui(dataScadenza);
}, [dataScadenza]);

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

  const toNumber = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(",", ".")) || 0;
  };

  const handleChange = (field: keyof typeof form, value: any) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "esito_contestazione" && typeof value === "string") {
        const dovuto = toNumber(next.importo_dovuto);

        if (!value) {
          next.importo_sgravato = "";
          next.importo_residuo = "0";
        }

        if (value === "Sgravio totale") {
          next.importo_sgravato = String(dovuto);
          next.importo_residuo = "0";
        }

        if (value === "Sgravio parziale") {
          next.importo_sgravato = "";
          next.importo_residuo = "";
        }

        if (value === "Respinto") {
          next.importo_sgravato = "0";
          next.importo_residuo = String(dovuto);
        }
      }

      if (field === "importo_dovuto" && typeof value === "string") {
        const dovuto = toNumber(value);
        const sgravato = toNumber(next.importo_sgravato);

        if (!next.esito_contestazione) {
          next.importo_residuo = "0";
        }

        if (next.esito_contestazione === "Sgravio totale") {
          next.importo_sgravato = String(dovuto);
          next.importo_residuo = "0";
        }

        if (next.esito_contestazione === "Respinto") {
          next.importo_sgravato = "0";
          next.importo_residuo = String(dovuto);
        }

        if (next.esito_contestazione === "Sgravio parziale") {
          next.importo_residuo = String(Math.max(dovuto - sgravato, 0));
        }
      }

      if (field === "importo_sgravato" && typeof value === "string") {
        const dovuto = toNumber(next.importo_dovuto);
        const sgravato = toNumber(value);

        if (next.esito_contestazione === "Sgravio parziale") {
          next.importo_residuo = String(Math.max(dovuto - sgravato, 0));
        }
      }

      return next;
    });
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

      const tipi = (tipiRes.data || []) as TipoAtto[];
      const cartella = tipi.find(
        (t) => t.descrizione?.toLowerCase() === TIPO_ATTO_CARTELLA.toLowerCase()
      );

      setClienti((clientiRes.data || []) as Cliente[]);
      setTipiAtto(tipi);

      if (cartella?.id) {
        setForm((prev) => ({
          ...prev,
          tipo_atto_id: cartella.id,
        }));
      }
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
      .select("id, numero_atto, anno_riferimento, importo_dovuto")
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
      importo_dovuto: avviso?.importo_dovuto
        ? String(avviso.importo_dovuto)
        : prev.importo_dovuto,
      importo_residuo: !prev.esito_contestazione ? "0" : prev.importo_residuo,
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
      data_scadenza: dataScadenza || null,
      giorni_residui: giorniResidui,
      importo_dovuto: form.importo_dovuto ? toNumber(form.importo_dovuto) : null,
      importo_sgravato: form.importo_sgravato
        ? toNumber(form.importo_sgravato)
        : null,
      importo_residuo: form.importo_residuo
        ? toNumber(form.importo_residuo)
        : null,
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
  <option value="">---</option>
  {avvisi.length === 0 ? (
    <option value="" disabled>
      Nessun avviso bonario trovato
    </option>
  ) : (
    avvisi.map((a) => (
      <option key={a.id} value={a.id}>
        {a.numero_atto || "Avviso senza numero"} -{" "}
        {a.anno_riferimento || "-"}
      </option>
    ))
  )}
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
            <input
              value={tipoSelezionato?.descrizione || "Cartella esattoriale"}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
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

  <div className="grid grid-cols-2 gap-2">
    <input
      type="date"
      value={dataScadenza}
      disabled
      className="w-full rounded-lg border bg-gray-100 p-2"
    />

    <div
      className={`flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold ${getClasseGiorniResidui(
        giorniResidui
      )}`}
    >
      {getLabelGiorniResidui(giorniResidui)}
    </div>
  </div>

  <p className="mt-1 text-xs text-gray-500">
    Calcolata automaticamente: data ricezione +{" "}
    {tipoSelezionato?.giorni_scadenza ?? 0} giorni
  </p>
</div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Importo dovuto
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.importo_dovuto}
              onChange={(e) =>
                handleChange(
                  "importo_dovuto",
                  e.target.value.replace(/[^0-9.,]/g, "")
                )
              }
              className="w-full rounded-lg border p-2"
              placeholder="Importo"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Motivazione
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => handleChange("note", e.target.value)}
              className="w-full rounded-lg border p-2"
              placeholder="Motivazione"
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
            <label className="mb-1 block text-sm font-medium">Data invio</label>
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

          <div>
            <label className="mb-1 block text-sm font-medium">
              Importo sgravato
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.importo_sgravato}
              onChange={(e) =>
                handleChange(
                  "importo_sgravato",
                  e.target.value.replace(/[^0-9.,]/g, "")
                )
              }
              disabled={
                form.esito_contestazione === "Sgravio totale" ||
                form.esito_contestazione === "Respinto"
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Importo residuo
            </label>
            <input
              type="text"
              value={form.importo_residuo}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
          </div>

         <div>
  <label className="mb-1 block text-sm font-medium">
    Genera ricorso
  </label>
  <div className="flex gap-2">
    <select
      value={form.genera_ricorso ? "Si" : "No"}
      onChange={(e) =>
        handleChange("genera_ricorso", e.target.value === "Si")
      }
      className="w-full rounded-lg border p-2"
    >
      <option value="No">No</option>
      <option value="Si">Sì</option>
    </select>

<button
  type="button"
  disabled={!form.genera_ricorso}
  onClick={() => {
    // funzione
  }}
  className="
    flex items-center gap-1
    rounded-lg px-3 py-2 text-sm
    bg-blue-600 text-white
    hover:bg-blue-700
    transition
    disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed
  "
>
  <Wand2 className="h-4 w-4" />
  Genera
</button>
  </div>
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
