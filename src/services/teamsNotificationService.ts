import { supabase } from "@/lib/supabase/client";
import { microsoftGraphService } from "./microsoftGraphService";

/**
 * Teams Notification Service
 * Gestisce l'invio di notifiche automatiche su Microsoft Teams
 */

interface TeamNotificationConfig {
  enabled: boolean;
  defaultTeamId?: string;
  defaultChannelId?: string;
  scadenzeChannelId?: string;
  alertChannelId?: string;
}

/**
 * Verifica se Teams è abilitato per lo studio corrente
 */
async function isTeamsEnabled(): Promise<{
  enabled: boolean;
  config: TeamNotificationConfig | null;
  userId: string | null;
}> {
  try {
    // 1. Ottieni utente corrente
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.email) {
      return { enabled: false, config: null, userId: null };
    }

    // 2. Ottieni dati utente
    const { data: userData } = await supabase
      .from("tbutenti")
      .select("id, studio_id")
      .eq("email", session.user.email)
      .single();

    if (!userData?.studio_id) {
      return { enabled: false, config: null, userId: null };
    }

    // 3. Verifica se Microsoft 365 è abilitato per lo studio
    const { data: studioConfig } = await supabase
      .from("microsoft365_config")
      .select("*")
      .eq("studio_id", userData.studio_id)
      .maybeSingle();

    if (!studioConfig || !studioConfig.enabled) {
      return { enabled: false, config: null, userId: null };
    }

    // 4. Verifica se l'utente ha token Microsoft validi
    const isConnected = await microsoftGraphService.isConnected(userData.id);
    if (!isConnected) {
      return { enabled: false, config: null, userId: null };
    }

    // 5. Ottieni configurazione Teams (se presente)
    const teamsConfig: TeamNotificationConfig = {
      enabled: true,
      defaultTeamId: (studioConfig as any).teams_default_team_id || undefined,
      defaultChannelId:
        (studioConfig as any).teams_default_channel_id || undefined,
      scadenzeChannelId:
        (studioConfig as any).teams_scadenze_channel_id || undefined,
      alertChannelId: (studioConfig as any).teams_alert_channel_id || undefined,
    };

    return { enabled: true, config: teamsConfig, userId: userData.id };
  } catch (error) {
    console.error("Errore verifica Teams:", error);
    return { enabled: false, config: null, userId: null };
  }
}

/**
 * Formatta messaggio per Teams con stile Adaptive Card
 */
function formatTeamsMessage(
  title: string,
  message: string,
  type: "info" | "warning" | "error" | "success" = "info",
  link?: string
): string {
  const emoji = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    success: "✅",
  };

  let html = `<h3>${emoji[type]} ${title}</h3>`;
  html += `<p>${message}</p>`;

  if (link) {
    html += `<p><a href="${link}">🔗 Apri nel Software</a></p>`;
  }

  html += `<p><small>📅 ${new Date().toLocaleString("it-IT")}</small></p>`;

  return html;
}

/**
 * Invia notifica generica su Teams
 */
