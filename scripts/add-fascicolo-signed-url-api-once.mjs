import fs from "node:fs";
import path from "node:path";

const target = "src/pages/api/antiriciclaggio/fascicolo-documenti/signed-url.ts";
const content = `import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_BUCKETS = new Set(["allegati", "messaggi-allegati"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo non consentito." });
  }

  try {
    const authorization = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Sessione non valida." });
    }

    const accessToken = authorization.slice("Bearer ".length).trim();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userData?.user?.email) {
      return res.status(401).json({ error: "Sessione scaduta o non valida." });
    }

    const documentoId = typeof req.body?.documento_id === "string"
      ? req.body.documento_id.trim()
      : "";

    if (!documentoId) {
      return res.status(400).json({ error: "Documento non valido." });
    }

    const { data: utente, error: utenteError } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("email", userData.user.email)
      .maybeSingle();

    if (utenteError || !utente?.studio_id) {
      console.error("Errore recupero studio per signed URL fascicolo:", utenteError);
      return res.status(403).json({ error: "Studio non disponibile per l'utente." });
    }

    const { data: documento, error: documentoError } = await supabaseAdmin
      .from("tbAVFascicoliDocumenti")
      .select("id, studio_id, storage_path, bucket_name")
      .eq("id", documentoId)
      .eq("studio_id", utente.studio_id)
      .maybeSingle();

    if (documentoError) {
      console.error("Errore recupero documento fascicolo:", documentoError);
      return res.status(500).json({ error: "Errore nel recupero del documento." });
    }

    if (!documento?.storage_path) {
      return res.status(404).json({ error: "Documento non trovato nel fascicolo." });
    }

    const bucketName = documento.bucket_name || "allegati";
    if (!ALLOWED_BUCKETS.has(bucketName)) {
      return res.status(400).json({ error: "Archivio documento non consentito." });
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUrl(documento.storage_path, 300);

    if (signedError || !signedData?.signedUrl) {
      console.error("Errore creazione signed URL fascicolo:", {
        signedError,
        documentoId,
        bucketName,
        storagePath: documento.storage_path,
      });
      return res.status(404).json({
        error: signedError?.message || "File non trovato nell'archivio documentale.",
      });
    }

    return res.status(200).json({ signedUrl: signedData.signedUrl });
  } catch (error: any) {
    console.error("Errore API signed URL fascicolo:", error);
    return res.status(500).json({
      error: error?.message || "Errore interno durante l'apertura del documento.",
    });
  }
}
`;

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, content);
console.log("Fascicolo signed URL API written");
// trigger workflow 2026-09-16
