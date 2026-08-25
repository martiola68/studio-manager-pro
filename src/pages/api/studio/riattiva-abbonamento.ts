import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function bearerToken(req: NextApiRequest) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function getAdminContext(req: NextApiRequest) {
  const token = bearerToken(req);
  if (!token) throw new Error("UNAUTHORIZED");

  const supabaseAdmin = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const email = authData.user?.email?.trim().toLowerCase();
  if (authError || !email) throw new Error("UNAUTHORIZED");

  const { data: utente, error: utenteError } = await supabaseAdmin
    .from("tbutenti")
    .select("studio_id, tipo_utente, attivo, email")
    .eq("email", email)
    .maybeSingle();

  if (utenteError || !utente?.studio_id || !utente.attivo) throw new Error("UNAUTHORIZED");
  if (utente.tipo_utente !== "Admin") throw new Error("FORBIDDEN");

  return { studioId: String(utente.studio_id), adminEmail: email };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY non configurata");

    const supabaseAdmin = getSupabaseAdmin();
    const { studioId, adminEmail } = await getAdminContext(req);

    const { data: studio, error: studioError } = await supabaseAdmin
      .from("tbstudio")
      .select("id, ragione_sociale, partita_iva, codice_fiscale, email, telefono, indirizzo, citta, provincia, cap, pec, licenze_bypass")
      .eq("id", studioId)
      .single();

    if (studioError || !studio) throw studioError || new Error("Studio non trovato");
    if (studio.licenze_bypass) {
      return res.status(400).json({ error: "La licenza interna FULL non richiede riattivazione Stripe" });
    }

    const { data: licenza, error: licenzaError } = await supabaseAdmin
      .from("tbsoftware_licenze")
      .select("id, studio_id, partita_iva, piano, stato, stripe_customer_id, stripe_subscription_id, stripe_status")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (licenzaError) throw licenzaError;
    if (!licenza?.id || !licenza.stripe_customer_id) {
      return res.status(400).json({ error: "Licenza o cliente Stripe non associato allo studio" });
    }

    const status = String(licenza.stripe_status || "").toLowerCase();
    const riattivabile = ["canceled", "unpaid", "incomplete_expired", "paused", "sospeso", "scaduto"].includes(status) || licenza.stato === "sospeso";
    if (!riattivabile) {
      return res.status(400).json({ error: "L'abbonamento non risulta in uno stato che richiede una nuova sottoscrizione" });
    }

    if (!licenza.stripe_subscription_id) {
      return res.status(400).json({ error: "Subscription Stripe precedente non disponibile per recuperare il piano" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const oldSubscription = await stripe.subscriptions.retrieve(licenza.stripe_subscription_id);
    const priceId = oldSubscription.items.data[0]?.price?.id;
    if (!priceId) {
      return res.status(400).json({ error: "Prezzo Stripe del piano precedente non disponibile" });
    }

    const origin = String(req.headers.origin || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (!origin) throw new Error("URL applicazione non disponibile");

    const activationId = `reactivation_${licenza.id}_${Date.now()}`;
    const metadata: Record<string, string> = {
      activation_id: activationId,
      piano: String(licenza.piano || "essential").toLowerCase().replace(/\s+/g, "_"),
      addons: "",
      ragione_sociale: String(studio.ragione_sociale || ""),
      partita_iva: String(studio.partita_iva || licenza.partita_iva || ""),
      codice_fiscale: String(studio.codice_fiscale || ""),
      email_studio: String(studio.email || adminEmail),
      admin_email: adminEmail,
      telefono: String(studio.telefono || ""),
      indirizzo: String(studio.indirizzo || ""),
      citta: String(studio.citta || ""),
      provincia: String(studio.provincia || ""),
      cap: String(studio.cap || ""),
      pec: String(studio.pec || ""),
      codice_sdi: "0000000",
      reactivation: "true",
      studio_id: studioId,
      licenza_id: String(licenza.id),
    };

    if (!metadata.ragione_sociale || !metadata.partita_iva || !metadata.codice_fiscale || !metadata.email_studio || !metadata.admin_email) {
      return res.status(400).json({ error: "Dati studio incompleti: impossibile creare la riattivazione Stripe" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: licenza.stripe_customer_id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      billing_address_collection: "required",
      allow_promotion_codes: true,
      client_reference_id: activationId,
      metadata,
      subscription_data: {
        metadata: {
          reactivation: "true",
          studio_id: studioId,
          licenza_id: String(licenza.id),
        },
      },
      success_url: `${origin}/impostazioni/studio?stripe=riattivato&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/impostazioni/studio?stripe=riattivazione_annullata`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Non autenticato" });
    if (error?.message === "FORBIDDEN") return res.status(403).json({ error: "Solo gli amministratori possono riattivare l'abbonamento" });
    console.error("API studio/riattiva-abbonamento error:", error);
    return res.status(500).json({ error: error?.message || "Errore creazione riattivazione Stripe" });
  }
}