async function sendTeamsNotification(
  title: string,
  message: string,
  options?: {
    type?: "info" | "warning" | "error" | "success";
    channelId?: string;
    link?: string;
    mentionUsers?: string[]; // Array di user IDs da menzionare
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { enabled, config, userId } = await isTeamsEnabled();

    if (!enabled || !userId || !config) {
      console.log("Teams non abilitato, skip notifica");
      return { success: false, error: "Teams non abilitato" };
    }

    // Determina quale canale usare
    const channelId =
      options?.channelId ||
      config.defaultChannelId ||
      config.alertChannelId;

    if (!channelId) {
      console.warn("Nessun canale Teams configurato");
      return { success: false, error: "Canale Teams non configurato" };
    }

    // Determina quale team usare
    const teamId = config.defaultTeamId;

    if (!teamId) {
      console.warn("Nessun team Teams configurato");
      return { success: false, error: "Team Teams non configurato" };
    }

    // Formatta messaggio
    const formattedMessage = formatTeamsMessage(
      title,
      message,
      options?.type || "info",
      options?.link
    );

    // Invia messaggio su canale Teams
    const result = await microsoftGraphService.sendChannelMessage(
      userId,
      teamId,
      channelId,
      formattedMessage
    );

    if (!result.success) {
      console.error("Errore invio messaggio Teams:", result.error);
      return { success: false, error: result.error };
    }

    console.log("✅ Notifica Teams inviata con successo");
    return { success: true };
  } catch (error) {
    console.error("Errore sendTeamsNotification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

/**
 * Invia alert per scadenza imminente
 */
async function sendScadenzaAlert(scadenza: {
  id: string;
  tipo: string;
  cliente: string;
  dataScadenza: string;
  responsabile: string;
}): Promise<{ success: boolean }> {
  const title = `📅 Scadenza ${scadenza.tipo} Imminente`;
  const message = `
<strong>Cliente:</strong> ${scadenza.cliente}<br>
<strong>Data Scadenza:</strong> ${new Date(scadenza.dataScadenza).toLocaleDateString("it-IT")}<br>
<strong>Responsabile:</strong> ${scadenza.responsabile}<br>
<br>
<em>Assicurati di completare la pratica entro la scadenza!</em>
  `;

  const link = `${process.env.NEXT_PUBLIC_APP_URL || "https://yourapp.vercel.app"}/scadenze?id=${scadenza.id}`;

  return await sendTeamsNotification(title, message, {
    type: "warning",
    link,
  });
}

/**
 * Invia notifica per nuovo promemoria
 */
async function sendPromemoriaNotification(promemoria: {
  id: string;
  titolo: string;
  mittente: string;
  destinatario: string;
}): Promise<{ success: boolean }> {
  const title = `📬 Nuovo Promemoria`;
  const message = `
<strong>Da:</strong> ${promemoria.mittente}<br>
<strong>A:</strong> ${promemoria.destinatario}<br>
<strong>Oggetto:</strong> ${promemoria.titolo}<br>
<br>
<em>Hai ricevuto un nuovo promemoria! Clicca per visualizzarlo.</em>
  `;

  const link = `${process.env.NEXT_PUBLIC_APP_URL || "https://yourapp.vercel.app"}/promemoria?id=${promemoria.id}`;

  return await sendTeamsNotification(title, message, {
    type: "info",
    link,
  });
}

/**
 * Invia notifica per nuovo evento/appuntamento
 */
async function sendEventoNotification(evento: {
  id: string;
  titolo: string;
  dataInizio: string;
  cliente?: string;
  utente: string;
}): Promise<{ success: boolean }> {
  const title = `📅 Nuovo Appuntamento`;
  const message = `
<strong>Titolo:</strong> ${evento.titolo}<br>
<strong>Data:</strong> ${new Date(evento.dataInizio).toLocaleString("it-IT")}<br>
${evento.cliente ? `<strong>Cliente:</strong> ${evento.cliente}<br>` : ""}
<strong>Assegnato a:</strong> ${evento.utente}<br>
<br>
<em>Nuovo appuntamento in agenda!</em>
  `;

  const link = `${process.env.NEXT_PUBLIC_APP_URL || "https://yourapp.vercel.app"}/agenda?id=${evento.id}`;

  return await sendTeamsNotification(title, message, {
    type: "success",
    link,
  });
}

/**
 * Invia notifica per nuova comunicazione
 */
async function sendComunicazioneNotification(comunicazione: {
  id: string;
  oggetto: string;
  mittente: string;
  destinatari: string[];
}): Promise<{ success: boolean }> {
  const title = `📧 Nuova Comunicazione`;
  const message = `
<strong>Mittente:</strong> ${comunicazione.mittente}<br>
<strong>Destinatari:</strong> ${comunicazione.destinatari.join(", ")}<br>
<strong>Oggetto:</strong> ${comunicazione.oggetto}<br>
<br>
<em>È stata inviata una nuova comunicazione!</em>
  `;

  const link = `${process.env.NEXT_PUBLIC_APP_URL || "https://yourapp.vercel.app"}/comunicazioni?id=${comunicazione.id}`;

  return await sendTeamsNotification(title, message, {
    type: "info",
    link,
  });
}

/**
 * Invia notifica per nuovo cliente
 */
async function sendNuovoClienteNotification(cliente: {
  id: string;
  ragioneSociale: string;
  partitaIva?: string;
  responsabile: string;
}): Promise<{ success: boolean }> {
  const title = `🏢 Nuovo Cliente Inserito`;
  const message = `
<strong>Ragione Sociale:</strong> ${cliente.ragioneSociale}<br>
${cliente.partitaIva ? `<strong>P.IVA:</strong> ${cliente.partitaIva}<br>` : ""}
<strong>Responsabile:</strong> ${cliente.responsabile}<br>
<br>
<em>Un nuovo cliente è stato aggiunto al sistema!</em>
  `;

  const link = `${process.env.NEXT_PUBLIC_APP_URL || "https://yourapp.vercel.app"}/clienti?id=${cliente.id}`;

  return await sendTeamsNotification(title, message, {
    type: "success",
    link,
  });
}

/**
 * Invia reminder giornaliero con riepilogo scadenze
 */
async function sendDailyScadenzeDigest(scadenze: Array<{
  tipo: string;
  cliente: string;
  dataScadenza: string;
  responsabile: string;
}>): Promise<{ success: boolean }> {
  if (scadenze.length === 0) {
    return { success: true }; // Nessuna scadenza, non inviare
  }

  const title = `📊 Riepilogo Scadenze Oggi`;

  let message = `<strong>Hai ${scadenze.length} scadenza/e oggi:</strong><br><br>`;

  scadenze.forEach((s, index) => {
    message += `${index + 1}. <strong>${s.tipo}</strong> - ${s.cliente} (${s.responsabile})<br>`;
  });

  message += `<br><em>Buon lavoro! 💪</em>`;

  return await sendTeamsNotification(title, message, {
    type: "info",
  });
}

/**
 * Invia messaggio di benvenuto quando un utente si connette a Teams
 */
async function sendWelcomeMessage(userName: string): Promise<{ success: boolean }> {
  const title = `👋 Benvenuto su Studio Manager Pro!`;
  const message = `
<strong>Ciao ${userName}!</strong><br>
<br>
Il tuo account è stato connesso con successo a Microsoft Teams!<br>
<br>
Da ora riceverai notifiche automatiche su:<br>
✅ Scadenze imminenti<br>
✅ Nuovi promemoria<br>
✅ Appuntamenti in agenda<br>
✅ Comunicazioni importanti<br>
<br>
<em>Buon lavoro! 🚀</em>
  `;

  return await sendTeamsNotification(title, message, {
    type: "success",
  });
}

// Esporta tutte le funzioni
export const teamsNotificationService = {
  isTeamsEnabled,
  sendTeamsNotification,
  sendScadenzaAlert,
  sendPromemoriaNotification,
  sendEventoNotification,
  sendComunicazioneNotification,
  sendNuovoClienteNotification,
  sendDailyScadenzeDigest,
  sendWelcomeMessage,
};