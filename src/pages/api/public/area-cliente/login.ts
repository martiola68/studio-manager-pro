import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function createToken(payload: any) {
  const secret = process.env.ACCESSI_CLIENTI_SECRET;

  if (!secret) {
    throw new Error("ACCESSI_CLIENTI_SECRET mancante");
  }

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email e password obbligatorie",
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: accesso, error } = await supabase
      .from("tbclienti_accessi_pubblici")
      .select(`
        id,
        studio_id,
        cliente_id,
        email_accesso,
        password_hash,
        attivo,
        tbclienti (
          ragione_sociale
        )
      `)
      .ilike("email_accesso", email.trim())
      .maybeSingle();

    if (error || !accesso) {
      return res.status(401).json({
        success: false,
        error: "Credenziali non valide",
      });
    }

    if (!accesso.attivo) {
      return res.status(403).json({
        success: false,
        error: "Accesso disattivato. Contattare lo Studio.",
      });
    }

    const passwordOk = await bcrypt.compare(password, accesso.password_hash);

    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        error: "Credenziali non valide",
      });
    }

    await supabase
      .from("tbclienti_accessi_pubblici")
      .update({
        ultimo_accesso: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", accesso.id);

    const cliente: any = Array.isArray(accesso.tbclienti)
      ? accesso.tbclienti[0]
      : accesso.tbclienti;

    const token = createToken({
      accesso_id: accesso.id,
      studio_id: accesso.studio_id,
      cliente_id: accesso.cliente_id,
      email_accesso: accesso.email_accesso,
      ragione_sociale: cliente?.ragione_sociale || "",
      exp: Date.now() + 1000 * 60 * 60 * 8,
    });

    return res.status(200).json({
      success: true,
      token,
      cliente: {
        id: accesso.cliente_id,
        ragione_sociale: cliente?.ragione_sociale || "",
        email_accesso: accesso.email_accesso,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore login area cliente",
    });
  }
}
