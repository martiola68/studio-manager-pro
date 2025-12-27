import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Conversazione = Database["public"]["Tables"]["tbconversazioni"]["Row"];
type Messaggio = Database["public"]["Tables"]["tbmessaggi"]["Row"];
type Allegato = Database["public"]["Tables"]["tbmessaggi_allegati"]["Row"];

export const messaggioService = {
  async getConversazioni(userId: string) {
    const { data, error } = await supabase
      .from("tbconversazioni")
      .select(`
        *,
        partecipanti:tbconversazioni_utenti(
          utente_id,
          ultimo_letto_at,
          tbutenti(id, nome, cognome, email)
        ),
        ultimo_messaggio:tbmessaggi(
          id,
          testo,
          created_at,
          mittente_id
        )
      `)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // Per ogni conversazione, conta i messaggi non letti
    const conversazioniConNonLetti = await Promise.all(
      (data || []).map(async (conv) => {
        const partecipante = conv.partecipanti?.find((p: any) => p.utente_id === userId);
        const ultimoLetto = partecipante?.ultimo_letto_at;

        const { count } = await supabase
          .from("tbmessaggi")
          .select("*", { count: "exact", head: true })
          .eq("conversazione_id", conv.id)
          .neq("mittente_id", userId)
          .gt("created_at", ultimoLetto || "1970-01-01");

        // Prendi solo l'ultimo messaggio (array restituisce tutti)
        const ultimoMsg = Array.isArray(conv.ultimo_messaggio) 
          ? conv.ultimo_messaggio[0] 
          : conv.ultimo_messaggio;

        return {
          ...conv,
          ultimo_messaggio: ultimoMsg || null,
          non_letti: count || 0,
        };
      })
    );

    return conversazioniConNonLetti;
  },

  async getMessaggi(conversazioneId: string) {
    const { data, error } = await supabase
      .from("tbmessaggi")
      .select(`
        *,
        mittente:tbutenti(id, nome, cognome, email),
        allegati:tbmessaggi_allegati(*)
      `)
      .eq("conversazione_id", conversazioneId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async inviaMessaggio(conversazioneId: string, mittenteId: string, testo: string) {
    // Prima aggiorna il timestamp della conversazione
    await supabase
      .from("tbconversazioni")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversazioneId);

    // Poi inserisci il messaggio
    const { data, error } = await supabase
      .from("tbmessaggi")
      .insert({
        conversazione_id: conversazioneId,
        mittente_id: mittenteId,
        testo,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async segnaComeLetto(conversazioneId: string, utenteId: string) {
    const { error } = await supabase
      .from("tbconversazioni_utenti")
      .update({ ultimo_letto_at: new Date().toISOString() })
      .eq("conversazione_id", conversazioneId)
      .eq("utente_id", utenteId);

    if (error) console.error("Errore aggiornamento lettura:", error);
  },

  async getOrCreateConversazioneDiretta(
    userId1: string,
    userId2: string,
    studioId: string
  ): Promise<Conversazione | null> {
    try {
      // VALIDAZIONE INPUT
      if (!userId1 || !userId2 || !studioId) {
        const error = `Parametri mancanti: userId1=${userId1}, userId2=${userId2}, studioId=${studioId}`;
        console.error(error);
        throw new Error(error);
      }

      console.log("🔍 Ricerca conversazione esistente tra:", { userId1, userId2, studioId });

      // Cerca conversazione esistente tra questi due utenti
      const { data: esistenti, error: searchError } = await supabase
        .from("tbconversazioni")
        .select(`
          *,
          partecipanti:tbconversazioni_utenti(utente_id)
        `)
        .eq("tipo", "diretta")
        .eq("studio_id", studioId);

      if (searchError) {
        console.error("❌ Errore ricerca conversazioni:", searchError);
        throw new Error(`Errore ricerca conversazioni: ${searchError.message}`);
      }

      console.log(`📋 Trovate ${esistenti?.length || 0} conversazioni dirette nello studio`);

      // Trova conversazione con esattamente questi 2 utenti
      const conversazioneEsistente = esistenti?.find((conv: any) => {
        const utentiIds = conv.partecipanti?.map((p: any) => p.utente_id) || [];
        return (
          utentiIds.length === 2 &&
          utentiIds.includes(userId1) &&
          utentiIds.includes(userId2)
        );
      });

      if (conversazioneEsistente) {
        console.log("✅ Conversazione esistente trovata:", conversazioneEsistente.id);
        return conversazioneEsistente;
      }

      console.log("🆕 Creazione nuova conversazione...");

      // Verifica che userId1 sia l'auth.uid() corrente
      const { data: { user: currentAuthUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error("❌ Errore verifica auth:", authError);
        throw new Error(`Errore autenticazione: ${authError.message}`);
      }

      if (!currentAuthUser) {
        throw new Error("Utente non autenticato");
      }

      console.log("👤 Auth user ID:", currentAuthUser.id);
      console.log("📝 Parametri conversazione:", {
        studio_id: studioId,
        tipo: "diretta",
        creato_da: userId1,
        auth_uid: currentAuthUser.id,
        match: userId1 === currentAuthUser.id ? "✅ MATCH" : "❌ MISMATCH"
      });

      if (userId1 !== currentAuthUser.id) {
        throw new Error(
          `ERRORE CRITICO: userId1 (${userId1}) non corrisponde a auth.uid() (${currentAuthUser.id}). ` +
          `La policy RLS richiede che creato_da = auth.uid()`
        );
      }

      // Crea nuova conversazione
      const { data: nuovaConv, error: createError } = await supabase
        .from("tbconversazioni")
        .insert({
          studio_id: studioId,
          tipo: "diretta",
          creato_da: userId1,
        })
        .select()
        .single();

      if (createError) {
        console.error("❌ ERRORE CREAZIONE CONVERSAZIONE:", {
          code: createError.code,
          message: createError.message,
          details: createError.details,
          hint: createError.hint
        });
        throw new Error(
          `Errore RLS creazione conversazione (${createError.code}): ${createError.message}. ` +
          `Verifica che l'utente ${userId1} sia autenticato e corrisponda a auth.uid()`
        );
      }

      if (!nuovaConv) {
        throw new Error("Conversazione creata ma non restituita dal database");
      }

      console.log("✅ Conversazione creata:", nuovaConv.id);

      // Aggiungi i 2 partecipanti
      console.log("👥 Aggiunta partecipanti:", [userId1, userId2]);
      
      const { error: parteciError } = await supabase
        .from("tbconversazioni_utenti")
        .insert([
          { conversazione_id: nuovaConv.id, utente_id: userId1 },
          { conversazione_id: nuovaConv.id, utente_id: userId2 },
        ]);

      if (parteciError) {
        console.error("❌ ERRORE AGGIUNTA PARTECIPANTI:", {
          code: parteciError.code,
          message: parteciError.message,
          details: parteciError.details
        });
        
        // Rollback: elimina la conversazione creata
        console.log("🔄 Rollback conversazione...");
        await supabase
          .from("tbconversazioni")
          .delete()
          .eq("id", nuovaConv.id);
        
        throw new Error(`Errore aggiunta partecipanti: ${parteciError.message}`);
      }

      console.log("✅ Partecipanti aggiunti con successo");
      console.log("🎉 Conversazione completa creata:", nuovaConv.id);

      return nuovaConv;
    } catch (error: any) {
      console.error("💥 ERRORE FATALE getOrCreateConversazioneDiretta:", error);
      // NON ritornare null - lancia l'errore così il chiamante lo vede
      throw error;
    }
  },

  async creaConversazioneGruppo(
    titolo: string,
    creatoId: string,
    studioId: string,
    membriIds: string[]
  ): Promise<Conversazione | null> {
    try {
      // Crea conversazione gruppo
      const { data: nuovaConv, error: createError } = await supabase
        .from("tbconversazioni")
        .insert({
          studio_id: studioId,
          tipo: "gruppo",
          titolo,
          creato_da: creatoId,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Aggiungi tutti i membri (incluso il creatore)
      const partecipanti = membriIds.map((uid) => ({
        conversazione_id: nuovaConv.id,
        utente_id: uid,
      }));

      const { error: parteciError } = await supabase
        .from("tbconversazioni_utenti")
        .insert(partecipanti);

      if (parteciError) throw parteciError;

      return nuovaConv;
    } catch (error) {
      console.error("Errore creazione gruppo:", error);
      return null;
    }
  },

  async uploadAllegato(file: File, messaggioId: string, userId: string) {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `messaggi-allegati/${fileName}`;

      // Upload file su Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("messaggi-allegati")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Ottieni URL pubblico (firmato per 1 anno)
      const { data: urlData } = await supabase.storage
        .from("messaggi-allegati")
        .createSignedUrl(fileName, 31536000); // 1 anno in secondi

      // Salva metadata nel database
      const { data, error } = await supabase
        .from("tbmessaggi_allegati")
        .insert({
          messaggio_id: messaggioId,
          nome_file: file.name,
          tipo_file: file.type,
          dimensione: file.size,
          storage_path: fileName,
          url: urlData?.signedUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Errore upload allegato:", error);
      throw error;
    }
  },

  async downloadAllegato(storagePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from("messaggi-allegati")
        .download(storagePath);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Errore download allegato:", error);
      throw error;
    }
  },

  subscribeToConversazione(conversazioneId: string, onNewMessage: (payload: any) => void) {
    return supabase
      .channel(`chat:${conversazioneId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tbmessaggi",
          filter: `conversazione_id=eq.${conversazioneId}`,
        },
        onNewMessage
      )
      .subscribe();
  },

  unsubscribeFromMessaggi(channel: any) {
    supabase.removeChannel(channel);
  },
};