from pathlib import Path

p = Path('src/pages/presenze/assenze-settimanali.tsx')
s = p.read_text(encoding='utf-8')
old = s

# Estende il caricamento con gruppi e membri, così possiamo ricostruire P/SW
# anche quando il calendario mensile non contiene ancora la riga.
old_head = '''      const [
        { data: utentiData, error: utentiError },
        { data: presenzeData, error: presenzeError },
        { data: smartData, error: smartError },
      ] = await Promise.all(['''
new_head = '''      const [
        { data: utentiData, error: utentiError },
        { data: presenzeData, error: presenzeError },
        { data: smartData, error: smartError },
        { data: gruppiData, error: gruppiError },
        { data: gruppiUtentiData, error: gruppiUtentiError },
      ] = await Promise.all(['''
if old_head not in s:
    raise SystemExit('Promise head marker not found')
s = s.replace(old_head, new_head, 1)

old_tail = '''        supabase
          .from("tbpresenze_smart_calendario")
          .select("id, utente_id, data, presenza, festivo, nota")
          .eq("studio_id", currentStudioId)
          .gte("data", startStr)
          .lte("data", endStr),
      ]);'''
new_tail = '''        supabase
          .from("tbpresenze_smart_calendario")
          .select("id, utente_id, data, presenza, festivo, nota")
          .eq("studio_id", currentStudioId)
          .gte("data", startStr)
          .lte("data", endStr),

        supabase
          .from("tbpresenze_smart_gruppi")
          .select("id, giorno_fisso, scelta_libera")
          .eq("studio_id", currentStudioId)
          .eq("attivo", true),

        supabase
          .from("tbpresenze_smart_gruppi_utenti")
          .select("id, gruppo_id, utente_id, ordine, giorni_presenza")
          .eq("studio_id", currentStudioId)
          .eq("attivo", true)
          .order("ordine", { ascending: true }),
      ]);'''
if old_tail not in s:
    raise SystemExit('Promise tail marker not found')
s = s.replace(old_tail, new_tail, 1)

old_errors = '''      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;
      if (smartError) throw smartError;
'''
new_errors = '''      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;
      if (smartError) throw smartError;
      if (gruppiError) throw gruppiError;
      if (gruppiUtentiError) throw gruppiUtentiError;
'''
if old_errors not in s:
    raise SystemExit('error marker not found')
s = s.replace(old_errors, new_errors, 1)

# Inserisce una seconda sorgente Smart: se manca la riga nel calendario mensile,
# ricostruisce la giornata direttamente dalla configurazione del gruppo.
marker = '''      // 2) Le Presenze reali sovrascrivono la base Smart SOLO se valorizzate
      //    con ferie, malattia, permessi o festivo. NULL/vuoto lascia P/SW Smart.
'''
block = '''      // 1b) Se il calendario Smart non contiene una riga, la ricava direttamente
      //     dalla configurazione del gruppo. In questo modo un NULL nelle Presenze
      //     non produce più "Nessun dato" quando il dipendente appartiene a un gruppo.
      const gruppiById = new Map<string, any>();
      for (const gruppo of gruppiData || []) {
        gruppiById.set(gruppo.id, gruppo);
      }

      const membriPerGruppo = new Map<string, any[]>();
      for (const membro of gruppiUtentiData || []) {
        const lista = membriPerGruppo.get(membro.gruppo_id) || [];
        lista.push(membro);
        membriPerGruppo.set(membro.gruppo_id, lista);
      }

      const mondayOf = (date: Date) => {
        const copy = new Date(date);
        const day = copy.getDay() || 7;
        copy.setDate(copy.getDate() - day + 1);
        copy.setHours(0, 0, 0, 0);
        return copy;
      };

      const excelBase = new Date(2025, 11, 1);
      const extraIndexForDay = (date: Date, weekday: number, count: number) => {
        if (!count) return null;
        const posByDay: Record<number, number> = { 1: 0, 3: 1, 4: 2, 5: 3 };
        const pos = posByDay[weekday];
        if (pos === undefined) return null;
        const weekIndex = Math.floor(
          (mondayOf(date).getTime() - excelBase.getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        );
        return (weekIndex + pos) % count;
      };

      for (const [gruppoId, membri] of membriPerGruppo.entries()) {
        const gruppo = gruppiById.get(gruppoId);
        if (!gruppo) continue;

        const ordinati = [...membri].sort(
          (a, b) => Number(a.ordine || 0) - Number(b.ordine || 0)
        );

        for (const day of days) {
          const wd = day.getDay();
          if (wd < 1 || wd > 5) continue;
          const dataKey = toDateInput(day);
          const extraIndex = extraIndexForDay(day, wd, ordinati.length);

          ordinati.forEach((membro, userIndex) => {
            const key = `${membro.utente_id}_${dataKey}`;
            if (merged.has(key)) return;

            const giorni = Array.isArray(membro.giorni_presenza)
              ? membro.giorni_presenza.map(Number)
              : [];
            const presenza = gruppo.scelta_libera
              ? giorni.includes(wd)
              : wd === Number(gruppo.giorno_fisso || 2) || userIndex === extraIndex;
            const codice = presenza ? "Pp" : "Ps";

            merged.set(key, {
              id: `smart-derived-${gruppoId}-${membro.utente_id}-${dataKey}`,
              utente_id: membro.utente_id,
              data_presenza: dataKey,
              codice_presenza: codice,
              note: null,
              tbpresenze_codici: {
                codice,
                descrizione: presenza ? "Presente in ufficio" : "Presente in smart working",
                tipo: "presenza",
              },
            });
          });
        }
      }

'''
if marker not in s:
    raise SystemExit('merge insertion marker not found')
s = s.replace(marker, block + marker, 1)

if s == old:
    raise SystemExit('no changes applied')

for token in [
    'gruppiUtentiData',
    'smart-derived-',
    'membriPerGruppo',
    'extraIndexForDay',
    'if (merged.has(key)) return;',
]:
    if token not in s:
        raise SystemExit(f'missing token {token}')

p.write_text(s, encoding='utf-8')
