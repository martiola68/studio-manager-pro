import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(rel, fn) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = fn(src);
  if (out === src) {
    console.log(`↷ ${rel} già protetto`);
    return;
  }
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${rel}`);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  // Non distruggere costi già valorizzati se il modello studio è temporaneamente incompleto.
  source = source.replace(
    '  const oreProduttive = n(p?.ore_produttive_studio);\n\n  return {\n    totaleCosti,\n    oreProduttive,\n    costoOrario: oreProduttive > 0 ? totaleCosti / oreProduttive : 0,\n  };',
    '  const oreProduttive = n(p?.ore_produttive_studio);\n  const configurato = oreProduttive > 0 && totaleCosti > 0;\n\n  return {\n    totaleCosti,\n    oreProduttive,\n    costoOrario: configurato ? totaleCosti / oreProduttive : 0,\n    configurato,\n  };'
  );

  source = source.replace(
    '  const medio = await costoOrarioMedioStudio(studioId, esercizio);\n  const pageSize = 500;',
    '  const medio = await costoOrarioMedioStudio(studioId, esercizio);\n  if (!medio.configurato) return medio;\n  const pageSize = 500;'
  );

  source = source.replace(
    '  const medio = await costoOrarioMedioStudio(String(servizio.studio_id), Number(servizio.esercizio));\n  const costo = round(n(servizio.ore_equivalenti) * medio.costoOrario, 2);',
    '  const medio = await costoOrarioMedioStudio(String(servizio.studio_id), Number(servizio.esercizio));\n  const costo = medio.configurato\n    ? round(n(servizio.ore_equivalenti) * medio.costoOrario, 2)\n    : n(servizio.costo_stimato);'
  );

  // Espone lo stato del modello economico al dettaglio cliente.
  const detailReturnAnchor = '        return res.status(200).json({\n          success: true,\n          cliente: clienteResult.data,';
  if (source.includes(detailReturnAnchor) && !source.includes('costo_modello: medioCliente')) {
    source = source.replace(
      detailReturnAnchor,
      '        const medioCliente = await costoOrarioMedioStudio(studioId, esercizio);\n\n' + detailReturnAnchor
    );
    source = source.replace(
      '          cliente: clienteResult.data,\n          servizi,',
      '          cliente: clienteResult.data,\n          costo_modello: medioCliente,\n          servizi,'
    );
  }

  // Anche l'overview leggero deve sapere se il costo è configurato.
  const fastReturn = '        return res.status(200).json({\n          success: true,\n          parametri: parametriClientiResult.data || null,';
  if (source.includes(fastReturn) && !source.includes('costo_modello: await costoOrarioMedioStudio')) {
    source = source.replace(
      fastReturn,
      '        const medioOverview = await costoOrarioMedioStudio(studioId, esercizio);\n\n        return res.status(200).json({\n          success: true,\n          costo_modello: medioOverview,\n          parametri: parametriClientiResult.data || null,'
    );
  }

  return source;
});

patch("src/components/controllo-gestione/RedditivitaClientiTab.tsx", (source) => {
  if (!source.includes('const [costoModelloConfigurato')) {
    source = source.replace(
      '  const [loading, setLoading] = useState(false);',
      '  const [loading, setLoading] = useState(false);\n  const [costoModelloConfigurato, setCostoModelloConfigurato] = useState(true);'
    );
  }

  source = source.replace(
    '      setClienti(Array.isArray(json?.clienti) ? json.clienti : []);',
    '      setClienti(Array.isArray(json?.clienti) ? json.clienti : []);\n      setCostoModelloConfigurato(json?.costo_modello?.configurato !== false);'
  );
  source = source.replace(
    '      setCliente(json?.cliente || null);',
    '      setCliente(json?.cliente || null);\n      setCostoModelloConfigurato(json?.costo_modello?.configurato !== false);'
  );

  // Avviso chiaro: zero non è un costo economico valido quando il modello non è configurato.
  const sectionStart = '  return (\n    <section className="space-y-5">';
  if (source.includes(sectionStart) && !source.includes('Costo orario studio non configurato')) {
    source = source.replace(
      sectionStart,
      '  return (\n    <section className="space-y-5">\n      {!costoModelloConfigurato && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Costo orario studio non configurato.</strong> Le ore vengono calcolate, ma il costo non può essere valorizzato finché in Costi Studio non inserisci e salvi le ore produttive annue complessive dello studio. Nessuna attività viene considerata realmente a costo zero.</div>}'
    );
  }

  // Totale cliente: non mostrare €0 fuorviante se esistono ore ma manca il modello economico.
  source = source.replaceAll(
    'value={euro(totali.costo)}',
    'value={!costoModelloConfigurato && totali.ore > 0 ? "Da configurare" : euro(totali.costo)}'
  );

  // Riepilogo generale: stessa regola.
  source = source.replaceAll(
    '{euro(c.costo_stimato)}',
    '{!costoModelloConfigurato && n(c.ore_equivalenti) > 0 ? "Da configurare" : euro(c.costo_stimato)}'
  );

  // Riga attività dettaglio: intercetta i diversi layout prodotti dalle patch precedenti.
  source = source.replaceAll(
    '{euro(servizio.costo_stimato)}',
    '{!costoModelloConfigurato && n(servizio.ore_equivalenti) > 0 ? "Da configurare" : euro(servizio.costo_stimato)}'
  );

  // Passa il flag alla ServiceRow se il layout usa il componente estratto.
  source = source.replaceAll(
    '<ServiceRow key={s.id} servizio={s}',
    '<ServiceRow key={s.id} servizio={s} costoModelloConfigurato={costoModelloConfigurato}'
  );
  source = source.replace(
    'function ServiceRow({ servizio,',
    'function ServiceRow({ servizio, costoModelloConfigurato,'
  );
  source = source.replace(
    '}: { servizio: Servizio;',
    '}: { servizio: Servizio; costoModelloConfigurato?: boolean;'
  );

  return source;
});

console.log("✓ Redditività: nessun falso costo zero quando il modello economico non è configurato");
