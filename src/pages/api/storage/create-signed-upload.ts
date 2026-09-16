import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_PREFIXES: Record<string, string[]> = {
  allegati: ["av1_firmati/"],
  "messaggi-allegati": ["av4/"],
};

function isSafePdfPath(bucket: string, path: string): boolean {
  const prefixes = ALLOWED_PREFIXES[bucket];
  if (!prefixes) return false;

  const normalized = String(path || "").trim();
  if (!normalized || normalized.startsWith("/") || normalized.includes("..") || normalized.includes("\\")) {
    return false;
  }

  if (!normalized.toLowerCase().endsWith(".pdf")) return false;
  return prefixes.some((prefix) => normalized.startsWith(prefix));
}

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

    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Sessione scaduta o non valida." });
    }

    const bucket = typeof req.body?.bucket === "string" ? req.body.bucket.trim() : "";
    const path = typeof req.body?.path === "string" ? req.body.path.trim() : "";

    if (!isSafePdfPath(bucket, path)) {
      return res.status(400).json({ error: "Percorso di caricamento non consentito." });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data?.token) {
      console.error("Errore creazione signed upload URL:", error);
      return res.status(500).json({
        error: error?.message || "Impossibile preparare il caricamento del PDF.",
      });
    }

    return res.status(200).json({
      path: data.path || path,
      token: data.token,
    });
  } catch (error: any) {
    console.error("Errore API signed upload:", error);
    return res.status(500).json({
      error: error?.message || "Errore interno durante la preparazione del caricamento.",
    });
  }
}
