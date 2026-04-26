import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Wand2 } from "lucide-react";
import {
  calcolaGiorniResidui,
  getClasseGiorniResidui,
  getLabelGiorniResidui,
} from "@/utils/contenziosoScadenze";

type Cliente = {
  id: string;
  ragione_sociale?: string | null;
};

type TipoAtto = {
  id: string;
  descrizione: string;
  giorni_scadenza: number;
};

const TIPO_ATTO_AVVISO_BONARIO = "Avviso bonario";
const BUCKET = "messaggi-allegati";

const initialForm = {
  cliente_id: "",
  numero_atto: "",
  tipo_atto_dettaglio: "",
  anno_riferimento: "",
  data_emissione: "",
  data_ricezione: "",
  importo_dovuto: "",
  importo_sgravato: "",
  importo_residuo: "0",
  motivazione: "",
  contestazione: "No",
  tipo_contestazione: "",
  data_invio_contestazione: "",
  responso: "",
  comunicato_al_cliente: false,
  data_comunicazione: "",
  fare_ricorso: false,
  motivazione_ricorso: "",
  allegato_atto: "",
  allegato_civis: "",
  allegato_responso: "",
};

export default function NuovoAvvisoBonario() {
  const router = useRouter();

  const [studioId, setStudioId] = useState("");
  const [tipoAtto, setTipoAtto] = useState<TipoAtto | null>(null);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const toNumber = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(",", ".")) || 0;
  };

  const addDays = (dateString: string, days: number) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  date.setDate(date.getDate() + days);

  return date.toISOString().split("T")[0];
};

const giorniScadenza = tipoAtto?.giorni_scadenza ?? 0;

const dataScadenza =
  form.data_ricezione && giorniScadenza > 0
    ? addDays(form.data_ricezione, giorniScadenza)
    : "";

