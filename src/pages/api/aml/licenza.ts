import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthorizedAmlStudio } from "@/lib/aml/checkLicense";

export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({error:"Metodo non consentito"});
 try{
   const auth=await getAuthorizedAmlStudio(req);
   if(!auth)return res.status(403).json({error:"Licenza AML o sessione non valida"});
   const db=supabaseAdmin as any;
   const {data:user,error:userError}=await db.from("tbutenti").select("tipo_utente,attivo")
     .eq("user_id",auth.userId).eq("studio_id",auth.studioId).maybeSingle();
   if(userError||user?.tipo_utente!=="Admin"||user.attivo!==true)
     return res.status(403).json({error:"Solo l'amministratore può consultare le licenze"});
   const [aml,smp,usage]=await Promise.all([
     db.from("tbaml_licenze").select("piano,stato,pratiche_incluse,canone_annuale_eur,data_attivazione,data_scadenza")
       .eq("studio_id",auth.studioId).maybeSingle(),
     db.from("tbsoftware_licenze").select("piano,stato,data_scadenza")
       .eq("studio_id",auth.studioId).eq("stato","attivo").limit(1).maybeSingle(),
     db.from("tbPraticheAML").select("id",{head:true,count:"exact"})
       .eq("studio_id",auth.studioId),
   ]);
   if(aml.error||smp.error||usage.error)throw aml.error||smp.error||usage.error;
   return res.status(200).json({aml:aml.data||null,smp:smp.data||null,praticheUtilizzate:usage.count??0});
 }catch(e){console.error("[AML Licenza]",e);return res.status(500).json({error:"Impossibile leggere le licenze dello studio"});}
}
