import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

// Redditività Studio è ora una funzione autonoma di "Archivi di base > Economia dello Studio".
// Rimuove soltanto l'eventuale vecchia voce operativa dal menu Controllo di gestione.
// Il manuale /guide/redditivita-studio resta invariato.
const legacyItem = `        { label: "Redditività Studio", href: "/controllo-gestione/redditivita-studio", icon: <BarChart3 className="h-4 w-4" /> },\n`;
source = source.replace(legacyItem, "");

fs.writeFileSync(path, source, "utf8");
console.log("✓ Redditività Studio gestita in Archivi di base > Economia dello Studio");
