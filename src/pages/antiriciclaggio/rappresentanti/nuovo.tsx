import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";

import { useMasterPasswordGate } from "@/hooks/useMasterPasswordGate";
import { MasterPasswordDialog } from "@/components/security/MasterPasswordDialog";
import { runProtectedSubmit } from "@/lib/security/masterPasswordActions";

import {
  isValidCF,
  normalizeCF,
  extractDataNascitaFromCF,
} from "@/utils/codiceFiscale";
import { getComuneFromCF } from "@/utils/comuniCatastali";
import { sendEmailViaMicrosoft } from "@/services/microsoftEmailService";

import {
  getMicrosoftConnectionsForUser,
  resolveMicrosoftConnectionId,
} from "@/services/microsoftConnectionsService";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

type TipoDocumento =
  | "__NONE__"
  | "Carta di identità"
  | "Passaporto"
  | "Patente";

type FormState = {
  nome_cognome: string;
  codice_fiscale: string;
  luogo_nascita: string;
  data_nascita: string;
  citta_residenza: string;
  indirizzo_residenza: string;
  cap: string;
  nazionalita: string;
  email: string;
  tipo_doc: TipoDocumento;
  num_doc: string;
  scadenza_doc: string;
  allegato_doc: string;
  microsoft_connection_id: string;
  rappresentante_legale: boolean;
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
  email?: string | null;
  tipo_doc?: string | null;
  num_doc?: string | null;
  scadenza_doc?: string | null;
  allegato_doc?: string | null;
  microsoft_connection_id?: string | null;
  rappresentante_legale?: boolean | null;
};

type MicrosoftConnectionRow = {
  id: string;
  studio_id?: string | null;
  nome?: string | null;
  nome_connessione?: string | null;
  email?: string | null;
  tenant_id?: string | null;
  client_id?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
  enabled?: boolean | null;
  created_at?: string | null;
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
  email: "",
  tipo_doc: "__NONE__",
  num_doc: "",
  scadenza_doc: "",
  allegato_doc: "",
  microsoft_connection_id: "",
  rappresentante_legale: false,
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
  tipo === "Carta di identità" ||
  tipo === "Passaporto" ||
  tipo === "Patente"
    ? tipo
    : "__NONE__";

  return {
    nome_cognome: row?.nome_cognome ?? "",
    codice_fiscale: row?.codice_fiscale ?? "",
    luogo_nascita: row?.luogo_nascita ?? "",
    data_nascita: normalizeDateForInput(row?.data_nascita),
    citta_residenza: row?.citta_residenza ?? "",
    indirizzo_residenza: row?.indirizzo_residenza ?? "",
    cap: row?.CAP ?? "",
    nazionalita: row?.nazionalita ?? "",
    email: row?.email ?? "",
    tipo_doc: safeTipo,
    num_doc: row?.num_doc ?? "",
    scadenza_doc: normalizeDateForInput(row?.scadenza_doc),
    allegato_doc: row?.allegato_doc ?? "",
    microsoft_connection_id: row?.microsoft_connection_id ?? "",
    rappresentante_legale: row?.rappresentante_legale ?? false,
  };
}

function getMicrosoftConnectionLabel(conn: MicrosoftConnectionRow): string {
  return (
    conn.nome_connessione?.trim() ||
    conn.nome?.trim() ||
    conn.email?.trim() ||
    (conn.tenant_id ? `Tenant ${conn.tenant_id}` : "") ||
    `Connessione ${conn.id.slice(0, 8)}`
  );
}

function isConnectionEnabled(conn: MicrosoftConnectionRow): boolean {
  if (typeof conn.is_active === "boolean") return conn.is_active;
  if (typeof conn.active === "boolean") return conn.active;
  if (typeof conn.enabled === "boolean") return conn.enabled;
  return true;
}

