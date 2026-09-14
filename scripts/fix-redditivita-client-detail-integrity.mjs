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
  // La colonna non è un prezzo cliente: è il costo interno dello studio.
  source = source.replaceAll(
    '<th className="px-3 py-3 text-right">Costo</th>',
    '<th className="px-3 py-3 text-right">Costo interno / tariffa</th>'
  );

  // Garantisce il calcolo della tariffa sulla singola riga anche se una patch
  // precedente non è riuscita ad agganciarsi al markup finale.
  if (!source.includes('const tariffa = prezzoListinoServizio(servizio);')) {
    source = source.replace(
      '  const rip = (servizio.ripartizione || []).reduce((s, x) => s + n(x.percentuale_ripartizione_attivita), 0);',
      '  const rip = (servizio.ripartizione || []).reduce((s, x) => s + n(x.percentuale_ripartizione_attivita), 0);\n  const tariffa = prezzoListinoServizio(servizio);'
    );
  }

  const baseCostCell = '<td className="px-3 py-3 text-right font-semibold">{euro(servizio.costo_stimato)}</td>';
  const richCostCell = '<td className="px-3 py-3 text-right"><div className="font-semibold">Costo {euro(servizio.costo_stimato)}</div>{tariffa.incluso_gruppo ? <div className="mt-0.5 text-[11px] font-medium text-sky-700">Tariffa gruppo {tariffa.gruppo}: {euro(tariffa.minimo)}–{euro(tariffa.massimo)} · prevista {euro(tariffa.prezzo)}</div> : tariffa.trovato ? <div className="mt-0.5 text-[11px] font-medium text-sky-700">Tariffa {euro(tariffa.minimo)}–{euro(tariffa.massimo)} · prevista {euro(tariffa.prezzo)}</div> : <div className="mt-0.5 text-[11px] text-slate-400">Listino non configurato</div>}</td>';

  if (source.includes(baseCostCell)) {
    source = source.replaceAll(baseCostCell, richCostCell);
  } else {
    // Sostituisce anche la variante già arricchita dalla patch listino precedente.
    source = source.replace(
      /<td className="px-3 py-3 text-right"><div className="font-semibold">\{euro\(servizio\.costo_stimato\)\}<\/div>\{tariffa[\s\S]*?<\/td>/,
      richCostCell
    );
  }

  source = source.replaceAll("Nessun operatore in anagrafica", "Nessun operatore associato");

  return source;
});

console.log("✓ Redditività Clienti: ripristinati operatore per servizio e visibilità tariffa listino");
