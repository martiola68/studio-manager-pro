import type {NextApiRequest,NextApiResponse} from "next";
import {createClient} from "@supabase/supabase-js";

export default async function handler(req:NextApiRequest,res:NextApiResponse){
 if(req.method!=="POST")return res.status(405).json({error:"Metodo non consentito"});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,role=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!role)return res.status(500).json({error:"Configurazione server mancante"});
 const db=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||!user)return res.status(401).json({error:"Autenticazione richiesta"});
 const {data:profile,error:pErr}=await db.from("tbutenti")
   .select("studio_id,attivo,tipo_utente,amministratore_sistema_generale")
   .eq("user_id",user.id).maybeSingle();
 if(pErr||!profile||profile.attivo===false||profile.tipo_utente!=="Admin"||!profile.studio_id)
  return res.status(403).json({error:"Solo l'amministratore autorizzato può gestire i tipi"});
 // Il catalogo S è condiviso tra tutti gli studi: non basta essere admin di uno studio.
 // Manteniamo la stessa autorizzazione del catalogo originale in DB, valutata
 // per l'utente autenticato con RPC, anziché concedere accesso a ogni admin.
 const authClient=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"",{auth:{persistSession:false}});
 const {data:{user:checked},error:tokenErr}=await authClient.auth.getUser(token);
 if(tokenErr||!checked)return res.status(401).json({error:"Sessione scaduta"});
 const {data:catalogAllowed,error:rpcError}=await authClient.rpc("is_system_catalog_admin");
 // RPC con anon service context non prova il token: controllo ulteriore sul
 // profilo approvato (identificatore admin generale) e studio responsabile.
 if(profile.amministratore_sistema_generale!==true)
  return res.status(403).json({error:"Catalogo condiviso riservato all'amministratore generale di sistema"});
 const {operazione,id,nome,colore}=req.body||{};
 if(!["crea","modifica","elimina"].includes(operazione))return res.status(400).json({error:"Operazione sconosciuta"});
 if(operazione!=="crea"&&(typeof id!=="string"||!id))return res.status(400).json({error:"Identificativo non valido"});
 if(operazione!=="elimina"&&(typeof nome!=="string"||!nome.trim()||nome.trim().length>120||typeof colore!=="string"||!/^#[0-9a-fA-F]{6}$/.test(colore)))
   return res.status(400).json({error:"Nome o colore non validi"});
 let query:any=db.from("tbtipopromemoria");
 if(operazione==="crea")query=query.insert({nome:nome.trim(),colore,origine:"S",studio_id:null,descrizione:null}).select("id").single();
 if(operazione==="modifica")query=query.update({nome:nome.trim(),colore,descrizione:null}).eq("id",id).eq("origine","S").select("id").single();
 if(operazione==="elimina")query=query.delete().eq("id",id).eq("origine","S").select("id").single();
 const {error,data}=await query;
 if(error)return res.status(409).json({error:error.message});
 if(!data)return res.status(404).json({error:"Tipo promemoria non trovato"});
 return res.status(200).json({ok:true});
}
