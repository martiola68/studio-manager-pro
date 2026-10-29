import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 if(req.method!=="POST")return res.status(405).json({error:"Metodo non consentito"});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return res.status(500).json({error:"Configurazione mancante"});
 const db=createClient(url,key,{auth:{persistSession:false}});
 const token=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
 const {data:auth,error:authErr}=await db.auth.getUser(token);
 if(authErr||!auth.user)return res.status(401).json({error:"Sessione non valida"});
 const {data:u}=await db.from("tbutenti").select("studio_id,attivo").eq("user_id",auth.user.id).maybeSingle();
 if(!u?.studio_id||u.attivo===false)return res.status(403).json({error:"Utente non autorizzato"});
 const {praticaId,confermato}=req.body||{};
 if(typeof praticaId!=="string"||typeof confermato!=="boolean")return res.status(400).json({error:"Dati non validi"});
 const {data:pratica}=await db.from("tbPraticheAML").select("id,studio_id").eq("id",praticaId).eq("studio_id",u.studio_id).maybeSingle();
 if(!pratica)return res.status(404).json({error:"Pratica non appartenente allo studio"});
 const {error}=await db.from("tbPraticheAML").update({fascicolo_completo_manuale:confermato}).eq("id",pratica.id).eq("studio_id",u.studio_id);
 if(error)return res.status(409).json({error:"Impossibile salvare il flag. Verificare che sia applicata la migrazione SQL.",details:error.message});
 return res.status(200).json({ok:true,confermato});
}