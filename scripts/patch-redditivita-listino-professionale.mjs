import fs from "node:fs";

function patch(file, fn) {
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${file}`);
}

patch("src/pages/api/controllo-gestione/redditivita-compensi.ts", (source) => {
  if (!source.includes('from "@/lib/redditivita-listino"')) {
    source = source.replace(
      'import { createClient } from "@supabase/supabase-js";',
      'import { createClient } from "@supabase/supabase-js";\nimport { calcolaEconomiaListino } from "@/lib/redditivita-listino";'
    );
  }

  source = source.replace(
    /function calcolaEconomia\(servizi: any\[\], margine: number\) \{[\s\S]*?\n\}/m,
    `function calcolaEconomia(servizi: any[], margine: number) {\n  return calcolaEconomiaListino(servizi, margine);\n}`
  );

  source = source.replace(
    '.select("id,codice,area,descrizione,driver,unita_misura")',
    '.select("id,codice,area,descrizione,driver,unita_misura")'
  );

  // Nello snapshot conserviamo anche il listino calcolato, utile per audit/storico.
  if (!source.includes('listino_minimo: economia.listino_minimo')) {
    source = source.replace(
      '            margine_obiettivo: margine,\n            servizi: servizi.map((s: any) => ({',
      '            margine_obiettivo: margine,\n            listino_minimo: economia.listino_minimo,\n            listino_massimo: economia.listino_massimo,\n            prezzo_listino: economia.prezzo_listino,\n            minimo_economico: economia.minimo_economico,\n            fuori_fascia: economia.fuori_fascia,\n            servizi: servizi.map((s: any) => ({'
    );
  }

  return source;
});

patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  if (!source.includes('from "@/lib/redditivita-listino"')) {
    source = source.replace(
      'import { Plus, Save, Trash2, X } from "lucide-react";',
      'import { Plus, Save, Trash2, X } from "lucide-react";\nimport { calcolaEconomiaListino, prezzoListinoServizio } from "@/lib/redditivita-listino";'
    );
  }

  // Il dettaglio cliente usa il nuovo listino e non il vecchio costo/(1-margine).
  if (!source.includes('const economiaSettore = useMemo')) {
    source = source.replace(
      '  const totali = useMemo(() => ({\n    operazioni: serviziSettore.reduce((s, x) => s + n(x.quantita_driver), 0),\n    ore: serviziSettore.reduce((s, x) => s + n(x.ore_equivalenti), 0),\n    costo: serviziSettore.reduce((s, x) => s + n(x.costo_stimato), 0),\n  }), [serviziSettore]);',
      '  const totali = useMemo(() => ({\n    operazioni: serviziSettore.reduce((s, x) => s + n(x.quantita_driver), 0),\n    ore: serviziSettore.reduce((s, x) => s + n(x.ore_equivalenti), 0),\n    costo: serviziSettore.reduce((s, x) => s + n(x.costo_stimato), 0),\n  }), [serviziSettore]);\n\n  const economiaSettore = useMemo(\n    () => calcolaEconomiaListino(serviziSettore, marginePercentuale),\n    [serviziSettore, marginePercentuale]\n  );'
    );
  }

  source = source.replace(
    '<Summary label="Ricavo stimato" value={euro(ricavoDaCosto(totali.costo))} />',
    '<Summary label="Listino minimo" value={euro(economiaSettore.listino_minimo)} />\n            <Summary label="Ricavo previsto" value={euro(economiaSettore.ricavo_previsto)} />'
  );
  source = source.replace(
    '<Summary label="Margine stimato" value={euro(ricavoDaCosto(totali.costo) - totali.costo)} />',
    '<Summary label="Margine previsto" value={euro(economiaSettore.margine_previsto)} />'
  );
  source = source.replace('md:grid-cols-5', 'md:grid-cols-6');

  // Se le card sono state già personalizzate da patch successive, sostituiamo i riferimenti residui.
  source = source.replaceAll('euro(ricavoDaCosto(totali.costo))', 'euro(economiaSettore.ricavo_previsto)');
  source = source.replaceAll('euro(ricavoDaCosto(totali.costo) - totali.costo)', 'euro(economiaSettore.margine_previsto)');

  // Aggiunge fascia e prezzo consigliato direttamente sulla riga servizio.
  if (!source.includes('const tariffa = prezzoListinoServizio(servizio);')) {
    source = source.replace(
      '  const rip = (servizio.ripartizione || []).reduce((s, x) => s + n(x.percentuale_ripartizione_attivita), 0);\n  return <tr>',
      '  const rip = (servizio.ripartizione || []).reduce((s, x) => s + n(x.percentuale_ripartizione_attivita), 0);\n  const tariffa = prezzoListinoServizio(servizio);\n  return <tr>'
    );
  }

  source = source.replace(
    '<td className="px-3 py-3 text-right font-semibold">{euro(servizio.costo_stimato)}</td>',
    '<td className="px-3 py-3 text-right"><div className="font-semibold">{euro(servizio.costo_stimato)}</div>{tariffa.incluso_coge ? <div className="text-[11px] text-slate-500">Incluso forfait COGE</div> : tariffa.trovato ? <div className="text-[11px] text-slate-500">Listino {euro(tariffa.minimo)}–{euro(tariffa.massimo)} · previsto {euro(tariffa.prezzo)}</div> : null}</td>'
  );

  return source;
});

console.log("✓ Redditività: listino professionale min/max collegato a compensi e clienti");
