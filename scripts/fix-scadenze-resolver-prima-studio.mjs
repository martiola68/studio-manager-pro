import fs from "node:fs";

const filePath = "src/pages/api/scadenze-centrale/processa-alert.ts";
let source = fs.readFileSync(filePath, "utf8");

const oldBlock = `      const { data: studio, error: studioError } = await supabaseAdmin
        .from("tbstudio")
        .select("id,email,email_alert_fiscale,microsoft_connection_id")
        .eq("id", riga.studio_id)
        .maybeSingle();

      if (studioError || !studio?.id) {
        saltati++;
        dettagli.push({
          scadenza_id: riga.id,
          ok: false,
          messaggio: "Studio non trovato",
        });
        continue;
      }

      // Revisioni Commerciali usa lo stesso mittente automatico già collaudato
      // dal report presenze. Per gli altri tenant resta disponibile il fallback legacy.
      let automaticSender: Awaited<ReturnType<typeof resolveAutomaticMicrosoftAlertSender>> | null = null;
      try {
        automaticSender = await resolveAutomaticMicrosoftAlertSender(supabaseAdmin, riga.studio_id);
      } catch (senderError: any) {
        console.warn("Mittente automatico scadenze non disponibile, uso fallback studio:", {
          studio_id: riga.studio_id,
          error: senderError?.message || String(senderError),
        });
      }

      const microsoftConnectionId =
        automaticSender?.microsoftConnectionId || studio.microsoft_connection_id || null;
      const fromMailbox =
        automaticSender?.fromMailbox || String(studio.email_alert_fiscale || "").trim() || null;
`;

const newBlock = `      // Prima usiamo lo stesso resolver automatico già collaudato dal report presenze.
      // Solo se non è disponibile, manteniamo il fallback legacy dello studio.
      let automaticSender: Awaited<ReturnType<typeof resolveAutomaticMicrosoftAlertSender>> | null = null;
      let studioFallback: any = null;

      try {
        automaticSender = await resolveAutomaticMicrosoftAlertSender(supabaseAdmin, riga.studio_id);
      } catch (senderError: any) {
        console.warn("Mittente automatico scadenze non disponibile, provo fallback studio:", {
          studio_id: riga.studio_id,
          error: senderError?.message || String(senderError),
        });

        const { data: studio, error: studioError } = await supabaseAdmin
          .from("tbstudio")
          .select("id,email,email_alert_fiscale,microsoft_connection_id")
          .eq("id", riga.studio_id)
          .maybeSingle();

        if (studioError) throw studioError;
        studioFallback = studio || null;
      }

      const microsoftConnectionId =
        automaticSender?.microsoftConnectionId || studioFallback?.microsoft_connection_id || null;
      const fromMailbox =
        automaticSender?.fromMailbox || String(studioFallback?.email_alert_fiscale || "").trim() || null;
`;

if (source.includes(newBlock)) {
  console.log("✓ Scadenze: resolver automatico già eseguito prima del fallback studio");
  process.exit(0);
}

if (!source.includes(oldBlock)) {
  throw new Error("[fix-scadenze-resolver-prima-studio] Blocco mittente atteso non trovato");
}

source = source.replace(oldBlock, newBlock);
fs.writeFileSync(filePath, source, "utf8");

console.log("✓ Scadenze: resolver m.artiola/noreply eseguito prima del fallback tbstudio");
