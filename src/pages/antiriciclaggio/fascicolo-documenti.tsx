import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import AmlOrganiDocumenti from "@/components/aml/AmlOrganiDocumenti";
import { FileText, Image as ImageIcon, File, Trash2 } from "lucide-react";

type ClienteRow = {
  id: string;
  ragione_sociale?: string | null;
  cod_cliente?: string | null;
};

type DocumentoRow = {
  id: string;
  //av1_id?: string | number | null;
  pratica_id?: string | null;
  cliente_id?: string | null;
  av4_id?: string | number | null;
  tipo_documento?: string | null;

  societa_documento_id?: string | null;

  nome_file?: string | null;

  storage_path?: string | null;
  bucket_name?: string | null;
  mime_type?: string | null;
  dimensione?: number | null;
  origine?: string | null;
  note?: string | null;
  created_at?: string | null;
};

type VisuraTeRichiesta = {
  societa_id: string;
  societa_nome: string;
  motivo: "cliente" | "percorso_te";
  percorsi: string[][];
};

const TIPO_DOCUMENTO_OPTIONS = [
  "Documento generico",
  "Documento identità",
  "Codice fiscale",
  "Visura camerale",
  "Contratto",
  "Delega",
  "Modulo firmato",
  "Altro",
];

function getFileNameFromPath(path?: string | null) {
  if (!path) return "file";
  const parts = path.split("/");
  return parts[parts.length - 1] || "file";
}

function getMimeTypeFromPath(path?: string | null) {
  if (!path) return null;

  const lower = path.toLowerCase();

  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";

  return null;
}

function getDisplayFileName(name?: string | null) {
  if (!name) return "-";
  return name.replace(/^\d+_/, "");
}

function getOrigineLabel(orig?: string | null) {
  switch (orig) {
    case "av1_firmato":
  return "AV1 firmato";
case "av2_firmato":
  return "AV2 firmato";
case "av4_pdf":
  return "AV4 firmato";
    case "documento_rappresentante":
      return "Documento rappresentante";
    case "manuale":
      return "Caricato manualmente";
    default:
      return orig || "-";
  }
}

