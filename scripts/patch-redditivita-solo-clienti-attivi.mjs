import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(rel, transform) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = transform(src);
  if (out === src) {
    console.log(`↷ ${rel} già filtrato cliente=true e attivo=true`);
    return;
  }
  fs.writeFileSync(file, out, "utf8");
  console.log(`✓ ${rel}: solo cliente=true e attivo=true`);
}

patch("src/pages/api/controllo-gestione/redditivita-studio.ts", (source) => {
  // Dettaglio singolo cliente.
  source = source.replace(
    `.from("tbclienti")\n            .select("id,ragione_sociale,codice_fiscale")\n            .eq("id", clienteId)\n            .eq("studio_id", studioId)\n            .maybeSingle()`,
    `.from("tbclienti")\n            .select("id,ragione_sociale,codice_fiscale")\n            .eq("id", clienteId)\n            .eq("studio_id", studioId)\n            .eq("cliente", true)\n            .eq("attivo", true)\n            .maybeSingle()`
  );

  // Elenco clienti dopo la patch operatività.
  source = source.replace(
    `.from("tbclienti").select("id,ragione_sociale,codice_fiscale,attivo,settore_fiscale,settore_consulenza,settore_lavoro").eq("studio_id", studioId).eq("attivo", true).order("ragione_sociale", { ascending: true })`,
    `.from("tbclienti").select("id,ragione_sociale,codice_fiscale,cliente,attivo,settore_fiscale,settore_consulenza,settore_lavoro").eq("studio_id", studioId).eq("cliente", true).eq("attivo", true).order("ragione_sociale", { ascending: true })`
  );

  // Fallback se la patch operatività non ha ancora trasformato la query.
  source = source.replace(
    `.from("tbclienti").select("id,ragione_sociale,codice_fiscale").eq("studio_id", studioId).order("ragione_sociale", { ascending: true })`,
    `.from("tbclienti").select("id,ragione_sociale,codice_fiscale,cliente,attivo").eq("studio_id", studioId).eq("cliente", true).eq("attivo", true).order("ragione_sociale", { ascending: true })`
  );

  // Verifica lato POST prima di salvare servizi cliente.
  source = source.replace(
    `supabaseAdmin.from("tbclienti").select("id").eq("id", clienteId).eq("studio_id", studioId).maybeSingle()`,
    `supabaseAdmin.from("tbclienti").select("id").eq("id", clienteId).eq("studio_id", studioId).eq("cliente", true).eq("attivo", true).maybeSingle()`
  );

  return source;
});

patch("src/pages/api/controllo-gestione/redditivita-compensi.ts", (source) => {
  // Ogni cliente usato da calcolo/contratto deve essere realmente cliente e attivo.
  source = source.replace(
    `.eq("id", clienteId)\n    .eq("studio_id", studioId)\n    .maybeSingle();`,
    `.eq("id", clienteId)\n    .eq("studio_id", studioId)\n    .eq("cliente", true)\n    .eq("attivo", true)\n    .maybeSingle();`
  );

  source = source.replace(
    `admin.from("tbclienti").select("id,ragione_sociale,codice_fiscale").eq("studio_id", studioId).order("ragione_sociale", { ascending: true })`,
    `admin.from("tbclienti").select("id,ragione_sociale,codice_fiscale,cliente,attivo").eq("studio_id", studioId).eq("cliente", true).eq("attivo", true).order("ragione_sociale", { ascending: true })`
  );

  return source;
});

patch("src/pages/api/controllo-gestione/redditivita-incassi.ts", (source) => {
  source = source.replace(
    `.from("tbclienti")\n          .select("id,ragione_sociale,codice_fiscale")\n          .eq("studio_id", studioId),`,
    `.from("tbclienti")\n          .select("id,ragione_sociale,codice_fiscale,cliente,attivo")\n          .eq("studio_id", studioId)\n          .eq("cliente", true)\n          .eq("attivo", true),`
  );

  // Non mostrare eventuali vecchi contratti collegati ad anagrafiche che non sono più clienti attivi.
  source = source.replace(
    `const contratti = Array.from(latestByCliente.values()).map((c: any) => {`,
    `const contratti = Array.from(latestByCliente.values()).filter((c: any) => clientiMap.has(c.cliente_id)).map((c: any) => {`
  );

  return source;
});

console.log("✓ Redditivita Studio: filtro clienti attivi applicato a Clienti, Compensi/Contratti e Incassi");
