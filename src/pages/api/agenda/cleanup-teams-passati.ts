import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getBearerToken(req: NextApiRequest): string | null {
  const header = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function getAuthUser(req: NextApiRequest) {
  const token = getBearerToken(req);
  if (!token) return { error: "Missing Authorization Bearer token" as const };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: "Utente non autenticato" as const };

  return { user: data.user };
}

async function getStudioId(authUser: { id: string; email?: string | null }) {
  const email = authUser.email || "";
  const { data, error } = await supabaseAdmin
    .from("tbutenti")
    .select("studio_id")
    .or(`id.eq.${authUser.id},email.eq.${email}`)
    .maybeSingle();

  if (error || !data?.studio_id) return { error: "Studio utente non trovato" as const };
  return { studioId: String(data.studio_id) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await getAuthUser(req);
    if ("error" in auth) return res.status(401).json({ error: auth.error });

    const studio = await getStudioId({ id: auth.user.id, email: auth.user.email });
    if ("error" in studio) return res.status(400).json({ error: studio.error });

    const nowIso = new Date().toISOString();

    const { data: candidates, error: readError } = await supabaseAdmin
      .from("tbagenda")
      .select("id, riunione_teams, link_teams, descrizione, luogo, data_fine")
      .eq("studio_id", studio.studioId)
      .lt("data_fine", nowIso);

    if (readError) {
      return res.status(500).json({ error: readError.message });
    }

    const idsToDelete = (candidates || [])
      .filter((row: any) => {
        const link = String(row.link_teams || "").trim();
        const description = String(row.descrizione || "");
        const place = String(row.luogo || "");

        return (
          row.riunione_teams === true ||
          Boolean(link) ||
          /teams\.microsoft\.com|teams\.live\.com/i.test(description) ||
          /microsoft teams/i.test(description) ||
          /microsoft teams/i.test(place)
        );
      })
      .map((row: any) => String(row.id));

    if (idsToDelete.length === 0) {
      return res.status(200).json({ ok: true, deleted: 0 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("tbagenda")
      .delete()
      .eq("studio_id", studio.studioId)
      .in("id", idsToDelete);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    return res.status(200).json({ ok: true, deleted: idsToDelete.length });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}
