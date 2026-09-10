import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getBearerToken(req: NextApiRequest): string | null {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Non autenticato" });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const authUser = authData.user;
    if (authError || !authUser) {
      return res.status(401).json({ ok: false, error: "Sessione non valida" });
    }

    const { data: utente, error: utenteError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .or(`user_id.eq.${authUser.id},email.eq.${authUser.email || ""}`)
      .limit(1)
      .maybeSingle();

    if (utenteError || !utente?.studio_id) {
      return res.status(403).json({ ok: false, error: "Studio utente non disponibile" });
    }

    const praticaId = String(req.body?.pratica_id || req.query.pratica_id || "").trim();
    if (!praticaId) {
      return res.status(400).json({ ok: false, error: "pratica_id obbligatorio" });
    }

    const { data: pratica, error: praticaError } = await supabaseAdmin
      .from("tbPraticheAML")
      .select("id, studio_id")
      .eq("id", praticaId)
      .eq("studio_id", utente.studio_id)
      .maybeSingle();

    if (praticaError) throw praticaError;
    if (!pratica) {
      return res.status(404).json({ ok: false, error: "Pratica AML non trovata" });
    }

    const { data: docs, error: docsReadError } = await supabaseAdmin
      .from("tbAVFascicoliDocumenti")
      .select("storage_path,bucket_name")
      .eq("pratica_id", praticaId);
    if (docsReadError) throw docsReadError;

    // Rimuove prima i file del fascicolo, se presenti. Un errore storage non deve lasciare
    // record DB incoerenti: viene registrato ma si prosegue con la cancellazione dati.
    for (const doc of docs || []) {
      const storagePath = String(doc.storage_path || "").trim();
      const bucket = String(doc.bucket_name || "").trim();
      if (!storagePath || !bucket) continue;
      const { error: storageError } = await supabaseAdmin.storage.from(bucket).remove([storagePath]);
      if (storageError) {
        console.warn("[AML delete] storage remove warning", { praticaId, bucket, storagePath, error: storageError.message });
      }
    }

    // La pratica contiene riferimenti ai moduli correnti: li azzeriamo prima di rimuovere i figli.
    const { error: unlinkError } = await supabaseAdmin
      .from("tbPraticheAML")
      .update({
        av1_id: null,
        av1_corrente_id: null,
        av2_id: null,
        av2_corrente_id: null,
        av4_id: null,
        av4_corrente_id: null,
      })
      .eq("id", praticaId)
      .eq("studio_id", utente.studio_id);

    if (unlinkError) throw unlinkError;

    const deletes = [
      ["tbAVFascicoliDocumenti", "fascicolo"],
      ["tbAV4", "AV4"],
      ["tbAV2", "AV2"],
      ["tbAV1", "AV1"],
    ] as const;

    for (const [table, label] of deletes) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("pratica_id", praticaId)
        .eq("studio_id", utente.studio_id);
      if (error) {
        throw new Error(`Errore cancellazione ${label}: ${error.message}`);
      }
    }

    const { error: deletePraticaError } = await supabaseAdmin
      .from("tbPraticheAML")
      .delete()
      .eq("id", praticaId)
      .eq("studio_id", utente.studio_id);

    if (deletePraticaError) throw deletePraticaError;

    return res.status(200).json({ ok: true, pratica_id: praticaId });
  } catch (error: any) {
    console.error("Errore cancellazione pratica AML:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Errore cancellazione pratica AML" });
  }
}
