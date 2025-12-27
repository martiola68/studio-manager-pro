import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Conversazione = Database["public"]["Tables"]["tbconversazioni"]["Row"];
type ConversazioneInsert = Database["public"]["Tables"]["tbconversazioni"]["Insert"];
type ConversazioneUtente = Database["public"]["Tables"]["tbconversazioni_utenti"]["Row"];
type Messaggio = Database["public"]["Tables"]["tbmessaggi"]["Row"];
type MessaggioInsert = Database["public"]["Tables"]["tbmessaggi"]["Insert"];

interface ConversazioneConDettagli extends Conversazione {
  partecipanti?: Array<{
    utente_id: string;
    ultimo_letto_at: string | null;
    tbutenti: {
      id: string;
      nome: string;
      cognome: string;
      email: string;
    } | null;
  }>;
  ultimo_messaggio?: Messaggio | null;
  non_letti?: number;
}

interface MessaggioConMittente extends Messaggio {
  mittente?: {
    id: string;
    nome: string;
    cognome: string;
    email: string;
  } | null;
}

export const messaggioService = {
  // Ottieni o crea conversazione diretta tra due utenti
  async getOrCreateConversazioneDiretta(
    utenteId1: string,
    utenteId2: string,
    studioId: string
  ): Promise<Conversazione | null> {
    try {
      // Cerca conversazione esistente
      const { data: existing, error: searchError } = await supabase
        .from("tbconversazioni")
        .select(`
          *,
          tbconversazioni_utenti!inner(utente_id)
        `)
        .eq("tipo", "diretta")
        .eq("studio_id", studioId);

      if (searchError) throw searchError;

      // Trova conversazione che contiene entrambi gli utenti
      const conversazione = existing?.find((conv: any) => {
        const partecipanti = conv.tbconversazioni_utenti.map((p: any) => p.utente_id);
        return (
          partecipanti.length === 2 &&
          partecipanti.includes(utenteId1) &&
          partecipanti.includes(utenteId2)
        );
      });

      if (conversazione) {
        return conversazione as Conversazione;
      }

      // Crea nuova conversazione
      const { data: newConv, error: createError } = await supabase
        .from("tbconversazioni")
        .insert({
          tipo: "diretta",
          studio_id: studioId,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Aggiungi partecipanti
      const { error: participantsError } = await supabase
        .from("tbconversazioni_utenti")
        .insert([
          { conversazione_id: newConv.id, utente_id: utenteId1 },
          { conversazione_id: newConv.id, utente_id: utenteId2 },
        ]);

      if (participantsError) throw participantsError;

      return newConv;
    } catch (error) {
      console.error("Error getting/creating conversation:", error);
      return null;
    }
  },

  // Ottieni tutte le conversazioni dell'utente con dettagli
  async getConversazioni(utenteId: string): Promise<ConversazioneConDettagli[]> {
    try {
      const { data, error } = await supabase
        .from("tbconversazioni")
        .select(`
          *,
          partecipanti:tbconversazioni_utenti(
            utente_id,
            ultimo_letto_at,
            tbutenti(id, nome, cognome, email)
          )
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Per ogni conversazione, ottieni l'ultimo messaggio e conta i non letti
      const conversazioniConDettagli = await Promise.all(
        (data || []).map(async (conv) => {
          // Ultimo messaggio
          const { data: ultimoMsg } = await supabase
            .from("tbmessaggi")
            .select("*")
            .eq("conversazione_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          // Conta messaggi non letti
          const partecipante = conv.partecipanti?.find(
            (p: any) => p.utente_id === utenteId
          );
          const ultimoLetto = partecipante?.ultimo_letto_at;

          let nonLetti = 0;
          if (ultimoLetto) {
            const { count } = await supabase
              .from("tbmessaggi")
              .select("*", { count: "exact", head: true })
              .eq("conversazione_id", conv.id)
              .neq("mittente_id", utenteId)
              .gt("created_at", ultimoLetto);

            nonLetti = count || 0;
          } else {
            // Se non ha mai letto, conta tutti i messaggi degli altri
            const { count } = await supabase
              .from("tbmessaggi")
              .select("*", { count: "exact", head: true })
              .eq("conversazione_id", conv.id)
              .neq("mittente_id", utenteId);

            nonLetti = count || 0;
          }

          return {
            ...conv,
            ultimo_messaggio: ultimoMsg,
            non_letti: nonLetti,
          };
        })
      );

      return conversazioniConDettagli;
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }
  },

  // Ottieni messaggi di una conversazione
  async getMessaggi(conversazioneId: string): Promise<MessaggioConMittente[]> {
    try {
      const { data, error } = await supabase
        .from("tbmessaggi")
        .select(`
          *,
          mittente:tbutenti(id, nome, cognome, email)
        `)
        .eq("conversazione_id", conversazioneId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  },

  // Invia messaggio
  async inviaMessaggio(
    conversazioneId: string,
    mittenteId: string,
    testo: string,
    clienteId?: string,
    eventoId?: string
  ): Promise<Messaggio | null> {
    try {
      const messaggio: MessaggioInsert = {
        conversazione_id: conversazioneId,
        mittente_id: mittenteId,
        testo,
        cliente_id: clienteId || null,
        evento_id: eventoId || null,
      };

      const { data, error } = await supabase
        .from("tbmessaggi")
        .insert(messaggio)
        .select()
        .single();

      if (error) throw error;

      // Aggiorna timestamp conversazione
      await supabase
        .from("tbconversazioni")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversazioneId);

      return data;
    } catch (error) {
      console.error("Error sending message:", error);
      return null;
    }
  },

  // Segna come letto
  async segnaComeLetto(conversazioneId: string, utenteId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("tbconversazioni_utenti")
        .update({ ultimo_letto_at: new Date().toISOString() })
        .eq("conversazione_id", conversazioneId)
        .eq("utente_id", utenteId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error marking as read:", error);
      return false;
    }
  },

  // Conta totale messaggi non letti
  async contaNonLetti(utenteId: string): Promise<number> {
    try {
      // Ottieni tutte le conversazioni dell'utente
      const { data: conversazioni } = await supabase
        .from("tbconversazioni_utenti")
        .select("conversazione_id, ultimo_letto_at")
        .eq("utente_id", utenteId);

      if (!conversazioni) return 0;

      let totaleNonLetti = 0;

      for (const conv of conversazioni) {
        if (conv.ultimo_letto_at) {
          const { count } = await supabase
            .from("tbmessaggi")
            .select("*", { count: "exact", head: true })
            .eq("conversazione_id", conv.conversazione_id)
            .neq("mittente_id", utenteId)
            .gt("created_at", conv.ultimo_letto_at);

          totaleNonLetti += count || 0;
        } else {
          const { count } = await supabase
            .from("tbmessaggi")
            .select("*", { count: "exact", head: true })
            .eq("conversazione_id", conv.conversazione_id)
            .neq("mittente_id", utenteId);

          totaleNonLetti += count || 0;
        }
      }

      return totaleNonLetti;
    } catch (error) {
      console.error("Error counting unread messages:", error);
      return 0;
    }
  },

  // Subscribe ai nuovi messaggi (Realtime)
  subscribeToMessaggi(
    conversazioneId: string,
    callback: (messaggio: Messaggio) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel(`messaggi:${conversazioneId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tbmessaggi",
          filter: `conversazione_id=eq.${conversazioneId}`,
        },
        (payload) => {
          callback(payload.new as Messaggio);
        }
      )
      .subscribe();

    return channel;
  },

  // Unsubscribe da Realtime
  unsubscribeFromMessaggi(channel: RealtimeChannel) {
    supabase.removeChannel(channel);
  },
};