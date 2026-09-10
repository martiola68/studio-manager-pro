from pathlib import Path

# 1) Daily email report: restore clean tabular graphic and include all Smart-group members.
p = Path('src/pages/api/presenze/report-giornaliero-email.ts')
s = p.read_text(encoding='utf-8')
old = s

s = s.replace(
'''      const [
        { data: utenti, error: utentiError },
        { data: smart, error: smartError },
        { data: actual, error: actualError },
      ] = await Promise.all([''',
'''      const [
        { data: utenti, error: utentiError },
        { data: smart, error: smartError },
        { data: actual, error: actualError },
        { data: gruppiSmart, error: gruppiSmartError },
      ] = await Promise.all([''',
1)

s = s.replace(
'''          .eq("studio_id", config.studio_id)
          .eq("attivo", true)
          .eq("tipo_rapporto", "Dipendente")
          .order("settore")''',
'''          .eq("studio_id", config.studio_id)
          .eq("attivo", true)
          .order("settore")''',
1)

needle = '''        supabase
          .from("tbpresenze_dipendenti")
          .select(
            "utente_id,codice_presenza,tbpresenze_codici(codice,descrizione,tipo)"
          )
          .eq("studio_id", config.studio_id)
          .eq("data_presenza", date),
      ]);'''
replacement = '''        supabase
          .from("tbpresenze_dipendenti")
          .select(
            "utente_id,codice_presenza,tbpresenze_codici(codice,descrizione,tipo)"
          )
          .eq("studio_id", config.studio_id)
          .eq("data_presenza", date),
        supabase
          .from("tbpresenze_smart_gruppi")
          .select(`
            id, giorno_fisso, scelta_libera,
            utenti:tbpresenze_smart_gruppi_utenti(
              utente_id, ordine, giorni_presenza
            )
          `)
          .eq("studio_id", config.studio_id)
          .eq("attivo", true),
      ]);'''
if needle not in s:
    raise SystemExit('daily report Promise tail marker not found')
s = s.replace(needle, replacement, 1)

s = s.replace(
'''      if (utentiError) throw utentiError;
      if (smartError) throw smartError;
      if (actualError) throw actualError;

      const stato = new Map<string, { codice: string; descrizione: string }>();''',
'''      if (utentiError) throw utentiError;
      if (smartError) throw smartError;
      if (actualError) throw actualError;
      if (gruppiSmartError) throw gruppiSmartError;

      const smartMemberIds = new Set<string>();
      for (const gruppo of gruppiSmart || []) {
        for (const membro of gruppo.utenti || []) {
          if (membro?.utente_id) smartMemberIds.add(String(membro.utente_id));
        }
      }

      const personeIncluse = (utenti || []).filter(
        (u: any) => u.tipo_rapporto === "Dipendente" || smartMemberIds.has(String(u.id))
      );

      const stato = new Map<string, { codice: string; descrizione: string }>();''',
1)

marker = '''      for (const r of actual || []) {'''
block = '''      // Se manca la riga nel calendario Smart, ricava P/SW direttamente dal gruppo,
      // come la schermata settimanale.
      const today = new Date(`${date}T12:00:00`);
      const wd = today.getDay();
      const mondayOf = (d: Date) => {
        const copy = new Date(d);
        const day = copy.getDay() || 7;
        copy.setDate(copy.getDate() - day + 1);
        copy.setHours(0, 0, 0, 0);
        return copy;
      };
      const excelBase = new Date(2025, 11, 1);
      const extraIndexForDay = (d: Date, weekday: number, count: number) => {
        if (!count) return null;
        const posByDay: Record<number, number> = { 1: 0, 3: 1, 4: 2, 5: 3 };
        const pos = posByDay[weekday];
        if (pos === undefined) return null;
        const weekIndex = Math.floor(
          (mondayOf(d).getTime() - excelBase.getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        );
        return (weekIndex + pos) % count;
      };

      for (const gruppo of gruppiSmart || []) {
        const membri = [...(gruppo.utenti || [])].sort(
          (a: any, b: any) => Number(a.ordine || 0) - Number(b.ordine || 0)
        );
        const extraIndex = extraIndexForDay(today, wd, membri.length);
        membri.forEach((membro: any, userIndex: number) => {
          if (!membro?.utente_id || stato.has(String(membro.utente_id))) return;
          const giorni = Array.isArray(membro.giorni_presenza)
            ? membro.giorni_presenza.map(Number)
            : [];
          const presenza = gruppo.scelta_libera
            ? giorni.includes(wd)
            : wd === Number(gruppo.giorno_fisso || 2) || userIndex === extraIndex;
          stato.set(String(membro.utente_id), {
            codice: presenza ? "Pp" : "Ps",
            descrizione: presenza ? "Presente in ufficio" : "Smart working",
          });
        });
      }

'''
if marker not in s:
    raise SystemExit('actual marker not found')
