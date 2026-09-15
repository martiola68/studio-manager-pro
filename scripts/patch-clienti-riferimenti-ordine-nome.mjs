import fs from "node:fs";

const filePath = "src/pages/clienti/index.tsx";
let source = fs.readFileSync(filePath, "utf8");

const startMarker = '{/* RIFERIMENTI */}';
const contactMarker = '<Label htmlFor="contatto1_id">Contatto 1</Label>';

const start = source.indexOf(startMarker);
const contact = source.indexOf(contactMarker, start + startMarker.length);

if (start === -1 || contact === -1 || contact <= start) {
  throw new Error(
    "[clienti-riferimenti-ordine-nome] Blocco delle quattro select RIFERIMENTI non trovato"
  );
}

const before = source.slice(0, start);
let targetSection = source.slice(start, contact);
const after = source.slice(contact);

const cognomeNomeA = '${safeString(a.cognome)} ${safeString(a.nome)}';
const nomeCognomeA = '${safeString(a.nome)} ${safeString(a.cognome)}';
const cognomeNomeB = '${safeString(b.cognome)} ${safeString(b.nome)}';
const nomeCognomeB = '${safeString(b.nome)} ${safeString(b.cognome)}';

const oldA = targetSection.split(cognomeNomeA).length - 1;
const oldB = targetSection.split(cognomeNomeB).length - 1;
const newA = targetSection.split(nomeCognomeA).length - 1;
const newB = targetSection.split(nomeCognomeB).length - 1;

// Le quattro select interessate sono:
// Utente Fiscale, Professionista Fiscale, Utente Payroll, Professionista Payroll.
// Contatto 1 resta volutamente fuori da questo blocco.
if (oldA === 4 && oldB === 4) {
  targetSection = targetSection
    .split(cognomeNomeA).join(nomeCognomeA)
    .split(cognomeNomeB).join(nomeCognomeB);
} else if (oldA === 0 && oldB === 0 && newA === 4 && newB === 4) {
  // Ordinamento già applicato: build idempotente.
} else {
  throw new Error(
    `[clienti-riferimenti-ordine-nome] Stato inatteso nelle quattro select: oldA=${oldA}, oldB=${oldB}, newA=${newA}, newB=${newB}`
  );
}

const activeFilter = '.filter((utente) => utente.attivo === true)';
const activeFilterCount = targetSection.split(activeFilter).length - 1;

if (activeFilterCount === 0) {
  let replacements = 0;
  targetSection = targetSection.replace(
    /(\n\s*)\.slice\(\)(\n\s*)\.sort\(/g,
    (_match, beforeSlice, beforeSort) => {
      replacements += 1;
      return `${beforeSlice}${activeFilter}${beforeSlice}.slice()${beforeSort}.sort(`;
    }
  );

  if (replacements !== 4) {
    throw new Error(
      `[clienti-riferimenti-ordine-nome] Attese 4 select da filtrare per utenti attivi, trovate ${replacements}`
    );
  }
} else if (activeFilterCount !== 4) {
  throw new Error(
    `[clienti-riferimenti-ordine-nome] Stato inatteso filtro utenti attivi: trovati ${activeFilterCount} filtri`
  );
}

source = before + targetSection + after;
fs.writeFileSync(filePath, source, "utf8");

console.log(
  "✓ Clienti/Riferimenti: 4 select ordinate per Nome crescente e limitate agli utenti attivi; Contatto 1 invariato"
);
