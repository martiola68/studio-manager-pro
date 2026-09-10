from pathlib import Path

p = Path('src/pages/api/presenze/report-giornaliero-email.ts')
s = p.read_text(encoding='utf-8')
old = s

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

      for (const item of sectorRecipients) {
        const to = String(item.to || "").trim();
        if (!to) {
          skippedRecipients.push(item.key);
          continue;
        }

        const settoreEntry = Array.from(perSettore.entries()).find(
          ([settore]) => settore.trim().toLowerCase() === item.key.toLowerCase()
        );
        const gruppo = settoreEntry?.[1] || { fisiche: [], smart: [] };

        const fisicheRows = gruppo.fisiche.length
          ? gruppo.fisiche
              .map(
                (u) => `<tr>
                  <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${esc(nomeCompleto(u))}</td>
                  <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#166534">Presente in ufficio</td>
                </tr>`
              )
              .join("")
          : `<tr><td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#64748b">Nessuno</td></tr>`;

        const smartRows = gruppo.smart.length
          ? gruppo.smart
              .map(
                (u) => `<tr>
                  <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${esc(nomeCompleto(u))}</td>
                  <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#1d4ed8">Smart working</td>
                </tr>`
              )
              .join("")
          : `<tr><td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#64748b">Nessuno</td></tr>`;

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
'''

s = s[:start] + new + s[end:]
s = s.replace(
'''        recipients: sent,
      });''',
'''        recipients: sent,
        skipped_recipients: skippedRecipients,
      });''',
1
)

if s == old:
    raise SystemExit('no changes applied')

for token in [
    'sectorRecipients',
    'PRESENZE ${item.key.toUpperCase()}',
    'skipped_recipients',
    'settore: item.key',
]:
    if token not in s:
        raise SystemExit(f'missing token: {token}')

p.write_text(s, encoding='utf-8')
print('Sector-specific presence report routing applied')
