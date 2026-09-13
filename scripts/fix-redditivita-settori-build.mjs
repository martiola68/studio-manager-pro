import fs from "node:fs";

const file = "src/components/controllo-gestione/RedditivitaClientiTab.tsx";
let source = fs.readFileSync(file, "utf8");

// 1) Dedupe delle proprietà del type Cliente introdotte da patch successive.
source = source.replace(/type Cliente = \{[\s\S]*?\n\};/, (block) => {
  const seen = new Set();
  const keysToDedupe = new Set([
    "utente_operatore_id",
    "utente_payroll_id",
    "operatore_nome",
    "settori_cliente",
    "operatori_settore",
    "metriche_settore",
  ]);

  return block
    .split("\n")
    .filter((line) => {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\??:/);
      if (!match) return true;
      const key = match[1];
      if (!keysToDedupe.has(key)) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
});

// 2) La patch settoriale sostituisce il blocco tra attivitaDisponibili e salvaServizio.
// Ripristiniamo quindi l'helper creato dalla patch nuovo-servizio se il bottone lo richiama.
if (source.includes("onClick={apriNuovoServizio}") && !source.includes("function apriNuovoServizio()")) {
  const anchor = "  async function salvaServizio() {";
  if (!source.includes(anchor)) throw new Error("[fix-redditivita-settori-build] salvaServizio non trovato");
  source = source.replace(
    anchor,
    `  function apriNuovoServizio() {\n    setServiceDraft({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 3 });\n    setMessage("");\n    setShowServiceForm(true);\n  }\n\n${anchor}`
  );
}

fs.writeFileSync(file, source, "utf8");
console.log("✓ Redditività settori: dedupe Cliente e helper nuovo servizio ripristinati");
