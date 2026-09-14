import fs from "node:fs";

function patch(file, fn) {
  const source = fs.readFileSync(file, "utf8");
  const next = fn(source);
  fs.writeFileSync(file, next, "utf8");
  console.log(`✓ ${file}`);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  // La patch settoriale deve filtrare per id OPERATORE, non per id SERVIZIO.
  // Il replaceAll precedente trasformava anche cliente_servizio_id e svuotava
  // servizio.ripartizione, pur lasciando corretti i totali operatore in basso.
  source = source.replaceAll(
    'const key = String(r.cliente_servizio_id || "");\n          if (!key || !mappaSettoriCliente.idsAmmessi.has(key)) continue;',
    'const key = String(r.cliente_servizio_id || "");\n          if (!key) continue;'
  );

  // Il catalogo deve arrivare al dettaglio cliente con il listino persistito
  // (colonne dedicate oppure fallback nel campo note).
  if (source.includes("attivitaConListinoFallback")) {
    source = source.replaceAll(
      "const attivitaMap = new Map((attivitaResult.data || []).map((a: any) => [a.id, a]));",
      "const attivitaIdratate = (attivitaResult.data || []).map((a: any) => attivitaConListinoFallback(a));\n        const attivitaMap = new Map(attivitaIdratate.map((a: any) => [a.id, a]));"
    );
    source = source.replaceAll(
      "attivita: attivitaResult.data || [],",
      "attivita: (attivitaResult.data || []).map((a: any) => attivitaConListinoFallback(a)),"
    );
  }

  return source;
});

patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  // Difesa: il componente finale deve sempre avere il motore tariffario disponibile.
  if (!source.includes('prezzoListinoServizio') || !source.includes('calcolaEconomiaListino')) {
    source = source.replace(
      'import { Plus, Save, Trash2, X } from "lucide-react";',
      'import { Plus, Save, Trash2, X } from "lucide-react";\nimport { calcolaEconomiaListino, prezzoListinoServizio } from "@/lib/redditivita-listino";'
    );
  }

  // La colonna costo non deve confondere costo industriale e tariffa professionale.
  source = source.replaceAll(
    '<th className="px-3 py-3 text-right">Costo</th>',
    '<th className="px-3 py-3 text-right">Costo interno</th><th className="px-3 py-3 text-right">Listino min–max</th><th className="px-3 py-3 text-right">Ricavo da difficoltà</th>'
  );
  source = source.replaceAll(
    '<th className="px-3 py-3 text-right">Costo interno / tariffa</th>',
    '<th className="px-3 py-3 text-right">Costo interno</th><th className="px-3 py-3 text-right">Listino min–max</th><th className="px-3 py-3 text-right">Ricavo da difficoltà</th>'
  );

  // Garantisce il calcolo tariffario sulla singola riga.
  if (!source.includes('const tariffa = prezzoListinoServizio(servizio);')) {
    source = source.replace(
      '  const rip = (servizio.ripartizione || []).reduce((s, x) => s + n(x.percentuale_ripartizione_attivita), 0);',
      '  const rip = (servizio.ripartizione || []).reduce((s, x) => s + n(x.percentuale_ripartizione_attivita), 0);\n  const tariffa = prezzoListinoServizio(servizio);'
    );
  }

  // Sostituisce in modo robusto QUALSIASI variante della cella costo generata
  // dalle patch precedenti con tre colonne distinte e leggibili.
  const costCellRegex = /<td[^>]*>[\s\S]*?\{euro\(servizio\.costo_stimato\)\}[\s\S]*?<\/td>/;
  const separateCells = '<td className="px-3 py-3 text-right font-semibold">{euro(servizio.costo_stimato)}</td><td className="px-3 py-3 text-right">{tariffa.trovato ? <><div className="font-semibold text-slate-900">{euro(tariffa.minimo)}–{euro(tariffa.massimo)}</div>{tariffa.incluso_gruppo && <div className="text-[11px] text-slate-500">Gruppo {tariffa.gruppo}</div>}</> : <span className="text-slate-400">—</span>}</td><td className="px-3 py-3 text-right font-semibold text-sky-800">{tariffa.trovato ? euro(tariffa.prezzo) : "—"}</td>';
  if (costCellRegex.test(source)) {
    source = source.replace(costCellRegex, separateCells);
  }

  // Le tre nuove colonne portano la tabella servizi da 8 a 10 colonne.
  source = source.replace(
    '<tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Nessun servizio configurato per questo cliente.</td></tr>',
    '<tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Nessun servizio configurato per questo cliente.</td></tr>'
  );

  source = source.replaceAll("Nessun operatore in anagrafica", "Nessun operatore associato");

  // Riepilogo: rendiamo visibili i tre passaggi economici separati.
  source = source.replaceAll(
    '<Summary label="Costo stimato" value={euro(totali.costo)} />',
    '<Summary label="Costo interno" value={euro(totali.costo)} /><Summary label="Listino minimo" value={euro(economiaSettore.listino_minimo)} /><Summary label="Listino da difficoltà" value={euro(economiaSettore.prezzo_listino)} /><Summary label="Minimo economico" value={euro(economiaSettore.minimo_economico)} />'
  );
  source = source.replaceAll(
    '<Summary label={`Costo ${settoreClienti}`} value={euro(riepilogoFiltrato.costo)} />',
    '<Summary label={`Costo interno ${settoreClienti}`} value={euro(riepilogoFiltrato.costo)} />'
  );
  source = source.replaceAll('grid gap-3 md:grid-cols-6', 'grid gap-3 md:grid-cols-3 xl:grid-cols-9');

  // Formula esplicita: il listino non modifica il costo interno.
  const formulaMarker = '<strong>Formula costo stimato:</strong> ore equivalenti × costo orario pieno dello studio.';
  if (source.includes(formulaMarker) && !source.includes('Il listino non modifica il costo interno')) {
    source = source.replace(
      formulaMarker,
      '<strong>Costo interno:</strong> ore equivalenti × costo orario pieno dello studio. <strong>Il listino non modifica il costo interno:</strong> determina invece il prezzo/ricavo professionale.'
    );
  }

  return source;
});

console.log("✓ Redditività Clienti: costo interno separato da listino e ricavo da difficoltà");
