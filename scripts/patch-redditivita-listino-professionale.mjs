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

  // Se una versione precedente della patch avesse già inserito il blocco nel posto sbagliato,
  // lo rimuoviamo prima di reinserirlo dopo la definizione del margine.
  source = source.replace(
    /\n  const economiaSettore = useMemo\(\n    \(\) => calcolaEconomiaListino\(serviziSettore, marginePercentuale\),\n    \[serviziSettore, marginePercentuale\]\n  \);/g,
    ""
  );

  const margineAnchor = '  const marginePercentuale = Math.min(95, Math.max(0, n(margineObiettivo)));';
  if (!source.includes(margineAnchor)) {
    throw new Error("[listino-professionale] marginePercentuale non trovato");
  }
  source = source.replace(
    margineAnchor,
    `${margineAnchor}\n\n  const economiaSettore = useMemo(\n    () => calcolaEconomiaListino(serviziSettore, marginePercentuale),\n    [serviziSettore, marginePercentuale]\n  );`
  );

  source = source.replace(
    '<Summary label="Ricavo stimato" value={euro(ricavoDaCosto(totali.costo))} />',
    '<Summary label="Listino minimo" value={euro(economiaSettore.listino_minimo)} />\n            <Summary label="Ricavo previsto" value={euro(economiaSettore.ricavo_previsto)} />'
  );
  source = source.replace(
    '<Summary label="Margine stimato" value={euro(ricavoDaCosto(totali.costo) - totali.costo)} />',
    '<Summary label="Margine previsto" value={euro(economiaSettore.margine_previsto)} />'
  );
  source = source.replace('md:grid-cols-5', 'md:grid-cols-6');
  source = source.replaceAll('euro(ricavoDaCosto(totali.costo))', 'euro(economiaSettore.ricavo_previsto)');
  source = source.replaceAll('euro(ricavoDaCosto(totali.costo) - totali.costo)', 'euro(economiaSettore.margine_previsto)');

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
