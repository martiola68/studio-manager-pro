import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Risolve lo studio dell'utente autenticato usando la stessa logica di StudioContext.
 * Non dipende dai metadata JWT, che in SMP non contengono sempre studio_id.
 */
export const getStudioId = async (): Promise<string | null> => {
  const supabase = getSupabaseClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) return null;

  let { data: utente, error } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if ((!utente || error) && user.email) {
    const fallback = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("email", user.email.toLowerCase())
      .maybeSingle();
    utente = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  const studioId = String(utente?.studio_id || "").trim();
  return studioId || null;
};
