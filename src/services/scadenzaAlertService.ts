import { supabase } from "@/lib/supabase/client";
import { teamsNotificationService } from "./teamsNotificationService";

export interface ScadenzaAlert {
  id: string;
  tipo: string;
  descrizione: string;
  data_scadenza: string;
  cliente_nome: string;
  urgenza: "critica" | "urgente" | "prossima";
  utente_assegnato?: string;
  tabella_origine?: string;
}

// Mappatura delle colonne di completamento per ogni tabella
const COMPLETION_COLUMNS: Record<string, string | null> = {
  "tbscadiva": "mod_inviato",
  "tbscad770": "mod_inviato",
  "tbscadfiscali": "mod_dual",
  "tbscadccgg": null,
  "tbscadbilanci": null,
  "tbscadlipe": null,
  "tbscadcu": null,
  "tbscadestero": null,
  "tbscadproforma": null,
};

export const scadenzaAlertService = {
  /**
   * Ottiene tutte le scadenze in arrivo per un utente
   * Se l'utente è Partner, restituisce TUTTE le scadenze dello studio
   * Altrimenti restituisce solo quelle assegnate all'utente
   */
  async getScadenzeInArrivo(userId: string, isPartner: boolean, studioId: string): Promise<ScadenzaAlert[]> {
    const oggi = new Date();
    const tra7giorni = new Date();
    tra7giorni.setDate(oggi.getDate() + 7);
    const tra30giorni = new Date();
    tra30giorni.setDate(oggi.getDate() + 30);

    const oggiStr = oggi.toISOString().split("T")[0];
    const tra7giorniStr = tra7giorni.toISOString().split("T")[0];
    const tra30giorniStr = tra30giorni.toISOString().split("T")[0];

    // Query parallele su tutte le tabelle scadenze
    const scadenzePromises = [
      this.fetchScadenzeFromTable("tbscadiva", "IVA", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchScadenzeFromTable("tbscadccgg", "CCGG", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchScadenzeFromTable("tbscadcu", "CU", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchScadenzeFromTable("tbscadfiscali", "Fiscale", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchScadenzeFromTable("tbscadbilanci", "Bilancio", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchScadenzeFromTable("tbscad770", "770", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchScadenzeFromTable("tbscadlipe", "LIPE", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchScadenzeFromTable("tbscadestero", "Esterometro", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchScadenzeFromTable("tbscadproforma", "Proforma", userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchImuScadenze(userId, isPartner, studioId, oggiStr, tra30giorniStr),
      this.fetchPromemoriaScadenze(userId, isPartner, studioId, oggiStr, tra30giorniStr),
    ];

    const results = await Promise.all(scadenzePromises);
    const tutteScadenze = results.flat();

    // Determina urgenza e ordina
    return tutteScadenze.map(scadenza => ({
      ...scadenza,
      urgenza: this.calcolaUrgenza(scadenza.data_scadenza, oggiStr, tra7giorniStr)
    })).sort((a, b) => {
      const urgenzaOrder = { critica: 0, urgente: 1, prossima: 2 };
      return urgenzaOrder[a.urgenza] - urgenzaOrder[b.urgenza];
    });
  },

  async fetchScadenzeFromTable(
    tabella: string,
    tipo: string,
    userId: string,
    isPartner: boolean,
    studioId: string,
    dataInizio: string,
    dataFine: string
  ): Promise<Omit<ScadenzaAlert, "urgenza">[]> {
    try {
      // Base query con join a tbtipi_scadenze per ottenere la data
      let query = supabase
        .from(tabella as any)
        .select(`
          id,
          nominativo,
          utente_operatore_id,
          tipo_scadenza_id,
          tbtipi_scadenze!inner(
            nome,
            data_scadenza,
            tipo_scadenza
          ),
          tbutenti:utente_operatore_id(nome, cognome)
        `)
        .gte("tbtipi_scadenze.data_scadenza", dataInizio)
        .lte("tbtipi_scadenze.data_scadenza", dataFine);

      // Filtro per ruolo: Partner vede tutto, Operatori solo le proprie
      if (!isPartner) {
        query = query.eq("utente_operatore_id", userId);
      }

      // Aggiungi filtro completamento SOLO se la tabella ha la colonna
      const completionColumn = COMPLETION_COLUMNS[tabella];
      if (completionColumn === "mod_inviato") {
        // Tabelle con mod_inviato (tbscadiva, tbscad770)
        query = query.or("mod_inviato.is.null,mod_inviato.eq.false");
      } else if (completionColumn === "mod_dual") {
        // tbscadfiscali ha mod_r_inviato E mod_i_inviato
        query = query.or("mod_r_inviato.is.null,mod_r_inviato.eq.false,mod_i_inviato.is.null,mod_i_inviato.eq.false");
      }
      // Se completionColumn è null, non aggiungiamo filtri (mostra tutte)

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${tipo} scadenze:`, error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        tipo,
        descrizione: item.tbtipi_scadenze?.nome || `Scadenza ${tipo}`,
        data_scadenza: item.tbtipi_scadenze?.data_scadenza || "",
        cliente_nome: item.nominativo || "Cliente sconosciuto",
        utente_assegnato: item.tbutenti ? `${item.tbutenti.nome} ${item.tbutenti.cognome}` : undefined,
        tabella_origine: tabella
      }));
    } catch (error) {
      console.error(`Exception fetching ${tipo} scadenze:`, error);
      return [];
    }
  },

  async fetchImuScadenze(
    userId: string,
    isPartner: boolean,
    studioId: string,
    dataInizio: string,
    dataFine: string
  ): Promise<Omit<ScadenzaAlert, "urgenza">[]> {
    try {
      // 1. Cerca se ci sono scadenze IMU nel periodo in tbtipi_scadenze
      const { data: tipiScadenze, error: tipiError } = await supabase
        .from("tbtipi_scadenze")
        .select("*")
        .eq("tipo_scadenza", "imu")
        .gte("data_scadenza", dataInizio)
        .lte("data_scadenza", dataFine);

      if (tipiError || !tipiScadenze || tipiScadenze.length === 0) {
        return [];
      }

      const alerts: Omit<ScadenzaAlert, "urgenza">[] = [];

      // 2. Per ogni scadenza IMU trovata, cerca i clienti che devono ancora completarla
      for (const tipoScadenza of tipiScadenze) {
        let query = supabase
          .from("tbscadimu")
          .select(`
            id, 
            nominativo, 
            operatore,
            professionista,
            acconto_imu, acconto_dovuto, acconto_comunicato,
            saldo_imu, saldo_dovuto, saldo_comunicato,
            dichiarazione_imu, dichiarazione_presentata,
            tbclienti!inner(utente_operatore_id)
          `);

        // Filtro operatore se non partner (tramite relazione tbclienti)
        if (!isPartner) {
          query = query.eq("tbclienti.utente_operatore_id", userId);
        }

        // Logica specifica per tipo di scadenza IMU
        const nomeScadenza = tipoScadenza.nome.toLowerCase();
        
        if (nomeScadenza.includes("acconto")) {
          query = query
            .eq("acconto_imu", true)
            .eq("acconto_dovuto", true)
            .eq("acconto_comunicato", false);
        } else if (nomeScadenza.includes("saldo")) {
          query = query
            .eq("saldo_imu", true)
            .eq("saldo_dovuto", true)
            .eq("saldo_comunicato", false);
        } else if (nomeScadenza.includes("dichiarazione")) {
          query = query
            .eq("dichiarazione_imu", true)
            .eq("dichiarazione_presentata", false);
        } else {
          continue; 
        }

        const { data: clienti, error } = await query;
        
        if (!error && clienti) {
          clienti.forEach((cliente: any) => {
            alerts.push({
              id: `${cliente.id}_${tipoScadenza.id}`,
              tipo: "IMU",
              descrizione: tipoScadenza.nome,
              data_scadenza: tipoScadenza.data_scadenza,
              cliente_nome: cliente.nominativo || "Cliente",
              utente_assegnato: cliente.operatore || undefined,
              tabella_origine: "tbscadimu"
            });
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error("Errore fetch IMU scadenze:", error);
      return [];
    }
  },

  async fetchPromemoriaScadenze(
    userId: string,
    isPartner: boolean,
    studioId: string,
    dataInizio: string,
    dataFine: string
  ): Promise<Omit<ScadenzaAlert, "urgenza">[]> {
    try {
      let query = supabase
        .from("tbpromemoria")
        .select(`
          id,
          note,
          data_scadenza,
          operatore_id,
          tbtipopromemoria(nome),
          tbutenti!tbpromemoria_operatore_id_fkey(nome, cognome)
        `)
        .eq("working_progress", "In lavorazione")
        .gte("data_scadenza", dataInizio)
        .lte("data_scadenza", dataFine);

      if (!isPartner) {
        query = query.eq("operatore_id", userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching promemoria scadenze:", error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        tipo: "Promemoria",
        descrizione: item.note || item.tbtipopromemoria?.nome || "Promemoria senza descrizione",
        data_scadenza: item.data_scadenza,
        cliente_nome: "Interno",
        utente_assegnato: item.tbutenti ? `${item.tbutenti.nome} ${item.tbutenti.cognome}` : undefined,
        tabella_origine: "tbpromemoria"
      }));
    } catch (error) {
      console.error("Exception fetching promemoria scadenze:", error);
      return [];
    }
  },

  calcolaUrgenza(dataScadenza: string, oggi: string, tra7giorni: string): "critica" | "urgente" | "prossima" {
    if (dataScadenza <= oggi) {
      return "critica";
    } else if (dataScadenza <= tra7giorni) {
      return "urgente";
    } else {
      return "prossima";
    }
  },

  /**
   * Invia notifica Teams per una scadenza urgente/critica
   */
  async sendTeamsAlertForScadenza(scadenza: ScadenzaAlert): Promise<boolean> {
    try {
      // Solo scadenze urgenti/critiche
      if (scadenza.urgenza !== "critica" && scadenza.urgenza !== "urgente") {
        return false;
      }

      await teamsNotificationService.sendScadenzaAlert({
        id: scadenza.id,
        tipo: scadenza.tipo,
        cliente: scadenza.cliente_nome,
        dataScadenza: scadenza.data_scadenza,
        responsabile: scadenza.utente_assegnato || "Non assegnato",
      });

      return true;
    } catch (error) {
      console.log("Teams alert skipped:", error);
      return false;
    }
  },

  /**
   * Segna una scadenza come "dismissata" (nascosta temporaneamente)
   * Salva in localStorage per non mostrarla di nuovo nella sessione corrente
   */
  dismissAlert(scadenzaId: string) {
    if (typeof window === "undefined") return;
    
    const dismissed = JSON.parse(localStorage.getItem("dismissed_alerts") || "[]");
    if (!dismissed.includes(scadenzaId)) {
      dismissed.push(scadenzaId);
      localStorage.setItem("dismissed_alerts", JSON.stringify(dismissed));
    }
  },

  /**
   * Verifica se una scadenza è stata dismissata
   */
  isDismissed(scadenzaId: string): boolean {
    if (typeof window === "undefined") return false;
    
    const dismissed = JSON.parse(localStorage.getItem("dismissed_alerts") || "[]");
    return dismissed.includes(scadenzaId);
  },

  /**
   * Pulisce gli alert dismissati (da chiamare all'inizio di ogni giornata)
   */
  clearDismissed() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("dismissed_alerts");
  },
  
  /**
   * Invia notifica Teams per una scadenza urgente
   */
  async sendTeamsAlert(scadenza: ScadenzaAlert, userId: string): Promise<boolean> {
    try {
      const { teamsService } = await import("./teamsService");
      
      // Recupera email dell'utente
      const { data: userData } = await supabase
        .from("tbutenti")
        .select("email, nome, cognome")
        .eq("id", userId)
        .single();
      
      if (!userData?.email) {
        console.error("Email utente non trovata");
        return false;
      }
      
      // Determina emoji e priorità in base all'urgenza
      let emoji = "⚠️";
      let importanza: "normal" | "high" | "urgent" = "normal";
      
      if (scadenza.urgenza === "critica") {
        emoji = "🚨";
        importanza = "urgent";
      } else if (scadenza.urgenza === "urgente") {
        emoji = "⏰";
        importanza = "high";
      }
      
      // Invia messaggio diretto su Teams
      await teamsService.sendDirectMessage(
        userId,
        userData.email,
        {
          content: `${emoji} <strong>Scadenza ${scadenza.urgenza.toUpperCase()}</strong><br><br>
            📋 <strong>${scadenza.descrizione}</strong><br>
            🏢 Cliente: ${scadenza.cliente_nome}<br>
            📅 Data scadenza: ${new Date(scadenza.data_scadenza).toLocaleDateString("it-IT")}<br>
            📂 Tipo: ${scadenza.tipo}<br><br>
            ${scadenza.utente_assegnato ? `👤 Assegnato a: ${scadenza.utente_assegnato}<br><br>` : ""}
            <em>Accedi a Studio Manager Pro per gestire questa scadenza</em>`,
          contentType: "html",
          importance: importanza
        }
      );
      
      return true;
    } catch (error) {
      console.error("Errore invio notifica Teams:", error);
      return false;
    }
  },
  
  /**
   * Invia notifiche Teams per tutte le scadenze urgenti di un utente
   */
  async sendBulkTeamsAlerts(
    scadenze: ScadenzaAlert[],
    userId: string,
    onlyUrgent: boolean = true
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    
    // Filtra solo scadenze urgenti/critiche se richiesto
    const scadenzeDaNotificare = onlyUrgent
      ? scadenze.filter(s => s.urgenza === "critica" || s.urgenza === "urgente")
      : scadenze;
    
    for (const scadenza of scadenzeDaNotificare) {
      const success = await this.sendTeamsAlert(scadenza, userId);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      
      // Pausa di 500ms tra una notifica e l'altra per evitare rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { sent, failed };
  },
  
  /**
   * Invia notifica Teams a un utente specifico per una scadenza
   */
  async notifyUserAboutDeadline(
    scadenza: ScadenzaAlert,
    targetUserId: string,
    senderUserId: string
  ): Promise<boolean> {
    try {
      const { teamsService } = await import("./teamsService");
      
      // Recupera email destinatario
      const { data: targetUser } = await supabase
        .from("tbutenti")
        .select("email, nome, cognome")
        .eq("id", targetUserId)
        .single();
      
      if (!targetUser?.email) {
        console.error("Email destinatario non trovata");
        return false;
      }
      
      // Invia notifica
      await teamsService.sendDirectMessage(
        senderUserId,
        targetUser.email,
        {
          content: `📌 <strong>Promemoria Scadenza</strong><br><br>
            ${targetUser.nome}, ti segnalo questa scadenza:<br><br>
            📋 ${scadenza.descrizione}<br>
            🏢 Cliente: ${scadenza.cliente_nome}<br>
            📅 Data: ${new Date(scadenza.data_scadenza).toLocaleDateString("it-IT")}<br>
            📂 Tipo: ${scadenza.tipo}<br><br>
            <em>Verifica su Studio Manager Pro</em>`,
          contentType: "html",
          importance: "high"
        }
      );
      
      return true;
    } catch (error) {
      console.error("Errore invio notifica Teams a utente:", error);
      return false;
    }
  }
};