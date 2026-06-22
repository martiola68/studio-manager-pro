import { supabase } from "@/lib/supabase/client";

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userProfile, error } = await supabase
    .from("tbutenti")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !userProfile) {
    return null;
  }

  return userProfile;
}
