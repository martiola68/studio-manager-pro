import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";
import { emailService } from "./emailService";

type EventoAgenda = Database["public"]["Tables"]["tbagenda"]["Row"];
type EventoAgendaInsert = Database["public"]["Tables"]["tbagenda"]["Insert"];
type EventoAgendaUpdate = Database["public"]["Tables"]["tbagenda"]["Update"];

export const eventoService = {
  async getEventi(studioId?: string | null): Promise<EventoAgenda[]> {
    let query = supabase
      .from("tbagenda")
      .select("*")
      .order("data_inizio", { ascending: true });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

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

  async getEventiByUtente(
    utenteId: string,
    studioId?: string | null
  ): Promise<EventoAgenda[]> {
    let query = supabase
      .from("tbagenda")
      .select("*")
      .eq("utente_id", utenteId)
      .order("data_inizio", { ascending: true });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching eventi by utente:", error);
      return [];
    }

    return data || [];
  },

  async getEventiByCliente(
    clienteId: string,
    studioId?: string | null
  ): Promise<EventoAgenda[]> {
    let query = supabase
      .from("tbagenda")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("data_inizio", { ascending: true });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching eventi by cliente:", error);
      return [];
    }

    return data || [];
  },

  async getEventiByDateRange(
    startDate: string,
    endDate: string,
    studioId?: string | null
  ): Promise<EventoAgenda[]> {
    let query = supabase
      .from("tbagenda")
      .select("*")
      .gte("data_inizio", startDate)
      .lte("data_inizio", endDate)
      .order("data_inizio", { ascending: true });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

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

    if (data) {
      try {
        await this.sendEventNotification(data, "created");
      } catch (emailError) {
        console.error("Error sending event notification:", emailError);
      }
    }

    return data;
  },

  async sendEventNotification(
    evento: EventoAgenda,
    action: "created" | "updated" | "cancelled" = "created"
  ): Promise<void> {
    try {
      console.log("📧 Preparing to send event notification for:", evento.id, action);

      if (!evento.utente_id) {
        console.error("❌ No utente_id found for evento");
        return;
      }

      const { data: responsabile, error: responsabileError } = await supabase
        .from("tbutenti")
        .select("nome, cognome, email")
        .eq("id", evento.utente_id)
        .single();

      if (responsabileError) {
        console.error("❌ Error fetching responsabile:", responsabileError);
        return;
      }

      if (!responsabile || !responsabile.email) {
        console.error("❌ Responsabile email not found");
        return;
      }

      let partecipantiEmails: string[] = [];
      let partecipantiNomi: string[] = [];

      const partecipantiIds = Array.isArray(evento.partecipanti)
        ? (evento.partecipanti as string[])
        : [];

      if (partecipantiIds.length > 0) {
        const { data: partecipanti, error: partecipantiError } = await supabase
          .from("tbutenti")
          .select("nome, cognome, email")
          .in("id", partecipantiIds);

        if (partecipantiError) {
          console.error("❌ Error fetching partecipanti:", partecipantiError);
        } else if (partecipanti) {
          partecipantiEmails = partecipanti
            .filter((p) => Boolean(p.email))
            .map((p) => p.email as string);

          partecipantiNomi = partecipanti.map(
            (p) =>
              `${p.nome || ""} ${p.cognome || ""}`.trim() ||
              p.email ||
              "Utente"
          );
        }
      }

      let clienteEmail: string | undefined;
      let clienteNome: string | undefined;

      if (evento.cliente_id) {
        const { data: cliente, error: clienteError } = await supabase
          .from("tbclienti")
          .select("ragione_sociale, email")
          .eq("id", evento.cliente_id)
          .single();

        if (clienteError) {
          console.error("❌ Error fetching cliente:", clienteError);
        } else if (cliente && cliente.email) {
          clienteEmail = cliente.email;
          clienteNome = cliente.ragione_sociale || "Cliente";
        }
      }

      const formatDate = (dateStr: string) => {
        try {
          return new Date(dateStr).toLocaleDateString("it-IT");
        } catch {
          return dateStr;
        }
      };

      const formatTime = (dateStr: string) => {
        try {
          return new Date(dateStr).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return "00:00";
        }
      };

   const emailData = {
  action,
  eventoId: evento.id,
  eventoTitolo: evento.titolo || "Evento senza titolo",
  eventoData: formatDate(evento.data_inizio),
  eventoOraInizio: evento.ora_inizio
    ? evento.ora_inizio.substring(0, 5)
    : formatTime(evento.data_inizio),
  eventoOraFine: evento.ora_fine
    ? evento.ora_fine.substring(0, 5)
    : formatTime(evento.data_fine),

  eventoInSede: Boolean((evento as any).in_sede),
  eventoLuogo: (evento as any).in_sede
    ? ((evento as any).sala || undefined)
    : ((evento as any).luogo || undefined),

  eventoDescrizione: evento.descrizione || undefined,
  responsabileEmail: responsabile.email,
  responsabileNome:
    `${responsabile.nome || ""} ${responsabile.cognome || ""}`.trim() ||
    responsabile.email,
  partecipantiEmails,
  partecipantiNomi,
  clienteEmail,
  clienteNome,
  riunione_teams: evento.riunione_teams || false,
  link_teams: evento.link_teams || undefined,
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
    }
  },

  async updateEvento(
    id: string,
    updates: EventoAgendaUpdate
  ): Promise<EventoAgenda | null> {
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

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("agenda-updated"));
    }

    if (data) {
      try {
        await this.sendEventNotification(data, "updated");
      } catch (emailError) {
        console.error("Error sending event notification:", emailError);
      }
    }

    return data;
  },

  async deleteEvento(id: string): Promise<boolean> {
    try {
      const { data: evento, error: eventoError } = await supabase
        .from("tbagenda")
        .select("*")
        .eq("id", id)
        .single();

      if (eventoError) {
        console.error("Error fetching evento before delete:", eventoError);
      }

      const { error } = await supabase.from("tbagenda").delete().eq("id", id);

      if (error) {
        console.error("Error deleting evento:", error);
        return false;
      }

      if (evento) {
        try {
          await this.sendEventNotification(evento, "cancelled");
        } catch (emailError) {
          console.error("Error sending cancel event notification:", emailError);
        }
      }

      return true;
    } catch (error) {
      console.error("Error deleting evento:", error);
      return false;
    }
  },
};
