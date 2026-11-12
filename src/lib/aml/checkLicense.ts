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
