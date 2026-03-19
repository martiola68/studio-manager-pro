import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isValidCF, normalizeCF } from "@/utils/codiceFiscale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* =========================================================
   CONFIG
   ========================================================= */
const BUCKET_NAME = "allegati";

/* =========================================================
   TYPES
   ========================================================= */
type TipoDocumento = "" | "Carta di identità" | "Passaporto";

type FormState = {
  nome_cognome: string;
  codice_fiscale: string;
  luogo_nascita: string;
  data_nascita: string;
  citta_residenza: string;
  indirizzo_residenza: string;
  cap: string;
  nazionalita: string;
  tipo_doc: TipoDocumento;
  num_doc: string;
  scadenza_doc: string;
  allegato_doc: string;
};

type RappLegaleRow = {
  id?: string;
  studio_id?: string;
  nome_cognome?: string | null;
  codice_fiscale?: string | null;
  luogo_nascita?: string | null;
  data_nascita?: string | null;
  citta_residenza?: string | null;
  indirizzo_residenza?: string | null;
  CAP?: string | null;
  nazionalita?: string | null;
  tipo_doc?: string | null;
  NumDoc?: string | null;
  scadenza_doc?: string | null;
  allegato_doc?: string | null;
};

const initialFormState: FormState = {
  nome_cognome: "",
  codice_fiscale: "",
  luogo_nascita: "",
  data_nascita: "",
  citta_residenza: "",
  indirizzo_residenza: "",
  cap: "",
  nazionalita: "",
  tipo_doc: "",
  num_doc: "",
  scadenza_doc: "",
  allegato_doc: "",
};

/* =========================================================
   HELPERS
   ========================================================= */
