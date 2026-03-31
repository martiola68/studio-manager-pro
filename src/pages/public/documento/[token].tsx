import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

type PublicDocumentoFormState = {
  id: string;
  nome_cognome: string;
  citta_residenza: string;
  indirizzo_residenza: string;
  CAP: string;
  tipo_doc: string;
  num_doc: string;
  scadenza_doc: string;
  allegato_doc: string;
  public_doc_token: string;
  public_doc_enabled: boolean;
  public_doc_opened_at: string;
  public_doc_submitted_at: string;
};

const emptyForm: PublicDocumentoFormState = {
  id: "",
  nome_cognome: "",
  citta_residenza: "",
  indirizzo_residenza: "",
  CAP: "",
  tipo_doc: "",
  num_doc: "",
  scadenza_doc: "",
  allegato_doc: "",
  public_doc_token: "",
  public_doc_enabled: false,
  public_doc_opened_at: "",
  public_doc_submitted_at: "",
};

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function normalizeDateForInput(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value?: string | null) {
  const normalized = normalizeDateForInput(value);
  if (!normalized) return "";

  const [year, month, day] = normalized.split("-");
  if (!year || !month || !day) return normalized;

  return `${day}/${month}/${year}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

function mapRowToForm(row: any): PublicDocumentoFormState {
  return {
    id: String(row?.id ?? ""),
    nome_cognome: row?.nome_cognome ?? "",
    citta_residenza: row?.citta_residenza ?? "",
    indirizzo_residenza: row?.indirizzo_residenza ?? "",
    CAP: row?.CAP ?? "",
    tipo_doc: row?.tipo_doc ?? "",
    num_doc: row?.num_doc ?? "",
    scadenza_doc: normalizeDateForInput(row?.scadenza_doc),
    allegato_doc: row?.allegato_doc ?? "",
    public_doc_token: row?.public_doc_token ?? "",
    public_doc_enabled: !!row?.public_doc_enabled,
    public_doc_opened_at: row?.public_doc_opened_at ?? "",
    public_doc_submitted_at: row?.public_doc_submitted_at ?? "",
  };
}

export default function PublicDocumentoPage() {
  const router = useRouter();

  const token = useMemo(
    () => (typeof router.query.token === "string" ? router.query.token : ""),
    [router.query.token]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [disabledLink, setDisabledLink] = useState(false);

  const [form, setForm] = useState<PublicDocumentoFormState>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!router.isReady || !token) return;

    let cancelled = false;

    const load = async () => {
      const supabase = getSupabaseClient() as any;

      setLoading(true);
      setErrMsg("");
      setOkMsg("");
      setNotFound(false);
      setDisabledLink(false);
      setCompleted(false);

      try {
        const { data, error } = await supabase
          .from("rapp_legali")
          .select("*")
          .eq("public_doc_token", token)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("Errore caricamento pagina pubblica documento:", error);
          setNotFound(true);
          return;
        }

        if (!data) {
          setNotFound(true);
          return;
        }

        const mapped = mapRowToForm(data);
        setForm(mapped);

        if (!mapped.public_doc_enabled) {
          setDisabledLink(true);
          return;
        }

        if (mapped.public_doc_submitted_at) {
          setCompleted(true);
          return;
        }

        if (!mapped.public_doc_opened_at) {
          await supabase
            .from("rapp_legali")
            .update({
              public_doc_opened_at: new Date().toISOString(),
            })
            .eq("id", mapped.id)
            .eq("public_doc_token", token);
        }
      } catch (err) {
        console.error("Errore imprevisto pagina pubblica documento:", err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, token]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "CAP" ? value.replace(/\D/g, "").slice(0, 5) : value,
    }));

    setErrMsg("");
    setOkMsg("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;

    setErrMsg("");
    setOkMsg("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setSelectedFile(null);
      e.target.value = "";
      setErrMsg("Formato file non ammesso. Caricare solo PDF, JPG, JPEG o PNG.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      e.target.value = "";
      setErrMsg(
        `Il file supera la dimensione massima consentita di ${MAX_FILE_SIZE_MB} MB.`
      );
      return;
    }

    setSelectedFile(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const submitToken = form.public_doc_token;

    if (!submitToken || !form.id) {
      setErrMsg("Link non valido o record non identificato.");
      return;
    }

    if (!form.citta_residenza.trim()) {
      setErrMsg("Inserisci la città di residenza.");
      return;
    }

    if (!form.indirizzo_residenza.trim()) {
      setErrMsg("Inserisci l'indirizzo di residenza.");
      return;
    }

    if (!form.CAP.trim()) {
      setErrMsg("Inserisci il CAP.");
      return;
    }

    if (!form.tipo_doc) {
      setErrMsg("Seleziona il tipo documento.");
      return;
    }

    if (!form.num_doc.trim()) {
      setErrMsg("Inserisci il numero documento.");
      return;
    }

    if (!form.scadenza_doc) {
      setErrMsg("Inserisci la scadenza documento.");
      return;
    }

    if (!selectedFile) {
      setErrMsg("Allega il documento prima di continuare.");
      return;
    }

    setSaving(true);
    setErrMsg("");
    setOkMsg("");

    try {
      const fileBase64 = await fileToBase64(selectedFile);

      const res = await fetch("/api/public/documento/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: submitToken,
          citta_residenza: form.citta_residenza.trim(),
          indirizzo_residenza: form.indirizzo_residenza.trim(),
          CAP: form.CAP.trim(),
          tipo_doc: form.tipo_doc,
          num_doc: form.num_doc.trim(),
          scadenza_doc: form.scadenza_doc,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileBase64,
        }),
      });

      const responseData = await res.json();

      if (!res.ok || !responseData?.ok) {
        throw new Error(
          responseData?.error || "Errore durante il salvataggio del documento."
        );
      }

      setForm((prev) => ({
        ...prev,
        citta_residenza: form.citta_residenza.trim(),
        indirizzo_residenza: form.indirizzo_residenza.trim(),
        CAP: form.CAP.trim(),
        tipo_doc: form.tipo_doc,
        num_doc: form.num_doc.trim(),
        scadenza_doc: form.scadenza_doc,
        allegato_doc: responseData?.path || prev.allegato_doc,
        public_doc_enabled: false,
        public_doc_submitted_at:
          responseData?.submittedAt || new Date().toISOString(),
      }));

      setSelectedFile(null);
      setOkMsg("Documento aggiornato correttamente.");
      setCompleted(true);
      setDisabledLink(true);
    } catch (error: any) {
      console.error("Errore salvataggio documento pubblico:", error);
      setErrMsg(
        error?.message || "Errore durante il salvataggio del documento."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>Aggiornamento documento</title>
          <meta
            name="description"
            content="Aggiornamento documento di riconoscimento"
          />
          <link rel="icon" href="/favicon-public.ico" />
        </Head>

        <div className="min-h-screen bg-slate-50 px-4 py-10">
          <div className="mx-auto w-full max-w-5xl">
            <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
              <p className="text-center text-slate-600">
                Caricamento pagina pubblica...
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Head>
          <title>Link non valido</title>
          <meta
            name="description"
            content="Aggiornamento documento di riconoscimento"
          />
          <link rel="icon" href="/favicon-public.ico" />
        </Head>

        <div className="min-h-screen bg-slate-50 px-4 py-10">
          <div className="mx-auto w-full max-w-5xl">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h1 className="text-xl font-semibold text-slate-900">
                Link non valido
              </h1>
              <p className="mt-3 text-slate-700">
                Il collegamento richiesto non esiste oppure non è più disponibile.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (completed) {
    return (
      <>
        <Head>
          <title>Documento aggiornato</title>
          <meta
            name="description"
            content="Aggiornamento documento di riconoscimento completato"
          />
          <link rel="icon" href="/favicon-public.ico" />
        </Head>

        <div className="min-h-screen bg-slate-50 px-4 py-10">
          <div className="mx-auto w-full max-w-5xl">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h1 className="text-xl font-semibold text-slate-900">
                Documento aggiornato
              </h1>
              <div className="mt-3 space-y-2 text-slate-700">
                <p>Il documento di riconoscimento è stato caricato correttamente.</p>
                <p>Il collegamento è stato chiuso e non è più riutilizzabile.</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (disabledLink) {
    return (
      <>
        <Head>
          <title>Link disattivato</title>
          <meta
            name="description"
            content="Aggiornamento documento di riconoscimento"
          />
          <link rel="icon" href="/favicon-public.ico" />
        </Head>

        <div className="min-h-screen bg-slate-50 px-4 py-10">
          <div className="mx-auto w-full max-w-5xl">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h1 className="text-xl font-semibold text-slate-900">
                Link disattivato
              </h1>
              <p className="mt-3 text-slate-700">
                Questo collegamento è stato disattivato.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Aggiornamento documento</title>
        <meta
          name="description"
          content="Aggiornamento documento di riconoscimento"
        />
        <link rel="icon" href="/favicon-public.ico" />
      </Head>

      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h1 className="text-2xl font-semibold text-slate-900">
                Aggiornamento documento di riconoscimento
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Caricare un documento di riconoscimento in corso di validità e
                confermare i dati di residenza.
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Intestatario richiesta:{" "}
                <strong>{form.nome_cognome || "—"}</strong>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-900">
                      Città residenza *
                    </label>
                    <input
                      name="citta_residenza"
                      value={form.citta_residenza}
                      onChange={handleChange}
                      className="w-full rounded-md border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-900">
                      CAP *
                    </label>
                    <input
                      name="CAP"
                      value={form.CAP}
                      onChange={handleChange}
                      maxLength={5}
                      className="w-full rounded-md border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-900">
                      Indirizzo residenza *
                    </label>
                    <input
                      name="indirizzo_residenza"
                      value={form.indirizzo_residenza}
                      onChange={handleChange}
                      className="w-full rounded-md border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-900">
                      Tipo documento *
                    </label>
                    <select
                      name="tipo_doc"
                      value={form.tipo_doc}
                      onChange={handleChange}
                      className="w-full rounded-md border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
                    >
                      <option value="">Seleziona...</option>
                      <option value="---">---</option>
                      <option value="Carta di identità">Carta di identità</option>
                      <option value="Passaporto">Passaporto</option>
                      <option value="Patente">Patente</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-900">
                      Numero documento *
                    </label>
                    <input
                      name="num_doc"
                      value={form.num_doc}
                      onChange={handleChange}
                      className="w-full rounded-md border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-900">
                      Scadenza documento *
                    </label>
                    <input
                      type="date"
                      name="scadenza_doc"
                      value={form.scadenza_doc}
                      onChange={handleChange}
                      className="w-full rounded-md border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
                    />
                    {form.scadenza_doc && (
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateForDisplay(form.scadenza_doc)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-900">
                      Allegato documento *
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="w-full rounded-md border border-slate-300 bg-white px-4 py-3"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Formati ammessi: PDF, JPG, JPEG, PNG • Dimensione massima:{" "}
                      {MAX_FILE_SIZE_MB} MB
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      Il documento deve essere completo e perfettamente leggibile,
                      senza tagli, sfocature, riflessi o parti coperte.
                    </p>

                    {selectedFile && (
                      <p className="mt-2 text-sm text-slate-700">
                        File selezionato: <strong>{selectedFile.name}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {!!okMsg && <p className="text-sm text-green-600">{okMsg}</p>}
                {!!errMsg && <p className="text-sm text-red-600">{errMsg}</p>}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-sky-600 px-5 py-3 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Salvataggio..." : "Salva e chiudi"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
