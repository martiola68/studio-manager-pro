import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendRichiestaDocumentoRappresentante } from "@/services/rappresentantiDocumentiService";
const db=supabaseAdmin as any;
const str=(v:unknown)=>String(v??"").trim();
const normalizeTipoDocumento=(v:unknown):string|null=>{
 const raw=str(v);
 if(!raw)return null;
 const simplified=raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’‘\u0060]/g,"'").replace(/\s+/g," ").trim();
 if(["carta d'identita","carta di identita","carta identita"].includes(simplified))return "Carta di identità";
 if(simplified==="passaporto")return "Passaporto";
 if(simplified==="patente")return "Patente";
 return null;
};
function alertTime(date:string){const d=new Date(date+"T08:00:00Z");d.setUTCDate(d.getUTCDate()-90);return d.getTime()>Date.now()?d.toISOString():new Date().toISOString()}
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 if(!["GET","POST"].includes(req.method||""))return res.status(405).json({error:"Metodo non consentito"});
 try{
  const authorization=str(req.headers.authorization);
  if(!authorization.toLowerCase().startsWith("bearer "))return res.status(401).json({error:"Autenticazione richiesta"});
  const auth=await db.auth.getUser(authorization.slice(7).trim());
  if(auth.error||!auth.data?.user)return res.status(401).json({error:"Sessione non valida"});
  const user=auth.data.user;
  let u=await db.from("tbutenti").select("id,studio_id").eq("user_id",user.id).eq("attivo",true).limit(1).maybeSingle();
  if(!u.data&&!u.error&&user.email)u=await db.from("tbutenti").select("id,studio_id").ilike("email",user.email).eq("attivo",true).limit(1).maybeSingle();
  if(u.error||!u.data?.studio_id)return res.status(403).json({error:"Studio non disponibile"});
  const studioId=String(u.data.studio_id), clienteId=str(req.method==="GET"?req.query.cliente_id:req.body?.cliente_id);
  if(!clienteId)return res.status(400).json({error:"Cliente mancante"});
  const cliente=await db.from("tbclienti").select("id").eq("studio_id",studioId).eq("id",clienteId).maybeSingle();
  if(cliente.error||!cliente.data)return res.status(403).json({error:"Cliente non appartenente allo studio"});
  // Solo il rappresentante principale collegato alla pratica AV4.
  // Nessun elenco indiscriminato di organi sociali o società.
  const praticaId=str(req.method==="GET"?req.query.pratica_id:req.body?.pratica_id);
  let av4SoggettoId="";
  if(praticaId){
    const pratica=await db.from("tbPraticheAML").select("id,av4_corrente_id,av4_id").eq("id",praticaId).eq("cliente_id",clienteId).eq("studio_id",studioId).maybeSingle();
    if(pratica.error)throw pratica.error;
    if(!pratica.data)return res.status(403).json({error:"Pratica AML non appartenente al cliente"});
    const av4Id=pratica.data.av4_corrente_id||pratica.data.av4_id;
    let av4Query=db.from("tbAV4").select("soggetto_cliente_id").eq("pratica_id",praticaId).eq("studio_id",studioId);
    av4Query=av4Id?av4Query.eq("id",av4Id):av4Query.order("created_at",{ascending:false}).limit(1);
    const av4=await av4Query.maybeSingle();
    if(av4.error)throw av4.error;
    av4SoggettoId=str(av4.data?.soggetto_cliente_id);
  }
  const org=await db.from("tbclienti_organi").select("soggetto_cliente_id").eq("studio_id",studioId).eq("cliente_id",clienteId).eq("tipo_ruolo","R").eq("principale",true).eq("attivo",true);
  if(org.error)throw org.error;
  const principali=[...new Set((org.data||[]).map((r:any)=>str(r.soggetto_cliente_id)).filter(Boolean))] as string[];
  let candidateId=av4SoggettoId || (principali.length===1?principali[0]:"");
  // Il rappresentante selezionato deve comunque appartenere agli organi attivi.
  if(candidateId&&!principali.includes(candidateId)){
    const link=await db.from("tbclienti_organi").select("soggetto_cliente_id").eq("studio_id",studioId).eq("cliente_id",clienteId).eq("soggetto_cliente_id",candidateId).eq("tipo_ruolo","R").eq("attivo",true).limit(1).maybeSingle();
    if(link.error)throw link.error;
    if(!link.data)candidateId="";
  }
  let ids=candidateId?[candidateId]:[];
  if(ids.length){
    const eligible=await db.from("tbclienti").select("id,tipo_cliente").eq("studio_id",studioId).eq("id",candidateId).maybeSingle();
    if(eligible.error)throw eligible.error;
    if(!eligible.data||eligible.data.tipo_cliente!=="Persona fisica")ids=[];
  }
  // Sincronizza il documento già conservato nell'anagrafica con il fascicolo
  // della pratica selezionata: un solo riferimento, senza duplicare il file.
  if(req.method==="POST"&&str(req.body?.action)==="sync"){
    if(!praticaId||ids.length!==1)return res.status(400).json({error:"Pratica o amministratore associato non univoco"});
    const documents=await db.from("tbclienti_documenti_aml")
      .select("id,tipo_documento,allegato_documento")
      .eq("studio_id",studioId).eq("soggetto_cliente_id",ids[0]).eq("attivo",true)
      .not("allegato_documento","is",null)
      .order("updated_at",{ascending:false}).limit(1).maybeSingle();
    if(documents.error)throw documents.error;
    const doc=documents.data;
    const path=str(doc?.allegato_documento);
    if(!path)return res.status(200).json({ok:true,synced:false,reason:"nessun allegato"});
    const fileName=path.split("/").pop()||"documento";
    const mime=path.toLowerCase().endsWith(".pdf")?"application/pdf":/\.jpe?g$/i.test(path)?"image/jpeg":/\.png$/i.test(path)?"image/png":null;
    const bucket=path.startsWith("av4/")?"messaggi-allegati":"allegati";
    const linked=await db.from("tbAVFascicoliDocumenti").select("id,storage_path")
      .eq("studio_id",studioId).eq("pratica_id",praticaId)
      .eq("origine","documento_rappresentante")
      .order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(linked.error)throw linked.error;
    const payload={
      tipo_documento:"Documento identità",nome_file:fileName,storage_path:path,
      bucket_name:bucket,mime_type:mime,
      note:"Documento d'identità associato al rappresentante ("+str(doc.tipo_documento)+")"
    };
    if(linked.data?.id){
      if(str(linked.data.storage_path)!==path){
        const updated=await db.from("tbAVFascicoliDocumenti").update(payload)
          .eq("id",linked.data.id).eq("studio_id",studioId).eq("pratica_id",praticaId);
        if(updated.error)throw updated.error;
      }
    }else{
      const inserted=await db.from("tbAVFascicoliDocumenti").insert({
        studio_id:studioId,pratica_id:praticaId,cliente_id:clienteId,
        societa_documento_id:null,origine:"documento_rappresentante",
        dimensione:null,...payload
      });
      if(inserted.error)throw inserted.error;
    }
    return res.status(200).json({ok:true,synced:true});
  }
  if(req.method==="GET"){
   if(!ids.length)return res.status(200).json({ok:true,items:[],notice:"Nessun amministratore persona fisica associato in modo univoco alla pratica. Verifica Organi sociali e l'AV4."});
   const [people,docs]=await Promise.all([
     db.from("tbclienti").select("id,ragione_sociale,email").eq("studio_id",studioId).in("id",ids),
     db.from("tbclienti_documenti_aml").select("id,soggetto_cliente_id,tipo_documento,numero_documento,scadenza_documento,allegato_documento,microsoft_connection_id").eq("studio_id",studioId).eq("attivo",true).in("soggetto_cliente_id",ids).order("updated_at",{ascending:false})
   ]);
   if(people.error)throw people.error;if(docs.error)throw docs.error;
   const latest=new Map<string,any>();
   for(const d of docs.data||[])if(!latest.has(String(d.soggetto_cliente_id)))latest.set(String(d.soggetto_cliente_id),d);
   const items=await Promise.all((people.data||[]).map(async(p:any)=>{
    const documento=latest.get(String(p.id))||null;
    let signed_url:string|null=null;
    if(documento?.allegato_documento){
      const bucket=String(documento.allegato_documento).startsWith("av4/")?"messaggi-allegati":"allegati";
      const signed=await db.storage.from(bucket).createSignedUrl(documento.allegato_documento,900);
      signed_url=signed.data?.signedUrl||null;
    }
    return {studio_id:studioId,soggetto_cliente_id:p.id,nome:p.ragione_sociale||"Nominativo",email:p.email||"",documento,signed_url};
   }));
   return res.status(200).json({ok:true,items});
  }
  const soggettoId=str(req.body?.soggetto_cliente_id),action=str(req.body?.action)||"save";
  if(!ids.includes(soggettoId))return res.status(403).json({error:"Amministratore non associato alla pratica selezionata"});
  const existing=await db.from("tbclienti_documenti_aml").select("id,tipo_documento,numero_documento,scadenza_documento,allegato_documento,microsoft_connection_id").eq("studio_id",studioId).eq("soggetto_cliente_id",soggettoId).eq("attivo",true).order("updated_at",{ascending:false}).limit(1);
  if(existing.error)throw existing.error;
  let doc=existing.data?.[0]||null;
  if(action==="request"){
    if(!doc){const created=await db.from("tbclienti_documenti_aml").insert({studio_id:studioId,soggetto_cliente_id:soggettoId,attivo:true}).select("id,microsoft_connection_id").single();if(created.error)throw created.error;doc=created.data;}
    const person=await db.from("tbclienti").select("ragione_sociale,email").eq("studio_id",studioId).eq("id",soggettoId).single();
    if(person.error)throw person.error;
    const emailDestinatario=str(req.body?.email_destinatario)||str(person.data.email);
    if(!emailDestinatario)return res.status(400).json({error:"Inserisci l'indirizzo email a cui inviare la richiesta."});
    if(emailDestinatario.length>254||!^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailDestinatario))return res.status(400).json({error:"Indirizzo email del destinatario non valido."});
    await sendRichiestaDocumentoRappresentante({documentoAmlId:doc.id,studioId,nomeDestinatario:str(person.data.ragione_sociale)||"Gentile cliente",email:emailDestinatario,microsoftConnectionId:str(doc.microsoft_connection_id)||"utente-comunicazioni",clienteId});
    return res.status(200).json({ok:true});
  }
  if(action!=="save")return res.status(400).json({error:"Azione non consentita"});
  const rawTipo=str(req.body?.tipo_documento);
  const tipo=normalizeTipoDocumento(rawTipo);
  if(rawTipo&&!tipo)return res.status(400).json({error:"Tipo documento non consentito. Seleziona Carta di identità, Passaporto o Patente."});
  const numero=str(req.body?.numero_documento),scadenza=str(req.body?.scadenza_documento),file=str(req.body?.allegato_documento);
  if(scadenza&&!/^\d{4}-\d{2}-\d{2}$/.test(scadenza))return res.status(400).json({error:"Data scadenza non valida"});
  if(file&&!file.startsWith(studioId+"/organi-documenti/"+soggettoId+"/"))return res.status(400).json({error:"Percorso documento non autorizzato"});
  const oldDate=str(doc?.scadenza_documento);
  const payload={tipo_documento:tipo||null,numero_documento:numero||null,scadenza_documento:scadenza||null,allegato_documento:file||doc?.allegato_documento||null,updated_at:new Date().toISOString()};
  const result=doc?await db.from("tbclienti_documenti_aml").update(payload).eq("id",doc.id).eq("studio_id",studioId).select("id").single():await db.from("tbclienti_documenti_aml").insert({studio_id:studioId,soggetto_cliente_id:soggettoId,attivo:true,...payload}).select("id").single();
  if(result.error)throw result.error;
  const docId=String(result.data.id);
  const person=await db.from("tbclienti").select("ragione_sociale").eq("studio_id",studioId).eq("id",soggettoId).single();
  if(person.error)throw person.error;
  const alerts=await db.from("tbscadenze_centrale").select("id").eq("studio_id",studioId).eq("origine_tabella","tbclienti_documenti_aml").eq("origine_record_id",docId).limit(1);
  if(alerts.error)throw alerts.error;
  const alert=alerts.data?.[0];
  if(!scadenza){
   if(alert){const a=await db.from("tbscadenze_centrale").update({stato:"annullata",annullata_at:new Date().toISOString(),prossimo_alert_at:null,updated_at:new Date().toISOString()}).eq("id",alert.id).eq("studio_id",studioId);if(a.error)throw a.error;}
  }else{
    const fields={origine_modulo:"Antiriciclaggio",tipo_scadenza:"documento_aml",titolo:"Documento AML - "+str(person.data.ragione_sociale),descrizione:[tipo,numero?"n. "+numero:null].filter(Boolean).join(" - ")||null,data_scadenza:scadenza,stato:"attiva",priorita:"normale",intervalli_alert:[90,60,30,7,0],link_dettaglio:"/aml/clienti/organi-sociali?cliente_id="+encodeURIComponent(clienteId),metadati:{soggetto_cliente_id:soggettoId,documento_aml_id:docId,tipo_documento:tipo,numero_documento:numero},completata_at:null,annullata_at:null,updated_at:new Date().toISOString()};
    const refreshed=oldDate!==scadenza?{prossimo_alert_at:alertTime(scadenza),numero_alert_inviati:0,ultimo_alert_inviato_at:null}:{};
    const a=alert?await db.from("tbscadenze_centrale").update({...fields,...refreshed}).eq("id",alert.id).eq("studio_id",studioId):await db.from("tbscadenze_centrale").insert({...fields,...refreshed,studio_id:studioId,cliente_id:clienteId,operatore_responsabile_id:null,origine_tabella:"tbclienti_documenti_aml",origine_record_id:docId,giorni_preavviso_1:90,giorni_preavviso_2:30,giorni_preavviso_3:7});
    if(a.error)throw a.error;
  }
  return res.status(200).json({ok:true});
 }catch(e:any){console.error("Errore gestione documenti organi",e);return res.status(500).json({error:e?.message||"Errore documenti"})}
}
