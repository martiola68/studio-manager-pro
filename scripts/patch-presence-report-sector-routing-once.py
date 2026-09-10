from pathlib import Path

p = Path('src/pages/api/presenze/report-giornaliero-email.ts')
s = p.read_text(encoding='utf-8')
old = s

# 1) Extend the per-sector state buckets with absences and permissions.
s = s.replace(
'''      const perSettore = new Map<string, { fisiche: any[]; smart: any[] }>();''',
'''      const perSettore = new Map<
        string,
        {
          fisiche: any[];
          smart: any[];
          assenze: Array<{ utente: any; stato: { codice: string; descrizione: string } }>;
          permessi: Array<{ utente: any; stato: { codice: string; descrizione: string } }>;
        }
      >();''',
1)

old_loop = '''      for (const u of personeIncluse) {
        const s = stato.get(String(u.id));
        if (!s || (s.codice !== "Pp" && s.codice !== "Ps")) continue;

        const settore = String(u.settore || "Senza settore").trim() || "Senza settore";
        const gruppo = perSettore.get(settore) || { fisiche: [], smart: [] };

        if (s.codice === "Pp") gruppo.fisiche.push(u);
        if (s.codice === "Ps") gruppo.smart.push(u);

        perSettore.set(settore, gruppo);
      }'''
new_loop = '''      for (const u of personeIncluse) {
        const s = stato.get(String(u.id));
        if (!s) continue;

        const settore = String(u.settore || "Senza settore").trim() || "Senza settore";
        const gruppo = perSettore.get(settore) || {
          fisiche: [],
          smart: [],
          assenze: [],
          permessi: [],
        };

        const isPermesso = /^P\\d+(?:\\.\\d+)?(?:\\.104)?$/.test(s.codice) ||
          String(s.descrizione || "").toLowerCase().includes("permesso");
        const isAssenza = s.codice === "F" || s.codice === "M" ||
          ["ferie", "malattia", "assenza"].some((x) =>
            String(s.descrizione || "").toLowerCase().includes(x)
          );

        if (s.codice === "Pp") gruppo.fisiche.push(u);
        else if (s.codice === "Ps") gruppo.smart.push(u);
        else if (isPermesso) gruppo.permessi.push({ utente: u, stato: s });
        else if (isAssenza) gruppo.assenze.push({ utente: u, stato: s });

        perSettore.set(settore, gruppo);
      }'''
if old_loop not in s:
    raise SystemExit('perSettore loop marker not found')
s = s.replace(old_loop, new_loop, 1)

# 2) Replace cumulative send with one email per mapped sector.
start = s.index('      const automaticSender = await resolveAutomaticMicrosoftAlertSender(')
end = s.index('\n      results.push({', start)

