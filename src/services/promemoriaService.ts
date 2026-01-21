import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { messaggioService } from "./messaggioService";

export type Promemoria = Database["public"]["Tables"]["tbpromemoria"]["Row"];

export interface Allegato {
  nome: string;
  url: string;
  size: number;
  tipo: string;
  data_upload: string;
}

export const promemoriaService = {
  async getPromemoria() {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .select(`
        *,
        operatore:tbutenti!operatore_id (
          id, nome, cognome, settore, responsabile
        ),
        destinatario:tbutenti!destinatario_id (
          id, nome, cognome, settore, responsabile
        )
      `)
      .order("data_scadenza", { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data;
  },

  async getAllegati(promemoriaId: string) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .select("allegati")
      .eq("id", promemoriaId)
      .single();

    if (error) {
      console.error("Errore recupero allegati DB:", error);
      return [];
    }

    if (data.allegati && Array.isArray(data.allegati)) {
      return data.allegati as unknown as Allegato[];
    }

    const { data: storageFiles, error: storageError } = await supabase.storage
      .from("promemoria-allegati")
      .list(promemoriaId);

    if (storageError) {
      return [];
    }

    return storageFiles
      .filter(f => f.name !== ".emptyFolderPlaceholder")
      .map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from("promemoria-allegati")
          .getPublicUrl(`${promemoriaId}/${file.name}`);
          
        return {
          nome: file.name,
          url: publicUrl,
          size: file.metadata?.size || 0,
          tipo: file.metadata?.mimetype || "application/octet-stream",
          data_upload: file.created_at
        };
      });
  },

  async getPromemoriaInScadenza(utenteId: string): Promise<Promemoria[]> {
    const oggi = new Date().toISOString().split("T")[0];
    const traSetteGiorni = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("tbpromemoria")
      .select(`
        *,
        tbtipopromemoria (
          id, nome, descrizione, colore
        )
      `)
      .eq("operatore_id", utenteId)
      .eq("working_progress", "In lavorazione")
      .gte("data_scadenza", oggi)
      .lte("data_scadenza", traSetteGiorni)
      .order("data_scadenza", { ascending: true });

    if (error) {
      console.error("Errore caricamento promemoria in scadenza:", error);
      throw error;
    }

    return data || [];
  },

  async controllaEInviaNotificheScadenza(currentUserId: string, studioId: string) {
    try {
      console.log("Controllo promemoria in scadenza...");

      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      const domani = new Date(oggi);
      domani.setDate(domani.getDate() + 1);
      const dopodomani = new Date(oggi);
      dopodomani.setDate(dopodomani.getDate() + 2);

      const { data: promemoria, error } = await supabase
        .from("tbpromemoria")
        .select(`
          *,
          destinatario:tbutenti!destinatario_id (
            id, nome, cognome, email
          )
        `)
        .in("working_progress", ["Aperto", "In lavorazione"])
        .gte("data_scadenza", oggi.toISOString().split("T")[0])
        .lte("data_scadenza", dopodomani.toISOString().split("T")[0]);

      if (error) {
        console.error("Errore recupero promemoria per notifiche:", error);
        return;
      }

      if (!promemoria || promemoria.length === 0) {
        console.log("Nessun promemoria in scadenza");
        return;
      }

      console.log(`Trovati ${promemoria.length} promemoria in scadenza`);

      for (const p of promemoria) {
        if (!p.destinatario_id || !p.destinatario) continue;

        const scadenza = new Date(p.data_scadenza);
        scadenza.setHours(0, 0, 0, 0);
        
        let urgenza = "";
        let giorniRimasti = 0;

        if (scadenza.getTime() === oggi.getTime()) {
          urgenza = "SCADE OGGI";
          giorniRimasti = 0;
        } else if (scadenza.getTime() === domani.getTime()) {
          urgenza = "SCADE DOMANI";
          giorniRimasti = 1;
        } else {
          urgenza = "SCADE TRA 2 GIORNI";
          giorniRimasti = 2;
        }

        const { data: notificheEsistenti } = await supabase
          .from("tbmessaggi")
          .select("id")
          .ilike("testo", `%Promemoria in scadenza: ${p.titolo}%`)
          .gte("created_at", oggi.toISOString());

        if (notificheEsistenti && notificheEsistenti.length > 0) {
          console.log(`Notifica già inviata per promemoria: ${p.titolo}`);
          continue;
        }

        try {
          const conversazione = await messaggioService.getOrCreateConversazioneDiretta(
            currentUserId,
            p.destinatario_id,
            studioId
          );

          if (!conversazione) {
            console.error(`Impossibile creare conversazione per promemoria: ${p.titolo}`);
            continue;
          }

          const dataScadenzaFormattata = new Date(p.data_scadenza).toLocaleDateString("it-IT");

          const messaggioTesto = `${urgenza}\n\nPromemoria in scadenza: ${p.titolo}\n\n` +
            `Scadenza: ${dataScadenzaFormattata} (${giorniRimasti === 0 ? "oggi" : giorniRimasti === 1 ? "domani" : "tra 2 giorni"})\n` +
            `Descrizione: ${p.descrizione || "Nessuna descrizione"}\n` +
            `Priorità: ${p.priorita}\n` +
            `Stato: ${p.working_progress}\n\n` +
            `Vai su /promemoria per gestire questo promemoria.`;

          await messaggioService.inviaMessaggio(
            conversazione.id,
            currentUserId,
            messaggioTesto
          );

          console.log(`Notifica inviata per promemoria: ${p.titolo} a ${p.destinatario.nome} ${p.destinatario.cognome}`);

        } catch (msgError) {
          console.error(`Errore invio notifica per promemoria ${p.titolo}:`, msgError);
        }
      }

      console.log("Controllo notifiche completato");
    } catch (error) {
      console.error("Errore controllo notifiche scadenza:", error);
    }
  },

  async createPromemoria(promemoria: {
    titolo: string;
    descrizione?: string;
    data_inserimento: string;
    giorni_scadenza: number;
    data_scadenza: string;
    priorita: string;
    stato: string;
    operatore_id: string;
    destinatario_id?: string | null;
    settore?: string;
    tipo_promemoria_id?: string | null;
  }) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .insert({
        titolo: promemoria.titolo,
        descrizione: promemoria.descrizione,
        data_inserimento: promemoria.data_inserimento,
        giorni_scadenza: promemoria.giorni_scadenza,
        data_scadenza: promemoria.data_scadenza,
        priorita: promemoria.priorita,
        working_progress: promemoria.stato,
        operatore_id: promemoria.operatore_id,
        destinatario_id: promemoria.destinatario_id,
        settore: promemoria.settore,
        tipo_promemoria_id: promemoria.tipo_promemoria_id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async updatePromemoria(id: string, promemoria: {
    titolo?: string;
    descrizione?: string;
    data_inserimento?: string;
    giorni_scadenza?: number;
    data_scadenza?: string;
    priorita?: string;
    working_progress?: string;
    destinatario_id?: string | null;
    settore?: string;
    tipo_promemoria_id?: string | null;
  }) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .update(promemoria)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Errore aggiornamento promemoria:", error);
      throw error;
    }

    return data;
  },

  async deletePromemoria(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbpromemoria")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Errore eliminazione promemoria:", error);
      throw error;
    }
  },

  calcolaDataScadenza(dataInizio: string, giorniScadenza: number): string {
    const data = new Date(dataInizio);
    data.setDate(data.getDate() + giorniScadenza);
    return data.toISOString().split("T")[0];
  },

  async getStatistiche(utenteId: string) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .select("working_progress, da_fatturare, fatturato")
      .eq("operatore_id", utenteId);

    if (error) {
      console.error("Errore caricamento statistiche:", error);
      return {
        totali: 0,
        inLavorazione: 0,
        conclusi: 0,
        daFatturare: 0,
        fatturati: 0,
      };
    }

    const promemoria = data || [];
    return {
      totali: promemoria.length,
      inLavorazione: promemoria.filter((p) => p.working_progress === "In lavorazione")
        .length,
      conclusi: promemoria.filter((p) => p.working_progress === "Concluso").length,
      daFatturare: promemoria.filter(
        (p) => p.da_fatturare && !p.fatturato
      ).length,
      fatturati: promemoria.filter((p) => p.fatturato).length,
    };
  },

  async uploadAllegato(
    promemoriaId: string,
    file: File
  ): Promise<Allegato> {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("File troppo grande. Dimensione massima: 10MB");
    }

    const tipiAccettati = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "image/gif"
    ];

    if (!tipiAccettati.includes(file.type)) {
      throw new Error("Tipo file non supportato. Usa: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF");
    }

    const timestamp = Date.now();
    const nomeFile = `${promemoriaId}/${timestamp}_${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("promemoria-allegati")
      .upload(nomeFile, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      console.error("Errore upload allegato:", uploadError);
      throw new Error("Errore durante l'upload del file");
    }

    const { data: urlData } = supabase.storage
      .from("promemoria-allegati")
      .getPublicUrl(nomeFile);

    const allegato: Allegato = {
      nome: file.name,
      url: urlData.publicUrl,
      size: file.size,
      tipo: file.type,
      data_upload: new Date().toISOString()
    };

    const { data: currentPromemoria } = await supabase
      .from("tbpromemoria")
      .select("allegati")
      .eq("id", promemoriaId)
      .single();

    const allegatiAttuali = (currentPromemoria?.allegati as unknown as Allegato[]) || [];
    const nuoviAllegati = [...allegatiAttuali, allegato];

    const { error: updateError } = await supabase
      .from("tbpromemoria")
      .update({ allegati: nuoviAllegati as any })
      .eq("id", promemoriaId);

    if (updateError) {
      await supabase.storage
        .from("promemoria-allegati")
        .remove([nomeFile]);
      throw new Error("Errore aggiornamento database");
    }

    return allegato;
  },

  async deleteAllegato(
    promemoriaId: string,
    allegatoUrl: string
  ): Promise<void> {
    const { data: currentPromemoria } = await supabase
      .from("tbpromemoria")
      .select("allegati")
      .eq("id", promemoriaId)
      .single();

    const allegatiAttuali = (currentPromemoria?.allegati as unknown as Allegato[]) || [];
    const allegatoDaEliminare = allegatiAttuali.find(a => a.url === allegatoUrl);

    if (!allegatoDaEliminare) {
      throw new Error("Allegato non trovato");
    }

    const url = new URL(allegatoDaEliminare.url);
    const pathParts = url.pathname.split("/");
    const nomeFile = pathParts.slice(-2).join("/");

    const { error: storageError } = await supabase.storage
      .from("promemoria-allegati")
      .remove([nomeFile]);

    if (storageError) {
      console.error("Errore eliminazione file storage:", storageError);
    }

    const nuoviAllegati = allegatiAttuali.filter(a => a.url !== allegatoUrl);

    const { error: updateError } = await supabase
      .from("tbpromemoria")
      .update({ allegati: nuoviAllegati as any })
      .eq("id", promemoriaId);

    if (updateError) {
      throw new Error("Errore aggiornamento database");
    }
  },

  getUrlAllegato(allegato: Allegato): string {
    return allegato.url;
  },
};