export default function NuovoRappresentantePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isEditMode =
    router.isReady && typeof router.query.id === "string" && !!router.query.id;

  const recordId =
    router.isReady && typeof router.query.id === "string" ? router.query.id : "";

  const from =
    router.isReady && typeof router.query.from === "string" ? router.query.from : "";

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
  const [initialLoadedForm, setInitialLoadedForm] =
    useState<FormState>(initialFormState);

  const [pageLoading, setPageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [publicDocUrl, setPublicDocUrl] = useState("");
  const [sendingPublicDoc, setSendingPublicDoc] = useState(false);

  const [microsoftConnections, setMicrosoftConnections] = useState<
    MicrosoftConnectionRow[]
  >([]);
  const [loadingMicrosoftConnections, setLoadingMicrosoftConnections] =
    useState(false);

  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const masterPasswordGate = useMasterPasswordGate({
  studioId,
  onUnlocked: async () => {},
});

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
     LOAD MICROSOFT CONNECTIONS
     ========================================================= */
  useEffect(() => {
    if (!studioId) return;

    let cancelled = false;

    const loadMicrosoftConnections = async () => {
      const supabase = getSupabaseClient() as any;
      setLoadingMicrosoftConnections(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id || "";

        if (!userId) {
          throw new Error("Utente non autenticato.");
        }

        const rows = (await getMicrosoftConnectionsForUser(
          studioId,
          userId
        )) as MicrosoftConnectionRow[];

        if (cancelled) return;

        setMicrosoftConnections(rows);

        setForm((prev) => ({
          ...prev,
          microsoft_connection_id: resolveMicrosoftConnectionId(
            rows as any,
            prev.microsoft_connection_id
          ),
        }));
      } catch (error: any) {
        if (!cancelled) {
          setErrMsg((prev) => prev || error?.message || "Errore connessioni Microsoft");
        }
      } finally {
        if (!cancelled) {
          setLoadingMicrosoftConnections(false);
        }
      }
    };

    void loadMicrosoftConnections();

    return () => {
      cancelled = true;
    };
  }, [studioId]);

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
          const response = await fetch(
            `/api/rapp-legali/get-by-id?id=${encodeURIComponent(recordId)}`
          );
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
              "id, studio_id, nome_cognome, codice_fiscale, luogo_nascita, data_nascita, citta_residenza, indirizzo_residenza, CAP, nazionalita, email, tipo_doc, num_doc, scadenza_doc, allegato_doc, microsoft_connection_id, rappresentante_legale"
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

        setForm((prev) => ({
          ...mapped,
          microsoft_connection_id:
            mapped.microsoft_connection_id || prev.microsoft_connection_id || "",
        }));

        setInitialLoadedForm((prev) => ({
          ...mapped,
          microsoft_connection_id:
            mapped.microsoft_connection_id || prev.microsoft_connection_id || "",
        }));

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

  const selectedMicrosoftConnection = useMemo(() => {
    return microsoftConnections.find((c) => c.id === form.microsoft_connection_id) || null;
  }, [microsoftConnections, form.microsoft_connection_id]);

  const documentoAttivo = form.tipo_doc !== "__NONE__";

  /* =========================================================
     ACTIONS
     ========================================================= */

    async function handleCodiceFiscaleAutoComune(rawValue: string) {
    const normalized = normalizeCF(rawValue);

    setForm((prev) => ({
      ...prev,
      codice_fiscale: normalized,
    }));

    if (normalized.length !== 16) return;
    if (!isValidCF(normalized)) return;

    try {
      const comuneData = await getComuneFromCF(normalized);
      const dataNascita = extractDataNascitaFromCF(normalized);

      setForm((prev) => ({
        ...prev,
        codice_fiscale: normalized,
        luogo_nascita: prev.luogo_nascita?.trim()
          ? prev.luogo_nascita
          : comuneData?.comune || "",
        data_nascita: prev.data_nascita?.trim()
          ? prev.data_nascita
          : dataNascita || "",
        nazionalita: prev.nazionalita?.trim()
          ? prev.nazionalita
          : comuneData?.nazionalita || "",
      }));
    } catch (error) {
      console.error("Errore lookup dati da codice fiscale:", error);
    }
  }
  
  function resetForm() {
    setOkMsg(null);
    setErrMsg(null);

    if (isEditMode) {
      setForm(initialLoadedForm);
    } else {
      setForm((prev) => ({
        ...initialFormState,
        microsoft_connection_id:
          prev.microsoft_connection_id || microsoftConnections[0]?.id || "",
      }));
      setPublicDocUrl("");
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
  setForm((prev) => ({
    ...prev,
    allegato_doc: "",
    tipo_doc: "__NONE__",
    num_doc: "",
    scadenza_doc: "",
  }));
  setOkMsg(null);
  setErrMsg(null);
}

  async function handleInviaRichiestaDocumento() {
    const supabase = getSupabaseClient() as any;
    let token = "";
    let userId: string | null = null;

    try {
      if (!recordId) {
        alert("Salva prima il rappresentante.");
        return;
      }

      if (!studioId) {
        alert("studio_id non disponibile.");
        return;
      }

      if (!form.email || !String(form.email).trim()) {
        alert("Il rappresentante non ha un indirizzo email valorizzato.");
        return;
      }

      if (!form.microsoft_connection_id || !String(form.microsoft_connection_id).trim()) {
        alert("Seleziona una connessione Microsoft.");
        return;
      }

      const resolvedConnectionId = resolveMicrosoftConnectionId(
        microsoftConnections as any,
        form.microsoft_connection_id
      );

      const connection = microsoftConnections.find(
        (c) => c.id === resolvedConnectionId
      );

      if (!connection || !resolvedConnectionId) {
        alert("La connessione Microsoft selezionata non è disponibile.");
        return;
      }

      setSendingPublicDoc(true);

      token =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const nowIso = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("rapp_legali")
        .update({
          public_doc_token: token,
          public_doc_enabled: true,
          public_doc_sent_at: nowIso,
          public_doc_opened_at: null,
          public_doc_submitted_at: null,
          doc_richiesto_il: nowIso,
          microsoft_connection_id: form.microsoft_connection_id,
        })
        .eq("id", recordId);

      if (updateError) {
        console.error("Errore aggiornamento link pubblico documento:", updateError);
        alert("Errore durante la generazione del link pubblico.");
        return;
      }

      const publicAppUrl =
      process.env.NEXT_PUBLIC_PUBLIC_APP_URL || "https://studio-manager-public.vercel.app";

      const url = `${publicAppUrl}/documento/${token}`;
      setPublicDocUrl(url);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      userId = session?.user?.id ?? null;

      if (!userId) {
        alert(
          `Link generato, ma non è stato possibile identificare l'utente mittente.\n${url}`
        );
        return;
      }

      const nomeDestinatario = form.nome_cognome || "Cliente";
      const destinatario = String(form.email).trim();
      const subject = "Richiesta aggiornamento documento di riconoscimento";
      const bodyPreview = `Richiesta aggiornamento documento inviata a ${destinatario}. Link pubblico: ${url}`;

     const html = `
  <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.6;">
    <p>Gentile ${nomeDestinatario},</p>

    <p>
      La invitiamo ad allegare un documento di riconoscimento in corso di validità.
    </p>

    <p>
      La invitiamo inoltre a verificare la correttezza dei dati relativi alla residenza
      (città, indirizzo e CAP) e, qualora mancanti o non aggiornati, a completarli
      direttamente nella pagina di caricamento.
    </p>

    <p>
      Può caricare il nuovo documento tramite il seguente collegamento riservato:
    </p>

    <p>
      <a href="${url}" target="_blank" rel="noopener noreferrer">
        ${url}
      </a>
    </p>

    <p><strong>Documenti accettati:</strong></p>

  <ul style="padding-left: 18px; margin: 8px 0;">
  <li>Carta di identità</li>
  <li>Passaporto</li>
  <li>Patente</li>
</ul>

    <p>
      Il documento allegato dovrà essere completo e chiaramente leggibile, senza tagli,
      sfocature, riflessi o parti coperte.
      </p>

    <p>
      Le chiediamo di compilare i campi richiesti, verificare i dati di residenza
      e allegare il documento aggiornato.
    </p>

    <p>
      Una volta completata la procedura, il collegamento non sarà più riutilizzabile.
    </p>

    <p>Cordiali saluti,<br />Studio Manager Pro</p>
  </div>
`;

      await sendEmailViaMicrosoft(userId, {
        microsoftConnectionId: form.microsoft_connection_id,
        to: destinatario,
        subject,
        html,
      });

      const { error: logError } = await supabase.from("tbAMLComunicazioni").insert({
        studio_id: studioId,
        tipo_comunicazione: "richiesta_documento",
        cliente_id: clienteIdFromQuery || null,
        rapp_legale_id: recordId,
        av4_id: av4IdFromQuery || null,
        destinatario_email: destinatario,
        oggetto: subject,
        body_preview: bodyPreview,
        stato_invio: "inviata",
        data_invio: nowIso,
        utente_id: userId,
        public_token: token,
        note: "Invio richiesta documento da anagrafica rappresentante",
      });

      if (logError) {
        console.error("Errore salvataggio log tbAMLComunicazioni:", logError);
        alert(
          `Email inviata correttamente a ${destinatario}, ma il log AML non è stato salvato.`
        );
        return;
      }

      alert(`Email inviata correttamente a ${destinatario}.`);
    } catch (error: any) {
      console.error("Errore invio richiesta documento:", error);

      try {
        if (studioId && recordId && form.email?.trim()) {
          await supabase.from("tbAMLComunicazioni").insert({
            studio_id: studioId,
            tipo_comunicazione: "richiesta_documento",
            cliente_id: clienteIdFromQuery || null,
            rapp_legale_id: recordId,
            av4_id: av4IdFromQuery || null,
            destinatario_email: String(form.email).trim(),
            oggetto: "Richiesta aggiornamento documento di riconoscimento",
            body_preview: `Errore invio richiesta documento a ${String(form.email).trim()}.`,
            stato_invio: "errore",
            data_invio: new Date().toISOString(),
            utente_id: userId,
            public_token: token || null,
            note:
              error?.message ||
              "Errore durante l'invio della richiesta documento.",
          });
        }
      } catch (logCatchError) {
        console.error("Errore salvataggio log AML di errore:", logCatchError);
      }

      alert(
        `Errore durante l'invio della richiesta documento: ${
          error?.message || "errore sconosciuto"
        }`
      );
    } finally {
      setSendingPublicDoc(false);
    }
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
    setErrMsg(
      "Compila almeno Nome e Cognome e un Codice Fiscale valido (16 caratteri)."
    );
    return;
  }

  setLoading(true);

  try {
    await runProtectedSubmit({
      encryptionEnabled: true,
      requireUnlock: masterPasswordGate.requireUnlock,
      action: async () => {
        const payload = {
          ...(isEditMode ? { id: recordId } : {}),
          studio_id: studioId,
          nome_cognome: form.nome_cognome.trim(),
          codice_fiscale: cf,
          luogo_nascita: form.luogo_nascita.trim() || null,
          data_nascita: form.data_nascita || null,
          citta_residenza: form.citta_residenza.trim() || null,
          indirizzo_residenza: form.indirizzo_residenza.trim() || null,
          CAP: form.cap.trim() || null,
          nazionalita: form.nazionalita.trim() || null,
          email: form.email.trim() || null,
          tipo_doc: form.tipo_doc === "__NONE__" ? null : form.tipo_doc,
          num_doc:
            form.tipo_doc === "__NONE__" ? null : form.num_doc.trim() || null,
          scadenza_doc:
            form.tipo_doc === "__NONE__" ? null : form.scadenza_doc || null,
          allegato_doc: form.allegato_doc || null,
          microsoft_connection_id: form.microsoft_connection_id || null,
          rappresentante_legale: form.rappresentante_legale ?? false,
        };

        const url = isEditMode
          ? "/api/rapp-legali/update"
          : "/api/rapp-legali/save";

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
          throw new Error(
            result?.error || "Errore salvataggio rappresentante legale"
          );
        }

        const savedId =
          result?.data?.id || result?.id || result?.record?.id || "";

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

          await router.push(
            `/antiriciclaggio/modello-av4?${fallbackParams.toString()}`
          );
          return;
        }

        await router.push("/antiriciclaggio/rappresentanti?saved=1");
      },
    });
  } catch (error: any) {
    setErrMsg(error?.message || "Errore salvataggio rappresentante legale");
  } finally {
    setLoading(false);
  }
}

  function handleCancel() {
    if (from === "av4" && returnTo) {
      void router.push(returnTo);
      return;
    }

    void router.push("/antiriciclaggio/rappresentanti");
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
           <form
  onSubmit={handleSubmit}
  onKeyDown={(e) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  }}
  className="space-y-6"
