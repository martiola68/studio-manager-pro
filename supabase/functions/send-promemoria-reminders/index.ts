import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Promemoria <noreply@tuodominio.it>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Errore invio email: ${errText}`);
  }
}

serve(async () => {
  try {
    const today = new Date();
    const yyyyMmDd = today.toISOString().slice(0, 10);

    const { data: reminders, error } = await supabase
      .from("tbpromemoria")
      .select(`
        id,
        titolo,
        descrizione,
        data_scadenza,
        priorita,
        working_progress,
        email_7gg_inviata,
        email_2gg_inviata,
        destinatario_id,
        destinatario:tbutenti!tbpromemoria_destinatario_id_fkey (
          id,
          nome,
          cognome,
          email
        )
      `)
      .not("destinatario_id", "is", null)
      .neq("working_progress", "Completato")
      .neq("working_progress", "Annullata");

    if (error) throw error;

    for (const p of reminders ?? []) {
      const destinatario = Array.isArray(p.destinatario) ? p.destinatario[0] : p.destinatario;
      if (!destinatario?.email || !p.data_scadenza) continue;

      const scadenza = new Date(`${p.data_scadenza}T00:00:00`);
      const diffMs = scadenza.getTime() - new Date(`${yyyyMmDd}T00:00:00`).getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 7 && !p.email_7gg_inviata) {
        await sendEmail(
          destinatario.email,
          `Promemoria in scadenza tra 7 giorni: ${p.titolo}`,
          `
            <p>Ciao ${destinatario.nome || ""},</p>
            <p>il promemoria <strong>${p.titolo}</strong> scadrà il <strong>${p.data_scadenza}</strong>.</p>
            <p>${p.descrizione || ""}</p>
            <p>Priorità: <strong>${p.priorita || "-"}</strong></p>
          `
        );

        await supabase
          .from("tbpromemoria")
          .update({ email_7gg_inviata: true })
          .eq("id", p.id);
      }

      if (diffDays === 2 && !p.email_2gg_inviata) {
        await sendEmail(
          destinatario.email,
          `Promemoria in scadenza tra 2 giorni: ${p.titolo}`,
          `
            <p>Ciao ${destinatario.nome || ""},</p>
            <p>il promemoria <strong>${p.titolo}</strong> scadrà il <strong>${p.data_scadenza}</strong>.</p>
            <p>${p.descrizione || ""}</p>
            <p>Priorità: <strong>${p.priorita || "-"}</strong></p>
          `
        );

        await supabase
          .from("tbpromemoria")
          .update({ email_2gg_inviata: true })
          .eq("id", p.id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : "Errore sconosciuto",
    }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
