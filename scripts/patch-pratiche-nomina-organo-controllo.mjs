import fs from "node:fs";

function patchDettaglioPratica() {
  const path = "src/pages/pratiche/[id].tsx";
  let source = fs.readFileSync(path, "utf8");

  const importLine = `import FormNominaOrganoControllo from "@/components/pratiche/forms/FormNominaOrganoControllo";`;
  if (!source.includes(importLine)) {
    const anchor = `import FormDeterminaLiquidazione from "@/components/pratiche/forms/FormDeterminaLiquidazione";`;
    if (!source.includes(anchor)) throw new Error("[nomina organo controllo] import anchor non trovato");
    source = source.replace(anchor, `${anchor}\n${importLine}`);
  }

  if (!source.includes(`return <FormNominaOrganoControllo pratica={pratica} />;`)) {
    const anchor = `if (pratica?.tipo?.classe_form === "cambio_amministratore") {\n  return <FormCambioAmministratore pratica={pratica} />;\n}\n\nreturn <div>Classe form non gestita</div>;`;
    if (!source.includes(anchor)) throw new Error("[nomina organo controllo] routing anchor non trovato");

    const replacement = `if (pratica?.tipo?.classe_form === "cambio_amministratore") {\n  return <FormCambioAmministratore pratica={pratica} />;\n}\n\nconst testoNominaOrganoControllo = String(\n  \`${'${pratica?.titolo || ""} ${pratica?.tipo?.nome || ""} ${pratica?.tipo?.classe_form || ""} ${pratica?.codice_workflow || ""}'}\`\n).toLowerCase();\n\nif (\n  [\n    "nomina_organo_controllo",\n    "nomina_revisore",\n    "nomina_sindaco",\n  ].includes(String(pratica?.tipo?.classe_form || "").toLowerCase()) ||\n  [\n    "revisore",\n    "revisione",\n    "sindaco",\n    "sindacale",\n    "organo di controllo",\n  ].some((chiave) => testoNominaOrganoControllo.includes(chiave))\n) {\n  return <FormNominaOrganoControllo pratica={pratica} />;\n}\n\nreturn <div>Classe form non gestita</div>;`;
    source = source.replace(anchor, replacement);
  }

  fs.writeFileSync(path, source, "utf8");
}

