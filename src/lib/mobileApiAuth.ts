import { createClient } from "@supabase/supabase-js";

export const mobileSupabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getMobileUser(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    throw Object.assign(new Error("Token mancante."), { status: 401 });
  }

  const { data: authData, error: authError } =
    await mobileSupabaseAdmin.auth.getUser(token);

  if (authError || !authData.user?.email) {
    throw Object.assign(new Error("Utente non autenticato."), { status: 401 });
  }

  const { data: utente, error: userError } = await mobileSupabaseAdmin
    .from("tbutenti")
    .select("id, studio_id, nome, cognome, email, attivo, settore, responsabile_paghe, responsabile_ferie_permessi")
    .ilike("email", authData.user.email)
    .eq("attivo", true)
    .limit(1)
    .maybeSingle();

  if (userError || !utente) {
    throw Object.assign(new Error("Profilo utente SMP non trovato."), { status: 403 });
  }

  return { token, authUser: authData.user, utente };
}

export function mobileError(error: any) {
  const status = Number(error?.status || 500);
  return Response.json(
    { success: false, error: error?.message || "Errore server." },
    { status }
  );
}