function normalizeDateForInput(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapRowToForm(row?: RappLegaleRow | null): FormState {
  const tipo = row?.tipo_doc ?? "";
  const safeTipo: TipoDocumento =
    tipo === "Carta di identità" || tipo === "Passaporto" ? tipo : "";

  return {
    nome_cognome: row?.nome_cognome ?? "",
    codice_fiscale: row?.codice_fiscale ?? "",
    luogo_nascita: row?.luogo_nascita ?? "",
    data_nascita: normalizeDateForInput(row?.data_nascita),
    citta_residenza: row?.citta_residenza ?? "",
    indirizzo_residenza: row?.indirizzo_residenza ?? "",
    cap: row?.CAP ?? "",
    nazionalita: row?.nazionalita ?? "",
    tipo_doc: safeTipo,
    num_doc: row?.NumDoc ?? "",
    scadenza_doc: normalizeDateForInput(row?.scadenza_doc),
    allegato_doc: row?.allegato_doc ?? "",
  };
}
export default function NuovoRappresentantePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isEditMode = router.isReady && typeof router.query.id === "string" && !!router.query.id;
  const recordId = router.isReady && typeof router.query.id === "string" ? router.query.id : "";

  const from = router.isReady && typeof router.query.from === "string" ? router.query.from : "";
  const clienteIdFromQuery =
    router.isReady && typeof router.query.cliente_id === "string"
      ? router.query.cliente_id
      : "";
  const av1IdFromQuery =
    router.isReady && typeof router.query.av1_id === "string"
      ? router.query.av1_id
      : "";
  const av4IdFromQuery =
    router.isReady && typeof router.query.av4_id === "string"
      ? router.query.av4_id
      : "";
  const returnTo =
    router.isReady && typeof router.query.returnTo === "string"
      ? router.query.returnTo
      : "";

  const [studioId, setStudioId] = useState<string>("");
  const [form, setForm] = useState<FormState>(initialFormState);
  const [initialLoadedForm, setInitialLoadedForm] = useState<FormState>(initialFormState);

  const [pageLoading, setPageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  /* =========================================================
     LOAD STUDIO ID
     ========================================================= */
  useEffect(() => {
    const loadStudioId = async () => {
      const supabase = getSupabaseClient() as any;
      setErrMsg(null);

      try {
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem("studio_id");
          if (cached) {
            setStudioId(cached);
            return;
          }
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) {
          throw new Error(`Errore autenticazione: ${authError.message}`);
        }

        const email = authData?.user?.email;
        if (!email) {
          throw new Error("Utente non loggato: impossibile recuperare studio_id.");
        }

        const { data, error } = await supabase
          .from("tbutenti")
          .select("studio_id")
          .eq("email", email)
          .single();

        if (error) {
          throw new Error(`Errore lettura tbutenti: ${error.message}`);
        }

        const sid = data?.studio_id ? String(data.studio_id) : "";
        if (!sid) {
          throw new Error("studio_id non presente in tbutenti per questo utente.");
        }

        setStudioId(sid);

        if (typeof window !== "undefined") {
          localStorage.setItem("studio_id", sid);
        }
      } catch (error: any) {
        setErrMsg(error?.message || "Errore recupero studio_id.");
      }
    };

    void loadStudioId();
  }, []);

  /* =========================================================
     LOAD RECORD IN EDIT MODE
     ========================================================= */
  useEffect(() => {
    if (!router.isReady || !isEditMode || !recordId) return;

    let cancelled = false;

    const loadRecord = async () => {
      const supabase = getSupabaseClient() as any;
      setPageLoading(true);
      setErrMsg(null);
      setOkMsg(null);

      try {
        let row: RappLegaleRow | null = null;

        try {
          const response = await fetch(`/api/rapp-legali/get-by-id?id=${encodeURIComponent(recordId)}`);
          const contentType = response.headers.get("content-type") || "";

          let result: any = null;

          if (contentType.includes("application/json")) {
            result = await response.json();
          }

          if (response.ok && result?.ok && result?.data) {
            row = result.data as RappLegaleRow;
          }
        } catch {
          // fallback sotto
        }

        if (!row) {
          const { data, error } = await supabase
            .from("rapp_legali")
            .select(
              "id, studio_id, nome_cognome, codice_fiscale, luogo_nascita, data_nascita, citta_residenza, indirizzo_residenza, CAP, nazionalita, tipo_doc, NumDoc, scadenza_doc, allegato_doc"
            )
            .eq("id", recordId)
            .single();

          if (error) {
            throw new Error(error.message || "Errore caricamento rappresentante");
          }

          row = data as RappLegaleRow;
        }

        if (!row) {
          throw new Error("Record non trovato.");
        }

        if (cancelled) return;

        const mapped = mapRowToForm(row);

        setForm(mapped);
        setInitialLoadedForm(mapped);

        if (row.studio_id) {
          const sid = String(row.studio_id);
          setStudioId((prev) => prev || sid);

          if (typeof window !== "undefined" && sid) {
            localStorage.setItem("studio_id", sid);
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrMsg(error?.message || "Errore caricamento rappresentante");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadRecord();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, isEditMode, recordId]);

  /* =========================================================
     MEMO
     ========================================================= */
  const cf = useMemo(() => normalizeCF(form.codice_fiscale), [form.codice_fiscale]);

  const cfOk = useMemo(() => {
    return cf.length === 16 ? isValidCF(cf) : false;
  }, [cf]);

  const canSave = useMemo(() => {
    return !!studioId && form.nome_cognome.trim().length > 0 && cfOk;
  }, [studioId, form.nome_cognome, cfOk]);

  /* =========================================================
     ACTIONS
     ========================================================= */
  function resetForm() {
    setOkMsg(null);
    setErrMsg(null);

    if (isEditMode) {
      setForm(initialLoadedForm);
    } else {
      setForm(initialFormState);
    }
  }

  async function handleUploadDoc(file: File) {
    if (!studioId) {
      setErrMsg("studio_id non disponibile: impossibile caricare il documento.");
      return;
    }

    setUploading(true);
    setErrMsg(null);
    setOkMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("studio_id", studioId);

      const response = await fetch("/api/rapp-legali/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Errore upload documento");
      }

      setForm((prev) => ({
        ...prev,
        allegato_doc: result.path || "",
      }));

      setOkMsg("✅ Documento allegato.");
    } catch (error: any) {
      setErrMsg(error?.message || "Errore upload documento");
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenDoc() {
    if (!form.allegato_doc) return;

    setErrMsg(null);

    try {
      const response = await fetch("/api/rapp-legali/open-doc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: form.allegato_doc }),
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Errore apertura documento");
      }

      if (!result?.signedUrl) {
        throw new Error("URL documento non disponibile.");
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setErrMsg(error?.message || "Errore apertura documento");
    }
  }

  function handleRemoveDoc() {
    setForm((prev) => ({ ...prev, allegato_doc: "" }));
    setOkMsg(null);
    setErrMsg(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setOkMsg(null);
    setErrMsg(null);

    if (!studioId) {
      setErrMsg("studio_id non disponibile: impossibile salvare.");
      return;
    }

    if (!canSave) {
      setErrMsg("Compila almeno Nome e Cognome e un Codice Fiscale valido (16 caratteri).");
      return;
    }

    setLoading(true);

    try {
     const payload = {
  ...(isEditMode ? { id: recordId } : {}),
  studio_id: studioId,
  nome_cognome: form.nome_cognome.trim(),
  codice_fiscale: cf,
  luogo_nascita: form.luogo_nascita.trim() || null,
  data_nascita: form.data_nascita || null,
  citta_residenza: form.citta_residenza.trim() || null,
  CAP: form.cap.trim() || null,
  indirizzo_residenza: form.indirizzo_residenza.trim() || null,
  nazionalita: form.nazionalita.trim() || null,
  tipo_doc: form.tipo_doc || null,
  NumDoc: form.num_doc.trim() || null,
  scadenza_doc: form.scadenza_doc || null,
  allegato_doc: form.allegato_doc || null,
};

      const url = isEditMode ? "/api/rapp-legali/update" : "/api/rapp-legali/save";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";
      let result: any = null;

      if (contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(
          `Endpoint ${url} non restituisce JSON. Risposta ricevuta: ${text.slice(0, 200)}`
        );
      }

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Errore salvataggio rappresentante legale");
      }

      const savedId = result?.data?.id || result?.id || result?.record?.id || "";

      if (!isEditMode && from === "av4" && clienteIdFromQuery && savedId) {
        const supabase = getSupabaseClient() as any;

        const { error: updateClienteError } = await supabase
          .from("tbclienti")
          .update({ rapp_legale_id: savedId })
          .eq("id", clienteIdFromQuery);

        if (updateClienteError) {
          throw new Error(
            `Rappresentante salvato ma errore aggiornamento cliente: ${updateClienteError.message}`
          );
        }

        if (returnTo) {
          const sep = returnTo.includes("?") ? "&" : "?";
          await router.push(`${returnTo}${sep}rapp_saved=1`);
          return;
        }

        const fallbackParams = new URLSearchParams({
          av1_id: av1IdFromQuery || "",
          cliente_id: clienteIdFromQuery || "",
          studio_id: studioId || "",
          rapp_saved: "1",
        });

        if (av4IdFromQuery) {
          fallbackParams.set("id", av4IdFromQuery);
        }

        await router.push(`/antiriciclaggio/modello-av4?${fallbackParams.toString()}`);
        return;
      }

      await router.push("/antiriciclaggio/rappresentanti?saved=1");
    } catch (error: any) {
      setErrMsg(error?.message || "Errore salvataggio rappresentante legale");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    if (from === "av4" && returnTo) {
      router.push(returnTo);
      return;
    }

    router.push("/antiriciclaggio/rappresentanti");
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {isEditMode
              ? "Antiriciclaggio • Modifica rappresentante"
              : "Antiriciclaggio • Nuovo rappresentante"}
          </CardTitle>

          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={handleCancel}>
              Annulla inserimento
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {pageLoading ? (
            <div className="py-8 text-sm text-muted-foreground">
              Caricamento dati rappresentante...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="nome_cognome">Cognome e nome *</Label>
                  <Input
                    id="nome_cognome"
                    value={form.nome_cognome}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nome_cognome: e.target.value }))
                    }
                    placeholder="Mario Rossi"
                  />
                </div>

                <div>
                  <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                  <Input
                    id="codice_fiscale"
                    value={form.codice_fiscale}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        codice_fiscale: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="RSSMRA80A01H501U"
                    maxLength={16}
                  />
                 {cf.length === 16 && !cfOk && (
                  <p className="mt-1 text-sm text-red-500">Codice fiscale non valido</p>
                    )}
                </div>

                <div>
                  <Label htmlFor="nazionalita">Nazionalità</Label>
                  <Input
                    id="nazionalita"
                    value={form.nazionalita}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nazionalita: e.target.value }))
                    }
                    placeholder="Italiana"
                  />
                </div>

                <div>
                  <Label htmlFor="luogo_nascita">Luogo nascita</Label>
                  <Input
                    id="luogo_nascita"
                    value={form.luogo_nascita}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, luogo_nascita: e.target.value }))
                    }
                    placeholder="Roma"
                  />
                </div>

                <div>
                  <Label htmlFor="data_nascita">Data nascita</Label>
                  <Input
                    id="data_nascita"
                    type="date"
                    value={form.data_nascita}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, data_nascita: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="citta_residenza">Città residenza</Label>
                  <Input
                    id="citta_residenza"
                    value={form.citta_residenza}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        citta_residenza: e.target.value,
                      }))
                    }
                    placeholder="Milano"
                  />
                </div>

                <div>
                  <Label htmlFor="indirizzo_residenza">Indirizzo residenza</Label>
                  <Input
                    id="indirizzo_residenza"
                    value={form.indirizzo_residenza}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        indirizzo_residenza: e.target.value,
                      }))
                    }
                    placeholder="Via Roma 10"
                  />
                </div>

                <div>
  <Label htmlFor="cap">CAP</Label>
  <Input
    id="cap"
    value={form.cap}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        cap: e.target.value.replace(/\D/g, "").slice(0, 5),
      }))
    }
    placeholder="00000"
    maxLength={5}
  />
