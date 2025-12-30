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

    // Determina urgenza
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
    let query = supabase
      .from(tabella)
      .select(`
        id,
        data_scadenza,
        note,
        cliente_id,
        utente_assegnato_id,
        tbclienti!inner(ragione_sociale),
        tbutenti(nome, cognome)
      `)
      .gte("data_scadenza", dataInizio)
      .lte("data_scadenza", dataFine)
      .eq("completata", false);

    // Se NON è Partner, filtra per utente assegnato
    if (!isPartner) {
      query = query.eq("utente_assegnato_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${tipo} scadenze:`, error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      tipo,
      descrizione: item.note || `Scadenza ${tipo}`,
      data_scadenza: item.data_scadenza,
      cliente_nome: item.tbclienti?.ragione_sociale || "Cliente sconosciuto",
      utente_assegnato: item.tbutenti ? `${item.tbutenti.nome} ${item.tbutenti.cognome}` : undefined,
      tabella_origine: tabella
    }));
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