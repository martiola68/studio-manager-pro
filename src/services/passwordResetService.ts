import { supabase } from "@/lib/supabase/client";
import bcrypt from "bcryptjs";

export interface PasswordResetToken {
  id: string;
  studio_id: string;
  token_hash: string;
  email: string;
  expires_at: string;
  attempts: number;
  used: boolean;
  created_at: string;
  used_at: string | null;
}

export const passwordResetService = {
  /**
   * Genera un codice OTP di 6 cifre
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Crea un token di reset e invia email con OTP
   */
  async requestPasswordReset(studioId: string, adminEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verifica che l'utente sia admin
      const { data: admin } = await supabase
        .from("tbutenti")
        .select("tipo_utente, email")
        .eq("email", adminEmail)
        .eq("tipo_utente", "Admin")
        .single();

      if (!admin) {
        return { success: false, error: "Solo gli amministratori possono resettare la Master Password" };
      }

      // Genera OTP
      const otp = this.generateOTP();
      const tokenHash = await bcrypt.hash(otp, 10);

      // Calcola scadenza (15 minuti)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // Invalida eventuali token precedenti non usati
      await supabase
        .from("password_reset_tokens")
        .update({ used: true })
        .eq("studio_id", studioId)
        .eq("used", false);

      // Crea nuovo token
      const { error: insertError } = await supabase
        .from("password_reset_tokens")
        .insert({
          studio_id: studioId,
          token_hash: tokenHash,
          email: adminEmail,
          expires_at: expiresAt.toISOString(),
          attempts: 0,
          used: false
        });

      if (insertError) {
        console.error("Errore creazione token:", insertError);
        return { success: false, error: "Impossibile creare il token di reset" };
      }

      // Invia email con OTP
      const emailSent = await this.sendResetEmail(adminEmail, otp);
      if (!emailSent) {
        return { success: false, error: "Impossibile inviare l'email di reset" };
      }

      return { success: true };
    } catch (error) {
      console.error("Errore richiesta reset password:", error);
      return { success: false, error: "Errore durante la richiesta di reset" };
    }
  },

  /**
   * Verifica il codice OTP inserito dall'utente
   */
  async verifyOTP(studioId: string, otp: string): Promise<{ valid: boolean; tokenId?: string; error?: string }> {
    try {
      // Recupera token attivi non scaduti
      const { data: tokens, error } = await supabase
        .from("password_reset_tokens")
        .select("*")
        .eq("studio_id", studioId)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error || !tokens || tokens.length === 0) {
        return { valid: false, error: "Nessun token di reset valido trovato" };
      }

      const token = tokens[0] as PasswordResetToken;

      // Verifica tentativi
      if (token.attempts >= 3) {
        // Invalida token dopo 3 tentativi
        await supabase
          .from("password_reset_tokens")
          .update({ used: true })
          .eq("id", token.id);

        return { valid: false, error: "Troppi tentativi. Richiedi un nuovo codice." };
      }

      // Verifica OTP
      const isValid = await bcrypt.compare(otp, token.token_hash);

      if (!isValid) {
        // Incrementa tentativi
        await supabase
          .from("password_reset_tokens")
          .update({ attempts: token.attempts + 1 })
          .eq("id", token.id);

        const remainingAttempts = 3 - (token.attempts + 1);
        return { 
          valid: false, 
          error: `Codice non valido. Tentativi rimasti: ${remainingAttempts}` 
        };
      }

      // OTP valido
      return { valid: true, tokenId: token.id };
    } catch (error) {
      console.error("Errore verifica OTP:", error);
      return { valid: false, error: "Errore durante la verifica del codice" };
    }
  },

  /**
   * Reset della Master Password dopo verifica OTP
   */
  async resetMasterPassword(
    tokenId: string, 
    studioId: string, 
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verifica che il token sia ancora valido
      const { data: token } = await supabase
        .from("password_reset_tokens")
        .select("*")
        .eq("id", tokenId)
        .eq("studio_id", studioId)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!token) {
        return { success: false, error: "Token non valido o scaduto" };
      }

      // Hash nuova password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Aggiorna Master Password
      const { error: updateError } = await supabase
        .from("tbstudio")
        .update({ 
          master_password_hash: hashedPassword,
          protezione_attiva: true
        })
        .eq("id", studioId);

      if (updateError) {
        console.error("Errore aggiornamento password:", updateError);
        return { success: false, error: "Impossibile aggiornare la password" };
      }

      // Marca token come usato
      await supabase
        .from("password_reset_tokens")
        .update({ 
          used: true, 
          used_at: new Date().toISOString() 
        })
        .eq("id", tokenId);

      // Invia email di conferma reset
      const { data: studio } = await supabase
        .from("tbstudio")
        .select("email")
        .eq("id", studioId)
        .single();

      if (studio?.email) {
        await this.sendResetConfirmationEmail(studio.email);
      }

      return { success: true };
    } catch (error) {
      console.error("Errore reset password:", error);
      return { success: false, error: "Errore durante il reset della password" };
    }
  },

  /**
   * Invia email con codice OTP
   */
  async sendResetEmail(email: string, otp: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: email,
          subject: "🔐 Recupero Master Password - Studio Manager Pro",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .otp-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: monospace; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔐 Recupero Master Password</h1>
                </div>
                <div class="content">
                  <p>Hai richiesto il recupero della Master Password per <strong>Studio Manager Pro</strong>.</p>
                  
                  <div class="otp-box">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Il tuo codice di verifica è:</p>
                    <div class="otp-code">${otp}</div>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">Codice valido per 15 minuti</p>
                  </div>

                  <div class="warning">
                    <strong>⚠️ Importante:</strong>
                    <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                      <li>Questo codice scade tra 15 minuti</li>
                      <li>Hai massimo 3 tentativi di inserimento</li>
                      <li>Non condividere questo codice con nessuno</li>
                    </ul>
                  </div>

                  <p>Se non hai richiesto questo reset, puoi ignorare questa email in sicurezza.</p>

                  <div class="footer">
                    <p>Studio Manager Pro - Sistema di Gestione Studio Professionale</p>
                    <p>Questo è un messaggio automatico, non rispondere a questa email.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `
        }
      });

      return !error;
    } catch (error) {
      console.error("Errore invio email OTP:", error);
      return false;
    }
  },

  /**
   * Invia email di conferma reset avvenuto
   */
  async sendResetConfirmationEmail(email: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: email,
          subject: "✅ Master Password Modificata - Studio Manager Pro",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .success-box { background: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .warning { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Master Password Modificata</h1>
                </div>
                <div class="content">
                  <div class="success-box">
                    <p style="font-size: 18px; margin: 0;"><strong>La tua Master Password è stata modificata con successo!</strong></p>
                  </div>

                  <p>La Master Password per <strong>Studio Manager Pro</strong> è stata aggiornata con successo.</p>
                  
                  <p><strong>Data/Ora modifica:</strong> ${new Date().toLocaleString("it-IT")}</p>

                  <div class="warning">
                    <strong>⚠️ Non hai richiesto questa modifica?</strong>
                    <p style="margin: 10px 0 0 0;">Se non hai richiesto il reset della Master Password, contatta immediatamente il supporto tecnico.</p>
                  </div>

                  <p>Puoi ora utilizzare la nuova Master Password per accedere alle funzionalità protette.</p>

                  <div class="footer">
                    <p>Studio Manager Pro - Sistema di Gestione Studio Professionale</p>
                    <p>Questo è un messaggio automatico, non rispondere a questa email.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `
        }
      });

      return !error;
    } catch (error) {
      console.error("Errore invio email conferma:", error);
      return false;
    }
  }
};