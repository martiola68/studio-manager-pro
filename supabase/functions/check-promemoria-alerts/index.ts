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

        const payload = {
          promemoriaId: promemoria.id,
          destinatarioEmail: destinatario.email,
          destinatarioNome: `${destinatario.nome || ""} ${destinatario.cognome || ""}`.trim(),
          promemoriaTitolo: promemoria.titolo,
          promemoriaDescrizione: promemoria.descrizione || "",
          dataScadenza: promemoria.data_scadenza,
          priorita: promemoria.priorita || "Media",
          giorniRimanenti,
          tipoAlert: check.tipoAlert,
        };

        const fnUrl = `${supabaseUrl}/functions/v1/send-promemoria-alert`;

        const response = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || !result?.success) {
          log.push(`Errore invio ${check.tipoAlert} per ${promemoria.titolo}`);
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
