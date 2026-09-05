import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { createClient } from "@supabase/supabase-js";
import { sendEmailServer } from "@/services/sendEmailServer";
import { sendRichiestaDocumentoRappresentante } from "@/services/rappresentantiDocumentiService";

const SECRET = process.env.CRON_SECRET;
const REVISIONI_STUDIO_ID = "1ea8b9e8-3f1a-4bb2-b5ea-362cf13fb058";
const REVISIONI_NOREPLY = "noreply@revisionicommerciali.it";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ScadenzaRow = {
  id: string;
  studio_id: string;
  cliente_id: string | null;
  operatore_responsabile_id: string | null;
  origine_modulo: string;
  origine_tabella: string;
  origine_record_id: string;
  tipo_scadenza: string;
  metadati: { ha_scadenzario?: boolean | null; ricorrente?: boolean | null } | null;
  titolo: string;
  descrizione: string | null;
  data_scadenza: string;
  stato: string;
  giorni_preavviso_1: number | null;
  giorni_preavviso_2: number | null;
  giorni_preavviso_3: number | null;
  intervalli_alert: number[] | null;
  prossimo_alert_at: string | null;
  numero_alert_inviati: number;
  link_dettaglio: string | null;
};

function dataIsoOggi(): string { return new Date().toISOString().slice(0, 10); }
function differenzaGiorni(dataScadenza: string, dataRiferimento: string): number {
  const scadenza = new Date(`${dataScadenza}T12:00:00Z`);
  const riferimento = new Date(`${dataRiferimento}T12:00:00Z`);
  return Math.round((scadenza.getTime() - riferimento.getTime()) / 86400000);
}
function sottraiGiorni(dataInput: string, giorni: number): string {
  const data = new Date(`${dataInput}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() - giorni);
  return data.toISOString().slice(0, 10);
}
function formattaDataItaliana(dataInput: string): string {
  const [anno, mese, giorno] = dataInput.split("-");
  return `${giorno}/${mese}/${anno}`;
}
function isMemoCalendarioSenzaScadenzario(scadenza: ScadenzaRow): boolean {
  return scadenza.origine_tabella === "tbtipi_scadenze" && scadenza.metadati?.ha_scadenzario === false;
}
function calcolaTipoAlert(scadenza: ScadenzaRow, oggi: string) {
  const giorniResidui = differenzaGiorni(scadenza.data_scadenza, oggi);
  if (giorniResidui < 0) return {
    tipoAlert: "scadenza_superata", chiaveInvio: `scaduta-${oggi}`,
    oggetto: `Scadenza superata - ${scadenza.titolo}`,
    intestazione: `Scadenza superata da ${Math.abs(giorniResidui)} ${Math.abs(giorniResidui) === 1 ? "giorno" : "giorni"}`,
  };
  if (giorniResidui === 0) return {
    tipoAlert: "scade_oggi", chiaveInvio: `scade-oggi-${oggi}`,
    oggetto: `Scadenza di oggi - ${scadenza.titolo}`, intestazione: "La scadenza è prevista per oggi",
  };
  return {
    tipoAlert: "preavviso", chiaveInvio: `preavviso-${giorniResidui}-${oggi}`,
    oggetto: `Scadenza tra ${giorniResidui} giorni - ${scadenza.titolo}`,
    intestazione: `La scadenza è prevista tra ${giorniResidui} giorni`,
  };
}
function prossimoLunediMattina(dataInput: string): string {
  const data = new Date(`${dataInput}T12:00:00Z`);
  const giornoSettimana = data.getUTCDay();
  const giorniDaAggiungere = giornoSettimana === 1 ? 7 : (8 - giornoSettimana) % 7;
  data.setUTCDate(data.getUTCDate() + giorniDaAggiungere);
  data.setUTCHours(8, 0, 0, 0);
  return data.toISOString();
}
function calcolaProssimoAlert(scadenza: ScadenzaRow, oggi: string): string | null {
  const giorniResidui = differenzaGiorni(scadenza.data_scadenza, oggi);
  if (isMemoCalendarioSenzaScadenzario(scadenza) && giorniResidui <= 0) return null;
  if (giorniResidui < 0) return prossimoLunediMattina(oggi);
  const preavvisi = Array.from(new Set((scadenza.intervalli_alert?.length ? scadenza.intervalli_alert : [30,20,10,5,2,1,0])
    .filter((valore): valore is number => Number.isInteger(valore) && valore >= 0).sort((a,b) => b-a)));
  const dateProgrammate = preavvisi.map(giorni => ({ giorni, data: sottraiGiorni(scadenza.data_scadenza, giorni) }))
    .filter(item => item.data > oggi).sort((a,b) => a.data.localeCompare(b.data));
  if (dateProgrammate.length > 0) return `${dateProgrammate[0].data}T08:00:00.000Z`;
  if (giorniResidui > 0) return `${scadenza.data_scadenza}T08:00:00.000Z`;
  return prossimoLunediMattina(scadenza.data_scadenza);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const querySecret = typeof req.query.secret === "string" ? req.query.secret : null;
  const bearerSecret = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!SECRET || (querySecret !== SECRET && bearerSecret !== SECRET)) return res.status(401).json({ ok:false, error:"Non autorizzato" });
  const scadenzaId = typeof req.query.scadenza_id === "string" ? req.query.scadenza_id.trim() : "";
  try {
    const adesso = new Date().toISOString();
    const oggi = dataIsoOggi();
    let queryScadenze = supabaseAdmin.from("tbscadenze_centrale").select(`id,studio_id,cliente_id,operatore_responsabile_id,origine_modulo,origine_tabella,origine_record_id,tipo_scadenza,titolo,metadati,descrizione,data_scadenza,stato,giorni_preavviso_1,giorni_preavviso_2,giorni_preavviso_3,intervalli_alert,prossimo_alert_at,numero_alert_inviati,link_dettaglio`)
      .eq("stato","attiva").not("prossimo_alert_at","is",null).lte("prossimo_alert_at",adesso).order("prossimo_alert_at",{ascending:true}).limit(200);
    if (scadenzaId) queryScadenze = queryScadenze.eq("id",scadenzaId);
    const { data: scadenze, error: scadenzeError } = await queryScadenze;
    if (scadenzeError) throw scadenzeError;
    let inviati=0, errori=0, saltati=0;
    const dettagli: Array<{scadenza_id:string;ok:boolean;messaggio:string}> = [];

    for (const riga of (scadenze || []) as ScadenzaRow[]) {
      const giorniResiduiMemo = differenzaGiorni(riga.data_scadenza, oggi);
      if (isMemoCalendarioSenzaScadenzario(riga) && giorniResiduiMemo < 0) {
        const { error } = await supabaseAdmin.from("tbscadenze_centrale").update({prossimo_alert_at:null,updated_at:new Date().toISOString()}).eq("id",riga.id).eq("studio_id",riga.studio_id);
        if (error) throw error;
        saltati++; dettagli.push({scadenza_id:riga.id,ok:true,messaggio:"Memo di calendario terminato al giorno zero"}); continue;
      }
      const { data: studio, error: studioError } = await supabaseAdmin.from("tbstudio").select("id,email,microsoft_connection_id").eq("id",riga.studio_id).maybeSingle();
      if (studioError || !studio?.microsoft_connection_id) { saltati++; dettagli.push({scadenza_id:riga.id,ok:false,messaggio:"Connessione Microsoft dello studio assente"}); continue; }

      const { data: assegnazioni, error: assegnazioniError } = await supabaseAdmin.from("tbscadenze_centrale_destinatari").select("utente_id,destinatario_email,tipo_destinatario").eq("studio_id",riga.studio_id).eq("scadenza_id",riga.id).eq("attivo",true);
      if (assegnazioniError) throw assegnazioniError;
      const destinatariInterniIds = Array.from(new Set((assegnazioni||[]).filter(a=>a.tipo_destinatario==="interno"&&a.utente_id).map(a=>String(a.utente_id))));
      const destinatariEsterni = Array.from(new Set((assegnazioni||[]).filter(a=>a.tipo_destinatario==="esterno"&&a.destinatario_email).map(a=>String(a.destinatario_email).trim().toLowerCase()).filter(Boolean)));
      if (!destinatariInterniIds.length && !destinatariEsterni.length && riga.operatore_responsabile_id) destinatariInterniIds.push(riga.operatore_responsabile_id);
      let destinatariInterni: any[]=[];
      if (destinatariInterniIds.length) {
        const { data, error } = await supabaseAdmin.from("tbutenti").select("id,nome,cognome,email,studio_id,attivo").eq("studio_id",riga.studio_id).eq("attivo",true).in("id",destinatariInterniIds);
        if (error) throw error; destinatariInterni=(data||[]).filter(d=>Boolean(d.email));
      }
      const destinatari = [
        ...destinatariInterni.map(d=>({tipo:"interno" as const,utente_id:String(d.id),nome:d.nome,cognome:d.cognome,email:String(d.email)})),
        ...destinatariEsterni.map(email=>({tipo:"esterno" as const,utente_id:null,nome:null,cognome:null,email}))
      ];
      if (!destinatari.length && riga.tipo_scadenza!=="documento_aml") { saltati++; dettagli.push({scadenza_id:riga.id,ok:false,messaggio:"Nessun destinatario valido associato alla scadenza"}); continue; }

      const { data: tokenDisponibili, error: tokenError } = await supabaseAdmin.from("tbmicrosoft365_user_tokens").select("user_id,updated_at").eq("microsoft_connection_id",studio.microsoft_connection_id).is("revoked_at",null).order("updated_at",{ascending:false});
      if (tokenError) throw tokenError;
      const utentiConTokenIds=Array.from(new Set((tokenDisponibili||[]).map(t=>String(t.user_id||"")).filter(Boolean)));
      let mittentiValidi:any[]=[];
      if (utentiConTokenIds.length) {
        const {data,error}=await supabaseAdmin.from("tbutenti").select("id").eq("studio_id",riga.studio_id).eq("attivo",true).in("id",utentiConTokenIds);
        if(error) throw error; mittentiValidi=data||[];
      }
      const mittentiValidiSet=new Set(mittentiValidi.map(m=>String(m.id)));
      const mittenteAlternativoId=utentiConTokenIds.find(id=>mittentiValidiSet.has(id))||null;
      const alert=calcolaTipoAlert(riga,oggi);
      let inviatiScadenza=0,erroriScadenza=0,saltatiScadenza=0;

      if(riga.tipo_scadenza==="documento_aml") {
        const {data:documentoAml,error:documentoAmlError}=await supabaseAdmin.from("tbclienti_documenti_aml").select("id,studio_id,soggetto_cliente_id,public_doc_enabled,public_doc_token,documento_richiesto_il").eq("id",riga.origine_record_id).eq("studio_id",riga.studio_id).eq("attivo",true).maybeSingle();
        if(documentoAmlError||!documentoAml?.id){errori++;erroriScadenza++;dettagli.push({scadenza_id:riga.id,ok:false,messaggio:documentoAmlError?.message||"Documento AML non trovato"});continue;}
        const {data:soggetto,error:soggettoError}=await supabaseAdmin.from("tbclienti").select("id,ragione_sociale,email").eq("id",documentoAml.soggetto_cliente_id).eq("studio_id",riga.studio_id).maybeSingle();
        if(soggettoError||!soggetto?.id||!soggetto.email){errori++;erroriScadenza++;dettagli.push({scadenza_id:riga.id,ok:false,messaggio:soggettoError?.message||"Soggetto AML o email non trovati"});continue;}
        if(!documentoAml.public_doc_enabled||!documentoAml.public_doc_token){
          try{await sendRichiestaDocumentoRappresentante({documentoAmlId:documentoAml.id,studioId:documentoAml.studio_id,nomeDestinatario:soggetto.ragione_sociale||"Cliente",email:String(soggetto.email).trim(),microsoftConnectionId:studio.microsoft_connection_id,clienteId:null,av4Id:null,note:"Richiesta automatica rinnovo documento AML da Scadenze unificate"});inviati++;inviatiScadenza++;dettagli.push({scadenza_id:riga.id,ok:true,messaggio:`Richiesta automatica documento inviata a ${soggetto.email}`});}
          catch(e:any){errori++;erroriScadenza++;dettagli.push({scadenza_id:riga.id,ok:false,messaggio:e?.message||"Errore invio richiesta documento AML"});}
        } else {saltati++;saltatiScadenza++;dettagli.push({scadenza_id:riga.id,ok:true,messaggio:`Link documento AML già attivo per ${soggetto.email}`});}
        const prossimoAlert=calcolaProssimoAlert(riga,oggi); const now=new Date().toISOString();
        const update:any={prossimo_alert_at:prossimoAlert,updated_at:now}; if(inviatiScadenza>0){update.numero_alert_inviati=Number(riga.numero_alert_inviati||0)+inviatiScadenza;update.ultimo_alert_inviato_at=now;}
        const {error}=await supabaseAdmin.from("tbscadenze_centrale").update(update).eq("id",riga.id).eq("studio_id",riga.studio_id);if(error)throw error;continue;
      }

      const urlApplicazione=process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||"https://app.studiomanagerpro.it";
      const link=riga.link_dettaglio?`${urlApplicazione}${riga.link_dettaglio}`:`${urlApplicazione}/scadenze`;
      for(const destinatario of destinatari){
        const destinatarioId=destinatario.utente_id, destinatarioEmail=destinatario.email;
        const senderUserId=destinatarioId&&mittentiValidiSet.has(destinatarioId)?destinatarioId:mittenteAlternativoId;
        const {data:logCreato,error:prenotazioneError}=await supabaseAdmin.from("tbscadenze_centrale_alert_log").insert({studio_id:riga.studio_id,scadenza_id:riga.id,operatore_responsabile_id:riga.operatore_responsabile_id||destinatarioId||mittenteAlternativoId,destinatario_utente_id:destinatarioId,alert_numero:Number(riga.numero_alert_inviati||0)+inviatiScadenza+1,giorni_preavviso:Math.max(differenzaGiorni(riga.data_scadenza,oggi),0),data_programmata:riga.prossimo_alert_at||adesso,canale:"email",destinatario_email:destinatarioEmail,esito:"in_lavorazione",tipo_alert:alert.tipoAlert,chiave_invio:alert.chiaveInvio}).select("id").maybeSingle();
        if(prenotazioneError){if(prenotazioneError.code==="23505"){saltati++;saltatiScadenza++;dettagli.push({scadenza_id:riga.id,ok:true,messaggio:`Alert già processato per ${destinatarioEmail}`});continue;}throw prenotazioneError;}
        if(!senderUserId){errori++;erroriScadenza++;await supabaseAdmin.from("tbscadenze_centrale_alert_log").update({esito:"errore",errore:"Nessun utente dello studio possiede un token Microsoft valido"}).eq("id",logCreato!.id);continue;}
        const nomeDestinatario=destinatario.tipo==="esterno"?"Cliente":[destinatario.nome,destinatario.cognome].filter(Boolean).join(" ")||destinatarioEmail;
        const html=`<div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.55"><h2 style="margin-bottom:8px;color:#1d4ed8">${alert.intestazione}</h2><p>Ciao <strong>${nomeDestinatario}</strong>,</p><p>è presente una scadenza che richiede la tua attenzione.</p><table style="border-collapse:collapse;width:100%;max-width:700px"><tr><td style="padding:7px;border:1px solid #d1d5db"><strong>Modulo</strong></td><td style="padding:7px;border:1px solid #d1d5db">${riga.origine_modulo}</td></tr><tr><td style="padding:7px;border:1px solid #d1d5db"><strong>Oggetto</strong></td><td style="padding:7px;border:1px solid #d1d5db">${riga.titolo}</td></tr><tr><td style="padding:7px;border:1px solid #d1d5db"><strong>Data di scadenza</strong></td><td style="padding:7px;border:1px solid #d1d5db">${formattaDataItaliana(riga.data_scadenza)}</td></tr>${riga.descrizione?`<tr><td style="padding:7px;border:1px solid #d1d5db"><strong>Descrizione</strong></td><td style="padding:7px;border:1px solid #d1d5db">${riga.descrizione}</td></tr>`:""}</table><p style="margin-top:20px"><a href="${link}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#2563eb;color:#fff;text-decoration:none;font-weight:bold">Apri la scadenza</a></p>${alert.tipoAlert==="scadenza_superata"?`<p style="color:#b91c1c;font-weight:bold">Il promemoria verrà ripetuto ogni lunedì mattina fino alla chiusura o all’annullamento della scadenza.</p>`:""}<p style="margin-top:24px;font-size:12px;color:#6b7280"><strong>Email generata automaticamente da Studio Manager Pro.</strong><br/>Si prega di non rispondere a questo messaggio.</p></div>`;
        const risultatoInvio=await sendEmailServer({senderUserId,microsoftConnectionId:studio.microsoft_connection_id,fromMailbox:riga.studio_id===REVISIONI_STUDIO_ID?REVISIONI_NOREPLY:null,to:destinatarioEmail,subject:alert.oggetto,html});
        if(!risultatoInvio.success){errori++;erroriScadenza++;await supabaseAdmin.from("tbscadenze_centrale_alert_log").update({esito:"errore",errore:risultatoInvio.error||"Errore invio email"}).eq("id",logCreato!.id);dettagli.push({scadenza_id:riga.id,ok:false,messaggio:`${risultatoInvio.error||"Errore invio email"} - ${destinatarioEmail}`});continue;}
        await supabaseAdmin.from("tbscadenze_centrale_alert_log").update({esito:"inviato",inviato_at:new Date().toISOString(),errore:null}).eq("id",logCreato!.id);
        inviati++;inviatiScadenza++;dettagli.push({scadenza_id:riga.id,ok:true,messaggio:`Alert inviato a ${destinatarioEmail}`});
      }
      const prossimoAlert=calcolaProssimoAlert(riga,oggi);const now=new Date().toISOString();const update:any={prossimo_alert_at:prossimoAlert,updated_at:now};if(inviatiScadenza>0){update.numero_alert_inviati=Number(riga.numero_alert_inviati||0)+inviatiScadenza;update.ultimo_alert_inviato_at=now;}
      const {error:updateError}=await supabaseAdmin.from("tbscadenze_centrale").update(update).eq("id",riga.id).eq("studio_id",riga.studio_id);if(updateError)throw updateError;
      dettagli.push({scadenza_id:riga.id,ok:erroriScadenza===0,messaggio:`Destinatari: ${destinatari.length}; inviati: ${inviatiScadenza}; errori: ${erroriScadenza}; già processati: ${saltatiScadenza}`});
    }
    return res.status(errori>0?207:200).json({ok:errori===0,trovati:scadenze?.length||0,inviati,saltati,errori,dettagli});
  } catch(error:any){console.error("Errore processore unico scadenze:",error);return res.status(500).json({ok:false,error:error?.message||"Errore processore unico delle scadenze"});}
}
