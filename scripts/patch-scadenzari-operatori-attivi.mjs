import fs from "node:fs";
import path from "node:path";

const root = "src/pages/scadenze";

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return /\.(tsx|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

const files = collectFiles(root);
let filesTouched = 0;
let queriesPatched = 0;
let queriesAlreadyFiltered = 0;
let operatorPages = 0;

for (const filePath of files) {
  let source = fs.readFileSync(filePath, "utf8");

  // Interveniamo solo nelle pagine che espongono un filtro operatore.
  if (!/filterOperatore|filtroOperatore|Utente Operatore/.test(source)) continue;
  operatorPages += 1;

  const original = source;
  const fromUtenti = /\.from\(\s*["']tbutenti["'](?:\s+as\s+any)?\s*\)/g;
  const matches = Array.from(source.matchAll(fromUtenti)).reverse();

  for (const match of matches) {
    const start = match.index;
    if (start == null) continue;

    // Una query Supabase termina al primo punto e virgola: lavoriamo solo sulla singola chain.
    const tail = source.slice(start);
    const semicolonOffset = tail.indexOf(";");
    if (semicolonOffset === -1) continue;

    const end = start + semicolonOffset;
    const chain = source.slice(start, end);

    // Le query puntuali dell'utente loggato non sono liste da usare nei filtri.
    if (/\.maybeSingle\s*\(|\.single\s*\(/.test(chain)) continue;

    // La lista operatori degli scadenzari è ordinata per nome/cognome.
    const orderMatch = chain.match(/\n(\s*)\.order\(\s*["'](?:nome|cognome)["']/);
    if (!orderMatch || orderMatch.index == null) continue;

    if (/\.eq\(\s*["']attivo["']\s*,\s*true\s*\)/.test(chain)) {
      queriesAlreadyFiltered += 1;
      continue;
    }

    const insertionPoint = start + orderMatch.index;
    const indent = orderMatch[1] || "      ";
    source =
      source.slice(0, insertionPoint) +
      `\n${indent}.eq("attivo", true)` +
      source.slice(insertionPoint);

    queriesPatched += 1;
  }

  if (source !== original) {
    fs.writeFileSync(filePath, source, "utf8");
    filesTouched += 1;
    console.log(`✓ ${filePath}`);
  }
}

if (operatorPages === 0) {
  throw new Error("[scadenzari-operatori-attivi] Nessuna pagina con filtro operatore trovata");
}

if (queriesPatched + queriesAlreadyFiltered === 0) {
  throw new Error(
    "[scadenzari-operatori-attivi] Nessuna lista tbutenti del filtro operatore trovata"
  );
}

console.log(
  `✓ Scadenzari: filtri operatore limitati agli utenti attivi (${filesTouched} file modificati, ${queriesPatched} query aggiornate, ${queriesAlreadyFiltered} già corrette)`
);
