import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";
import { emailService } from "./emailService";

type EventoAgenda = Database["public"]["Tables"]["tbagenda"]["Row"];
type EventoAgendaInsert = Database["public"]["Tables"]["tbagenda"]["Insert"];
type EventoAgendaUpdate = Database["public"]["Tables"]["tbagenda"]["Update"];

export const eventoService = {
  async getEventi(): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("tbagenda")
      .select("*")
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Error fetching eventi:", error);
      return [];
    }
    return data || [];
  },

  async getEventoById(id: string): Promise<EventoAgenda | null> {
    const { data, error } = await supabase
      .from("tbagenda")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching evento:", error);
      return null;
    }
    return data;
  },

  async getEventiByUtente(utenteId: string): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("tbagenda")
      .select("*")
      .eq("utente_id", utenteId)
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Error fetching eventi by utente:", error);
      return [];
    }
    return data || [];
  },

  async getEventiByCliente(clienteId: string): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("tbagenda")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Error fetching eventi by cliente:", error);
      return [];
    }
    return data || [];
  },

  async getEventiByDateRange(startDate: string, endDate: string): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("tbagenda")
      .select("*")
      .gte("data_inizio", startDate)
      .lte("data_inizio", endDate)
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Error fetching eventi by date range:", error);
      return [];
    }
    return data || [];
  },

  async createEvento(evento: EventoAgendaInsert): Promise<EventoAgenda | null> {
    const { data, error } = await supabase
      .from("tbagenda")
      .insert(evento)
      .select()
      .single();

    if (error) {
      console.error("Error creating evento:", error);
      throw error;
    }

    // Invia notifica email dopo la creazione dell'evento
    if (data) {
      try {
        await this.sendEventNotification(data);
      } catch (emailError) {
        console.error("Error sending event notification:", emailError);
        // Non bloccare la creazione dell'evento se l'invio email fallisce
      }
    }

    return data;
  },

  async sendEventNotification(evento: EventoAgenda): Promise<void> {
    try {
      console.log("📧 Preparing to send event notification for:", evento.id);

      // Recupera i dati del responsabile
      if (!evento.utente_id) {
        console.error("❌ No utente_id found for evento");
        return;
      }

      const { data: responsabile } = await supabase
        .from("tbutenti")
        .select("nome, cognome, email")
        .eq("id", evento.utente_id)
        .single();

      if (!responsabile || !responsabile.email) {
        console.error("❌ Responsabile email not found");
        return;
      }

      // Recupera i dati dei partecipanti (se presenti)
      let partecipantiEmails: string[] = [];
      let partecipantiNomi: string[] = [];
      
      const partecipantiIds = Array.isArray(evento.partecipanti) 
        ? (evento.partecipanti as string[]) 
        : [];

      if (partecipantiIds.length > 0) {
        const { data: partecipanti } = await supabase
          .from("tbutenti")
          .select("nome, cognome, email")
          .in("id", partecipantiIds);

        if (partecipanti) {
          partecipantiEmails = partecipanti
            .filter(p => p.email)
            .map(p => p.email!);
          partecipantiNomi = partecipanti.map(p => 
            `${p.nome || ""} ${p.cognome || ""}`.trim() || p.email || "Utente"
          );
        }
      }

      // Recupera i dati del cliente (se presente)
      let clienteEmail: string | undefined;
      let clienteNome: string | undefined;

      if (evento.cliente_id) {
        const { data: cliente } = await supabase
          .from("tbclienti")
          .select("ragione_sociale, email")
          .eq("id", evento.cliente_id)
          .single();

        if (cliente && cliente.email) {
          clienteEmail = cliente.email;
          clienteNome = cliente.ragione_sociale || "Cliente";
        }
      }

      // Helper per formattare data e ora
      const formatDate = (dateStr: string) => {
        try {
          return new Date(dateStr).toLocaleDateString('it-IT');
        } catch (e) {
          return dateStr;
        }
      };
      
      const formatTime = (dateStr: string) => {
        try {
          return new Date(dateStr).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          return "00:00";
        }
      };

      // Usa emailService per inviare la notifica
      const emailData = {
        eventoId: evento.id,
        eventoTitolo: evento.titolo || "Evento senza titolo",
        eventoData: formatDate(evento.data_inizio),
        eventoOraInizio: evento.ora_inizio ? evento.ora_inizio.substring(0, 5) : formatTime(evento.data_inizio),
        eventoOraFine: evento.ora_fine ? evento.ora_fine.substring(0, 5) : formatTime(evento.data_fine),
        eventoLuogo: evento.luogo || undefined,
        eventoDescrizione: evento.descrizione || undefined,
        eventoInSede: evento.in_sede || false,
        responsabileEmail: responsabile.email,
        responsabileNome: `${responsabile.nome || ""} ${responsabile.cognome || ""}`.trim() || responsabile.email,
        partecipantiEmails,
        partecipantiNomi,
        clienteEmail,
        clienteNome
      };

      console.log("📧 Sending notification via emailService");
      const result = await emailService.sendEventNotification(emailData);
      
      if (result.success) {
        console.log("✅ Event notification sent successfully:", result);
      } else {
        console.error("❌ Failed to send event notification:", result.error);
      }
    } catch (error) {
      console.error("💥 Critical error in sendEventNotification:", error);
      // Non bloccare la creazione/modifica dell'evento se l'email fallisce
    }
  },

  async updateEvento(id: string, updates: EventoAgendaUpdate): Promise<EventoAgenda | null> {
    const { data, error } = await supabase
      .from("tbagenda")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating evento:", error);
      throw error;
    }

    // Invia notifica email dopo l'aggiornamento dell'evento
    if (data) {
      try {
        await this.sendEventNotification(data);
      } catch (emailError) {
        console.error("Error sending event notification:", emailError);
      }
    }

    return data;
  },

  async deleteEvento(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("tbagenda")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting evento:", error);
      return false;
    }
    return true;
  }
};