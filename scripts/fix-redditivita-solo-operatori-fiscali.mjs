import fs from "node:fs";

const file = "src/pages/api/controllo-gestione/redditivita-studio.ts";
let source = fs.readFileSync(file, "utf8");

const marker = "async function operatoriFiscaliAmmessiIds";

function replaceOrFail(label, from, to) {
  if (!source.includes(from)) {
    throw new Error(`[fix-redditivita-solo-operatori-fiscali] pattern not found: ${label}`);
  }
  source = source.replace(from, to);
}

if (!source.includes(marker)) {
  const anchor = "export default async function handler(req: NextApiRequest, res: NextApiResponse) {";
  const helper = `async function operatoriFiscaliAmmessiIds(studioId: string) {\n  const [{ data: utenti, error: utentiError }, { data: ruoli, error: ruoliError }] = await Promise.all([\n    supabaseAdmin\n      .from(\"tbutenti\")\n      .select(\"id,settore,tipo_rapporto,ruolo_operatore_id,attivo\")\n      .eq(\"studio_id\", studioId),\n    supabaseAdmin\n      .from(\"tbroperatore\")\n      .select(\"id,ruolo\")\n      .eq(\"studio_id\", studioId),\n  ]);\n\n  if (utentiError) throw utentiError;\n  if (ruoliError) throw ruoliError;\n\n  const ruoloById = new Map<string, string>(\n    (ruoli || []).map((r: any) => [String(r.id), String(r.ruolo || \"\")])\n  );\n\n  const ids = new Set<string>();\n\n  for (const u of utenti || []) {\n    if (u.attivo === false) continue;\n\n    const ruolo = ruoloById.get(String(u.ruolo_operatore_id || \"\")) || \"\";\n    let ammesso = false;\n\n    if (ruolo.includes(\"·\")) {\n      const [profiloRaw = \"\", areeRaw = \"\"] = ruolo.split(\"·\");\n      const profilo = profiloRaw.trim().toLowerCase();\n      const aree = areeRaw\n        .split(\"+\")\n        .map((area) => area.trim().toLowerCase())\n        .filter(Boolean);\n\n      const profiloAmmesso = [\n        \"dipendente\",\n        \"professionista collaboratore\",\n        \"professionista socio\",\n        \"altro\",\n      ].includes(profilo);\n\n      ammesso =\n        profiloAmmesso &&\n        aree.includes(\"contabilità e fiscale\") &&\n        !aree.includes(\"payroll\");\n    } else {\n      const settore = String(u.settore || \"\").trim().toLowerCase();\n      const rapporto = String(u.tipo_rapporto || \"\").trim().toLowerCase();\n      ammesso =\n        settore === \"fiscale\" &&\n        [\"dipendente\", \"collaboratore\", \"socio\", \"altro\"].includes(rapporto);\n    }\n\n    if (ammesso) ids.add(String(u.id));\n  }\n\n  return ids;\n}\n\n`;

  replaceOrFail("helper anchor", anchor, helper + anchor);
}

if (!source.includes("const operatoriFiscaliIds = await operatoriFiscaliAmmessiIds(studioId);")) {
  replaceOrFail(
    "capacity fiscal ids",
    "async function capacitaOperatoriStudio(studioId: string, esercizio: number) {\n  const [",
    "async function capacitaOperatoriStudio(studioId: string, esercizio: number) {\n  const operatoriFiscaliIds = await operatoriFiscaliAmmessiIds(studioId);\n  const ["
  );

  replaceOrFail(
    "payroll capacity filter",
    "    if (!userId) continue;\n    const oreGiorno =",
    "    if (!userId || !operatoriFiscaliIds.has(userId)) continue;\n    const oreGiorno ="
  );

  replaceOrFail(
    "manual capacity filter",
    "    if (!userId || byUser.has(userId)) continue;",
    "    if (!userId || !operatoriFiscaliIds.has(userId) || byUser.has(userId)) continue;"
  );
}

if (!source.includes("const operatoriFiscaliIdsCliente = await operatoriFiscaliAmmessiIds(studioId);")) {
  replaceOrFail(
    "client detail fiscal users",
    "        if (costiOperatoriResult.error) throw costiOperatoriResult.error;\n\n        const attivitaMap =",
    "        if (costiOperatoriResult.error) throw costiOperatoriResult.error;\n\n        const operatoriFiscaliIdsCliente = await operatoriFiscaliAmmessiIds(studioId);\n        const utentiFiscaliCliente = (utentiResult.data || []).filter((u: any) =>\n          operatoriFiscaliIdsCliente.has(String(u.id))\n        );\n\n        const attivitaMap ="
  );

  source = source.replace(
    "const utentiMap = new Map((utentiResult.data || []).map((u: any) => [u.id, u]));",
    "const utentiMap = new Map(utentiFiscaliCliente.map((u: any) => [u.id, u]));"
  );

  source = source.replace(
    "const operatoriCliente = (utentiResult.data || []).map((u: any) => {",
    "const operatoriCliente = utentiFiscaliCliente.map((u: any) => {"
  );

  source = source.replaceAll(
    "        for (const r of ripartizioniResult.data || []) {\n          const key = String(r.operatore_id || \"\");\n          if (!key) continue;",
    "        for (const r of ripartizioniResult.data || []) {\n          const key = String(r.operatore_id || \"\");\n          if (!key || !operatoriFiscaliIdsCliente.has(key)) continue;"
  );
}

if (!source.includes("const operatoriFiscaliIdsStudio = await operatoriFiscaliAmmessiIds(studioId);")) {
  replaceOrFail(
    "studio fiscal users",
    "      if (serviziClientiResult.error) throw serviziClientiResult.error;\n\n      const costiMap =",
    "      if (serviziClientiResult.error) throw serviziClientiResult.error;\n\n      const operatoriFiscaliIdsStudio = await operatoriFiscaliAmmessiIds(studioId);\n      const utentiFiscaliStudio = (utentiResult.data || []).filter((u: any) =>\n        operatoriFiscaliIdsStudio.has(String(u.id))\n      );\n\n      const costiMap ="
  );

  replaceOrFail(
    "studio load operator list",
    "      const operatori = (utentiResult.data || []).map((u: any) => {",
    "      const operatori = utentiFiscaliStudio.map((u: any) => {"
  );

  replaceOrFail(
    "studio workload filter",
    "      for (const r of carichiResult.data || []) {\n        const key = String(r.operatore_id || \"\");\n        if (!key) continue;",
    "      for (const r of carichiResult.data || []) {\n        const key = String(r.operatore_id || \"\");\n        if (!key || !operatoriFiscaliIdsStudio.has(key)) continue;"
  );
}

fs.writeFileSync(file, source, "utf8");
console.log("✓ Redditività Studio: solo operatori fiscali ammessi in elenco, capacità e carichi");
