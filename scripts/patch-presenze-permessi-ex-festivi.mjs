import fs from "node:fs";

const path = "src/pages/presenze/index.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(oldValue, newValue, label) {
  if (!source.includes(oldValue)) {
    throw new Error(`[presenze-progressivo] Anchor non trovato: ${label}`);
  }
  source = source.replace(oldValue, newValue);
}

// Mantiene compatibile il raggruppamento export già corretto nelle build precedenti.
const brokenExportGrouping = `        if (!acc[codiceDitta]) acc[codiceDitta].push(dipendente);`;
const fixedExportGrouping = `        if (!acc[codiceDitta]) acc[codiceDitta] = [];
        acc[codiceDitta].push(dipendente);`;
if (source.includes(brokenExportGrouping)) {
  source = source.replace(brokenExportGrouping, fixedExportGrouping);
}

if (!source.includes("permessiPfOre") || !source.includes("isPermessoPfCode")) {
  throw new Error("[presenze-progressivo] Gestione PF moderna non trovata nel sorgente");
}

// Carica per il solo utente autenticato lo storico delle presenze effettive
// dall'avvio del modulo fino alla fine del mese selezionato.
if (!source.includes("presenzeStorichePersonaliData")) {
  replaceOnce(
`      if (presenzeError) throw presenzeError;

      const loadedValues: Record<string, string> = {};`,
`      if (presenzeError) throw presenzeError;

      const progressiveStartDate = toDateKey(MIN_YEAR, MIN_MONTH_INDEX, 1);
      const { data: presenzeStorichePersonaliData, error: presenzeStorichePersonaliError } =
        await supabase
          .from('tbpresenze_dipendenti')
          .select(\`
            id,
            studio_id,
            utente_id,
            data_presenza,
            codice_presenza,
            note,
            inserito_da,
            richiesta_ferie_permessi_id,
            generata_da_richiesta_ferie_permessi
          \`)
          .eq('studio_id', typedUser.studio_id)
          .eq('utente_id', typedUser.id)
          .gte('data_presenza', progressiveStartDate)
          .lte('data_presenza', endDate);

      if (presenzeStorichePersonaliError) throw presenzeStorichePersonaliError;

      const presenzePerRiepilogo = [
        ...((presenzeStorichePersonaliData ?? []) as Presenza[]),
        ...((presenzeData ?? []) as Presenza[]),
      ];

      const loadedValues: Record<string, string> = {};`,
    "storico personale"
  );

  replaceOnce(
`(presenzeData ?? []).forEach((presence: Presenza) => {`,
`presenzePerRiepilogo.forEach((presence: Presenza) => {`,
    "merge presenze storico"
  );
}

// Riepilogo progressivo personale: mesi precedenti + mese selezionato = totale usufruito.
const riepilogoStart = source.indexOf("  const riepilogoPermessi = useMemo(() => {");
const riepilogoEnd = source.indexOf("const validateRequiredWorkdays", riepilogoStart);

if (riepilogoStart === -1 || riepilogoEnd === -1) {
  throw new Error("[presenze-progressivo] Blocco riepilogo non trovato");
}

const riepilogoProgressivo = `  const riepilogoPermessi = useMemo(() => {
    const totale = {
      pRichiesto: 0,
      pMese: 0,
      pTotale: 0,
      pfRichiesto: 0,
      pfMese: 0,
      pfTotale: 0,
      l104Richiesto: 0,
      l104Mese: 0,
      l104Totale: 0,
      alRichiesto: 0,
      alMese: 0,
      alTotale: 0,
      ferieRichieste: 0,
      feriePrese: 0,
      ferieTotali: 0,
    };

    if (!currentUser?.id) return totale;

    const progressiveStartDate = toDateKey(MIN_YEAR, MIN_MONTH_INDEX, 1);

    Object.entries(values).forEach(([key, code]) => {
      const separatorIndex = key.indexOf('|');
      if (separatorIndex === -1) return;

      const utenteId = key.slice(0, separatorIndex);
      const data = key.slice(separatorIndex + 1);

      if (utenteId !== currentUser.id) return;
      if (data < progressiveStartDate || data > endDate) return;

      const summary = summarize([code]);
      const isMeseSelezionato = data >= startDate;

      if (isMeseSelezionato) {
        totale.pMese += summary.permessiOre;
        totale.pfMese += summary.permessiPfOre;
        totale.l104Mese += summary.permessi104Ore;
        totale.alMese += summary.allattamentoOre;
        totale.feriePrese += summary.ferie;
      } else {
        totale.pRichiesto += summary.permessiOre;
        totale.pfRichiesto += summary.permessiPfOre;
        totale.l104Richiesto += summary.permessi104Ore;
        totale.alRichiesto += summary.allattamentoOre;
        totale.ferieRichieste += summary.ferie;
      }
    });

    totale.pTotale = totale.pRichiesto + totale.pMese;
    totale.pfTotale = totale.pfRichiesto + totale.pfMese;
    totale.l104Totale = totale.l104Richiesto + totale.l104Mese;
    totale.alTotale = totale.alRichiesto + totale.alMese;
    totale.ferieTotali = totale.ferieRichieste + totale.feriePrese;

    return totale;
  }, [currentUser?.id, endDate, startDate, values]);

`;

