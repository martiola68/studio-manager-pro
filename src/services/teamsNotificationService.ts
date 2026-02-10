import { supabase } from "@/lib/supabase/client";
import { microsoftGraphService } from "./microsoftGraphService";

interface TeamsChannelConfig {
  teamId: string;
  channelId: string;
}

type NotificationType = "default" | "alert" | "scadenza";

export const teamsNotificationService = {
  /**
   * Helper privato per ottenere userId corrente se non fornito
   */
  async _getUserId(userId?: string): Promise<string | null> {
    if (userId) return userId;
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  },

  /**
   * Verifica se le notifiche Teams sono abilitate per una specifica funzionalità
   */
  async isEnabled(userId?: string, feature: "teams_notifications" | "teams_chat" = "teams_notifications"): Promise<boolean> {
    try {
      const uid = await this._getUserId(userId);
      if (!uid) return false;

      const { data: utente } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", uid)
        .single();

      if (!utente?.studio_id) return false;

      const { data: config } = await supabase
        .from("microsoft365_config")
        .select("enabled, features")
        .eq("studio_id", utente.studio_id)
        .single();

      if (!config?.enabled) return false;

      const features = config.features as Record<string, boolean> | null;
      return features?.[feature] === true;
    } catch {
      return false;
    }
  },

  /**
   * Ottiene la configurazione del canale appropriato
   */
  async getTeamsConfig(userId?: string, type: NotificationType = "default"): Promise<TeamsChannelConfig | null> {
    try {
      const uid = await this._getUserId(userId);
      if (!uid) return null;

      const { data: utente } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", uid)
        .single();

      if (!utente?.studio_id) return null;

      const { data: config } = await supabase
        .from("microsoft365_config")
        .select("teams_default_team_id, teams_default_channel_id, teams_scadenze_channel_id, teams_alert_channel_id")
        .eq("studio_id", utente.studio_id)
        .single();

      if (!config?.teams_default_team_id) return null;

      let channelId = config.teams_default_channel_id;
      
      if (type === "scadenza" && config.teams_scadenze_channel_id) {
        channelId = config.teams_scadenze_channel_id;
      } else if (type === "alert" && config.teams_alert_channel_id) {
        channelId = config.teams_alert_channel_id;
      }

      if (!channelId) return null;

      return {
        teamId: config.teams_default_team_id,
        channelId: channelId
      };
    } catch {
      return null;
    }
  },

  /**
   * Formatta un messaggio per Teams
   */
  formatMessage(title: string, message: string, type: NotificationType = "default"): string {
    const icon = type === "alert" ? "🔴" : type === "scadenza" ? "⏰" : "📢";
    return `<h3>${icon} ${title}</h3><p>${message}</p>`;
  },

  /**
   * Invia una notifica generica su Teams
   * Ordine parametri flessibile per retrocompatibilità
   */
  async notify(arg1: string, arg2: string, arg3?: string, arg4: NotificationType = "default"): Promise<{ success: boolean; error?: string }> {
    // Gestione overload: (userId, title, message, type) vs (title, message, type, undefined)
    // Se arg1 sembra un UUID (lunghezza 36), assumiamo sia userId. Altrimenti è title.
    // Metodo sicuro: cerchiamo di risolvere userId.
    
    let userId: string | undefined;
    let title: string;
    let message: string;
    let type: NotificationType;

    // Logica euristica semplice: se arg1 è lungo 36 caratteri (UUID), è probabile sia userId
    // Ma per sicurezza, controlliamo se arg3 è definito.
    // Firma originale: notify(userId, title, message, type)
    
    if (arg1.length === 36 && arg3) {
      userId = arg1;
      title = arg2;
      message = arg3;
      type = arg4;
    } else {
      // Firma nuova semplificata: notify(title, message, type) - userId dedotto
      title = arg1;
      message = arg2;
      type = (arg3 as NotificationType) || "default";
    }

    try {
      const uid = await this._getUserId(userId);
      if (!uid) return { success: false, error: "Utente non autenticato" };

      const enabled = await this.isEnabled(uid, "teams_notifications");
      if (!enabled) return { success: false, error: "Notifiche Teams disabilitate" };

      const config = await this.getTeamsConfig(uid, type);
      if (!config) return { success: false, error: "Canale Teams non configurato" };

      const formattedMessage = this.formatMessage(title, message, type);
      
      return await microsoftGraphService.sendChannelMessage(
        uid,
        config.teamId,
        config.channelId,
        formattedMessage
      );
    } catch (error: any) {
      console.error("Errore invio notifica Teams:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Invia notifica per nuovo cliente
   */
  async sendNuovoClienteNotification(clienteNome: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const title = "Nuovo Cliente Creato";
    const message = `È stato creato un nuovo cliente: <strong>${clienteNome}</strong>`;
    // Usa la firma nuova che deduce l'utente se manca
    if (userId) {
        return this.notify(userId, title, message, "default");
    } else {
        return this.notify(title, message, "default");
    }
  },

  /**
   * Invia notifica per scadenza
   */
  async sendScadenzaAlert(titolo: string, dataScadenza: string, cliente?: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const title = "Scadenza Imminente";
    let message = `La scadenza <strong>${titolo}</strong> scade il ${new Date(dataScadenza).toLocaleDateString()}.`;
    if (cliente) {
      message += `<br>Cliente: ${cliente}`;
    }
    if (userId) {
        return this.notify(userId, title, message, "scadenza");
    } else {
        return this.notify(title, message, "scadenza");
    }
  },

  /**
   * Invia notifica per promemoria
   */
  async sendPromemoriaNotification(titolo: string, data: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const title = "Promemoria";
    const message = `Promemoria: <strong>${titolo}</strong> per il ${new Date(data).toLocaleDateString()}`;
    if (userId) {
        return this.notify(userId, title, message, "default");
    } else {
        return this.notify(title, message, "default");
    }
  },

  /**
   * Invia notifica per nuova comunicazione
   */
  async sendComunicazioneNotification(oggetto: string, destinatario: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    const title = "Nuova Comunicazione";
    const message = `Inviata comunicazione: <strong>${oggetto}</strong> a ${destinatario}`;
    if (userId) {
        return this.notify(userId, title, message, "default");
    } else {
        return this.notify(title, message, "default");
    }
  }
};