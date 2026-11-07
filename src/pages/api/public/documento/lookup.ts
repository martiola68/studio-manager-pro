import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function handler(req:NextApiRequest,res:NextApiResponse) {
  res.setHeader("Cache-Control","no-store, private");
  if(req.method!=="GET")return res.status(405).json({error:"Metodo non consentito"});
  const token=typeof req.query.token==="string"?req.query.token.trim():"";
  if(!/^[a-f0-9-]{36}$/i.test(token))return res.status(404).json({error:"Link non valido"});
  try {
    const {data:documento,error:docError}=await supabaseAdmin.from("tbclienti_documenti_aml")
      .select("id,studio_id,soggetto_cliente_id,tipo_documento,numero_documento,scadenza_documento,allegato_documento,public_doc_token,public_doc_enabled,public_doc_opened_at,public_doc_submitted_at")
      .eq("public_doc_token",token).eq("attivo",true).maybeSingle();
    if(docError){console.error("Errore lookup documento pubblico",docError);return res.status(500).json({error:"Errore verifica collegamento"});}
    if(!documento)return res.status(404).json({error:"Link non valido"});
    if(!documento.public_doc_enabled||documento.public_doc_submitted_at)return res.status(410).json({error:"Collegamento già utilizzato o disattivato"});
    const {data:soggetto,error:soggettoError}=await supabaseAdmin.from("tbclienti")
      .select("id,ragione_sociale,citta,indirizzo,cap")
      .eq("id",documento.soggetto_cliente_id).eq("studio_id",documento.studio_id).maybeSingle();
    if(soggettoError){console.error("Errore anagrafica documento pubblico",soggettoError);return res.status(500).json({error:"Errore lettura anagrafica"});}
    if(!soggetto)return res.status(404).json({error:"Nominativo non trovato"});
    if(!documento.public_doc_opened_at){
      const {error:openedError}=await supabaseAdmin.from("tbclienti_documenti_aml")
       .update({public_doc_opened_at:new Date().toISOString()}).eq("id",documento.id).eq("public_doc_token",token).eq("public_doc_enabled",true);
      if(openedError)console.error("Errore registrazione apertura documento pubblico",openedError);
    }
    return res.status(200).json({ok:true,documento,soggetto});
  } catch(error){console.error("Errore imprevisto lookup documento pubblico",error);return res.status(500).json({error:"Errore verifica link"});}
}
