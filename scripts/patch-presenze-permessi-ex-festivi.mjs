import fs from "node:fs";

const path = "src/pages/presenze/index.tsx";
let source = fs.readFileSync(path, "utf8");

function patchRiepilogoPersonale() {
  const blockStart = source.indexOf("  const riepilogoPermessi = useMemo(() => {");
  const blockEnd = source.indexOf("const validateRequiredWorkdays", blockStart);

  if (blockStart === -1 || blockEnd === -1) {
    return false;
  }

  let block = source.slice(blockStart, blockEnd);
  let changed = false;

  const dipendentiAggregati = "    dipendenti.forEach((dipendente) => {";
  const dipendenteLoggato = `    dipendenti
      .filter((dipendente) => dipendente.utente_id === currentUser?.id)
      .forEach((dipendente) => {`;

  if (block.includes(dipendentiAggregati)) {
    block = block.replace(dipendentiAggregati, dipendenteLoggato);
    changed = true;
  }

  const richiesteAggregate = "    richiesteFeriePermessi.forEach((richiesta) => {";
  const richiesteLoggato = `    richiesteFeriePermessi
      .filter((richiesta) => richiesta.utente_id === currentUser?.id)
      .forEach((richiesta) => {`;

  if (block.includes(richiesteAggregate)) {
    block = block.replace(richiesteAggregate, richiesteLoggato);
    changed = true;
  }

  const depsAggregate = "  }, [days, dipendenti, richiesteFeriePermessi, values]);";
  const depsPersonali = "  }, [currentUser?.id, days, dipendenti, richiesteFeriePermessi, values]);";

  if (block.includes(depsAggregate)) {
    block = block.replace(depsAggregate, depsPersonali);
    changed = true;
  }

  if (changed) {
    source = `${source.slice(0, blockStart)}${block}${source.slice(blockEnd)}`;
  }

  return changed;
}

// Il sorgente aggiornato gestisce PF direttamente. In questo caso la vecchia patch
// non deve cercare gli anchor legacy; normalizziamo solo l'eventuale blocco export
// e rendiamo personale il riepilogo ferie/permessi delle card.
if (source.includes("permessiPfOre") || source.includes("isPermessoPfCode")) {
  let changed = false;

  const brokenExportGrouping = `        if (!acc[codiceDitta]) acc[codiceDitta].push(dipendente);`;
  const fixedExportGrouping = `        if (!acc[codiceDitta]) acc[codiceDitta] = [];
        acc[codiceDitta].push(dipendente);`;

  if (source.includes(brokenExportGrouping)) {
    source = source.replace(brokenExportGrouping, fixedExportGrouping);
    changed = true;
  }

  if (patchRiepilogoPersonale()) {
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(path, source, "utf8");
    console.log("✓ Presenze: PF compatibile e card riepilogo limitate al dipendente loggato");
  } else {
    console.log("✓ Presenze PF e riepilogo personale già applicati");
  }

  process.exit(0);
}

if (source.includes("permessiExFestiviOre")) {
  if (patchRiepilogoPersonale()) {
    fs.writeFileSync(path, source, "utf8");
    console.log("✓ Presenze PF già applicati; card riepilogo limitate al dipendente loggato");
  } else {
    console.log("✓ Presenze PF e riepilogo personale già applicati");
  }
  process.exit(0);
}

function replaceOnce(oldValue, newValue, label) {
  if (!source.includes(oldValue)) {
    throw new Error(`[presenze-pf] Anchor non trovato: ${label}`);
  }
  source = source.replace(oldValue, newValue);
}

replaceOnce(
`  permessiOre: number;
  allattamentoOre: number;`,
`  permessiOre: number;
  permessiExFestiviOre: number;
  allattamentoOre: number;`,
"RowSummary PF"
);

replaceOnce(
`function isPermesso104Code(code: string) {
  return /^P\\d+(\\.\\d+)?\\.104$/.test(code);
}

function getPermessoHours(code: string) {
  return Number(code.replace('P', '').replace('.104', ''));
}`,
`function isPermesso104Code(code: string) {
  return /^P\\d+(\\.\\d+)?\\.104$/.test(code);
}

function isPermessoExFestivoCode(code: string) {
  return /^PF\\d+(\\.\\d+)?$/.test(code);
}

function getPermessoHours(code: string) {
  return Number(code.replace(/^PF?/, '').replace('.104', ''));
}`,
"helper PF"
);

replaceOnce(
`function buildQuarterHourCodes(suffix = '') {
  const codes: string[] = [];

  for (let minutes = 15; minutes <= 8 * 60; minutes += 15) {
    const hours = minutes / 60;
    codes.push(\`P\${formatHours(hours)}\${suffix}\`);
  }

  return codes;
}`,
`function buildQuarterHourCodes(suffix = '', prefix = 'P') {
  const codes: string[] = [];

  for (let minutes = 15; minutes <= 8 * 60; minutes += 15) {
    const hours = minutes / 60;
    codes.push(\`\${prefix}\${formatHours(hours)}\${suffix}\`);
  }

  return codes;
}`,
"builder PF"
);

