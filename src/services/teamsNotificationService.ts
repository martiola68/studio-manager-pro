import { supabase } from "@/lib/supabase/client";
import { microsoftGraphService } from "./microsoftGraphService";

/**
 * Tipi di notifica supportati
 */
export type NotificationType = "info" | "success" | "warning" | "error" | "alert";

/**
 * Opzioni per l'invio di notifiche Teams
 */
interface TeamsNotificationOptions {
  type?: NotificationType;
  teamId?: string;
  channelId?: string;
  mention?: string[];
  urgent?: boolean;
}

/**
 * Configurazione canali Teams per tipo di notifica
 */
interface TeamsChannelConfig {
  default_team_id?: string;
  default_channel_id?: string;
  scadenze_channel_id?: string;
  alert_channel_id?: string;
}

/**
 * Servizio per l'invio di notifiche su Microsoft Teams
 */
export const teamsNotificationService = {
  /**
   * Ottiene la configurazione Teams per lo studio dell'utente
   */
  async getTeamsConfig(userId: string): Promise<TeamsChannelConfig | null> {
    try {
      // 1. Ottieni studio_id dell'utente
      const { data: utente } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", userId)
        .single();

      if (!utente?.studio_id) {
        console.error("❌ Studio non trovato per utente:", userId);
        return null;
      }

      // 2. Ottieni configurazione Teams
      const { data: config } = await supabase
        .from("microsoft365_config")
        .select("teams_default_team_id, teams_default_channel_id, teams_scadenze_channel_id, teams_alert_channel_id")
        .eq("studio_id", utente.studio_id)
        .single();

      if (!config) {
        console.error("❌ Configurazione Teams non trovata");
        return null;
      }

      return {
        default_team_id: config.teams_default_team_id || undefined,
        default_channel_id: config.teams_default_channel_id || undefined,
        scadenze_channel_id: config.teams_scadenze_channel_id || undefined,
        alert_channel_id: config.teams_alert_channel_id || undefined,
      };
    } catch (error) {
      console.error("❌ Errore recupero configurazione Teams:", error);
      return null;
    }
  },

  /**
   * Formatta il contenuto del messaggio con icone e colori
   */
  formatMessage(title: string, message: string, type: NotificationType = "info"): string {
    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
      alert: "🚨",
    };

    const icon = icons[type] || "📢";

    return `
<p><strong>${icon} ${title}</strong></p>
<p>${message}</p>
    `.trim();
  },

  /**
   * Invia notifica su Microsoft Teams
   */
  async sendTeamsNotification(
    title: string,
    message: string,
    options: TeamsNotificationOptions = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("📨 [Teams] Invio notifica:", { title, type: options.type });

      // 1. Ottieni utente corrente
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "Utente non autenticato" };
      }

      // 2. Verifica se Teams è abilitato
      const { data: utente } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (!utente?.studio_id) {
        return { success: false, error: "Studio non trovato" };
      }

      const { data: config } = await supabase
        .from("microsoft365_config")
        .select("enabled, features")
        .eq("studio_id", utente.studio_id)
        .single();

      if (!config?.enabled || !config?.features?.teams) {
        console.log("⚠️ Teams non abilitato, skip notifica");
        return { success: false, error: "Teams non abilitato" };
      }

      // 3. Ottieni configurazione canali
      const teamsConfig = await this.getTeamsConfig(user.id);
      if (!teamsConfig) {
        return { success: false, error: "Configurazione Teams non trovata" };
      }

      // 4. Determina il canale di destinazione
      let targetChannelId = options.channelId;
      let targetTeamId = options.teamId;

      if (!targetChannelId) {
        // Usa canale specifico in base al tipo di notifica
        if (options.type === "alert" && teamsConfig.alert_channel_id) {
          targetChannelId = teamsConfig.alert_channel_id;
        } else if (options.urgent && teamsConfig.scadenze_channel_id) {
          targetChannelId = teamsConfig.scadenze_channel_id;
        } else {
          targetChannelId = teamsConfig.default_channel_id;
        }
      }

      if (!targetTeamId) {
        targetTeamId = teamsConfig.default_team_id;
      }

      if (!targetTeamId || !targetChannelId) {
        return { success: false, error: "Team o canale non configurato" };
      }

      // 5. Formatta messaggio
      const formattedMessage = this.formatMessage(title, message, options.type);

      // 6. Invia messaggio su Teams
      console.log("📤 [Teams] Invio a canale:", { teamId: targetTeamId, channelId: targetChannelId });

      await microsoftGraphService.sendChannelMessage(
        user.id,
        targetTeamId,
        targetChannelId,
        formattedMessage
      );

      console.log("✅ [Teams] Notifica inviata con successo");
      return { success: true };
    } catch (error: any) {
      console.error("❌ [Teams] Errore invio notifica:", error);
      return {
        success: false,
        error: error.message || "Errore invio notifica Teams",
      };
    }
  },

  /**
   * Invia notifica per nuova scadenza
   */
  async notifyScadenza(
    clienteNome: string,
    tipoScadenza: string,
    dataScadenza: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const title = "📅 Nuova Scadenza";
    const message = `
**Cliente:** ${clienteNome}
**Tipo:** ${tipoScadenza}
**Data scadenza:** ${new Date(dataScadenza).toLocaleDateString("it-IT")}
    `.trim();

    return this.sendTeamsNotification(title, message, {
      type: "info",
      urgent: true,
    });
  },

  /**
   * Invia notifica per scadenza imminente
   */
  async notifyScadenzaImminente(
    clienteNome: string,
    tipoScadenza: string,
    dataScadenza: string,
    giorniMancanti: number
  ): Promise<{ success: boolean; error?: string }> {
    const title = "⚠️ Scadenza Imminente";
    const message = `
**Cliente:** ${clienteNome}
**Tipo:** ${tipoScadenza}
**Data scadenza:** ${new Date(dataScadenza).toLocaleDateString("it-IT")}
**Giorni mancanti:** ${giorniMancanti}
    `.trim();

    return this.sendTeamsNotification(title, message, {
      type: "warning",
      urgent: true,
    });
  },

  /**
   * Invia notifica per scadenza critica
   */
  async notifyScadenzaCritica(
    clienteNome: string,
    tipoScadenza: string,
    dataScadenza: string
  ): Promise<{ success: boolean; error?: string }> {
    const title = "🚨 SCADENZA CRITICA";
    const message = `
**URGENTE - AZIONE RICHIESTA**

**Cliente:** ${clienteNome}
**Tipo:** ${tipoScadenza}
**Data scadenza:** ${new Date(dataScadenza).toLocaleDateString("it-IT")}

⚠️ La scadenza è imminente o già superata!
    `.trim();

    return this.sendTeamsNotification(title, message, {
      type: "alert",
      urgent: true,
    });
  },

  /**
   * Invia notifica per nuovo promemoria
   */
  async notifyPromemoria(
    clienteNome: string,
    oggetto: string,
    messaggio: string
  ): Promise<{ success: boolean; error?: string }> {
    const title = "📝 Nuovo Promemoria";
    const content = `
**Cliente:** ${clienteNome}
**Oggetto:** ${oggetto}
**Messaggio:** ${messaggio}
    `.trim();

    return this.sendTeamsNotification(title, content, {
      type: "info",
    });
  },

  /**
   * Invia notifica per nuovo evento in agenda
   */
  async notifyEvento(
    titolo: string,
    dataInizio: string,
    dataFine: string,
    descrizione?: string
  ): Promise<{ success: boolean; error?: string }> {
    const title = "📅 Nuovo Evento in Agenda";
    const message = `
**Titolo:** ${titolo}
**Data inizio:** ${new Date(dataInizio).toLocaleString("it-IT")}
**Data fine:** ${new Date(dataFine).toLocaleString("it-IT")}
${descrizione ? `**Descrizione:** ${descrizione}` : ""}
    `.trim();

    return this.sendTeamsNotification(title, message, {
      type: "info",
    });
  },

  /**
   * Invia notifica generica
   */
  async notify(
    title: string,
    message: string,
    type: NotificationType = "info"
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendTeamsNotification(title, message, { type });
  },
};