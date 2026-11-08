import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
  turnstileToken?: unknown;
};
const clean=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max+1):"";
const allowedPlans=new Set(["starter","professional","business"]);
const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function checkTurnstile(token:string,remoteIp:string){
  const secret=process.env.AML_TURNSTILE_SECRET_KEY;
  // Fail closed: a public form is not exposed without anti-bot protection.
  if(!secret)return false;
  if(!token)return false;
  const values=new URLSearchParams({secret,response:token,remoteip:remoteIp});
  const result=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {method:"POST",body:values,headers:{"Content-Type":"application/x-www-form-urlencoded"}});
  if(!result.ok)return false;
  const json=await result.json() as {success?:boolean;hostname?:string};
  const expected=(process.env.AML_PUBLIC_HOSTNAME||"aml.studiomanagerpro.it").toLowerCase();
  return json.success===true && String(json.hostname||"").toLowerCase()===expected;
}

export default async function handler(req:NextApiRequest,res:NextApiResponse){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({error:"Metodo non consentito"});}
 res.setHeader("Cache-Control","no-store");
 // Never log personal information from the request.
 const body=(req.body||{}) as RequestBody;
 const studio=clean(body.ragione_sociale,200),piva=clean(body.partita_iva,32),ref=clean(body.referente,160),
   email=clean(body.email,254).toLowerCase(),telefono=clean(body.telefono,40),
   piano=clean(body.piano,30),note=clean(body.note,500),website=clean(body.website,80),
   token=clean(body.turnstileToken,3000);
 if(website)return res.status(200).json({ok:true,message:"Richiesta registrata per verifica."});
 if(studio.length<2||studio.length>200||ref.length<3||ref.length>160||!emailRegex.test(email)||
    email.length>254||!allowedPlans.has(piano)||body.consenso!==true||
    piva.length>32||telefono.length>40||note.length>500){
   return res.status(400).json({error:"Controlla i dati obbligatori e il consenso privacy."});
 }
 const startedAt=Number(body.startedAt);
 if(!Number.isFinite(startedAt)||Date.now()-startedAt<2500||Date.now()-startedAt>7200000)
   return res.status(400).json({error:"Ricarica il modulo e riprova."});
 const ip=String(req.headers["x-forwarded-for"]||"").split(",")[0].trim().slice(0,60);
 try{
   if(!await checkTurnstile(token,ip))return res.status(403).json({error:"Verifica di sicurezza non riuscita. Ricarica la pagina."});
   const db=getSupabaseAdmin();
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
