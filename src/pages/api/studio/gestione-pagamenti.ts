import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function bearerToken(req: NextApiRequest) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function getAdminStudioId(req: NextApiRequest) {
  const token = bearerToken(req);
  if (!token) throw new Error("UNAUTHORIZED");

  const supabaseAdmin = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const email = authData.user?.email;
  if (authError || !email) throw new Error("UNAUTHORIZED");

  const { data: utente, error } = await supabaseAdmin
    .from("tbutenti")
    .select("studio_id, tipo_utente, attivo")
    .eq("email", email)
    .maybeSingle();

  if (error || !utente?.studio_id || !utente.attivo) throw new Error("UNAUTHORIZED");
  if (utente.tipo_utente !== "Admin") throw new Error("FORBIDDEN");
  return String(utente.studio_id);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY non configurata");

    const studioId = await getAdminStudioId(req);
    const supabaseAdmin = getSupabaseAdmin();

    const { data: licenza, error } = await supabaseAdmin
      .from("tbsoftware_licenze")
      .select("stripe_customer_id")
      .eq("studio_id", studioId)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!licenza?.stripe_customer_id) {
      return res.status(400).json({ error: "Cliente Stripe non associato allo studio" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = String(req.headers.origin || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (!origin) throw new Error("URL applicazione non disponibile");

    const session = await stripe.billingPortal.sessions.create({
      customer: licenza.stripe_customer_id,
      return_url: `${origin}/impostazioni/studio`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Non autenticato" });
    if (error?.message === "FORBIDDEN") return res.status(403).json({ error: "Solo gli amministratori possono gestire i pagamenti" });
    console.error("API studio/gestione-pagamenti error:", error);
    return res.status(500).json({ error: error?.message || "Errore apertura gestione pagamenti" });
  }
}