>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
    onChange={(e) => {
      const value = normalizeCF(e.target.value);

      setForm((prev) => ({
        ...prev,
        codice_fiscale: value,
      }));

      if (value.length === 16) {
        void handleCodiceFiscaleAutoComune(value);
      }
    }}
    placeholder="RSSMRA80A01H501U"
    maxLength={16}
  />
  {cf.length === 16 && !cfOk && (
    <p className="mt-1 text-sm text-red-500">
      Codice fiscale non valido
    </p>
  )}
</div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="nome@dominio.it"
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-2 rounded-md border p-3">
                  <Checkbox
                    id="rappresentante_legale"
                    checked={form.rappresentante_legale}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        rappresentante_legale: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="rappresentante_legale" className="cursor-pointer">
                    Rappresentante legale
                  </Label>
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
                    maxLength={5}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="text-sm font-medium">Documento di riconoscimento</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="tipo_doc">Tipo documento</Label>
                   <Select
  value={form.tipo_doc}
  onValueChange={(value) =>
    setForm((prev) => ({
      ...prev,
      tipo_doc: value as TipoDocumento,
      ...(value === "__NONE__"
        ? {
            num_doc: "",
            scadenza_doc: "",
          }
        : {}),
    }))
  }
>
  <SelectTrigger id="tipo_doc">
    <SelectValue placeholder="Seleziona..." />
  </SelectTrigger>

  <SelectContent>
    <SelectItem value="__NONE__">----</SelectItem>

    <SelectItem value="Carta di identità">
      Carta di identità
    </SelectItem>

    <SelectItem value="Passaporto">
      Passaporto
    </SelectItem>

    <SelectItem value="Patente">
      Patente
    </SelectItem>
  </SelectContent>