new = '''      const automaticSender = await resolveAutomaticMicrosoftAlertSender(
        supabaseAdmin,
        config.studio_id
      );

      const sectorRecipients = [
        { key: "Fiscale", to: configuredRecipients[0] || "" },
        { key: "Lavoro", to: configuredRecipients[1] || "" },
        { key: "Consulenza", to: configuredRecipients[2] || "" },
      ];

      const sent: any[] = [];
      const skippedRecipients: string[] = [];

      const makeRows = (
        rows: Array<{ nome: string; stato: string; colore: string }>,
        emptyLabel = "Nessuno"
      ) => rows.length
        ? rows.map((row) => `<tr>
            <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${esc(row.nome)}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${row.colore}">${esc(row.stato)}</td>
          </tr>`).join("")
        : `<tr><td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#64748b">${emptyLabel}</td></tr>`;

      for (const item of sectorRecipients) {
        const to = String(item.to || "").trim();
        if (!to) {
          skippedRecipients.push(item.key);
          continue;
        }

        const settoreEntry = Array.from(perSettore.entries()).find(
          ([settore]) => settore.trim().toLowerCase() === item.key.toLowerCase()
        );
        const gruppo = settoreEntry?.[1] || {
          fisiche: [], smart: [], assenze: [], permessi: [],
        };

        const fisicheRows = makeRows(
          gruppo.fisiche.map((u) => ({
            nome: nomeCompleto(u),
            stato: "Presente in ufficio",
            colore: "#166534",
          }))
        );

        const smartRows = makeRows(
          gruppo.smart.map((u) => ({
            nome: nomeCompleto(u),
            stato: "Smart working",
            colore: "#1d4ed8",
          }))
        );

        const assenzeRows = makeRows(
          gruppo.assenze.map((x) => ({
            nome: nomeCompleto(x.utente),
            stato: x.stato.descrizione || x.stato.codice || "Assenza",
            colore: "#b91c1c",
          }))
        );

        const permessiRows = makeRows(
          gruppo.permessi.map((x) => ({
            nome: nomeCompleto(x.utente),
            // La descrizione del codice contiene già le ore richieste,
            // es. "Permesso L.104 1 ora" per P1.104.
            stato: x.stato.descrizione || x.stato.codice || "Permesso",
            colore: "#a16207",
          }))
        );

        const settoreHtml = `
          <div style="font-family:Arial,sans-serif;color:#111827;max-width:760px;margin:auto">
            <h2 style="margin-bottom:4px">PRESENZE DEL ${dataIt}</h2>
            <p style="margin-top:0;margin-bottom:18px;color:#64748b">Settore ${esc(item.key)}</p>
            <div style="margin:0 0 22px 0">
              <div style="background:#eaf4fb;border-left:4px solid #1478a6;padding:8px 12px;font-weight:700">${esc(item.key)}</div>

              <div style="padding:9px 12px 4px;font-weight:700;color:#166534">Presenze fisiche — ${gruppo.fisiche.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${fisicheRows}</table>

              <div style="padding:12px 12px 4px;font-weight:700;color:#1d4ed8">Presenze in smart — ${gruppo.smart.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${smartRows}</table>

              <div style="padding:12px 12px 4px;font-weight:700;color:#b91c1c">Ferie / Assenze — ${gruppo.assenze.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${assenzeRows}</table>

              <div style="padding:12px 12px 4px;font-weight:700;color:#a16207">Permessi — ${gruppo.permessi.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${permessiRows}</table>
            </div>
            <p style="font-size:12px;color:#64748b;margin-top:26px">
              Mittente automatico: <strong>${esc(AUTOMATIC_ALERT_FROM_MAILBOX)}</strong><br />
              Report automatico Studio Manager Pro.
            </p>
          </div>
        `;

        const result = await sendEmailServer({
          senderUserId: automaticSender.senderUserId,
          microsoftConnectionId: automaticSender.microsoftConnectionId,
          fromMailbox: automaticSender.fromMailbox,
          to,
          subject: `PRESENZE ${item.key.toUpperCase()} - ${dataIt}`,
          html: settoreHtml,
        });

        sent.push({
          settore: item.key,
          to,
          success: result.success,
          error: result.error || null,
          presenze_fisiche: gruppo.fisiche.length,
          presenze_smart: gruppo.smart.length,
          assenze: gruppo.assenze.length,
          permessi: gruppo.permessi.length,
        });
      }

      const ok = sent.every((x) => x.success);

      if (ok && !force) {
        await supabaseAdmin
          .from("tbpresenze_report_email_config")
          .update({
            ultimo_invio_data: date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
      }

      const presenzeFisiche = sent.reduce(
        (n, row) => n + Number(row.presenze_fisiche || 0),
        0
      );
      const presenzeSmart = sent.reduce(
        (n, row) => n + Number(row.presenze_smart || 0),
        0
      );
      const assenzeTotali = sent.reduce(
        (n, row) => n + Number(row.assenze || 0),
        0
      );
      const permessiTotali = sent.reduce(
        (n, row) => n + Number(row.permessi || 0),
        0
      );
'''

s = s[:start] + new + s[end:]

s = s.replace(
'''        recipients: sent,
      });''',
'''        recipients: sent,
        skipped_recipients: skippedRecipients,
        assenze: assenzeTotali,
        permessi: permessiTotali,
      });''',
1
)

if s == old:
    raise SystemExit('no changes applied')

for token in [
    'sectorRecipients',
    'Ferie / Assenze',
    'Permessi —',
    'x.stato.descrizione',
    'skipped_recipients',
    'settore: item.key',
]:
    if token not in s:
        raise SystemExit(f'missing token: {token}')

p.write_text(s, encoding='utf-8')
print('Sector-specific report + absences/permissions applied')