function patchVariazioniPage() {
  const path = "src/pages/pratiche/variazioni.tsx";
  let source = fs.readFileSync(path, "utf8");

  if (!source.includes(`function isNominaOrganoControllo(`)) {
    const anchor = `function aggiungiGiorni(data: string, giorni: number) {\n  if (!data) return "";\n  const d = new Date(data);\n  d.setDate(d.getDate() + Number(giorni || 0));\n  return d.toISOString().slice(0, 10);\n}`;
    if (!source.includes(anchor)) throw new Error("[nomina organo controllo] helper anchor non trovato");
    source = source.replace(
      anchor,
      `${anchor}\n\nfunction isNominaOrganoControllo(tipo: unknown) {\n  const value = String(tipo || "").toLowerCase();\n  return (\n    value.includes("revisore") ||\n    value.includes("revisione") ||\n    value.includes("sindaco") ||\n    value.includes("sindacale") ||\n    value.includes("organo di controllo")\n  );\n}`
    );
  }

  if (!source.includes(`if (isNominaOrganoControllo(v.tipo_variazione)) {`)) {
    const anchor = `if (v.tipo_variazione === "Cambio amministratore") {\n  steps = [\n    v.step_verbale_stato,\n    v.step_accettazione_carica_stato,\n    v.step_cciaa_stato,\n    v.obbligo_ade ? v.step_ade_stato : null,\n  ].filter(Boolean);\n}\n\n  const completati = steps.filter((s) => s === "completato").length;\n\n  return Math.round((completati / steps.length) * 100);`;
    if (!source.includes(anchor)) throw new Error("[nomina organo controllo] avanzamento anchor non trovato");
    source = source.replace(
      anchor,
      `if (v.tipo_variazione === "Cambio amministratore") {\n  steps = [\n    v.step_verbale_stato,\n    v.step_accettazione_carica_stato,\n    v.step_cciaa_stato,\n    v.obbligo_ade ? v.step_ade_stato : null,\n  ].filter(Boolean);\n}\n\nif (isNominaOrganoControllo(v.tipo_variazione)) {\n  steps = [\n    v.step_verbale_stato || "da_fare",\n    v.step_accettazione_carica_stato || "da_fare",\n    v.step_cciaa_stato || "da_fare",\n  ];\n}\n\n  if (steps.length === 0) return 0;\n\n  const completati = steps.filter((s) => s === "completato").length;\n\n  return Math.round((completati / steps.length) * 100);`
    );
  }

  if (!source.includes(`Verbale di nomina:`)) {
    const anchor = `\n</td>\n\n<td className="p-2">\n  <div className="w-28">`;
    if (!source.includes(anchor)) throw new Error("[nomina organo controllo] iter anchor non trovato");

    const block = `\n  {isNominaOrganoControllo(v.tipo_variazione) && (\n    <div className="space-y-1 text-xs">\n      <button\n        type="button"\n        className="block underline text-left"\n        onClick={async () => {\n          let praticaDaAprire = v.pratica_id;\n\n          if (!praticaDaAprire) {\n            const response = await fetch("/api/pratiche/variazioni/apri-nomina", {\n              method: "POST",\n              headers: { "Content-Type": "application/json" },\n              body: JSON.stringify({ variazione_id: v.id }),\n            });\n            const result = await response.json();\n\n            if (!result.success || !result.pratica_id) {\n              alert(result.error || "Impossibile aprire la pratica di nomina");\n              return;\n            }\n\n            praticaDaAprire = result.pratica_id;\n          }\n\n          router.push(\`/pratiche/${'${praticaDaAprire}'}\`);\n        }}\n      >\n        Verbale di nomina:\n        <span className={\`ml-1 ${'${coloreStep(v.step_verbale_stato)}'}\`}>\n          {(v.step_verbale_stato || "da_fare").replaceAll("_", " ")}\n        </span>\n      </button>\n\n      <div>\n        Accettazione carica/cariche:\n        <span className={\`ml-1 ${'${coloreStep(v.step_accettazione_carica_stato)}'}\`}>\n          {(v.step_accettazione_carica_stato || "da_fare").replaceAll("_", " ")}\n        </span>\n      </div>\n\n      <div>\n        Deposito pratica CCIAA:\n        <span className={\`ml-1 ${'${coloreStep(v.step_cciaa_stato)}'}\`}>\n          {(v.step_cciaa_stato || "da_fare").replaceAll("_", " ")}\n        </span>\n      </div>\n    </div>\n  )}\n`;

    source = source.replace(anchor, `${block}${anchor}`);
  }

  fs.writeFileSync(path, source, "utf8");
}

function patchStepTitles() {
  const path = "src/pages/api/pratiche/variazioni/index.ts";
  let source = fs.readFileSync(path, "utf8");

  if (!source.includes(`titolo: "Verbale di nomina"`)) {
    const anchor = `  if (tipo.includes("amministratore")) {`;
    if (!source.includes(anchor)) throw new Error("[nomina organo controllo] step API anchor non trovato");

    const block = `  if (\n    tipo.includes("revisore") ||\n    tipo.includes("revisione") ||\n    tipo.includes("sindaco") ||\n    tipo.includes("sindacale") ||\n    tipo.includes("organo di controllo")\n  ) {\n    return [\n      { ordine: 1, codice_step: "VERBALE", titolo: "Verbale di nomina", ente: "Interno" },\n      { ordine: 2, codice_step: "ACCETTAZIONE_CARICA", titolo: "Accettazione carica / cariche", ente: "CCIAA" },\n      { ordine: 3, codice_step: "DEPOSITO_CCIAA", titolo: "Deposito pratica CCIAA", ente: "CCIAA" },\n    ];\n  }\n\n`;

    source = source.replace(anchor, `${block}${anchor}`);
  }

  fs.writeFileSync(path, source, "utf8");
}

patchDettaglioPratica();
patchVariazioniPage();
patchStepTitles();
console.log("✓ Pratiche Revisore/Sindaci: Verbale di nomina, form dinamico, avanzamento e workflow integrati");