source = `${source.slice(0, riepilogoStart)}${riepilogoProgressivo}${source.slice(riepilogoEnd)}`;

function cardMarkup({
  title,
  tone,
  pastExpr,
  monthExpr,
  totalExpr,
  suffix = "",
}) {
  return `                <div className="min-w-[175px] rounded-lg border border-${tone}-200 bg-${tone}-50 px-3 py-2 shadow-sm">
                  <div className="text-xs font-semibold text-${tone}-900">${title}</div>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[9px] uppercase leading-tight text-${tone}-700">Già richiesti</div>
                      <div className="text-sm font-bold text-${tone}-950">{${pastExpr}}${suffix}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] uppercase leading-tight text-${tone}-700">In corso</div>
                      <div className="text-sm font-bold text-${tone}-950">{${monthExpr}}${suffix}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase leading-tight text-${tone}-700">Tot. usufruiti</div>
                      <div className="text-sm font-bold text-${tone}-950">{${totalExpr}}${suffix}</div>
                    </div>
                  </div>
                </div>`;
}

function replaceCard(title, replacement, isLast = false) {
  const titleNeedle = `>${title}</div>`;
  const titleIndex = source.indexOf(titleNeedle);
  if (titleIndex === -1) {
    throw new Error(`[presenze-progressivo] Card non trovata: ${title}`);
  }

  const start = source.lastIndexOf('                <div className="min-w-[150px]', titleIndex);
  if (start === -1) {
    throw new Error(`[presenze-progressivo] Inizio card non trovato: ${title}`);
  }

  let end;
  if (isLast) {
    end = source.indexOf(
      '\n              </div>\n\n              <div className="flex flex-wrap items-end gap-3 xl:ml-auto">',
      titleIndex,
    );
  } else {
    end = source.indexOf('\n\n                <div className="min-w-[150px]', titleIndex);
  }

  if (end === -1) {
    throw new Error(`[presenze-progressivo] Fine card non trovata: ${title}`);
  }

  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

if (!source.includes("Tot. usufruiti")) {
  replaceCard(
    "Permesso P",
    cardMarkup({
      title: "Permesso P",
      tone: "orange",
      pastExpr: "formatHoursMinutes(riepilogoPermessi.pRichiesto)",
      monthExpr: "formatHoursMinutes(riepilogoPermessi.pMese)",
      totalExpr: "formatHoursMinutes(riepilogoPermessi.pTotale)",
    }),
  );

  replaceCard(
    "Permesso PF",
    cardMarkup({
      title: "Permesso PF",
      tone: "amber",
      pastExpr: "formatHoursMinutes(riepilogoPermessi.pfRichiesto)",
      monthExpr: "formatHoursMinutes(riepilogoPermessi.pfMese)",
      totalExpr: "formatHoursMinutes(riepilogoPermessi.pfTotale)",
    }),
  );

  replaceCard(
    "Permesso L.104",
    cardMarkup({
      title: "Permesso L.104",
      tone: "pink",
      pastExpr: "formatHoursMinutes(riepilogoPermessi.l104Richiesto)",
      monthExpr: "formatHoursMinutes(riepilogoPermessi.l104Mese)",
      totalExpr: "formatHoursMinutes(riepilogoPermessi.l104Totale)",
    }),
  );

  replaceCard(
    "Allattamento AL",
    cardMarkup({
      title: "Allattamento AL",
      tone: "teal",
      pastExpr: "formatHoursMinutes(riepilogoPermessi.alRichiesto)",
      monthExpr: "formatHoursMinutes(riepilogoPermessi.alMese)",
      totalExpr: "formatHoursMinutes(riepilogoPermessi.alTotale)",
    }),
  );

  replaceCard(
    "Ferie",
    cardMarkup({
      title: "Ferie",
      tone: "sky",
      pastExpr: "riepilogoPermessi.ferieRichieste",
      monthExpr: "riepilogoPermessi.feriePrese",
      totalExpr: "riepilogoPermessi.ferieTotali",
      suffix: " gg",
    }),
    true,
  );
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Presenze: riepilogo personale progressivo per mesi precedenti, mese in corso e totale usufruito");