</Select>
                  </div>

                  <div>
                    <Label htmlFor="num_doc">Numero documento</Label>
                   <Input
                    id="num_doc"
                      value={form.num_doc}
                      disabled={!documentoAttivo}
                      onChange={(e) =>
                        setForm((prev) => ({
                      ...prev,
                    num_doc: e.target.value,
                          }))
                        }
                        className={!documentoAttivo ? "bg-muted text-muted-foreground" : ""}
                    />
                  </div>

                  <div>
                    <Label htmlFor="scadenza_doc">Scadenza documento</Label>
                    <Input
  id="scadenza_doc"
  type="date"
  value={form.scadenza_doc}
  disabled={!documentoAttivo}
  onChange={(e) =>
    setForm((prev) => ({
      ...prev,
      scadenza_doc: e.target.value,
    }))
  }
  className={!documentoAttivo ? "bg-muted text-muted-foreground" : ""}
/>
                  </div>
                </div>

                <div className="space-y-3">
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

                  <Input
                    id="allegato_doc"
                    type="text"
                    value={form.allegato_doc ? "Documento allegato" : ""}
                    readOnly
                    placeholder="Nessun documento allegato"
                    className="cursor-default"
                  />

                  <div className="flex flex-wrap items-center gap-2">
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

                    <Button
                      type="button"
                      onClick={handleInviaRichiestaDocumento}
                      disabled={sendingPublicDoc || !recordId}
                      variant="outline"
                      className="h-10 border-red-600 bg-white px-4 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      {sendingPublicDoc ? "Invio..." : "Richiedi nuovo documento"}
                    </Button>
                  </div>

                  {publicDocUrl && (
                    <div className="pt-1">
                      <Input value={publicDocUrl} readOnly className="bg-gray-50 text-sm" />
                    </div>
                  )}
                </div>
              </div>

              {!!okMsg && <p className="text-sm text-green-600">{okMsg}</p>}
              {!!errMsg && <p className="text-sm text-red-600">{errMsg}</p>}

              <p className="text-xs text-muted-foreground">
                Debug studio_id: {studioId || "-"} | Bucket: {BUCKET_NAME} | Mode:{" "}
                {isEditMode ? `edit (${recordId})` : "create"} | From: {from || "-"} |
                Cliente: {clienteIdFromQuery || "-"} | Connessione Microsoft:{" "}
                {selectedMicrosoftConnection
                  ? getMicrosoftConnectionLabel(selectedMicrosoftConnection)
                  : "-"}
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
      <MasterPasswordDialog
  open={masterPasswordGate.open}
  onOpenChange={masterPasswordGate.setOpen}
  password={masterPasswordGate.password}
  onPasswordChange={masterPasswordGate.setPassword}
  onUnlock={masterPasswordGate.handleUnlock}
  loading={masterPasswordGate.unlocking}
/>
    </div>
  );
}
