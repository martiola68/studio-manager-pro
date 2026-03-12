import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Promemoria = {
  id: string;
  titolo: string;
  descrizione?: string | null;
  data_scadenza: string;
  priorita?: string | null;
  working_progress?: string | null;
  destinatario_id?: string | null;
  operatore_id?: string | null;
  studio_id?: string | null;
};

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(from: Date, to: Date): number {
  const ms = toDateOnly(to).getTime() - toDateOnly(from).getTime();
  return Math.round(ms / 86400000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = toDateOnly(new Date());

    const { data: promemoriaList, error: promemoriaError } = await supabase
      .from("tbpromemoria")
      .select(`
        id,
        titolo,
        descrizione,
        data_scadenza,
        priorita,
        working_progress,
        destinatario_id,
        operatore_id,
        studio_id
      `)
      .not("data_scadenza", "is", null)
      .not("destinatario_id", "is", null)
      .neq("working_progress", "Completato")
      .neq("working_progress", "Annullata");

    if (promemoriaError) throw promemoriaError;

    let alert7 = 0;
    let alert2 = 0;
    const log: string[] = [];

    for (const promemoria of (promemoriaList || []) as Promemoria[]) {
      if (!promemoria.destinatario_id || !promemoria.data_scadenza) {
        log.push(`Saltato promemoria ${promemoria.id}: dati incompleti`);
        continue;
      }

      const dataScadenza = parseDateOnly(promemoria.data_scadenza);
      const giorniRimanenti = diffDays(today, dataScadenza);

      const checks = [
        { giorniTarget: 7, tipoAlert: "7_giorni" as const },
        { giorniTarget: 2, tipoAlert: "2_giorni" as const },
      ];

      for (const check of checks) {
        if (giorniRimanenti !== check.giorniTarget) continue;

        const { data: alreadySent, error: alertCheckError } = await supabase
          .from("tbpromemoria_alert")
          .select("id")
          .eq("promemoria_id", promemoria.id)
          .eq("data_scadenza_riferimento", promemoria.data_scadenza)
          .eq("tipo_alert", check.tipoAlert)
          .limit(1);

        if (alertCheckError) throw alertCheckError;

        if (alreadySent && alreadySent.length > 0) {
          log.push(`Avviso ${check.tipoAlert} già inviato per ${promemoria.titolo}`);
          continue;
        }

        const { data: destinatario, error: destinatarioError } = await supabase
          .from("tbutenti")
          .select("id, nome, cognome, email")
          .eq("id", promemoria.destinatario_id)
          .single();

        if (destinatarioError || !destinatario?.email) {
          log.push(`Saltato ${promemoria.titolo}: destinatario senza email valida`);
          continue;
        }

       const subject = `🔔 Alert Promemoria: ${promemoria.titolo || "Promemoria"}`;


 const titoloPromemoria = promemoria.titolo || "Promemoria";
const dataScadenzaFormatted = new Date(promemoria.data_scadenza).toLocaleDateString("it-IT", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const coloreAlert = giorniRimanenti <= 2 ? "#dc2626" : "#ef4444";
const etichettaAlert =
  giorniRimanenti <= 2 ? "⏰ Scade tra 2 giorni" : "⏰ Scade tra 7 giorni";

const html = `
  <div style="margin:0; padding:0; background-color:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
    <div style="max-width:700px; margin:0 auto; background:#ffffff;">
      
      <div style="padding:24px 28px 8px 28px; font-size:30px; line-height:1.2; color:#111827; font-weight:700;">
        🔔
      </div>

      <div style="padding:8px 28px 0 28px;">
        <div style="border-left:4px solid ${coloreAlert}; padding-left:16px; margin-bottom:24px;">
          <div style="font-size:18px; font-weight:700; color:${coloreAlert}; margin-bottom:18px;">
            ${etichettaAlert}
          </div>

          <div style="font-size:16px; line-height:1.8; color:#374151;">
            <div><strong>Promemoria:</strong> ${titoloPromemoria}</div>
            <div><strong>Data scadenza:</strong> ${dataScadenzaFormatted}</div>
            <div><strong>Priorità:</strong> ${promemoria.priorita || "Media"}</div>
            ${
              promemoria.descrizione
                ? `<div><strong>Descrizione:</strong> ${promemoria.descrizione}</div>`
                : ""
            }
          </div>
        </div>

        <div style="background:#f3f4f6; padding:14px 16px; margin:0 0 18px 0; color:#374151; font-size:15px;">
          Questo alert è stato inviato da <strong>Studio Manager Pro</strong> per ricordarti una scadenza importante.
        </div>

        <div style="font-size:15px; color:#374151; margin-bottom:28px;">
          Accedi a Studio Manager Pro per visualizzare tutti i dettagli e gestire il promemoria.
        </div>
      </div>

      <div style="text-align:center; color:#9ca3af; font-size:13px; padding:24px 16px 8px 16px;">
        © 2026 Studio Manager Pro - Sistema di gestione studio
      </div>

      <div style="text-align:center; color:#9ca3af; font-size:12px; padding:0 16px 28px 16px;">
        Questa è una email automatica, non rispondere a questo messaggio.
      </div>
    </div>
  </div>
`;

const payload = {
  email: destinatario.email,
  subject,
  html,
};

const fnUrl = `${supabaseUrl}/functions/v1/send-promemoria-alert`;

const response = await fetch(fnUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseServiceKey}`,
    apikey: supabaseServiceKey,
  },
  body: JSON.stringify(payload),
});

        const raw = await response.text();

let result: any = null;
try {
  result = JSON.parse(raw);
} catch {
  result = null;
}

if (!response.ok || !result?.success) {
  log.push(
    `Errore invio ${check.tipoAlert} per ${promemoria.titolo} - status ${response.status} - body ${raw}`
  );
  continue;
}

        const { error: insertError } = await supabase
          .from("tbpromemoria_alert")
          .insert({
            promemoria_id: promemoria.id,
            data_scadenza_riferimento: promemoria.data_scadenza,
            tipo_alert: check.tipoAlert,
            data_invio: new Date().toISOString(),
          });

        if (insertError) throw insertError;

        if (check.tipoAlert === "7_giorni") alert7++;
        if (check.tipoAlert === "2_giorni") alert2++;

        log.push(`Inviato ${check.tipoAlert} per ${promemoria.titolo}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Controllo promemoria completato",
        alert7,
        alert2,
        totale: promemoriaList?.length || 0,
        log,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
