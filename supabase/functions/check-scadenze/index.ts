import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TipoScadenza = {
  id: string;
  nome: string;
  descrizione?: string | null;
  data_scadenza: string;
  tipo_scadenza: string;
  ricorrente?: boolean | null;
  giorni_preavviso_1?: number | null;
  giorni_preavviso_2?: number | null;
  attivo?: boolean | null;
  studio_id?: string | null;
  settore_fiscale?: boolean | null;
  settore_lavoro?: boolean | null;
  settore_consulenza?: boolean | null;
};

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diffDays(from: Date, to: Date): number {
  const ms = toDateOnly(to).getTime() - toDateOnly(from).getTime();
  return Math.round(ms / 86400000);
}

function getSettori(tipo: TipoScadenza): string[] {
  const settori: string[] = [];
  if (tipo.settore_fiscale) settori.push("Fiscale");
  if (tipo.settore_lavoro) settori.push("Lavoro");
  if (tipo.settore_consulenza) settori.push("Consulenza");
  return settori;
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

    const { data: tipi, error: tipiError } = await supabase
      .from("tbtipi_scadenze")
      .select(`
        id,
        nome,
        descrizione,
        data_scadenza,
        tipo_scadenza,
        ricorrente,
        giorni_preavviso_1,
        giorni_preavviso_2,
        attivo,
        studio_id,
        settore_fiscale,
        settore_lavoro,
        settore_consulenza
      `)
      .eq("attivo", true);

    if (tipiError) throw tipiError;

    let rinnovi = 0;
    let alert30 = 0;
    let alert10 = 0;
    const log: string[] = [];

    for (const tipo of (tipi || []) as TipoScadenza[]) {
      let dataScadenza = parseDateOnly(tipo.data_scadenza);

      // 1) rinnovo automatico annuale per ricorrenti già scadute
      if (tipo.ricorrente) {
        let changed = false;

        while (toDateOnly(dataScadenza) < today) {
          dataScadenza = new Date(
            dataScadenza.getFullYear() + 1,
            dataScadenza.getMonth(),
            dataScadenza.getDate()
          );
          changed = true;
        }

        if (changed) {
          const nuovaData = formatDateOnly(dataScadenza);

          const { error: updateError } = await supabase
            .from("tbtipi_scadenze")
            .update({
              data_scadenza: nuovaData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", tipo.id);

          if (updateError) throw updateError;

          tipo.data_scadenza = nuovaData;
          rinnovi++;
          log.push(`Rinnovata ${tipo.nome} al ${nuovaData}`);
        }
      }

      // 2) ricalcolo giorni mancanti
      dataScadenza = parseDateOnly(tipo.data_scadenza);
      const giorniRimanenti = diffDays(today, dataScadenza);

      const settori = getSettori(tipo);
      if (settori.length === 0) {
        log.push(`Saltata ${tipo.nome}: nessun settore configurato`);
        continue;
      }

      const checks = [
        {
          giorniTarget: tipo.giorni_preavviso_1 ?? 30,
          tipoAlert: "30_giorni",
        },
        {
          giorniTarget: tipo.giorni_preavviso_2 ?? 10,
          tipoAlert: "10_giorni",
        },
      ];

      for (const check of checks) {
        if (giorniRimanenti !== check.giorniTarget) continue;

        const annoInvio = dataScadenza.getFullYear();

        const { data: alreadySent, error: alertCheckError } = await supabase
          .from("tbtipi_scadenze_alert")
          .select("id")
          .eq("tipo_scadenza_id", tipo.id)
          .eq("anno_invio", annoInvio)
          .eq("tipo_alert", check.tipoAlert)
          .limit(1);

        if (alertCheckError) throw alertCheckError;
        if (alreadySent && alreadySent.length > 0) {
          log.push(`Avviso ${check.tipoAlert} già inviato per ${tipo.nome}`);
          continue;
        }

        const payload = {
          tipoScadenzaId: tipo.id,
          settori,
          responsabileEmail: "noreply@revisionicommerciali.it",
          responsabileNome: "Studio Manager Pro",
          scadenzaNome: tipo.nome,
          scadenzaData: tipo.data_scadenza,
          scadenzaDescrizione: tipo.descrizione || "",
          giorniRimanenti,
        };

        const fnUrl = `${supabaseUrl}/functions/v1/send-scadenza-alert`;

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
          log.push(`Errore invio ${check.tipoAlert} per ${tipo.nome}`);
          continue;
        }

        const { error: insertError } = await supabase
          .from("tbtipi_scadenze_alert")
          .insert({
            tipo_scadenza_id: tipo.id,
            anno_invio: annoInvio,
            tipo_alert: check.tipoAlert,
            data_invio: new Date().toISOString(),
          });

        if (insertError) throw insertError;

        if (check.tipoAlert === "30_giorni") alert30++;
        if (check.tipoAlert === "10_giorni") alert10++;

        log.push(`Inviato ${check.tipoAlert} per ${tipo.nome}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Controllo scadenze completato",
        rinnovi,
        alert30,
        alert10,
        totale: tipi?.length || 0,
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
