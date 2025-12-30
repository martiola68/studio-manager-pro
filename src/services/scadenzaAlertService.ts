import { supabase } from "@/integrations/supabase/client";

export interface ScadenzaAlert {
  id: string;
  tipo: string;
  descrizione: string;
  data_scadenza: string;
  cliente_nome: string;
  urgenza: "critica" | "urgente" | "prossima";
  utente_assegnato?: string;
  tabella_origine: string;
}

// Mappatura delle colonne di completamento per ogni tabella
const COMPLETION_COLUMNS: Record<string, string | null> = {
  "tbscadiva": "mod_inviato",
  "tbscad770": "mod_inviato",
  "tbscadfiscali": "mod_dual", // Special case: ha mod_r_inviato E mod_i_inviato
  "tbscadccgg": null, // No completion column
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
  }
};