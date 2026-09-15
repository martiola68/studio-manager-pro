import fs from "node:fs";

const filePath = "src/pages/clienti/index.tsx";
let source = fs.readFileSync(filePath, "utf8");

const startMarker = '{/* RIFERIMENTI */}';
const endMarker = '{/* COMUNICAZIONI */}';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);

if (start === -1 || end === -1 || end <= start) {
  throw new Error("[clienti-riferimenti-ordine-nome] Sezione RIFERIMENTI non trovata");
}

const before = source.slice(0, start);
let section = source.slice(start, end);
const after = source.slice(end);

const cognomeNomeA = '${safeString(a.cognome)} ${safeString(a.nome)}';
const nomeCognomeA = '${safeString(a.nome)} ${safeString(a.cognome)}';
const cognomeNomeB = '${safeString(b.cognome)} ${safeString(b.nome)}';
const nomeCognomeB = '${safeString(b.nome)} ${safeString(b.cognome)}';

const countA = section.split(cognomeNomeA).length - 1;
const countB = section.split(cognomeNomeB).length - 1;

if (countA !== 4 || countB !== 4) {
  throw new Error(
    `[clienti-riferimenti-ordine-nome] Attese 4 select da correggere, trovate A=${countA}, B=${countB}`
  );
}

section = section
  .split(cognomeNomeA).join(nomeCognomeA)
  .split(cognomeNomeB).join(nomeCognomeB);

source = before + section + after;
fs.writeFileSync(filePath, source, "utf8");

console.log("✓ Clienti/Riferimenti: Utente Fiscale, Professionista Fiscale, Utente Payroll e Professionista Payroll ordinati per Nome crescente");