replaceOnce(
`function getCellClass(code: string) {
  if (isPermesso104Code(code)) return 'bg-pink-100 text-pink-800 border-pink-200';
  if (isPermessoCode(code)) return 'bg-orange-100 text-orange-800 border-orange-200';`,
`function getCellClass(code: string) {
  if (isPermesso104Code(code)) return 'bg-pink-100 text-pink-800 border-pink-200';
  if (isPermessoExFestivoCode(code)) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (isPermessoCode(code)) return 'bg-orange-100 text-orange-800 border-orange-200';`,
"colore PF"
);

replaceOnce(
`      if (isPermessoCode(code)) acc.permessiOre += getPermessoHours(code);
      if (isPermesso104Code(code)) acc.permessi104Ore += getPermessoHours(code);`,
`      if (isPermessoCode(code)) acc.permessiOre += getPermessoHours(code);
      if (isPermessoExFestivoCode(code)) acc.permessiExFestiviOre += getPermessoHours(code);
      if (isPermesso104Code(code)) acc.permessi104Ore += getPermessoHours(code);`,
"somma PF"
);

replaceOnce(
`      permessiOre: 0,
      permessi104Ore: 0,`,
`      permessiOre: 0,
      permessiExFestiviOre: 0,
      permessi104Ore: 0,`,
"default PF"
);

replaceOnce(
`  if (isPermessoCode(code) || isPermesso104Code(code)) {
    return getPermessoHours(code);
  }`,
`  if (isPermessoCode(code) || isPermessoExFestivoCode(code) || isPermesso104Code(code)) {
    return getPermessoHours(code);
  }`,
"ore PF"
);

replaceOnce(
`    const quarterHourPermessi = buildQuarterHourCodes();
    const quarterHourPermessi104 = buildQuarterHourCodes('.104');`,
`    const quarterHourPermessi = buildQuarterHourCodes();
    const quarterHourPermessiExFestivi = buildQuarterHourCodes('', 'PF');
    const quarterHourPermessi104 = buildQuarterHourCodes('.104');`,
"codici PF"
);

replaceOnce(
`      ...quarterHourPermessi,
      ...quarterHourPermessi104,`,
`      ...quarterHourPermessi,
      ...quarterHourPermessiExFestivi,
      ...quarterHourPermessi104,`,
"ordine PF"
);

replaceOnce(
`                <Badge className="border bg-orange-100 text-orange-800 hover:bg-orange-100">
                  P0.25-P8 permessi
                </Badge>
                <Badge className="border bg-teal-100 text-teal-800 hover:bg-teal-100">`,
`                <Badge className="border bg-orange-100 text-orange-800 hover:bg-orange-100">
                  P0.25-P8 permessi
                </Badge>
                <Badge className="border bg-amber-100 text-amber-800 hover:bg-amber-100">
                  PF0.25-PF8 ex-festivi
                </Badge>
                <Badge className="border bg-teal-100 text-teal-800 hover:bg-teal-100">`,
"legenda PF"
);

replaceOnce(
`  (es. <strong>P2</strong>, <strong>P4</strong>, <strong>P1.104</strong>,
  <strong> AL1</strong>, <strong>AL2</strong>).`,
`  (es. <strong>P2</strong>, <strong>P4</strong>, <strong>PF1.25</strong>, <strong>P1.104</strong>,
  <strong> AL1</strong>, <strong>AL2</strong>).`,
"esempio PF"
);

replaceOnce(
`      gridTemplateColumns: \`220px repeat(\${days.length + 8}, 88px)\`,`,
`      gridTemplateColumns: \`220px repeat(\${days.length + 9}, 88px)\`,`,
"colonna PF"
);

replaceOnce(
`   { top: 'Tot.', bottom: 'Perm.' },
  { top: 'Tot.', bottom: 'AL' },`,
`   { top: 'Tot.', bottom: 'Perm.' },
  { top: 'Tot.', bottom: 'PF' },
  { top: 'Tot.', bottom: 'AL' },`,
"header totale PF"
);

replaceOnce(
`<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-orange-100 font-bold text-orange-900">
    {formatHoursMinutes(summary.permessiOre)}
  </div>
</div>

          <div className="border-b p-1 text-center">`,
`<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-orange-100 font-bold text-orange-900">
    {formatHoursMinutes(summary.permessiOre)}
  </div>
</div>

<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-amber-100 font-bold text-amber-900">
    {formatHoursMinutes(summary.permessiExFestiviOre)}
  </div>
</div>

          <div className="border-b p-1 text-center">`,
"totale PF"
);

patchRiepilogoPersonale();

fs.writeFileSync(path, source, "utf8");
console.log("✓ Presenze: aggiunti PF0.25-PF8, totale PF separato e riepilogo personale");
