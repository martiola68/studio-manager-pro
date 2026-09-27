import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);

    const { data, error } = await mobileSupabaseAdmin
      .from("tbcontatti")
      .select("id,nome,cognome,email,pec,cell,tel")
      .eq("studio_id", utente.studio_id)
      .order("cognome", { ascending: true });

    if (error) throw error;

    return Response.json({ success: true, data: data || [] });
  } catch (error) {
    return mobileError(error);
  }
}
