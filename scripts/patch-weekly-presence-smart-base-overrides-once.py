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

# 2) merge: Smart Working è la base; ferie/permessi/malattia prevalgono.
old_after_errors = '''      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;

      setUtenti(utentiData || []);
      setPresenze(presenzeData || []);'''

new_after_errors = '''      if (utentiError) throw utentiError;
      if (presenzeError) throw presenzeError;
      if (smartError) throw smartError;

      const actualRows = (presenzeData || []) as Presenza[];
      const merged = new Map<string, Presenza>();

      // Mantiene come fallback eventuali dati già presenti in Presenze
      // (festivi/non lavorativi e dipendenti non inclusi nei gruppi Smart).
      for (const presenza of actualRows) {
        merged.set(`${presenza.utente_id}_${presenza.data_presenza}`, presenza);
      }

      // Il calendario dei gruppi Smart diventa la base P/SW.
      // Non sovrascrive però ferie, permessi o malattia già registrati in Presenze.
      for (const smart of smartData || []) {
        const key = `${smart.utente_id}_${smart.data}`;
        const actual = merged.get(key);
        const actualTipo = actual?.tbpresenze_codici?.tipo;
        const actualCodice = actual?.codice_presenza || "";
        const isPermesso = actualTipo === "permesso" || /^P\\d+(?:\\.\\d+)?(?:\\.104)?$/.test(actualCodice);
        const isAssenza = actualTipo === "assenza" || actualCodice === "F" || actualCodice === "M";
        const isFestivo = actualTipo === "festivo" || actualCodice === "N";

        if (isPermesso || isAssenza || isFestivo) {
          continue;
        }

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
    'const merged = new Map<string, Presenza>();',
    'actualCodice === "F" || actualCodice === "M"',
    'smart.presenza ? "Pp" : "Ps"',
]
for token in checks:
    if token not in s:
        raise SystemExit(f'missing expected token: {token}')

p.write_text(s, encoding='utf-8')
