import { supabase } from "@/lib/supabase/client";

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

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(data: EmailData): Promise<{ success: boolean; error?: string }> {
  try {
    // Tenta di invocare una funzione generica per l'invio email
    // Se non esiste, fallirà gracefully
    const { data: result, error } = await supabase.functions.invoke("send-email", {
      body: data
    });

    if (error) {
      console.warn("Edge function 'send-email' not found or error:", error);
      // Fallback o log
      return { success: false, error: error.message };
    }

    return { success: true, ...result };
  } catch (error) {
    console.error("Error sending generic email:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function sendEventNotification(data: EventEmailData): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  error?: string;
}> {
  try {
    console.log("📧 emailService.sendEventNotification - Building recipients list");

    // ✅ COSTRUISCE ARRAY DESTINATARI VALIDO
    const recipients: string[] = [];

    // 1. Aggiungi responsabile (obbligatorio)
    if (data.responsabileEmail && data.responsabileEmail.includes("@")) {
      recipients.push(data.responsabileEmail);
      console.log("✅ Responsabile:", data.responsabileEmail);
    } else {
      console.error("❌ Responsabile email invalid or missing:", data.responsabileEmail);
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        error: "Responsabile email is required and must be valid"
      };
    }

    // 2. Aggiungi partecipanti (opzionali)
    if (data.partecipantiEmails && Array.isArray(data.partecipantiEmails)) {
      data.partecipantiEmails.forEach(email => {
        if (email && email.includes("@") && !recipients.includes(email)) {
          recipients.push(email);
          console.log("✅ Partecipante:", email);
        }
      });
    }

    // 3. Aggiungi cliente (opzionale)
    if (data.clienteEmail && data.clienteEmail.includes("@")) {
      if (!recipients.includes(data.clienteEmail)) {
        recipients.push(data.clienteEmail);
        console.log("✅ Cliente:", data.clienteEmail);
      }
    }

    // ✅ VALIDAZIONE FINALE
    if (recipients.length === 0) {
      console.error("❌ No valid recipients found!");
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        error: "No valid email recipients"
      };
    }

    console.log(`📧 Total valid recipients: ${recipients.length}`);
    console.log("📧 Recipients list:", recipients);

    // ✅ CHIAMA EDGE FUNCTION CON DATI CORRETTI
    const { data: result, error } = await supabase.functions.invoke(
      "send-event-notification",
      {
        body: {
          ...data,
          recipients  // ✅ AGGIUNGE ARRAY RECIPIENTS VALIDATO
        }
      }
    );

    if (error) {
      console.error("❌ Error invoking email function:", error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: recipients.length,
        error: error.message
      };
    }

    console.log("✅ Email function response:", result);

    return {
      success: true,
      sent: recipients.length,
      failed: 0,
      total: recipients.length,
      ...result
    };
  } catch (error) {
    console.error("💥 Error sending event notification:", error);
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

export const emailService = {
  sendEventNotification,
  triggerEventReminders,
  sendEmail
};