import { createClient } from "@supabase/supabase-js";
import { sendEmailServer } from "@/services/sendEmailServer";

type SendRichiestaDocumentoParams = {
  documentoAmlId: string;
  studioId: string;
  nomeDestinatario: string;
  email: string;
  nomeOperatore?: string | null;
  microsoftConnectionId: string;
  clienteId?: string | null;
  av4Id?: string | null;
  note?: string | null;
};

export async function sendRichiestaDocumentoRappresentante(
  params: SendRichiestaDocumentoParams
) {
 const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const {
  documentoAmlId,
  studioId,
  nomeDestinatario,
  email,
  nomeOperatore,
  microsoftConnectionId,
  clienteId = null,
  av4Id = null,
  note = "Invio richiesta documento da anagrafica rappresentante",
} = params;
 let token = "";
let userId: string | null = null;

  if (!documentoAmlId) {
  throw new Error("documentoAmlId mancante.");
}
  if (!studioId) throw new Error("studio_id non disponibile.");
  if (!email || !String(email).trim()) {
    throw new Error("Il rappresentante non ha un indirizzo email valorizzato.");
  }

  token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const nowIso = new Date().toISOString();

  const publicAppUrl =
    process.env.NEXT_PUBLIC_PUBLIC_APP_URL ||
    "https://studio-manager-public.vercel.app";

  const url = `${publicAppUrl}/documento/${token}`;

/*
 * Per le comunicazioni automatiche utilizziamo
 * esclusivamente l'Utente comunicazioni dello Studio.
 *
 * Gli invii manuali, come AV4, non passano da questa
 * logica e continuano a utilizzare l'utente operatore.
 */
const {
  data: utenteComunicazioni,
  error: utenteComunicazioniError,
} = await supabase
  .from("tbutenti")
  .select(`
    id,
    email,
    microsoft_connection_id
  `)
  .eq("studio_id", studioId)
  .eq("utente_comunicazioni", true)
  .eq("attivo", true)
  .maybeSingle();

if (utenteComunicazioniError) {
  throw new Error(
    utenteComunicazioniError.message
  );
}

if (!utenteComunicazioni?.id) {
  throw new Error(
    "Utente comunicazioni di Studio non configurato."
  );
}

if (!utenteComunicazioni.microsoft_connection_id) {
  throw new Error(
    "L'Utente comunicazioni non ha una connessione Microsoft 365 configurata."
  );
}

userId = String(
  utenteComunicazioni.id
);

const microsoftConnectionIdInvio =
  String(
    utenteComunicazioni.microsoft_connection_id
  );

/*
 * Verifichiamo che l'Utente comunicazioni
 * abbia effettivamente un token Microsoft valido.
 */
const {
  data: tokenComunicazioni,
  error: tokenComunicazioniError,
} = await supabase
  .from("tbmicrosoft365_user_tokens")
  .select("user_id")
  .eq("user_id", userId)
  .eq(
    "microsoft_connection_id",
    microsoftConnectionIdInvio
  )
  .is("revoked_at", null)
  .limit(1)
  .maybeSingle();

if (tokenComunicazioniError) {
  throw new Error(
    tokenComunicazioniError.message
  );
}

if (!tokenComunicazioni?.user_id) {
  throw new Error(
    "L'Utente comunicazioni non dispone di un token Microsoft 365 valido."
  );
}

  const destinatario = String(email).trim();
  const subject = "Richiesta aggiornamento documento di riconoscimento";
  const bodyPreview = `Richiesta aggiornamento documento inviata a ${destinatario}. Link pubblico: ${url}`;
  const firmaOperatore = String(nomeOperatore || "").trim();

  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.6;">
      <p>Gentile ${nomeDestinatario || "Cliente"},</p>

      <p>
        La invitiamo ad allegare un documento di riconoscimento in corso di validità.
      </p>

      <p>
        La invitiamo inoltre a verificare la correttezza dei dati relativi alla residenza
        (città, indirizzo e CAP) e, qualora mancanti o non aggiornati, a completarli
        direttamente nella pagina di caricamento.
      </p>

      <p>
        Può caricare il nuovo documento tramite il pulsante seguente:
      </p>

      <p style="margin-top: 10px; margin-bottom: 18px;">
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:8px; font-weight:600;">
          Carica documento e verifica dati residenza
        </a>
      </p>

      <p><strong>Documenti accettati:</strong></p>

      <ul style="padding-left: 18px; margin: 8px 0;">
        <li>Carta di identità</li>
        <li>Passaporto</li>
        <li>Patente</li>
      </ul>

      <p>
        Il documento allegato dovrà essere completo e chiaramente leggibile, senza tagli,
        sfocature, riflessi o parti coperte.
      </p>

      <p>
        Le chiediamo di compilare i campi richiesti, verificare i dati di residenza
        e allegare il documento aggiornato.
      </p>

      <p>
        Una volta completata la procedura, il collegamento non sarà più riutilizzabile.
      </p>

      ${
        firmaOperatore
          ? `<p>Cordiali saluti,<br/>${firmaOperatore}</p>`
          : ""
      }
    </div>
  `;

  const text = `
Gentile ${nomeDestinatario || "Cliente"},

La invitiamo ad allegare un documento di riconoscimento in corso di validità.

La invitiamo inoltre a verificare la correttezza dei dati relativi alla residenza
(città, indirizzo e CAP) e, qualora mancanti o non aggiornati, a completarli
direttamente nella pagina di caricamento.

Può caricare il nuovo documento tramite il link seguente:
${url}

Documenti accettati:
- Carta di identità
- Passaporto
- Patente

Il documento allegato dovrà essere completo e chiaramente leggibile, senza tagli,
sfocature, riflessi o parti coperte.

Le chiediamo di compilare i campi richiesti, verificare i dati di residenza
e allegare il documento aggiornato.

Una volta completata la procedura, il collegamento non sarà più riutilizzabile.

${firmaOperatore ? `Cordiali saluti,\n${firmaOperatore}` : ""}
  `.trim();

  try {
const emailResult =
  await sendEmailServer({
    senderUserId: userId,

    microsoftConnectionId:
      microsoftConnectionIdInvio,

    to: destinatario,

    subject,

    html,
  });

if (!emailResult.success) {
  throw new Error(
    emailResult.error ||
    "Errore durante l'invio email."
  );
}
/*
 * Aggiorniamo prima la nuova tabella AML.
 * recordId continua a essere, per ora, il vecchio rapp_legali.id.
 */
const { data: documentoAml, error: documentoAmlError } = await supabase
  .from("tbclienti_documenti_aml")
  .update({
    public_doc_token: token,
    public_doc_enabled: true,
    public_doc_sent_at: nowIso,
    public_doc_opened_at: null,
    public_doc_submitted_at: null,
    documento_richiesto_il: nowIso,
    microsoft_connection_id: microsoftConnectionIdInvio,
    updated_at: nowIso,
  })
  .eq("id", documentoAmlId)
  .eq("studio_id", studioId)
  .eq("attivo", true)
  .select("id")
  .maybeSingle();

if (documentoAmlError || !documentoAml?.id) {
  throw new Error(
    documentoAmlError?.message ||
      "Email inviata, ma il documento AML collegato non è stato trovato."
  );
}


  const { error: logError } = await supabase.from("tbAMLComunicazioni").insert({
  studio_id: studioId,
  tipo_comunicazione: "richiesta_documento",
  cliente_id: clienteId,
  rapp_legale_id: null,
  av4_id: av4Id,
  destinatario_email: destinatario,
  oggetto: subject,
  body_preview: bodyPreview,
  stato_invio: "inviata",
  data_invio: nowIso,
  utente_id: userId,
  public_token: token,
  note,
});
    
    if (logError) {
      throw new Error(
        `Email inviata correttamente a ${destinatario}, ma il log AML non è stato salvato.`
      );
    }

    return { ok: true, url, token };
} catch (error: any) {
  try {
    const rollbackTimestamp =
      new Date().toISOString();

    /*
     * Ripristiniamo esclusivamente il record
     * ufficiale tbclienti_documenti_aml.
     *
     * Non utilizziamo più rapp_legali né
     * legacy_rapp_legale_id.
     */
    await supabase
      .from("tbclienti_documenti_aml")
      .update({
        public_doc_token: null,
        public_doc_enabled: false,
        public_doc_sent_at: null,
        public_doc_opened_at: null,
        public_doc_submitted_at: null,
        documento_richiesto_il: null,
        updated_at: rollbackTimestamp,
      })
      .eq("id", documentoAmlId)
      .eq("studio_id", studioId)
      .eq("attivo", true);
  } catch (rollbackError) {
    console.error(
      "Errore rollback richiesta documento:",
      rollbackError
    );
  }

  try {
    await supabase
      .from("tbAMLComunicazioni")
      .insert({
        studio_id: studioId,
        tipo_comunicazione:
          "richiesta_documento",
        cliente_id: clienteId,
        rapp_legale_id: null,
        av4_id: av4Id,
        destinatario_email:
          destinatario,
        oggetto: subject,
        body_preview:
          `Errore invio richiesta documento a ${destinatario}.`,
        stato_invio: "errore",
        data_invio:
          new Date().toISOString(),
        utente_id: userId,
        public_token:
          token || null,
        note:
          error?.message ||
          "Errore durante l'invio della richiesta documento.",
      });
  } catch {}

  throw error;
}
}