const giorniResidui = calcolaGiorniResidui(dataScadenza);

  const loadData = async () => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

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

    const [clientiRes, tipoAttoRes] = await Promise.all([
      supabase
        .from("tbclienti")
        .select("id, ragione_sociale")
        .order("ragione_sociale", { ascending: true }),

      (supabase as any)
        .from("tbcontenzioso_tipi_atto")
        .select("id, descrizione, giorni_scadenza")
        .ilike("descrizione", TIPO_ATTO_AVVISO_BONARIO)
        .eq("attivo", true)
        .single(),
    ]);

    if (clientiRes.error) {
      setErrore("Errore nel caricamento dei clienti.");
      setLoading(false);
      return;
    }

    if (tipoAttoRes.error) {
      setErrore("Tipo atto Avviso bonario non trovato.");
      setLoading(false);
      return;
    }

    setClienti((clientiRes.data || []) as Cliente[]);
    setTipoAtto(tipoAttoRes.data as TipoAtto);
    setLoading(false);
  };

  const handleChange = (
    field: keyof typeof initialForm,
    value: string | boolean
  ) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "responso" && typeof value === "string") {
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

        if (!next.responso) {
          next.importo_residuo = "0";
        }

        if (next.responso === "Sgravio totale") {
          next.importo_sgravato = String(dovuto);
          next.importo_residuo = "0";
        }

        if (next.responso === "Respinto") {
          next.importo_sgravato = "0";
          next.importo_residuo = String(dovuto);
        }

        if (next.responso === "Sgravio parziale") {
          next.importo_residuo = String(Math.max(dovuto - sgravato, 0));
        }
      }

      if (field === "importo_sgravato" && typeof value === "string") {
        const dovuto = toNumber(next.importo_dovuto);
        const sgravato = toNumber(value);

        if (next.responso === "Sgravio parziale") {
          next.importo_residuo = String(Math.max(dovuto - sgravato, 0));
        }
      }

      return next;
    });
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
    field: "allegato_atto" | "allegato_civis" | "allegato_responso",
    path: string
  ) => {
    if (!path) return;

    const supabase = getSupabaseClient();

    const { error } = await supabase.storage.from(BUCKET).remove([path]);

    if (error) {
      setErrore("Errore durante l'eliminazione del PDF.");
      return;
    }

    handleChange(field, "");
  };

  const handlePdfUpload = async (
    field: "allegato_atto" | "allegato_civis" | "allegato_responso",
    file: File | null
  ) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setErrore("Puoi caricare solo file PDF.");
      return;
    }

    const supabase = getSupabaseClient();

    const fileExt = file.name.split(".").pop();
    const fileName = `${field}_${Date.now()}.${fileExt}`;
    const filePath = `contenzioso/avvisi-bonari/${fileName}`;

    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) {
      setErrore("Errore durante il caricamento del PDF.");
      return;
    }

    handleChange(field, filePath);
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();

    setErrore("");
    setSuccesso("");

    if (!studioId) {
      setErrore("Studio non trovato.");
      return;
    }

    if (!tipoAtto?.id) {
      setErrore("Tipo atto Avviso bonario non trovato.");
      return;
    }

    if (!form.cliente_id) {
      setErrore("Seleziona un cliente.");
      return;
    }

    if (!form.numero_atto.trim()) {
      setErrore("Inserisci il numero atto.");
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
      numero_atto: form.numero_atto.trim(),
      tipo_atto: TIPO_ATTO_AVVISO_BONARIO,
      tipo_atto_id: tipoAtto.id,
      anno_riferimento: form.anno_riferimento
        ? Number(form.anno_riferimento)
        : null,
      data_emissione: form.data_emissione || null,
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
      motivazione: form.motivazione || null,
      contestazione: form.contestazione,
      tipo_contestazione: form.tipo_contestazione || null,
      data_invio_contestazione: form.data_invio_contestazione || null,
      responso: form.responso || null,
      comunicato_al_cliente: form.comunicato_al_cliente,
      data_comunicazione: form.data_comunicazione || null,
      fare_ricorso: form.fare_ricorso,
      motivazione_ricorso: form.motivazione_ricorso || null,
      allegato_atto: form.allegato_atto || null,
      allegato_civis: form.allegato_civis || null,
      allegato_responso: form.allegato_responso || null,
    };

    const { error } = await (supabase as any)
      .from("tbcontenzioso_avvisi_bonari")
      .insert(payload);

    setSaving(false);

    if (error) {
      console.error(error);
      setErrore("Errore durante il salvataggio dell'avviso bonario.");
      return;
    }

    setSuccesso("Avviso bonario salvato correttamente.");
    router.push("/contenzioso");
  };

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Nuovo avviso bonario
          </h1>

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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Cliente</label>
            <select
              value={form.cliente_id}
              onChange={(e) => handleChange("cliente_id", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleziona cliente</option>
              {clienti.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.ragione_sociale || "Cliente senza nome"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo atto</label>
            <input
              value={TIPO_ATTO_AVVISO_BONARIO}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Numero atto</label>
            <input
              value={form.numero_atto}
              onChange={(e) => handleChange("numero_atto", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tipo atto dettaglio
            </label>
            <select
              value={form.tipo_atto_dettaglio}
              onChange={(e) =>
                handleChange("tipo_atto_dettaglio", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="">---</option>
              <option value="Redditi">Redditi</option>
              <option value="IVA">IVA</option>
              <option value="770">770</option>
              <option value="IRAP">IRAP</option>
              <option value="Altro">Altro</option>
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
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data emissione
            </label>
            <input
              type="date"
              value={form.data_emissione}
              onChange={(e) => handleChange("data_emissione", e.target.value)}
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
    Data scadenza automatica
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
  Calcolata automaticamente: data ricezione + {giorniScadenza} giorni
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
            <label className="mb-1 block text-sm font-medium">Motivazione</label>
            <input
              type="text"
              value={form.motivazione}
              onChange={(e) => handleChange("motivazione", e.target.value)}
              className="w-full rounded-lg border p-2"
              placeholder="Motivazione"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Contestazione
            </label>
            <select
              value={form.contestazione}
              onChange={(e) => handleChange("contestazione", e.target.value)}
              className="w-full rounded-lg border p-2"
            >
              <option value="No">No</option>
              <option value="Si">Sì</option>
              <option value="Parziale">Parziale</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tipo contestazione
            </label>
            <select
              value={form.tipo_contestazione}
              onChange={(e) =>
                handleChange("tipo_contestazione", e.target.value)
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
              Data invio contestazione
            </label>
            <input
              type="date"
              value={form.data_invio_contestazione}
              onChange={(e) =>
                handleChange("data_invio_contestazione", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Responso</label>
            <select
              value={form.responso}
              onChange={(e) => handleChange("responso", e.target.value)}
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
              className="w-full rounded-lg border p-2"
              disabled={
                form.responso === "Sgravio totale" ||
                form.responso === "Respinto"
              }
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
              Comunicato al cliente
            </label>
            <select
              value={form.comunicato_al_cliente ? "Si" : "No"}
              onChange={(e) =>
                handleChange("comunicato_al_cliente", e.target.value === "Si")
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="No">No</option>
              <option value="Si">Sì</option>
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

<div>
  <label className="mb-1 block text-sm font-medium">
    Genera pratica ricorso
  </label>

  <div className="flex gap-2">
    <select
      value={form.fare_ricorso ? "Si" : "No"}
      onChange={(e) =>
        handleChange("fare_ricorso", e.target.value === "Si")
      }
      className="w-full rounded-lg border p-2"
    >
      <option value="No">No</option>
      <option value="Si">Sì</option>
    </select>

   <button
  type="button"
  disabled={!form.fare_ricorso}
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
              Motivazione ricorso
            </label>
            <textarea
              value={form.motivazione_ricorso}
              onChange={(e) =>
                handleChange("motivazione_ricorso", e.target.value)
              }
              className="w-full rounded-lg border p-2"
              rows={3}
            />
          </div>

           {[
            ["allegato_atto", "Allegato atto"],
            ["allegato_civis", "Allegato CIVIS"],
            ["allegato_responso", "Allegato responso"],
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
                          | "allegato_atto"
                          | "allegato_civis"
                          | "allegato_responso",
                        e.target.files?.[0] || null
                      )
                    }
                    className="w-full rounded-lg border p-2"
                  />

                  <button
                    type="button"
                    disabled={!path}
                    onClick={() => openPdf(path)}
                    className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
                  >
                    Apri
                  </button>

                  <button
                    type="button"
                    disabled={!path}
                    onClick={() =>
                      removePdf(
                        field as
                          | "allegato_atto"
                          | "allegato_civis"
                          | "allegato_responso",
                        path
                      )
                    }
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-40"
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
            {saving ? "Salvataggio..." : "Salva avviso bonario"}
          </button>
        </div>
      </div>
    </div>
  );
}
