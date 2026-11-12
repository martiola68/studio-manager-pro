import type { NextApiRequest } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Licensing checks are always server-side. An AML subscription is independent
 * of the SMP plan and is valid only between activation and expiry.
 * The database trigger separately enforces practice quotas on INSERT.
 */
export async function checkAmlLicense(studioId: string): Promise<{allowed:boolean;limit:number|null;reason:string}> {
  if (!studioId) return {allowed:false,limit:null,reason:"Studio non identificato"};
  const today = new Date().toISOString().slice(0, 10);
  const {data,error} = await (supabaseAdmin as any).from("tbaml_licenze")
    .select("stato,data_attivazione,data_scadenza,pratiche_incluse")
    .eq("studio_id",studioId).limit(1).maybeSingle();
  if (error || !data) return {allowed:false,limit:null,reason:"Licenza AML non disponibile"};
  if (data.stato!=="attivo" || !data.data_attivazione || !data.data_scadenza
      || String(data.data_attivazione)>today || String(data.data_scadenza)<today) {
    return {allowed:false,limit:null,reason:"Licenza AML non attiva o scaduta"};
  }
  return {allowed:true,limit:data.pratiche_incluse===null?null:Number(data.pratiche_incluse),reason:""};
}

export async function getAuthorizedAmlStudio(req: NextApiRequest): Promise<{studioId:string;userId:string}|null> {
 const bearer=String(req.headers.authorization||"");
 if(!bearer.toLowerCase().startsWith("bearer "))return null;
 const token=bearer.slice(7).trim();
 if(!token)return null;
 const {data:auth,error}=await supabaseAdmin.auth.getUser(token);
 if(error||!auth?.user)return null;
 const db=supabaseAdmin as any;
 let r=await db.from("tbutenti").select("studio_id").eq("user_id",auth.user.id).eq("attivo",true).limit(1).maybeSingle();
 if(!r.data&&!r.error&&auth.user.email)r=await db.from("tbutenti").select("studio_id").ilike("email",auth.user.email).eq("attivo",true).limit(1).maybeSingle();
 if(r.error||!r.data?.studio_id)return null;
 const studioId=String(r.data.studio_id);
 const license=await checkAmlLicense(studioId);
 return license.allowed?{studioId,userId:auth.user.id}:null;
}
