import { getSupabaseClient } from "@/lib/supabaseClient";

export const getStudioId = async (): Promise<string | null> => {
  const supabase = getSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;

  if (!user) return null;

  return (
    user.user_metadata?.studio_id ||
    user.app_metadata?.studio_id ||
    null
  );
};
