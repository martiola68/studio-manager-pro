import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PublicDocumentoFormState = {
  id: string;
  nome_cognome: string;
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
  tipo_doc: "",
  num_doc: "",
  scadenza_doc: "",
  allegato_doc: "",
  public_doc_token: "",
  public_doc_enabled: false,
  public_doc_opened_at: "",
  public_doc_submitted_at: "",
};

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

      try {
        const { data, error } = await supabase
          .from("rapp_legali")
          .select("*")
          .eq("public_doc_token", token)
          .maybeSingle();

        if (error) {
          console.error("Errore caricamento pagina pubblica documento:", error);
          if (!cancelled) setNotFound(true);
          return;
        }

        if (!data) {
          if (!cancelled) setNotFound(true);
          return;
        }

        if (!data.public_doc_enabled) {
          if (!cancelled) setDisabledLink(true);
          return;
        }

        const mapped = mapRowToForm(data);

        if (cancelled) return;

        setForm(mapped);

        if (mapped.public_doc_submitted_at) {
          setCompleted(true);
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
      [name]: value,
    }));

    setErrMsg("");
    setOkMsg("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrMsg("");
    setOkMsg("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const submitToken = form.public_doc_token;

    if (!submitToken || !form.id) {
      setErrMsg("Link non valido o record non identificato.");
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
        allegato_doc: responseData?.path || prev.allegato_doc,
        public_doc_enabled: false,
        public_doc_submitted_at:
          responseData?.submittedAt || new Date().toISOString(),
      }));

      setSelectedFile(null);
      setCompleted(true);
      setDisabledLink(true);
      setOkMsg("Documento aggiornato correttamente.");
    } catch (error: any) {
      console.error("Errore salvataggio documento pubblico:", error);
      setErrMsg(error?.message || "Errore durante il salvataggio del documento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardContent className="py-10 text-center text-slate-600">
              Caricamento pagina pubblica...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Link non valido</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-700">
              Il collegamento richiesto non esiste oppure non è più disponibile.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Documento aggiornato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-slate-700">
              <p>Il documento di riconoscimento è stato caricato correttamente.</p>
              <p>Il collegamento è stato chiuso e non è più riutilizzabile.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (disabledLink) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Link disattivato</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-700">
              Questo collegamento è stato disattivato.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Aggiornamento documento di riconoscimento</CardTitle>
            <p className="text-sm text-slate-600">
              Caricare un documento di riconoscimento in corso di validità.
            </p>
          </CardHeader>

          <CardContent>
            <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Intestatario richiesta: <strong>{form.nome_cognome || "—"}</strong>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Tipo documento *
                  </label>
                  <select
                    name="tipo_doc"
                    value={form.tipo_doc}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="">Seleziona...</option>
                    <option value="Carta di identità">Carta di identità</option>
                    <option value="Passaporto">Passaporto</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Numero documento *
                  </label>
                  <input
                    name="num_doc"
                    value={form.num_doc}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Scadenza documento *
                  </label>
                  <input
                    type="date"
                    name="scadenza_doc"
                    value={form.scadenza_doc}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Allegato documento *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="w-full rounded-md border bg-white px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Formati ammessi: PDF, JPG, JPEG, PNG
                  </p>
                  {selectedFile && (
                    <p className="mt-1 text-sm text-slate-700">
                      File selezionato: <strong>{selectedFile.name}</strong>
                    </p>
                  )}
                </div>
              </div>

              {!!okMsg && <p className="text-sm text-green-600">{okMsg}</p>}
              {!!errMsg && <p className="text-sm text-red-600">{errMsg}</p>}

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-sky-600 px-5 py-3 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Salvataggio..." : "Salva e chiudi"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
