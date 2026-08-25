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
  const email = authData.user?.email;

  if (authError || !email) throw new Error("UNAUTHORIZED");

  const { data: utente, error: utenteError } = await supabaseAdmin
    .from("tbutenti")
    .select("studio_id, tipo_utente, attivo")
    .eq("email", email)
    .maybeSingle();

  if (utenteError || !utente?.studio_id || !utente.attivo) throw new Error("UNAUTHORIZED");
  if (utente.tipo_utente !== "Admin") throw new Error("FORBIDDEN");

  return { studioId: String(utente.studio_id) };
}

function paymentMethodSummary(method: Stripe.PaymentMethod | null) {
  const card = method?.card;
  if (!card) return null;

  return {
    brand: String(card.brand || "carta"),
    last4: String(card.last4 || ""),
    exp_month: card.exp_month || null,
    exp_year: card.exp_year || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { studioId } = await getAdminContext(req);

    const { data: studio, error: studioError } = await supabaseAdmin
      .from("tbstudio")
      .select("id, ragione_sociale, software_attivo, stato_abbonamento_corrente, data_scadenza_abbonamento_corrente, piano_corrente, importo_annuale_corrente, licenze_bypass")
      .eq("id", studioId)
      .single();

    if (studioError) throw studioError;

    const { data: licenza, error: licenzaError } = await supabaseAdmin
      .from("tbsoftware_licenze")
      .select("id, piano, stato, canone_mensile, importo_annuale, rinnovo_automatico, giorni_preavviso_disdetta, data_attivazione, data_scadenza, data_ultimo_pagamento, data_prossimo_pagamento, stripe_customer_id, stripe_subscription_id, stripe_status, stripe_current_period_end, stripe_cancel_at_period_end")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (licenzaError) throw licenzaError;

    let metodoPagamento = null;
    let stripeStatus = licenza?.stripe_status || null;
    let cancelAtPeriodEnd = Boolean(licenza?.stripe_cancel_at_period_end);

    if (licenza?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      let paymentMethodId: string | null = null;

      if (licenza.stripe_subscription_id) {
        try {
          const subscription = await stripe.subscriptions.retrieve(licenza.stripe_subscription_id);
          stripeStatus = subscription.status || stripeStatus;
          cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
          const subPm = subscription.default_payment_method;
          paymentMethodId = typeof subPm === "string" ? subPm : subPm?.id || null;
        } catch (error) {
          console.error("Errore lettura subscription Stripe:", error);
        }
      }

      if (!paymentMethodId) {
        try {
          const customer = await stripe.customers.retrieve(licenza.stripe_customer_id);
          if (!("deleted" in customer && customer.deleted)) {
            const customerPm = customer.invoice_settings.default_payment_method;
            paymentMethodId = typeof customerPm === "string" ? customerPm : customerPm?.id || null;
          }
        } catch (error) {
          console.error("Errore lettura customer Stripe:", error);
        }
      }

      if (paymentMethodId) {
        try {
          const method = await stripe.paymentMethods.retrieve(paymentMethodId);
          metodoPagamento = paymentMethodSummary(method);
        } catch (error) {
          console.error("Errore lettura metodo pagamento Stripe:", error);
        }
      }
    }

    return res.status(200).json({
      studio: {
        id: studio.id,
        ragione_sociale: studio.ragione_sociale,
        software_attivo: studio.software_attivo,
        stato_abbonamento: studio.stato_abbonamento_corrente,
        data_scadenza_abbonamento: studio.data_scadenza_abbonamento_corrente,
        licenze_bypass: studio.licenze_bypass,
      },
      licenza: licenza
        ? {
            id: licenza.id,
            piano: licenza.piano,
            stato: licenza.stato,
            canone_mensile: Number(licenza.canone_mensile || 0),
            importo_annuale: Number(licenza.importo_annuale || 0),
            rinnovo_automatico: Boolean(licenza.rinnovo_automatico),
            giorni_preavviso_disdetta: Number(licenza.giorni_preavviso_disdetta || 30),
            data_attivazione: licenza.data_attivazione,
            data_scadenza: licenza.data_scadenza,
            data_ultimo_pagamento: licenza.data_ultimo_pagamento,
            data_prossimo_pagamento: licenza.data_prossimo_pagamento,
            stripe_status: stripeStatus,
            stripe_cancel_at_period_end: cancelAtPeriodEnd,
            ha_customer_stripe: Boolean(licenza.stripe_customer_id),
            ha_subscription_stripe: Boolean(licenza.stripe_subscription_id),
          }
        : null,
      metodo_pagamento: metodoPagamento,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Non autenticato" });
    if (error?.message === "FORBIDDEN") return res.status(403).json({ error: "Solo gli amministratori possono gestire l'abbonamento" });
    console.error("API studio/abbonamento error:", error);
    return res.status(500).json({ error: error?.message || "Errore caricamento abbonamento" });
  }
}
