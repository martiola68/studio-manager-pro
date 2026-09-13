import fs from "node:fs";

const file = "src/components/controllo-gestione/RedditivitaClientiTab.tsx";
let source = fs.readFileSync(file, "utf8");

if (!source.includes("function apriNuovoServizio()")) {
  const anchor = "  async function salvaServizio() {";
  if (!source.includes(anchor)) throw new Error("Anchor salvaServizio non trovato");
  source = source.replace(
    anchor,
    `  function apriNuovoServizio() {\n    setServiceDraft({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 3 });\n    setMessage("");\n    setShowServiceForm(true);\n  }\n\n${anchor}`
  );
}

source = source.replaceAll(
  "onClick={() => setShowServiceForm(true)}",
  "onClick={apriNuovoServizio}"
);

// Dopo un salvataggio la bozza torna sempre allo stato standard, mai ai valori precedenti.
source = source.replaceAll(
  'setServiceDraft({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 1 })',
  'setServiceDraft({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 3 })'
);

// Nei form di nuovo servizio lo zero iniziale deve apparire vuoto, non come valore precompilato.
source = source.replaceAll(
  'value={Number.isFinite(value) ? Math.trunc(value) : 0}',
  'value={Number.isFinite(value) && value > 0 ? Math.trunc(value) : ""}'
);
source = source.replaceAll(
  'value={Number.isFinite(value) ? value : 0}',
  'value={Number.isFinite(value) && value > 0 ? value : ""}'
);

fs.writeFileSync(file, source, "utf8");
console.log("✓ Nuovo servizio Redditività: form sempre azzerato all'apertura");
