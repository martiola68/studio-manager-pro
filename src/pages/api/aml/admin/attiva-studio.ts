import type { NextApiRequest, NextApiResponse } from "next";
import {randomUUID,randomBytes} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {getSupabaseAdmin} from "@/lib/supabaseAdmin";

const goodId=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const v=(a:unknown,n:number)=>typeof a==="string"?a.trim().slice(0,n+1):"";
const plans:Record<string,{pratiche:number;prezzo:number}>={starter:{pratiche:50,prezzo:250},professional:{pratiche:200,prezzo:550},business:{pratiche:500,prezzo:950}};

export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader("Cache-Control","private, no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Metodo non consentito"});
 const db=getSupabaseAdmin();
 const bearer=String(req.headers.authorization||"");
 if(!bearer.startsWith("Bearer "))return res.status(401).json({error:"Accesso richiesto"});
 const {data:auth,error:authError}=await db.auth.getUser(bearer.slice(7).trim());
 if(authError||!auth.user)return res.status(401).json({error:"Sessione non valida"});
 const {data:admin,error:adminError}=await db.from("tbutenti")
 .select("id,attivo,tipo_utente,amministratore_sistema_generale").eq("user_id",auth.user.id).maybeSingle();
 if(adminError||!admin||admin.attivo!==true||admin.tipo_utente!=="Admin"||admin.amministratore_sistema_generale!==true)
  return res.status(403).json({error:"Solo l'amministratore generale può attivare nuove licenze"});
 const id=v(req.body?.id,64),nome=v(req.body?.nome,90),cognome=v(req.body?.cognome,90);
 const indirizzo=v(req.body?.indirizzo,180),cap=v(req.body?.cap,10),citta=v(req.body?.citta,120),
 provincia=v(req.body?.provincia,5).toUpperCase(),codiceFiscale=v(req.body?.codiceFiscale,20).toUpperCase(),
 pec=v(req.body?.pec,254),pagamento=v(req.body?.riferimentoPagamento,160);
 if(!goodId(id)||!nome||!cognome||!indirizzo||!cap||!citta||!provincia||!codiceFiscale||!pagamento||
   req.body?.paymentConfirmed!==true||req.body?.confirmation!=="CONFERMO PAGAMENTO")
  return res.status(400).json({error:"Compila i dati e conferma esplicitamente il pagamento."});
 if([nome,cognome,indirizzo,cap,citta,provincia,codiceFiscale,pec,pagamento].some(x=>x.length>254))
  return res.status(400).json({error:"Campo troppo lungo."});
 const {data:reqRow,error:reqError}=await db.from("tbaml_richieste_attivazione")
  .select("id,ragione_sociale,partita_iva,referente,email,telefono,piano,stato,studio_id_attivato")
  .eq("id",id).maybeSingle();
 if(reqError||!reqRow)return res.status(503).json({error:"Archivio richieste non disponibile"});
 if(reqRow.stato!=="approvata"||reqRow.studio_id_attivato)
  return res.status(409).json({error:"Richiesta non approvata o già in fase di attivazione"});
 const email=String(reqRow.email||"").trim().toLowerCase(),piva=String(reqRow.partita_iva||"").trim();
 if(!/^\d{11}$/.test(piva)||!email.includes("@"))
  return res.status(409).json({error:"La richiesta non contiene una P. IVA italiana o un'email valida"});
 const plan=plans[String(reqRow.piano||"")];
 if(!plan)return res.status(409).json({error:"Piano commerciale non valido"});
 const [{data:existingStudio,error:studioCheckError},{data:existingUser,error:userCheckError}]=await Promise.all([
   db.from("tbstudio").select("id").eq("partita_iva",piva).limit(1).maybeSingle(),
   db.from("tbutenti").select("id").ilike("email",email).limit(1).maybeSingle()
 ]);
 if(studioCheckError||userCheckError)return res.status(503).json({error:"Controllo duplicati non disponibile"});
 if(existingStudio||existingUser)return res.status(409).json({error:"Partita IVA o email già presente. Occorre una verifica manuale, senza creare doppioni."});
 const studioId=randomUUID();
 const {data:lock,error:lockError}=await db.from("tbaml_richieste_attivazione")
 .update({studio_id_attivato:studioId,gestita_da:admin.id,gestita_il:new Date().toISOString()})
 .eq("id",id).eq("stato","approvata").is("studio_id_attivato",null).select("id").maybeSingle();
 if(lockError||!lock)return res.status(409).json({error:"Attivazione già avviata da un'altra sessione"});
 let createdStudio=false,createdAuthId="",createdLicenseId="",success=false;
 try{
  const today=new Date(),start=today.toISOString().slice(0,10);
  const end=new Date(Date.UTC(today.getUTCFullYear()+1,today.getUTCMonth(),today.getUTCDate())).toISOString().slice(0,10);
  const {error:studioError}=await db.from("tbstudio").insert({
    id:studioId,ragione_sociale:reqRow.ragione_sociale,denominazione_breve:String(reqRow.ragione_sociale).slice(0,100),
    partita_iva:piva,codice_fiscale:codiceFiscale,indirizzo,cap,citta,provincia,
    telefono:String(reqRow.telefono||""),email,pec,
    attivo:true,software_attivo:false,stato_abbonamento_corrente:"sospeso",
    piano_corrente:"aml_standalone",software_nome_corrente:"AML PRO",
    numero_licenze_corrente:1,importo_annuale_corrente:plan.prezzo,licenze_bypass:false
  });
  if(studioError)throw new Error("Creazione studio: "+studioError.message);
  createdStudio=true;
  // No password is emailed or logged. Account is initially unusable.
  const {data:newAuth,error:newAuthError}=await db.auth.admin.createUser({
    email,email_confirm:true,password:randomBytes(40).toString("base64url")+"!A7",
    user_metadata:{nome,cognome}
  });
  if(newAuthError||!newAuth.user)throw new Error("Creazione credenziali: "+(newAuthError?.message||""));
  createdAuthId=newAuth.user.id;
  const {error:profileError}=await db.from("tbutenti").upsert({
    id:createdAuthId,user_id:createdAuthId,studio_id:studioId,nome,cognome,email,
    tipo_utente:"Admin",attivo:true,amministratore_sistema_generale:false
  },{onConflict:"id"});
  if(profileError)throw new Error("Collegamento account: "+profileError.message);
  const {data:license,error:licenseError}=await db.from("tbsoftware_licenze").insert({
    studio_id:studioId,ragione_sociale:reqRow.ragione_sociale,email,partita_iva:piva,codice_fiscale:codiceFiscale,
    software_nome:"AML PRO",piano:"aml_standalone",numero_licenze:1,
    data_attivazione:start,data_scadenza:end,importo_annuale:plan.prezzo,prezzo_aml:plan.prezzo,
    totale_vendita:plan.prezzo,importo_contratto_iniziale:plan.prezzo,importo_rata_iniziale:plan.prezzo,
    modalita_pagamento_iniziale:"annuale_anticipato",stato_pagamento_iniziale:"pagato",data_ultimo_pagamento:start,
    stato:"sospeso",rinnovo_automatico:false,
    note:JSON.stringify({prodotto:"AML PRO",fascia:reqRow.piano,max_pratiche:plan.pratiche,
      id_richiesta:id,riferimento_pagamento:pagamento,approvato_da:admin.id}),
    admin_email:email
  }).select("id").single();
  if(licenseError||!license?.id)throw new Error("Creazione licenza: "+(licenseError?.message||""));
  createdLicenseId=String(license.id);
  const {error:licenseEnableError}=await db.from("tbsoftware_licenze").update({stato:"attivo"}).eq("id",createdLicenseId);
  if(licenseEnableError)throw new Error("Abilitazione licenza: "+licenseEnableError.message);
  const {error:studioEnableError}=await db.from("tbstudio").update({
    software_attivo:true,stato_abbonamento_corrente:"attivo",data_scadenza_abbonamento_corrente:end
  }).eq("id",studioId);
  if(studioEnableError)throw new Error("Abilitazione studio: "+studioEnableError.message);
  const {data:done,error:finishError}=await db.from("tbaml_richieste_attivazione")
   .update({stato:"attivata",aggiornata_il:new Date().toISOString()})
   .eq("id",id).eq("stato","approvata").eq("studio_id_attivato",studioId).select("id").maybeSingle();
  if(finishError||!done)throw new Error("Registrazione conclusiva non riuscita");
  success=true;
  let emailSent=false;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(url&&anon){
   const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
   const result=await client.auth.resetPasswordForEmail(email,{
    redirectTo:"https://aml.studiomanagerpro.it/auth/callback?type=recovery"
   });
   emailSent=!result.error;
  }
  return res.status(201).json({ok:true,studioId,emailSent,message:emailSent?
   "Studio e licenza AML attivati. Inviata la richiesta per impostare la password.":
   "Studio e licenza AML attivati; invio del link password non confermato. Usa il ripristino password."});
 }catch(e){
  if(!success){
   // Fail closed: do not leave partially activated entitlements.
   if(createdLicenseId)await db.from("tbsoftware_licenze").delete().eq("id",createdLicenseId);
   if(createdAuthId){
    await db.from("tbutenti").delete().eq("id",createdAuthId);
    await db.auth.admin.deleteUser(createdAuthId);
   }
   if(createdStudio){
    await db.from("tbstudio").update({software_attivo:false,stato_abbonamento_corrente:"sospeso"}).eq("id",studioId);
    await db.from("tbstudio").delete().eq("id",studioId);
   }
   await db.from("tbaml_richieste_attivazione").update({studio_id_attivato:null})
    .eq("id",id).eq("studio_id_attivato",studioId).eq("stato","approvata");
  }
  console.error("[AML activation] Provision failed",e instanceof Error?e.message:"unknown error");
  return res.status(503).json({error:"Attivazione non completata. Verifica se esistono dati parziali prima di riprovare."});
 }
}
