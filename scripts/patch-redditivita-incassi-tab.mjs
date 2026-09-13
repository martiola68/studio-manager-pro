import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "src/pages/controllo-gestione/redditivita-studio.tsx");
let source = fs.readFileSync(file, "utf8");

const importAnchor = 'import RedditivitaCompensiTab from "@/components/controllo-gestione/RedditivitaCompensiTab";';
const importLine = 'import RedditivitaIncassiTab from "@/components/controllo-gestione/RedditivitaIncassiTab";';

if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error("Import anchor RedditivitaCompensiTab non trovato");
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const oldBlock = '{tab === "incassi" && <EmptyWorkspace title="Piano fatturazione e incassi" text="Rate mensili, trimestrali o personalizzate e stato previsto, fatturato, incassato o scaduto." columns={["Cliente", "Scadenza", "Importo", "Fatturazione", "Stato", "Incassato il"]} />}';
const newBlock = '{tab === "incassi" && <RedditivitaIncassiTab studioId={studioId} anno={anno} />}';

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) throw new Error("Blocco tab Incassi legacy non trovato");
  source = source.replace(oldBlock, newBlock);
}

fs.writeFileSync(file, source);
console.log("✓ Redditivita Studio Incassi tab patched");
