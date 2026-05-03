import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  calcolaGiorniResidui,
  getClasseGiorniResidui,
  getLabelGiorniResidui,
} from "@/utils/contenziosoScadenze";

type Cliente = {
  id: string;
  ragione_sociale?: string | null;
};

type TributoConstatazione = {
  id: string;
  descrizione: string;
};

type Utente = {
  id: string;
  nome: string | null;
  cognome: string | null;
};

const BUCKET = "messaggi-allegati";

const initialForm = {
  cliente_id: "",
  numero_atto: "",
  tributo_constatazione_id: "",
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
  operatore_responsabile_id: "",
  pratica_chiusa: false,
  allegato_atto: "",
  allegato_civis: "",
  allegato_responso: "",
};

export default function ModificaAvvisoBonario() {
  const router = useRouter();
  const { id } = router.query;

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [tributiConstatazione, setTributiConstatazione] = useState<
    TributoConstatazione[]
  >([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState("");
  const [successo, setSuccesso] = useState("");

 const toNumber = (val: string) => {
  if (!val) return 0;

  return (
    parseFloat(
      val
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 0
  );
};

const formatCurrencyInput = (val: string) => {
  const num = toNumber(val);
  if (!num) return "";

  return num.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

 const addDays = (dateString: string, days: number) => {
  if (!dateString) return "";

  const [yyyy, mm, dd] = dateString.split("-").map(Number);

  if (!yyyy || !mm || !dd) return "";

  const date = new Date(yyyy, mm - 1, dd);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

  const giorniScadenza = 60;

  const dataScadenza = form.data_ricezione
    ? addDays(form.data_ricezione, giorniScadenza)
    : "";

  const giorniResidui = calcolaGiorniResidui(dataScadenza);

  useEffect(() => {
    if (!router.isReady || !id) return;
    void loadData(String(id));
  }, [router.isReady, id]);

  const loadData = async (avvisoId: string) => {
    const supabase = getSupabaseClient();

    setLoading(true);
    setErrore("");

    const [clientiRes, tributiRes, utentiRes, avvisoRes] = await Promise.all([
      supabase
        .from("tbclienti")
        .select("id, ragione_sociale")
        .order("ragione_sociale", { ascending: true }),

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
        .from("tbcontenzioso_avvisi_bonari")
        .select("*")
        .eq("id", avvisoId)
        .single(),
    ]);

    if (clientiRes.error) {
      setErrore("Errore nel caricamento clienti.");
      setLoading(false);
      return;
    }

    if (tributiRes.error) {
      setErrore("Errore nel caricamento tributi.");
      setLoading(false);
      return;
    }

    if (utentiRes.error) {
      setErrore("Errore nel caricamento operatori.");
      setLoading(false);
      return;
    }

    if (avvisoRes.error || !avvisoRes.data) {
      setErrore("Avviso bonario non trovato.");
      setLoading(false);
      return;
    }

    const row = avvisoRes.data as any;

    setClienti((clientiRes.data || []) as Cliente[]);
    setTributiConstatazione((tributiRes.data || []) as TributoConstatazione[]);
    setUtenti((utentiRes.data || []) as Utente[]);

    setForm({
      cliente_id: row.cliente_id || "",
      numero_atto: row.numero_atto || "",
      tributo_constatazione_id: row.tributo_constatazione_id || "",
      anno_riferimento: row.anno_riferimento ? String(row.anno_riferimento) : "",
      data_emissione: row.data_emissione || "",
      data_ricezione: row.data_ricezione || "",
      importo_dovuto:
        row.importo_dovuto !== null && row.importo_dovuto !== undefined
          ? String(row.importo_dovuto)
          : "",
      importo_sgravato:
        row.importo_sgravato !== null && row.importo_sgravato !== undefined
          ? String(row.importo_sgravato)
          : "",
      importo_residuo:
        row.importo_residuo !== null && row.importo_residuo !== undefined
          ? String(row.importo_residuo)
          : "0",
      motivazione: row.motivazione || "",
      contestazione: row.contestazione || "No",
      tipo_contestazione: row.tipo_contestazione || "",
      data_invio_contestazione: row.data_invio_contestazione || "",
      responso: row.responso || "",
      comunicato_al_cliente: !!row.comunicato_al_cliente,
      data_comunicazione: row.data_comunicazione || "",
      operatore_responsabile_id: row.operatore_responsabile_id || "",
      pratica_chiusa: !!row.pratica_chiusa,
      allegato_atto: row.allegato_atto || "",
      allegato_civis: row.allegato_civis || "",
      allegato_responso: row.allegato_responso || "",
    });

    setLoading(false);
  };

  const handleChange = (
    field: keyof typeof initialForm,
    value: string | boolean
  ) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

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

  const openPdf = async (path: string) => {
    if (!path) return;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      setErrore("Impossibile aprire il PDF.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
  if (!id) return;

  const supabase = getSupabaseClient();

  setErrore("");
  setSuccesso("");

  if (!form.cliente_id) {
    setErrore("Seleziona un cliente.");
    return;
  }

if (!form.operatore_responsabile_id) {
  setErrore("Seleziona l'operatore responsabile.");
  return;
}

if (!form.numero_atto.trim()) {
  setErrore("Inserisci il numero atto.");
  return;
}

if (!form.tributo_constatazione_id) {
  setErrore("Seleziona il tributo/contributo.");
  return;
}

if (!form.anno_riferimento) {
  setErrore("Inserisci l'anno di riferimento.");
  return;
}

if (!form.data_emissione) {
  setErrore("Inserisci la data di emissione.");
  return;
}

if (!form.data_ricezione) {
  setErrore("Inserisci la data di ricezione.");
  return;
}

if (!form.importo_dovuto || toNumber(form.importo_dovuto) <= 0) {
  setErrore("Inserisci l'importo dovuto.");
  return;
}
  setSaving(true);

  const payload = {
    cliente_id: form.cliente_id,
    numero_atto: form.numero_atto.trim(),
    tributo_constatazione_id: form.tributo_constatazione_id || null,
    anno_riferimento: form.anno_riferimento
      ? Number(form.anno_riferimento)
      : null,
    data_emissione: form.data_emissione || null,
    data_ricezione: form.data_ricezione,
    giorni_restanti: giorniResidui,
    importo_dovuto: form.importo_dovuto
      ? toNumber(form.importo_dovuto)
      : null,
    importo_sgravato: form.importo_sgravato
      ? toNumber(form.importo_sgravato)
      : null,
    importo_residuo: form.importo_residuo
      ? toNumber(form.importo_residuo)
      : null,
    motivazione: form.motivazione || null,
    contestazione: form.contestazione,
    tipo_contestazione: form.tipo_contestazione || null,
    data_invio_contestazione:
      form.data_invio_contestazione || null,
    responso: form.responso || null,
    comunicato_al_cliente: form.comunicato_al_cliente,
    data_comunicazione: form.data_comunicazione || null,
    operatore_responsabile_id:
      form.operatore_responsabile_id || null,
    pratica_chiusa: form.pratica_chiusa,
    allegato_atto: form.allegato_atto || null,
    allegato_civis: form.allegato_civis || null,
    allegato_responso: form.allegato_responso || null,
  };

  const { error } = await (supabase as any)
    .from("tbcontenzioso_avvisi_bonari")
    .update(payload)
    .eq("id", String(id));

  setSaving(false);

  if (error) {
    console.error(error);
    setErrore(
      error.message ||
        "Errore durante il salvataggio dell'avviso bonario."
    );
    return;
  }

  router.push("/contenzioso");
};

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Modifica avviso bonario
            </h1>
            <p className="text-sm text-gray-500">
              Numero atto: {form.numero_atto || "-"}
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
            <label className="mb-1 block text-sm font-medium">Numero atto</label>
            <input
              value={form.numero_atto}
              onChange={(e) => handleChange("numero_atto", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tributo / imposta
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
            <input
              type="date"
              value={dataScadenza}
              disabled
              className="w-full rounded-lg border bg-gray-100 p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Giorni restanti
            </label>
            <div
              className={`flex h-[42px] items-center justify-center rounded-lg px-3 text-sm font-semibold ${getClasseGiorniResidui(
                giorniResidui
              )}`}
            >
              {getLabelGiorniResidui(giorniResidui)}
            </div>
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
  onBlur={() =>
    handleChange("importo_dovuto", formatCurrencyInput(form.importo_dovuto))
  }
  className="w-full rounded-lg border p-2"
  placeholder="0,00"
/>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Motivazione</label>
            <input
              value={form.motivazione}
              onChange={(e) => handleChange("motivazione", e.target.value)}
              className="w-full rounded-lg border p-2"
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
              onChange={(e) => handleChange("tipo_contestazione", e.target.value)}
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
              value={form.importo_sgravato}
              onChange={(e) =>
                handleChange(
                  "importo_sgravato",
                  e.target.value.replace(/[^0-9.,]/g, "")
                )
              }
              disabled={
                form.responso === "Sgravio totale" ||
                form.responso === "Respinto"
              }
              className="w-full rounded-lg border p-2 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Importo residuo
            </label>
            <input
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
              onChange={(e) => handleChange("data_comunicazione", e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Operatore responsabile
            </label>
            <select
              value={form.operatore_responsabile_id}
              onChange={(e) =>
                handleChange("operatore_responsabile_id", e.target.value)
              }
              className="w-full rounded-lg border p-2"
            >
              <option value="">Seleziona operatore</option>
              {utenti.map((utente) => (
                <option key={utente.id} value={utente.id}>
                  {`${utente.nome || ""} ${utente.cognome || ""}`.trim() ||
                    "Operatore"}
                </option>
              ))}
            </select>
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

        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Pratica chiusa</label>

            <select
              value={form.pratica_chiusa ? "Si" : "No"}
              onChange={(e) =>
                handleChange("pratica_chiusa", e.target.value === "Si")
              }
              className="rounded-lg border p-2"
            >
              <option value="No">No</option>
              <option value="Si">Sì</option>
            </select>
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
              {saving ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