function getOrigineBadgeClass(orig?: string | null) {
  switch (orig) {
  case "av1_firmato":
  return "bg-blue-50 text-blue-700 border-blue-200";
case "av2_firmato":
  return "bg-cyan-50 text-cyan-700 border-cyan-200";
case "av4_pdf":
  return "bg-violet-50 text-violet-700 border-violet-200";
    case "documento_rappresentante":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "manuale":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function getFormatoLabel(mime?: string | null) {
  if (!mime) return "";
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPG";
  if (mime === "image/png") return "PNG";
  if (mime === "image/webp") return "WEBP";
  return mime;
}

function getFormatoIcon(mime?: string | null) {
  if (!mime) return <File className="w-4 h-4 text-gray-400" />;

  if (mime.includes("pdf")) {
    return <FileText className="w-4 h-4 text-red-500" />;
  }

  if (mime.includes("image")) {
    return <ImageIcon className="w-4 h-4 text-blue-500" />;
  }

  return <File className="w-4 h-4 text-gray-400" />;
}

export default function FascicoloDocumentiPage() {
  const router = useRouter();
 const { pratica_id, cliente_id } = router.query;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [clienteNome, setClienteNome] = useState("Cliente");
  const [clienteIdPratica, setClienteIdPratica] = useState("");
  const [prestazionePratica, setPrestazionePratica] = useState("");
  
  const [clienteIsSocieta, setClienteIsSocieta] = useState(false);
  
  const [documenti, setDocumenti] = useState<DocumentoRow[]>([]);
  const [controlliAV7, setControlliAV7] = useState<Array<{ id: string; data_controllo: string; esito: string }>>([]);
  const [versioniAV1, setVersioniAV1] = useState<Array<{ id: number; DataVerifica: string | null; AV1Conferma: boolean | null; allegato_av1_firmato: string | null; Prestazione: string | null }>>([]);
  const [versioniAV4, setVersioniAV4] = useState<Array<{ id: string; created_at: string | null; compilato_da_cliente: boolean | null; pdf_firmato_cliente: string | null }>>([]);
  const [uploading, setUploading] = useState(false);
  const [workingDocumentId, setWorkingDocumentId] = useState<string | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState("Documento generico");
  const [regolaDiCondottaRichiesta, setRegolaDiCondottaRichiesta] = useState("");

  const [documentiMancanti, setDocumentiMancanti] = useState<string[]>([]);

  const [documentiOpzionaliMancanti, setDocumentiOpzionaliMancanti] = useState<string[]>([]);
const [fascicoloCompleto, setFascicoloCompleto] = useState(false);

const [visureTeRichieste, setVisureTeRichieste] =
  useState<VisuraTeRichiesta[]>([]);

const [societaDocumentoId, setSocietaDocumentoId] =
  useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const syncedRef = useRef<string | null>(null);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleString("it-IT");
  };

  const formatSize = (value?: number | null) => {
    if (!value || value <= 0) return "";

    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  };

const ensureDocumentoInFascicolo = async ({
  supabase,
  studioId,
  praticaId,
   clienteId,
societaDocumentoId = null,
tipoDocumento,
  storagePath,
  bucketName = "allegati",
  mimeType = null,
  origine,
  note = null,
}: {
  supabase: any;
  studioId: string;
  praticaId: string;
 clienteId: string | null;
societaDocumentoId?: string | null;
tipoDocumento: string;
  storagePath: string;
  bucketName?: string;
  mimeType?: string | null;
  origine: string;
  note?: string | null;
}) => {
  
const nomeFile = getFileNameFromPath(storagePath);

const { data: existing, error: existingError } = await supabase
  .from("tbAVFascicoliDocumenti")
  .select("id")
  .eq("studio_id", studioId)
  .eq("pratica_id", praticaId)
  .eq("origine", origine)
  .eq("storage_path", storagePath)
  .limit(1)
  .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existing?.id) {
    return;
  }

  const { error: insertError } = await supabase
    .from("tbAVFascicoliDocumenti")
    .insert({
      studio_id: studioId,
      pratica_id: praticaId,
     cliente_id: clienteId,
    societa_documento_id: societaDocumentoId,
    tipo_documento: tipoDocumento,
      nome_file: nomeFile,
      storage_path: storagePath,
      bucket_name: bucketName,
      mime_type: mimeType,
      dimensione: null,
      origine,
      note,
    });

  if (insertError) {
    throw insertError;
  }
};
const syncDocumentiCollegati = async (
  supabase: any,
  studioId: string,
  praticaId: string,
  clienteIdFromQuery: string | null
) => {
  const { data: praticaData, error: praticaError } = await supabase
    .from("tbPraticheAML")
    .select("id, cliente_id, tipo_prestazione")
    .eq("studio_id", studioId)
    .eq("id", praticaId)
    .maybeSingle();

  if (praticaError) {
    throw praticaError;
  }

  setPrestazionePratica(String(praticaData?.tipo_prestazione || "").trim());

  const effectiveClienteId = clienteIdFromQuery || praticaData?.cliente_id || null;

  if (!effectiveClienteId) {
    return;
  }

  // Ogni rinnovo AV1 è una versione separata: importiamo tutti i firmati.
  const { data: av1Documenti, error: av1DocumentoError } = await supabase
    .from("tbAV1")
    .select("id, DataVerifica, allegato_av1_firmato")
    .eq("studio_id", studioId)
    .eq("pratica_id", praticaId)
    .order("DataVerifica", { ascending: true });

  if (av1DocumentoError) throw av1DocumentoError;

  for (const av1 of av1Documenti || []) {
    if (!av1.allegato_av1_firmato) continue;
    await ensureDocumentoInFascicolo({
      supabase,
      studioId,
      praticaId,
      clienteId: effectiveClienteId,
      tipoDocumento: "Modulo firmato",
      storagePath: av1.allegato_av1_firmato,
      bucketName: "allegati",
      mimeType: getMimeTypeFromPath(av1.allegato_av1_firmato),
      origine: "av1_firmato",
      note: `AV1 versione ${av1.id}, verifica ${av1.DataVerifica || "data non disponibile"}`,
    });
  }

 const { data: clienteData, error: clienteError } = await supabase
  .from("tbclienti")
  .select("id, ragione_sociale, cod_cliente")
  .eq("id", effectiveClienteId)
  .maybeSingle();

  if (clienteError) {
    throw clienteError;
  }

  if (clienteData) {
    const cliente = clienteData as ClienteRow;
    const nome = cliente.ragione_sociale || cliente.cod_cliente || "Cliente";

    setClienteNome(nome);

    const nomeNormalizzato = nome
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/\./g, "");

    setClienteIsSocieta(
      nomeNormalizzato.includes("srl") ||
        nomeNormalizzato.includes("spa") ||
        nomeNormalizzato.includes("snc") ||
        nomeNormalizzato.includes("sas") ||
        nomeNormalizzato.includes("sapa") ||
        nomeNormalizzato.includes("societa") ||
        nomeNormalizzato.includes("società")
    );
  }

 // Collegamento documenti rappresentante tramite API autenticata.

};

 const calcolaStatoFascicolo = (
  docs: DocumentoRow[],
  isSocietaCliente: boolean,
  visureRichieste: VisuraTeRichiesta[],
  regolaDiCondotta: string
) => {
  const normalizza = (value: any) =>
    String(value || "").toLowerCase().trim();

  const hasDoc = (check: (doc: DocumentoRow) => boolean) =>
    docs.some(check);

  const av1EsclusoPerRegola = String(regolaDiCondotta || "").trim().length > 0;

  const hasAV1 =
    av1EsclusoPerRegola ||
    hasDoc((doc) => {
      const origine = normalizza(doc.origine);
      const tipo = normalizza(doc.tipo_documento);

      return (
        origine === "av1_firmato" ||
        origine === "av1 firmato" ||
        origine === "av1_pdf" ||
        tipo === "av1 firmato" ||
        tipo === "modulo firmato"
      );
    });

  const hasRegolaDiCondotta =
    !av1EsclusoPerRegola ||
    hasDoc((doc) => normalizza(doc.tipo_documento) === normalizza(regolaDiCondotta));

  const hasAV4 = hasDoc((doc) => {
    const origine = normalizza(doc.origine);
    const tipo = normalizza(doc.tipo_documento);

    return (
      origine === "av4_pdf" ||
      origine === "av4_firmato" ||
      origine === "av4 firmato" ||
      tipo === "av4 firmato"
    );
  });

  const hasDocumentoIdentita = hasDoc((doc) => {
    const origine = normalizza(doc.origine);
    const tipo = normalizza(doc.tipo_documento);

    return (
      origine === "documento_rappresentante" ||
      origine === "documento rappresentante" ||
      tipo === "documento identità" ||
      tipo === "documento identita"
    );
  });

 const isVisura = (doc: DocumentoRow) => {
  const origine = normalizza(doc.origine);
  const tipo = normalizza(doc.tipo_documento);

  return origine.includes("visura") || tipo.includes("visura");
};

const visurePresentiConSocieta = new Set(
  docs
    .filter(
      (doc) =>
        isVisura(doc) &&
        !!doc.societa_documento_id
    )
    .map((doc) =>
      String(doc.societa_documento_id)
    )
);

const visureGenericheLegacy = docs.filter(
  (doc) =>
    isVisura(doc) &&
    !doc.societa_documento_id
);

const visureMancanti =
  isSocietaCliente
    ? visureRichieste.filter((visura) => {
        if (
          visurePresentiConSocieta.has(
            String(visura.societa_id)
          )
        ) {
          return false;
        }

        /*
         * Compatibilità con i vecchi fascicoli:
         * se serve una sola visura e ne esiste già
         * una vecchia senza societa_documento_id,
         * la consideriamo quella del cliente.
         *
         * Se le visure richieste sono più di una,
         * NON possiamo attribuire una vecchia
         * visura generica a una società a caso.
         */
        if (
          visureRichieste.length === 1 &&
          visureGenericheLegacy.length > 0
        ) {
          return false;
        }

        return true;
      })
    : [];

  const hasContratto = hasDoc((doc) => {
    const origine = normalizza(doc.origine);
    const tipo = normalizza(doc.tipo_documento);

    return origine.includes("contratto") || tipo.includes("contratto");
  });

const isSocieta = isSocietaCliente;
  const mancanti: string[] = [];

  if (!hasAV1) mancanti.push("AV1 firmato");
  if (!hasRegolaDiCondotta) mancanti.push(regolaDiCondotta);
  if (!hasAV4) mancanti.push("AV4 firmato");
 const hasCodiceFiscale = hasDoc((doc) => {
  const origine = normalizza(doc.origine);
  const tipo = normalizza(doc.tipo_documento);

  return (
    origine.includes("codice fiscale") ||
    origine.includes("codice_fiscale") ||
    tipo.includes("codice fiscale") ||
    tipo.includes("codice_fiscale")
  );
});

if (!hasDocumentoIdentita) {
  mancanti.push("Documento identità");
}

visureMancanti.forEach((visura) => {
  mancanti.push(
    `Visura camerale - ${visura.societa_nome}`
  );
});

if (!hasContratto) {
  mancanti.push("Contratto professionale");
}

const opzionaliMancanti: string[] = [];

if (!hasCodiceFiscale) opzionaliMancanti.push("Codice fiscale");

setDocumentiMancanti(mancanti);
setDocumentiOpzionaliMancanti(opzionaliMancanti);
setFascicoloCompleto(mancanti.length === 0);
   
void fetch("/api/antiriciclaggio/fascicolo-alert/upsert", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
body: JSON.stringify({
  pratica_id: typeof pratica_id === "string" ? pratica_id : null,
    cliente_id: typeof cliente_id === "string" ? cliente_id : null,
    documenti_mancanti: mancanti,
    documenti_opzionali_mancanti: opzionaliMancanti,
    completo: mancanti.length === 0,
  }),
});
};


  const loadData = async () => {
    try {
    if (!router.isReady || typeof pratica_id !== "string" || !pratica_id) return;

      setLoading(true);

      const studioId = await getStudioId();
      if (!studioId) {
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient() as any;
   const clienteIdValue =
  typeof cliente_id === "string" && cliente_id.trim() !== ""
    ? cliente_id
    : null;

const {data:praticaAttiva,error:praticaAttivaError}=await supabase
  .from("tbPraticheAML").select("cliente_id").eq("studio_id",studioId).eq("id",pratica_id).maybeSingle();
if(praticaAttivaError)throw praticaAttivaError;
if(!praticaAttiva?.cliente_id)throw new Error("Cliente non trovato per la pratica AML.");
if(clienteIdValue && clienteIdValue!==praticaAttiva.cliente_id)throw new Error("Cliente e pratica AML non corrispondono.");
const effectiveClienteId=String(praticaAttiva.cliente_id);
setClienteIdPratica(effectiveClienteId);

let visureRichieste: VisuraTeRichiesta[] = [];

if (clienteIdValue) {
  const responseGruppi = await fetch(
    `/api/gruppi-societari?cliente_id=${encodeURIComponent(
      clienteIdValue
    )}`
  );

  if (!responseGruppi.ok) {
    throw new Error(
      "Errore nel recupero delle società rilevanti per il Titolare Effettivo."
    );
  }

  const gruppiData = await responseGruppi.json();

  visureRichieste = Array.isArray(
    gruppiData?.visure_te_richieste
  )
    ? gruppiData.visure_te_richieste
    : [];

  setVisureTeRichieste(visureRichieste);
}

const { data: av1PrestazioneData, error: av1PrestazioneError } = await supabase
  .from("tbAV1")
  .select("Prestazione")
  .eq("studio_id", studioId)
  .eq("pratica_id", pratica_id)
  .order("DataVerifica", { ascending: false })
  .limit(1)
  .maybeSingle();

if (av1PrestazioneError) {
  throw av1PrestazioneError;
}

let regolaDiCondotta = "";

if (av1PrestazioneData?.Prestazione) {
  const { data: prestazioneArData, error: prestazioneArError } = await supabase
    .from("tbElencoPrestAR")
    .select("RischioTipoPrestAR, RegolaDiCondotta")
    .eq("TipoPrestazioneAR", av1PrestazioneData.Prestazione)
    .maybeSingle();

  if (prestazioneArError) {
    throw prestazioneArError;
  }

  if (
    prestazioneArData?.RischioTipoPrestAR === "Non significativo" &&
    String(prestazioneArData?.RegolaDiCondotta || "").trim()
  ) {
    regolaDiCondotta = String(prestazioneArData.RegolaDiCondotta).trim();
  }
}

setRegolaDiCondottaRichiesta(regolaDiCondotta);

// Collega anche i documenti già archiviati, senza una seconda copia del PDF.
const {data:{session}}=await supabase.auth.getSession();
if(!session?.access_token)throw new Error("Sessione non valida per sincronizzare documenti.");
const responseDoc=await fetch("/api/aml/documenti-organi",{
  method:"POST",
  headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
  body:JSON.stringify({action:"sync",cliente_id:effectiveClienteId,pratica_id})
});
const dataDoc=await responseDoc.json().catch(()=>({}));
if(!responseDoc.ok||!dataDoc.ok)throw new Error(dataDoc.error||"Errore sincronizzazione documento rappresentante.");
const syncKey = `${studioId}|${pratica_id}|${effectiveClienteId}`;
if (syncedRef.current !== syncKey) {
  await syncDocumentiCollegati(supabase, studioId, pratica_id, effectiveClienteId);
  syncedRef.current = syncKey;
}
      
const { data: clienteCheckData } = await supabase
  .from("tbclienti")
  .select("ragione_sociale, cod_cliente")
  .eq("id", clienteIdValue)
  .maybeSingle();

const nomeClienteCheck =
  clienteCheckData?.ragione_sociale ||
  clienteCheckData?.cod_cliente ||
  clienteNome;

const nomeClienteNormalizzato = String(nomeClienteCheck || "")
  .toLowerCase()
  .replace(/\s+/g, "")
  .replace(/\./g, "");

const isSocietaCliente =
  nomeClienteNormalizzato.includes("srl") ||
  nomeClienteNormalizzato.includes("spa") ||
  nomeClienteNormalizzato.includes("snc") ||
  nomeClienteNormalizzato.includes("sas") ||
  nomeClienteNormalizzato.includes("sapa") ||
  nomeClienteNormalizzato.includes("societa") ||
  nomeClienteNormalizzato.includes("società");

let query = supabase
  .from("tbAVFascicoliDocumenti")
  .select(`
    id,
    pratica_id,
    cliente_id,
    av4_id,
   tipo_documento,
societa_documento_id,

nome_file,
    storage_path,
    bucket_name,
    mime_type,
    dimensione,
    origine,
    note,
    created_at
  `)
  .eq("studio_id", studioId)
  .order("created_at", { ascending: false });

query = query.eq("pratica_id", pratica_id);

const { data, error } = await query;

      if (error) {
        console.error("Errore caricamento documenti:", error);
        alert(`Errore caricamento documenti: ${error.message}`);
        setDocumenti([]);
        return;
      }

     setDocumenti(data || []);

calcolaStatoFascicolo(
  data || [],
  isSocietaCliente,
  visureRichieste,
  regolaDiCondotta
);
    } catch (err: any) {
      console.error("Errore loadData fascicolo:", err);
      alert(err?.message || "Errore caricamento fascicolo documenti");
      setDocumenti([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    try {
     if (!file || typeof pratica_id !== "string" || !pratica_id) return;

      if (
  tipoDocumento === "Visura camerale" &&
  !societaDocumentoId
) {
  alert(
    "Seleziona la società a cui appartiene la visura camerale."
  );
  return;
}

      setUploading(true);

      const studioId = await getStudioId();
      if (!studioId) {
        alert("Studio non trovato");
        return;
      }

      const supabase = getSupabaseClient() as any;

      const originalName = file.name || "file";
      const safeOriginalName = originalName.replace(/\s+/g, "_");
      const fileName = `${Date.now()}_${safeOriginalName}`;
      const fascicoloKey = pratica_id;
      const filePath = `antiriciclaggio/fascicoli/${studioId}/${fascicoloKey}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("allegati")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("tbAVFascicoliDocumenti")
        .insert({
  studio_id: studioId,
  pratica_id,
  cliente_id:
    typeof cliente_id === "string" && cliente_id.trim() !== ""
      ? cliente_id
      : null,
          nome_file: file.name,
          storage_path: filePath,
          bucket_name: "allegati",
          mime_type: file.type || null,
          dimensione: file.size,
         origine: "manuale",

societa_documento_id:
  tipoDocumento === "Visura camerale"
    ? societaDocumentoId
    : null,

tipo_documento:
  tipoDocumento || "Documento generico",
        });

      if (insertError) throw insertError;

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadData();
    } catch (err: any) {
      console.error("Errore upload:", err);
      alert(err?.message || "Errore upload documento");
    } finally {
      setUploading(false);
    }
  };

  const handleApriDocumento = async (doc: DocumentoRow) => {
    try {
      if (!doc.storage_path) {
        alert("Percorso file non disponibile");
        return;
      }

      setWorkingDocumentId(doc.id);

      const supabase = getSupabaseClient() as any;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Sessione non valida. Effettua nuovamente l'accesso.");
        return;
      }

      const response = await fetch("/api/antiriciclaggio/fascicolo-documenti/signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ documento_id: doc.id }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.signedUrl) {
        throw new Error(payload?.error || "Impossibile aprire il documento");
      }

      setPreviewUrl(payload.signedUrl);
    } catch (err: any) {
      console.error("Errore apertura documento:", err);
      alert(err?.message || "Errore apertura documento");
    } finally {
      setWorkingDocumentId(null);
    }
  };

  const handleEliminaDocumento = async (doc: DocumentoRow) => {
    try {
      const conferma = window.confirm(
        `Vuoi eliminare il documento "${doc.nome_file || "senza nome"}"?`
      );
      if (!conferma) return;

      setWorkingDocumentId(doc.id);

      const supabase = getSupabaseClient() as any;

      if (doc.storage_path && doc.origine !== "documento_rappresentante") {
        const bucketName = doc.bucket_name || "allegati";

        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([doc.storage_path]);

        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase
        .from("tbAVFascicoliDocumenti")
        .delete()
        .eq("id", doc.id);

      if (deleteError) throw deleteError;

      await loadData();
    } catch (err: any) {
      console.error("Errore eliminazione documento:", err);
      alert(err?.message || "Errore eliminazione documento");
    } finally {
      setWorkingDocumentId(null);
    }
  };

useEffect(() => {
  if (regolaDiCondottaRichiesta && tipoDocumento === "Documento generico") {
    setTipoDocumento(regolaDiCondottaRichiesta);
  }
}, [regolaDiCondottaRichiesta, tipoDocumento]);

useEffect(() => {
  void loadData();
}, [router.isReady, pratica_id, cliente_id]);

useEffect(() => {
  if (!router.isReady || typeof pratica_id !== "string" || !pratica_id) {
    setControlliAV7([]);
    return;
  }
  let active = true;
  (async () => {
    try {
      const supabase = getSupabaseClient() as any;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch(
        `/api/antiriciclaggio/controlli-costanti?pratica_id=${encodeURIComponent(pratica_id)}`,
        { headers: { Authorization: `Bearer ${session.access_token}`, "x-aml-av7-proof": sessionStorage.getItem("antiriciclaggio_av7_access_proof") || "" } }
      );
      if (!response.ok) return;
      const result = await response.json();
      if (active) setControlliAV7(result.controlli || []);
    } catch (error) {
      console.error("Errore caricamento storico AV7", error);
    }
  })();
  return () => { active = false; };
}, [router.isReady, pratica_id]);

useEffect(() => {
  if (!router.isReady || typeof pratica_id !== "string" || !pratica_id) {
    setVersioniAV1([]); setVersioniAV4([]);
    return;
  }
  let active = true;
  (async () => {
    try {
      const supabase = getSupabaseClient() as any;
      const studioId = await getStudioId();
      if (!studioId) return;
      const [av1, av4] = await Promise.all([
        supabase.from("tbAV1")
          .select("id, DataVerifica, AV1Conferma, allegato_av1_firmato, Prestazione")
          .eq("studio_id", studioId).eq("pratica_id", pratica_id)
          .order("DataVerifica", { ascending: false }).order("id", { ascending: false }),
        supabase.from("tbAV4")
          .select("id, created_at, compilato_da_cliente, pdf_firmato_cliente")
          .eq("studio_id", studioId).eq("pratica_id", pratica_id)
          .order("created_at", { ascending: false }),
      ]);
      if (av1.error) throw av1.error;
      if (av4.error) throw av4.error;
      if (active) {
        setVersioniAV1(av1.data || []);
        setVersioniAV4(av4.data || []);
      }
    } catch (e) { console.error("Errore storico versioni AML", e); }
  })();
  return () => { active = false; };
}, [router.isReady, pratica_id]);
  
  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fascicolo documenti</h1>

          <p className="mt-1 text-gray-700">Cliente:</p>
          <p className="text-lg font-bold text-gray-900">{clienteNome}</p>

          <p className="mt-1 text-sm text-gray-600">
           Pratica ID: <span className="font-semibold">{String(pratica_id || "-")}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/antiriciclaggio")}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Torna all'elenco
        </button>
      </div>

      {regolaDiCondottaRichiesta ? (
        <div className="mb-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          <div className="font-semibold">Regola di condotta associata alla prestazione</div>
          <div className="mt-2 whitespace-pre-wrap leading-relaxed">
            {regolaDiCondottaRichiesta}
          </div>
          <div className="mt-2 text-xs font-medium text-emerald-800">
            Il documento previsto da questa regola deve essere acquisito e conservato nel fascicolo.
          </div>
        </div>
      ) : null}

        <details className="group mb-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-950"><summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold [&::-webkit-details-marker]:hidden"><span>{loading?"Verifica fascicolo AML...":fascicoloCompleto?"Fascicolo AML completo":`Fascicolo AML incompleto · ${documentiMancanti.length} mancanti`}</span><span className="text-lg text-amber-700 group-open:rotate-180" aria-hidden="true">⌄</span></summary><div className="border-t border-amber-200 px-3 pb-1 pt-3">{loading ? null : fascicoloCompleto ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="font-semibold">Fascicolo AML completo</div>
          <div className="mt-1">
            Tutti i documenti obbligatori risultano presenti.
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          <div className="font-semibold">Fascicolo AML incompleto</div>
          <div className="mt-1">Documenti mancanti:</div>

         <ul className="mt-2 list-disc pl-5">
  {documentiMancanti.map((doc) => (
    <li key={doc}>{doc}</li>
  ))}
</ul>

{documentiOpzionaliMancanti.length > 0 ? (
  <div className="mt-3">
    <div className="font-medium">Documenti opzionali mancanti:</div>
    <ul className="mt-1 list-disc pl-5">
      {documentiOpzionaliMancanti.map((doc) => (
        <li key={doc}>{doc}</li>
      ))}
    </ul>
  </div>
) : null}
        </div>
      )}</div></details>
      {clienteIdPratica && typeof pratica_id === "string" && <details className="group mb-5 rounded-lg border border-sky-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold [&::-webkit-details-marker]:hidden"><span>Documento d'identità – Amministratore associato</span><span className="text-lg text-sky-700 group-open:rotate-180" aria-hidden="true">⌄</span></summary><div className="border-t border-sky-100 p-3"><AmlOrganiDocumenti clienteId={clienteIdPratica} praticaId={pratica_id} onDocumentoSalvato={async()=>{syncedRef.current=null;await loadData();}} /></div></details>}

      {typeof pratica_id === "string" && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => router.push(`/antiriciclaggio/controllo-costante?pratica_id=${encodeURIComponent(pratica_id)}`)}
            className="rounded border border-sky-500 bg-white px-4 py-2 text-sm font-semibold text-sky-700">
            AV7 · Controlli periodici e storico
          </button>
        </div>
      )}

      {typeof pratica_id === "string" && (versioniAV1.length > 0 || versioniAV4.length > 0) && (
        <details className="group mb-5 rounded-lg border border-sky-200 bg-white p-4">
          <summary className="mb-3 flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden"><span>Storico moduli di adeguata verifica · AV1 ({versioniAV1.length}) / AV4 ({versioniAV4.length})</span><span className="text-lg text-sky-700 group-open:rotate-180" aria-hidden="true">⌄</span></summary><div className="border-t border-sky-100 pt-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold">Versioni AV1 ({versioniAV1.length})</h3>
              {versioniAV1.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800">AV1 · Versione {versioniAV1.length - i}</div>
                    <div className="mt-1 text-sm font-medium text-sky-900">Prestazione: {v.Prestazione || prestazionePratica || "Non indicata"}</div>
                    <div className="text-xs text-slate-600">
                      Verifica: {v.DataVerifica ? new Date(v.DataVerifica + "T12:00:00").toLocaleDateString("it-IT") : "—"}
                      {" · "}{v.AV1Conferma ? "Confermato" : "Da confermare"}
                    </div>
                  </div>
                  <button type="button" className="shrink-0 rounded border border-sky-400 px-3 py-1 text-sky-700"
                    onClick={() => {
                      const params = new URLSearchParams({
                        id: String(v.id), pratica_id, origine: "fascicolo",
                      });
                      if (typeof cliente_id === "string" && cliente_id) params.set("cliente_id", cliente_id);
                      void router.push(`/antiriciclaggio/modello-av1?${params.toString()}`);
                    }}>Apri AV1</button>
                </div>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">Versioni AV4 ({versioniAV4.length})</h3>
              {versioniAV4.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800">AV4 · Versione {versioniAV4.length - i}</div>
                    <div className="mt-1 text-sm font-medium text-sky-900">
                      Prestazione: {prestazionePratica || versioniAV1.find((av1) => av1.Prestazione)?.Prestazione || "Non indicata"}
                    </div>
                    <div className="text-xs text-slate-600">
                      Creato: {v.created_at ? new Date(v.created_at).toLocaleDateString("it-IT") : "—"}
                      {" · "}{v.compilato_da_cliente ? "Compilato" : "Da completare"}
                    </div>
                  </div>
                  <button type="button" className="shrink-0 rounded border border-sky-400 px-3 py-1 text-sky-700"
                    onClick={() => {
                      const params = new URLSearchParams({
                        id: String(v.id), pratica_id, origine: "fascicolo",
                      });
                      if (typeof cliente_id === "string" && cliente_id) params.set("cliente_id", cliente_id);
                      void router.push(`/antiriciclaggio/modello-av4?${params.toString()}`);
                    }}>Apri AV4</button>
                </div>
              ))}
            </div>
          </div>
        </div></details>
      )}

      {controlliAV7.length > 0 && typeof pratica_id === "string" && (
        <section className="mb-5 rounded-lg border border-sky-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Controlli periodici AV7 ({controlliAV7.length})</h2>
          <div className="space-y-2">
            {controlliAV7.map((controllo) => (
              <div key={controllo.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 text-sm">
                <span>AV7 del {new Date(controllo.data_controllo + "T12:00:00").toLocaleDateString("it-IT")} · {controllo.esito.replaceAll("_", " ")}</span>
                <a href={`/antiriciclaggio/stampa-av7?pratica_id=${encodeURIComponent(pratica_id)}&id=${encodeURIComponent(controllo.id)}`}
                  target="_blank" rel="noopener noreferrer" className="rounded border border-sky-500 px-3 py-1 font-semibold text-sky-700">
                  Apri / Stampa
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="text-sm text-gray-600">
          Gestione upload, apertura ed eliminazione documenti del fascicolo.
        </div>

        <div className="flex items-end gap-3">
          <div className="min-w-[220px]">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo documento
            </label>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
              disabled={uploading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {regolaDiCondottaRichiesta ? (
                <option value={regolaDiCondottaRichiesta}>
                  Regola di condotta: {regolaDiCondottaRichiesta}
                </option>
              ) : null}
              {TIPO_DOCUMENTO_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {tipoDocumento === "Visura camerale" && (
  <div className="min-w-[280px]">
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Società della visura
    </label>

    <select
      value={societaDocumentoId}
      onChange={(e) =>
        setSocietaDocumentoId(e.target.value)
      }
      disabled={uploading}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
    >
      <option value="">
        Seleziona società
      </option>

      {visureTeRichieste.map((visura) => (
        <option
          key={visura.societa_id}
          value={visura.societa_id}
        >
          {visura.societa_nome}
        </option>
      ))}
    </select>
  </div>
)}

          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                uploading
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {uploading ? "Caricamento..." : "Carica documento"}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleUploadFile(file);
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left font-semibold text-gray-700">
                Tipo documento
              </th>
              <th className="p-3 text-left font-semibold text-gray-700">
                Nome file
              </th>
              <th className="p-3 text-left font-semibold text-gray-700">
                Origine
              </th>
              <th className="p-3 text-left font-semibold text-gray-700">
                Formato
              </th>
              <th className="p-3 text-left font-semibold text-gray-700">
                Dimensione
              </th>
              <th className="p-3 text-left font-semibold text-gray-700">
                Data caricamento
              </th>
              <th className="p-3 text-center font-semibold text-gray-700">
                Azioni
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Caricamento...
                </td>
              </tr>
            ) : documenti.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Nessun documento presente nel fascicolo
                </td>
              </tr>
            ) : (
              documenti.map((doc) => {
                const isWorking = workingDocumentId === doc.id;
                const canDelete = doc.origine === "manuale";

                 return (
                  <tr key={doc.id} className="border-t border-gray-100">
                    <td className="p-3 text-gray-900">
                      {doc.tipo_documento || "-"}
                    </td>

                    <td className="p-3 text-gray-800">
                    {getDisplayFileName(doc.nome_file)}
                      </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getOrigineBadgeClass(
                          doc.origine
                        )}`}
                      >
                        {getOrigineLabel(doc.origine)}
                      </span>
                    </td>

                    <td className="p-3">
  <div className="flex items-center gap-2 text-gray-700">
    {getFormatoIcon(doc.mime_type || getMimeTypeFromPath(doc.storage_path))}
    <span>
      {getFormatoLabel(doc.mime_type || getMimeTypeFromPath(doc.storage_path)) || "-"}
    </span>
  </div>
</td>

                    <td className="p-3 text-gray-700">
                      {formatSize(doc.dimensione)}
                    </td>

                    <td className="p-3 text-gray-700">
                      {formatDateTime(doc.created_at)}
                    </td>

                    <td className="p-3">
            <div className="grid grid-cols-[64px_34px] items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void handleApriDocumento(doc)}
                disabled={isWorking}
                className="h-8 w-16 rounded-lg border border-blue-200 px-3 text-sm font-medium text-blue-700 disabled:opacity-60"
              >
                Apri
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => void handleEliminaDocumento(doc)}
                  disabled={isWorking}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 disabled:opacity-60"
                  title="Elimina documento"
                  aria-label="Elimina documento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <span className="block h-8 w-8" aria-hidden="true" />
              )}
            </div>
          </td>
                  </tr>
                );
              })
            )}
          </tbody>
      </table>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="relative h-[90vh] w-[90vw] overflow-hidden rounded-xl bg-white shadow-lg">
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute right-3 top-3 z-10 rounded-lg bg-white px-3 py-1 text-sm font-medium shadow hover:bg-gray-100"
            >
              Chiudi
            </button>

            <iframe
              src={previewUrl}
              title="Anteprima documento"
              className="h-full w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
