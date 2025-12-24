import { supabase } from "@/integrations/supabase/client";

export interface EventEmailData {
  eventoId: string;
  eventoTitolo: string;
  eventoData: string;
  eventoOraInizio: string;
  eventoOraFine: string;
  eventoLuogo?: string;
  eventoDescrizione?: string;
  responsabileEmail: string;
  responsabileNome: string;
  partecipantiEmails: string[];
  partecipantiNomi: string[];
  clienteEmail?: string;
  clienteNome?: string;
}

export async function sendEventNotification(data: EventEmailData): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  error?: string;
}> {
  try {
    const { data: result, error } = await supabase.functions.invoke(
      "send-event-notification",
      {
        body: data
      }
    );

    if (error) {
      console.error("Error invoking email function:", error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        error: error.message
      };
    }

    return result;
  } catch (error) {
    console.error("Error sending event notification:", error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function triggerEventReminders(): Promise<{
  success: boolean;
  events_processed: number;
  reminders_sent: number;
  error?: string;
}> {
  try {
    const { data: result, error } = await supabase.functions.invoke(
      "send-event-reminder"
    );

    if (error) {
      console.error("Error invoking reminder function:", error);
      return {
        success: false,
        events_processed: 0,
        reminders_sent: 0,
        error: error.message
      };
    }

    return result;
  } catch (error) {
    console.error("Error triggering reminders:", error);
    return {
      success: false,
      events_processed: 0,
      reminders_sent: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}