</div>

                <div>
                  <Label htmlFor="tipo_doc">Tipo documento</Label>
                  <Select
                    value={form.tipo_doc}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        tipo_doc: value as TipoDocumento,
                      }))
                    }
                  >
                    <SelectTrigger id="tipo_doc">
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Carta di identità">Carta di identità</SelectItem>
                      <SelectItem value="Passaporto">Passaporto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

 <div>
  <Label htmlFor="num_doc">Numero documento</Label>
  <Input
    id="num_doc"
    value={form.num_doc}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        num_doc: e.target.value,
      }))
    }
    placeholder="AB1234567"
  />
</div>

                <div>
                  <Label htmlFor="scadenza_doc">Scadenza documento</Label>
                  <Input
                    id="scadenza_doc"
                    type="date"
                    value={form.scadenza_doc}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, scadenza_doc: e.target.value }))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="allegato_doc">Allegato documento</Label>

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleUploadDoc(file);
                      }
                      e.currentTarget.value = "";
                    }}
                  />

                  <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <Input
                      id="allegato_doc"
                      type="text"
                      value={form.allegato_doc ? "Documento allegato" : ""}
                      readOnly
                      placeholder="Nessun documento allegato"
                      className="cursor-default"
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                      >
                        {uploading ? "Caricamento..." : "Allega documento"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={!form.allegato_doc}
                        onClick={handleOpenDoc}
                      >
                        Apri
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        disabled={!form.allegato_doc || uploading}
                        onClick={handleRemoveDoc}
                      >
                        Rimuovi
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {!!okMsg && <p className="text-sm text-green-600">{okMsg}</p>}
              {!!errMsg && <p className="text-sm text-red-600">{errMsg}</p>}

              <p className="text-xs text-muted-foreground">
                Debug studio_id: {studioId || "-"} | Bucket: {BUCKET_NAME} | Mode:{" "}
                {isEditMode ? `edit (${recordId})` : "create"} | From: {from || "-"} | Cliente:{" "}
                {clienteIdFromQuery || "-"}
              </p>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading || !canSave}>
                  {loading ? "Salvataggio..." : "Salva dati"}
                </Button>

                <Button type="button" variant="secondary" onClick={resetForm}>
                  {isEditMode ? "Ripristina dati" : "Pulisci"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