s = s.replace(marker, block + marker, 1)

s = s.replace('''      for (const u of utenti || []) {''','''      for (const u of personeIncluse) {''',1)

start = s.index('      const sezioni = Array.from(perSettore.entries())')
end = s.index('\n\n      const html = `', start)
new_sections = '''      const sezioni = Array.from(perSettore.entries())
        .sort(([a], [b]) => a.localeCompare(b, "it"))
        .map(([settore, gruppo]) => {
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

          return `
            <div style="margin:0 0 22px 0">
              <div style="background:#eaf4fb;border-left:4px solid #1478a6;padding:8px 12px;font-weight:700">
                ${esc(settore)}
              </div>
              <div style="padding:8px 12px 4px;font-weight:700;color:#166534">Presenze fisiche — ${gruppo.fisiche.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${fisicheRows}</table>
              <div style="padding:12px 12px 4px;font-weight:700;color:#1d4ed8">Presenze in smart — ${gruppo.smart.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${smartRows}</table>
            </div>
          `;
        })
        .join("");'''
s = s[:start] + new_sections + s[end:]

s = s.replace(
'''          <h2 style="margin-bottom:18px">PRESENZE DEL ${dataIt}</h2>''',
'''          <h2 style="margin-bottom:4px">PRESENZE DEL ${dataIt}</h2>
          <p style="margin-top:0;margin-bottom:18px;color:#64748b">Presenze fisiche e Smart Working, suddivise per settore.</p>''',
1)

if s == old:
    raise SystemExit('daily report: no changes')
p.write_text(s, encoding='utf-8')

# 2) Weekly page: employees + every active user explicitly included in a Smart group.
p = Path('src/pages/presenze/assenze-settimanali.tsx')
s = p.read_text(encoding='utf-8')
old = s
s = s.replace(
'''          .eq("studio_id", currentStudioId)
          .eq("attivo", true)
          .eq("tipo_rapporto", "Dipendente")
          .order("cognome", { ascending: true }),''',
'''          .eq("studio_id", currentStudioId)
          .eq("attivo", true)
          .order("cognome", { ascending: true }),''',
1)

needle = '''      const gruppiUtentiData = gruppiData.flatMap((gruppo: any) =>
        (gruppo.utenti || []).map((membro: any) => ({
          ...membro,
          gruppo_id: gruppo.id,
        }))
      );

      const actualRows = (presenzeData || []) as Presenza[];'''
replacement = '''      const gruppiUtentiData = gruppiData.flatMap((gruppo: any) =>
        (gruppo.utenti || []).map((membro: any) => ({
          ...membro,
          gruppo_id: gruppo.id,
        }))
      );

      const smartMemberIds = new Set(
        gruppiUtentiData.map((membro: any) => String(membro.utente_id))
      );
      const utentiInclusi = (utentiData || []).filter(
        (utente: any) =>
          utente.tipo_rapporto === "Dipendente" || smartMemberIds.has(String(utente.id))
      );

      const actualRows = (presenzeData || []) as Presenza[];'''
if needle not in s:
    raise SystemExit('weekly smart member marker not found')
s = s.replace(needle, replacement, 1)
s = s.replace('''      setUtenti(utentiData || []);''','''      setUtenti(utentiInclusi);''',1)

if s == old:
    raise SystemExit('weekly page: no changes')
p.write_text(s, encoding='utf-8')

print('Presence report style restored and Smart-group members included')
