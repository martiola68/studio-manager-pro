import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidItalianVat } from "@/lib/aml/italianVat";

type RequestBody = {
  ragione_sociale?: unknown;
  partita_iva?: unknown;
  referente?: unknown;
  email?: unknown;
  telefono?: unknown;
  piano?: unknown;
  note?: unknown;
  consenso?: unknown;
  website?: unknown; // honeypot
  startedAt?: unknown;
};
const clean=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max+1):"";
export const config={api:{bodyParser:{sizeLimit:"8kb"}}};
const allowedPlans=new Set(["starter","professional","business"]);
const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({error:"Metodo non consentito"});}
 res.setHeader("Cache-Control","no-store");
 // Never log personal information from the request.
 const body=(req.body||{}) as RequestBody;
 const studio=clean(body.ragione_sociale,200),piva=clean(body.partita_iva,32),ref=clean(body.referente,160),
   email=clean(body.email,254).toLowerCase(),telefono=clean(body.telefono,40),
   piano=clean(body.piano,30),note=clean(body.note,500),website=clean(body.website,80);
 if(website)return res.status(200).json({ok:true,message:"Richiesta registrata per verifica."});
 if(!isValidItalianVat(piva))return res.status(400).json({error:"Partita IVA non valida: servono 11 cifre e codice di controllo corretto."});
 if(studio.length<2||studio.length>200||ref.length<3||ref.length>160||!emailRegex.test(email)||
    email.length>254||!allowedPlans.has(piano)||body.consenso!==true||
    telefono.length>40||note.length>500){
   return res.status(400).json({error:"Controlla i dati obbligatori e il consenso privacy."});
 }
 const startedAt=Number(body.startedAt);
 if(!Number.isFinite(startedAt)||Date.now()-startedAt<2500||Date.now()-startedAt>7200000)
   return res.status(400).json({error:"Ricarica il modulo e riprova."});
 const origin=String(req.headers.origin||"");
 if(origin){
   try{
     const url=new URL(origin);
     if(url.protocol!=="https:"||url.hostname.toLowerCase()!=="aml.studiomanagerpro.it")
       return res.status(403).json({error:"Origine della richiesta non consentita."});
   }catch{return res.status(403).json({error:"Origine della richiesta non valida."});}
 }
 try{
   const db=getSupabaseAdmin();
   // Abuse limits are persisted in the existing requests archive: they work
   // across multiple Vercel instances without external providers.
   const oneHourAgo=new Date(Date.now()-60*60*1000).toISOString();
   const fifteenMinutesAgo=new Date(Date.now()-15*60*1000).toISOString();
   const [emailHistory,globalHistory]=await Promise.all([
     db.from("tbaml_richieste_attivazione").select("id",{count:"exact",head:true})
       .eq("email",email).gte("creata_il",oneHourAgo),
     db.from("tbaml_richieste_attivazione").select("id",{count:"exact",head:true})
       .gte("creata_il",fifteenMinutesAgo)
   ]);
   if(emailHistory.error||globalHistory.error)
     return res.status(503).json({error:"Servizio temporaneamente non disponibile."});
   if((emailHistory.count||0)>=2)
     return res.status(429).json({error:"Hai già inviato una richiesta recentemente. Riprova più tardi."});
   if((globalHistory.count||0)>=60)
     return res.status(429).json({error:"Troppe richieste in questo momento. Riprova più tardi."});
   const {error}=await db.from("tbaml_richieste_attivazione").insert({
     ragione_sociale:studio,partita_iva:piva||null,referente:ref,email,telefono:telefono||null,
     piano,note:note||null,privacy_accettata_il:new Date().toISOString(),stato:"in_attesa"
   });
   if(error){
     if(error.code==="23505")return res.status(200).json({ok:true,message:"La richiesta risulta già in attesa di verifica."});
     console.error("[AML onboarding] Impossibile salvare la richiesta:",error.code);
     return res.status(503).json({error:"Servizio di attivazione non ancora disponibile. Contatta l'assistenza."});
   }
   return res.status(201).json({ok:true,message:"Richiesta acquisita. L'attivazione avviene solo dopo verifica amministrativa."});
 }catch{
   return res.status(503).json({error:"Attivazione temporaneamente non disponibile. Riprova più tardi."});
 }
}
