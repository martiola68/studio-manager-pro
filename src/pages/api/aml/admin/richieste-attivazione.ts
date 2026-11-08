import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const states=new Set(["in_attesa","in_valutazione","approvata","rifiutata"]);
const isUuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader("Cache-Control","private, no-store");
 if(req.method!=="GET"&&req.method!=="POST")return res.status(405).json({error:"Metodo non consentito"});
 try{
  const authHeader=String(req.headers.authorization||"");
  if(!authHeader.startsWith("Bearer "))return res.status(401).json({error:"Accesso richiesto"});
  const db=getSupabaseAdmin();
  const {data:identity,error:identityError}=await db.auth.getUser(authHeader.slice(7).trim());
  if(identityError||!identity.user)return res.status(401).json({error:"Sessione scaduta"});
  const {data:manager,error:managerError}=await db.from("tbutenti")
   .select("id,user_id,attivo,tipo_utente,amministratore_sistema_generale")
   .eq("user_id",identity.user.id).maybeSingle();
  if(managerError||!manager||manager.attivo!==true||manager.tipo_utente!=="Admin"||manager.amministratore_sistema_generale!==true)
   return res.status(403).json({error:"Riservato all'amministratore generale di sistema"});
  if(req.method==="GET"){
   const {data,error}=await db.from("tbaml_richieste_attivazione")
    .select("id,ragione_sociale,partita_iva,referente,email,telefono,piano,note,stato,creata_il,aggiornata_il,studio_id_attivato")
    .order("creata_il",{ascending:false}).limit(200);
   if(error)return res.status(503).json({error:"Archivio richieste non disponibile. Verifica la migrazione SQL."});
   return res.status(200).json({requests:data||[]});
  }
  const id=String(req.body?.id||"");
  const action=String(req.body?.action||"");
  if(!isUuid(id))return res.status(400).json({error:"Identificativo richiesta non valido"});
  if(action!=="status"&&action!=="activate_verified")
   return res.status(400).json({error:"Azione non valida"});
  const {data:request,error:requestError}=await db.from("tbaml_richieste_attivazione")
   .select("id,stato,piano,email,partita_iva").eq("id",id).maybeSingle();
  if(requestError)return res.status(503).json({error:"Archivio richieste non disponibile"});
  if(!request)return res.status(404).json({error:"Richiesta non trovata"});
  if(request.stato==="attivata")return res.status(409).json({error:"La richiesta è già attivata e non può essere modificata"});
  const now=new Date().toISOString();
  if(action==="status"){
   const status=String(req.body?.status||"");
   if(!states.has(status))return res.status(400).json({error:"Stato non ammesso"});
   if(request.stato==="rifiutata"&&status!=="in_valutazione")return res.status(409).json({error:"Riapri prima la richiesta in valutazione"});
   const {data, error}=await db.from("tbaml_richieste_attivazione")
    .update({stato:status,aggiornata_il:now,gestita_da:manager.id,gestita_il:now})
    .eq("id",id).eq("stato",request.stato).select("id,stato").maybeSingle();
   if(error||!data)return res.status(409).json({error:"Richiesta modificata contemporaneamente o salvataggio non riuscito"});
   return res.status(200).json({ok:true,stato:data.stato,message:"Stato aggiornato. Nessuna licenza attivata."});
  }
  if(request.stato!=="approvata")return res.status(409).json({error:"Approva prima la richiesta commerciale"});
  const studioId=String(req.body?.studioId||"").trim();
  if(!isUuid(studioId))return res.status(400).json({error:"Inserisci l'ID dello studio AML già attivato"});
  const {data:studio,error:studioError}=await db.from("tbstudio")
   .select("id,partita_iva").eq("id",studioId).maybeSingle();
  if(studioError||!studio)return res.status(409).json({error:"Studio non trovato: nessuna attivazione registrata"});
  const requestVat=String(request.partita_iva||"").replace(/\s/g,"").toUpperCase();
  const studioVat=String(studio.partita_iva||"").replace(/\s/g,"").toUpperCase();
  if(!requestVat||!studioVat||requestVat!==studioVat)
   return res.status(409).json({error:"Partita IVA dello studio non corrispondente alla richiesta: verifica manuale obbligatoria"});
  const {data:account,error:accountError}=await db.from("tbutenti")
    .select("id,attivo,tipo_utente,email").eq("studio_id",studioId)
    .eq("email",String(request.email||"").toLowerCase()).maybeSingle();
  if(accountError||!account||account.tipo_utente!=="Admin"||account.attivo!==true)
   return res.status(409).json({error:"Amministratore dello studio non ancora creato o non attivo"});
  const {data:license,error:licenseError}=await db.from("tbsoftware_licenze")
    .select("id,piano,stato,data_scadenza").eq("studio_id",studioId).eq("stato","attivo")
    .order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(licenseError||!license)return res.status(409).json({error:"Licenza attiva non trovata: non è possibile confermare l'attivazione"});
  const p=String(license.piano||"").toLowerCase().replace(/\s+/g,"_");
  if(!["aml","aml_standalone","solo_aml","aml_only"].includes(p))
   return res.status(409).json({error:"La licenza è di un piano diverso da AML standalone"});
  if(license.data_scadenza && Date.parse(license.data_scadenza)<Date.now())
   return res.status(409).json({error:"Licenza già scaduta"});
  // "Attivata" is registered only after verifying an actual account and an active license.
  // This endpoint never provisions users, bills or grants new entitlements.
  const {data:updated,error:updateError}=await db.from("tbaml_richieste_attivazione")
   .update({stato:"attivata",studio_id_attivato:studioId,aggiornata_il:now,gestita_da:manager.id,gestita_il:now})
   .eq("id",id).eq("stato","approvata").select("id,stato").maybeSingle();
  if(updateError||!updated)return res.status(409).json({error:"Impossibile registrare la verifica finale"});
  return res.status(200).json({ok:true,stato:"attivata",message:"Studio, amministratore e licenza AML attiva verificati. Richiesta conclusa."});
 }catch(e){console.error("[AML activation manager]",e instanceof Error?e.message:"error");return res.status(500).json({error:"Operazione non riuscita"});}
}
