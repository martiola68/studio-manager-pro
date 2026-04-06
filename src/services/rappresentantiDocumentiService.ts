import { getSupabaseClient } from "@/lib/supabaseClient";
import { sendEmailViaMicrosoft } from "@/services/microsoftEmailService";

type SendRichiestaDocumentoParams = {
  recordId: string;
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
  const supabase = getSupabaseClient() as any;

  const {
    recordId,
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

  if (!recordId) throw new Error("recordId mancante.");
  if (!studioId) throw new Error("studio_id non disponibile.");
  if (!email || !String(email).trim()) {
    throw new Error("Il rappresentante non ha un indirizzo email valorizzato.");
  }
  if (!microsoftConnectionId || !String(microsoftConnectionId).trim()) {
    throw new Error("Connessione Microsoft non valorizzata.");
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  userId = session?.user?.id ?? null;

  if (!userId) {
    throw new Error(
      `Link generato, ma non è stato possibile identificare l'utente mittente.\n${url}`
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

  try {
    await sendEmailViaMicrosoft(userId, {
      microsoftConnectionId,
      to: destinatario,
      subject,
      html,
    });

    const { error: updateError } = await supabase
      .from("rapp_legali")
      .update({
        public_doc_token: token,
        public_doc_enabled: true,
        public_doc_sent_at: nowIso,
        public_doc_opened_at: null,
        public_doc_submitted_at: null,
        doc_richiesto_il: nowIso,
        microsoft_connection_id: microsoftConnectionId,
      })
      .eq("id", recordId);

    if (updateError) {
      throw new Error("Email inviata ma errore aggiornamento stato richiesta documento.");
    }

    const { error: logError } = await supabase.from("tbAMLComunicazioni").insert({
      studio_id: studioId,
      tipo_comunicazione: "richiesta_documento",
      cliente_id: clienteId,
      rapp_legale_id: recordId,
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
      await supabase
        .from("rapp_legali")
        .update({
          public_doc_token: null,
          public_doc_enabled: false,
          public_doc_sent_at: null,
          public_doc_opened_at: null,
          public_doc_submitted_at: null,
          doc_richiesto_il: null,
        })
        .eq("id", recordId);
    } catch (rollbackError) {
      console.error("Errore rollback richiesta documento:", rollbackError);
    }

    try {
      await supabase.from("tbAMLComunicazioni").insert({
        studio_id: studioId,
        tipo_comunicazione: "richiesta_documento",
        cliente_id: clienteId,
        rapp_legale_id: recordId,
        av4_id: av4Id,
        destinatario_email: destinatario,
        oggetto: subject,
        body_preview: `Errore invio richiesta documento a ${destinatario}.`,
        stato_invio: "errore",
        data_invio: new Date().toISOString(),
        utente_id: userId,
        public_token: token || null,
        note: error?.message || "Errore durante l'invio della richiesta documento.",
      });
    } catch {}

    throw error;
  }
}
