import fs from "node:fs";

const file = "src/pages/controllo-gestione/redditivita-studio.tsx";
let src = fs.readFileSync(file, "utf8");

const importLine = 'import RedditivitaClientiTab from "@/components/controllo-gestione/RedditivitaClientiTab";';
if (!src.includes(importLine)) {
  const anchor = 'import { getStudioId } from "@/lib/getStudioId";';
  if (!src.includes(anchor)) throw new Error("Anchor getStudioId non trovato in redditivita-studio.tsx");
  src = src.replace(anchor, `${anchor}\n${importLine}`);
}

const oldBlock = '{tab === "clienti" && <EmptyWorkspace title="Analisi economica clienti" text="Per ogni cliente attiveremo solo i servizi realmente svolti, inclusi bilancio, dichiarazioni e consulenza anche quando la contabilità è interna." columns={["Cliente", "Servizi", "Ore equivalenti", "Costo", "Compenso attuale", "Compenso obiettivo", "Margine"]} />}';
const newBlock = '{tab === "clienti" && <RedditivitaClientiTab studioId={studioId} anno={anno} />}';

if (!src.includes(newBlock)) {
  if (!src.includes(oldBlock)) throw new Error("Blocco Clienti legacy non trovato in redditivita-studio.tsx");
  src = src.replace(oldBlock, newBlock);
}

fs.writeFileSync(file, src);
console.log("Patched Redditivita Studio Clienti tab");
