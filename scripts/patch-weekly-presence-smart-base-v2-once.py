from pathlib import Path

p = Path('src/pages/presenze/assenze-settimanali.tsx')
s = p.read_text(encoding='utf-8')
old = s

old_block = '''      const actualRows = (presenzeData || []) as Presenza[];
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
'''

new_block = '''      const actualRows = (presenzeData || []) as Presenza[];
      const merged = new Map<string, Presenza>();

      // 1) Il calendario Smart è SEMPRE la base principale della settimana.
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

      // 2) Le Presenze reali sovrascrivono la base Smart SOLO se valorizzate
      //    con ferie, malattia, permessi o festivo. NULL/vuoto lascia P/SW Smart.
      for (const actual of actualRows) {
        const key = `${actual.utente_id}_${actual.data_presenza}`;
        const codice = String(actual.codice_presenza || "").trim();
        const tipo = actual.tbpresenze_codici?.tipo;

        if (!codice || codice === "-") {
          continue;
        }

        const isPermesso = tipo === "permesso" || /^P\\d+(?:\\.\\d+)?(?:\\.104)?$/.test(codice);
        const isAssenza = tipo === "assenza" || codice === "F" || codice === "M";
        const isFestivo = tipo === "festivo" || codice === "N";

        if (isPermesso || isAssenza || isFestivo) {
          merged.set(key, actual);
          continue;
        }

        // Se il dipendente/giorno non appartiene a un calendario Smart,
        // conserva comunque l'eventuale presenza reale valorizzata.
        if (!merged.has(key)) {
          merged.set(key, actual);
        }
      }
'''

if old_block not in s:
    raise SystemExit('current merge block not found')

s = s.replace(old_block, new_block, 1)

if s == old:
    raise SystemExit('no changes applied')

assert 'Il calendario Smart è SEMPRE la base principale' in s
assert 'if (!codice || codice === "-")' in s
assert 'merged.set(key, actual);' in s

p.write_text(s, encoding='utf-8')
