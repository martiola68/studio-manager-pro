import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "src/pages/controllo-gestione/redditivita-studio.tsx");
let s = fs.readFileSync(file, "utf8");

if (!s.includes('import RedditivitaCompensiTab from "@/components/controllo-gestione/RedditivitaCompensiTab";')) {
  const marker = 'import { getStudioId } from "@/lib/getStudioId";';
  if (!s.includes(marker)) throw new Error("Import marker not found for RedditivitaCompensiTab");
  s = s.replace(marker, `${marker}\nimport RedditivitaCompensiTab from "@/components/controllo-gestione/RedditivitaCompensiTab";`);
}

const oldBlock = '{tab === "contratti" && <EmptyWorkspace title="Compensi e contratti" text="Il compenso tecnico sarà trasformato in contratto forfettario, analitico o misto." columns={["Cliente", "Costo", "Compenso consigliato", "Tipo contratto", "Totale annuo", "Scostamento"]} />}';
const newBlock = '{tab === "contratti" && <RedditivitaCompensiTab studioId={studioId} anno={anno} />}';

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
} else if (!s.includes(newBlock)) {
  throw new Error("Compensi tab marker not found");
}

fs.writeFileSync(file, s);
console.log("✓ Redditivita Studio Compensi tab wired");
