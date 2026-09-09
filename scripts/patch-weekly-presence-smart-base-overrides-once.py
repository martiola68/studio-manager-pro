from pathlib import Path

p = Path('src/pages/presenze/assenze-settimanali.tsx')
s = p.read_text(encoding='utf-8')
old = s

# 1) carica anche il calendario Smart Working
old_promise = '''      const [{ data: utentiData, error: utentiError }, { data: presenzeData, error: presenzeError }] =
        await Promise.all([
  supabase
    .from("tbutenti")
    .select("id, nome, cognome, email, settore, tipo_rapporto")
    .eq("studio_id", currentStudioId)
    .eq("attivo", true)
    .eq("tipo_rapporto", "Dipendente")
    .order("cognome", { ascending: true }),

  supabase
    .from("tbpresenze_dipendenti")
    .select(`
      id,
      utente_id,
      data_presenza,
      codice_presenza,
      note,
      tbpresenze_codici (
        codice,
        descrizione,
        tipo
      )
    `)
            .eq("studio_id", currentStudioId)
            .gte("data_presenza", startStr)
            .lte("data_presenza", endStr),
        ]);'''

new_promise = '''      const [
        { data: utentiData, error: utentiError },
        { data: presenzeData, error: presenzeError },
        { data: smartData, error: smartError },
      ] = await Promise.all([
        supabase
          .from("tbutenti")
          .select("id, nome, cognome, email, settore, tipo_rapporto")
          .eq("studio_id", currentStudioId)
          .eq("attivo", true)
          .eq("tipo_rapporto", "Dipendente")
          .order("cognome", { ascending: true }),

        supabase
          .from("tbpresenze_dipendenti")
          .select(`
            id,
            utente_id,
            data_presenza,
            codice_presenza,
            note,
            tbpresenze_codici (
              codice,
              descrizione,
              tipo
            )
          `)
          .eq("studio_id", currentStudioId)
          .gte("data_presenza", startStr)
          .lte("data_presenza", endStr),

        supabase
          .from("tbpresenze_smart_calendario")
          .select("id, utente_id, data, presenza, festivo, nota")
          .eq("studio_id", currentStudioId)
          .gte("data", startStr)
          .lte("data", endStr),
      ]);'''

if old_promise not in s:
    raise SystemExit('loadData Promise.all marker mismatch')
s = s.replace(old_promise, new_promise, 1)

# 2) merge esplicito:
#    - Smart Working è sempre il valore base
#    - se Presenze è NULL/vuoto, resta il valore Smart
#    - ferie, malattia, permessi e festivi sovrascrivono il valore Smart
old_after_errors = '''      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;

      setUtenti(utentiData || []);
      setPresenze(presenzeData || []);'''

new_after_errors = '''      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;
      if (smartError) throw smartError;

      const actualRows = (presenzeData || []) as Presenza[];
      const merged = new Map<string, Presenza>();

      // 1. Calendario Smart = base principale P/SW.
      for (const smart of smartData || []) {
        const key = `${smart.utente_id}_${smart.data}`;

        if (smart.festivo) {
          merged.set(key, {
            id: `smart-${smart.id}`,
            utente_id: smart.utente_id,
            data_presenza: smart.data,
            codice_presenza: "N",
            note: smart.nota || null,
            tbpresenze_codici: {
              codice: "N",
              descrizione: smart.nota || "Festivo / Non lavorativo",
              tipo: "festivo",
            },
          });
          continue;
        }

        const codice = smart.presenza ? "Pp" : "Ps";
        merged.set(key, {
          id: `smart-${smart.id}`,
          utente_id: smart.utente_id,
          data_presenza: smart.data,
          codice_presenza: codice,
          note: null,
          tbpresenze_codici: {
            codice,
            descrizione: smart.presenza ? "Presente in ufficio" : "Presente in smart working",
            tipo: "presenza",
          },
        });
      }

      // 2. Presenze reali: un NULL/non valorizzato NON deve cancellare il dato Smart.
      //    Solo ferie, malattia, permessi e festivi hanno precedenza sul calendario Smart.
      for (const actual of actualRows) {
        const key = `${actual.utente_id}_${actual.data_presenza}`;
        const codice = String(actual.codice_presenza || "").trim();
        const tipo = actual.tbpresenze_codici?.tipo;

        if (!codice) {
          // Se la presenza è NULL/vuota, mantiene il valore già derivato dal gruppo Smart.
          continue;
        }

        const isPermesso = tipo === "permesso" || /^P\\d+(?:\\.\\d+)?(?:\\.104)?$/.test(codice);
        const isAssenza = tipo === "assenza" || codice === "F" || codice === "M";
        const isFestivo = tipo === "festivo" || codice === "N";

        if (isPermesso || isAssenza || isFestivo) {
          merged.set(key, actual);
          continue;
        }

        // Per dipendenti/giorni senza calendario Smart, conserva comunque il dato reale.
        if (!merged.has(key)) {
          merged.set(key, actual);
        }
      }

      setUtenti(utentiData || []);
      setPresenze(Array.from(merged.values()));'''

if old_after_errors not in s:
    raise SystemExit('loadData post-error marker mismatch')
s = s.replace(old_after_errors, new_after_errors, 1)

# 3) descrizione pagina aggiornata per esplicitare la logica.
s = s.replace(
    'Ferie, permessi e assenze dal{" "}',
    'Calendario Smart Working aggiornato con ferie, permessi e assenze dal{" "}',
    1,
)

if s == old:
    raise SystemExit('no weekly presence changes applied')

checks = [
    'tbpresenze_smart_calendario',
    'Calendario Smart = base principale P/SW.',
    'if (!codice)',
    'smart.presenza ? "Pp" : "Ps"',
    'isAssenza = tipo === "assenza" || codice === "F" || codice === "M"',
]
for token in checks:
    if token not in s:
        raise SystemExit(f'missing expected token: {token}')

p.write_text(s, encoding='utf-8')
