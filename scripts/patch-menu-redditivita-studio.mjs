import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

const anchor = `{ label: "Importa contabilità", href: "/controllo-gestione/import-contabilita", icon: <RefreshCcw className="h-4 w-4" /> },`;
const item = `{ label: "Redditività Studio", href: "/controllo-gestione/redditivita-studio", icon: <BarChart3 className="h-4 w-4" /> },`;

if (!source.includes(item)) {
  if (!source.includes(anchor)) throw new Error("Anchor menu Controllo di gestione non trovato");
  source = source.replace(anchor, `${anchor}\n        ${item}`);
}

if (!source.includes('/controllo-gestione/redditivita-studio')) {
  throw new Error("Voce Redditività Studio non applicata");
}

fs.writeFileSync(path, source, "utf8");
console.log("Menu Controllo di gestione: Redditività Studio aggiunta");
