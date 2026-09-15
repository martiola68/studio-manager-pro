#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const filePath = path.join(
  process.cwd(),
  "src/pages/presenze/richiesta-ferie-permessi.tsx"
);

let src = fs.readFileSync(filePath, "utf8");
let changed = false;

function replaceOnce(search, replacement, label) {
  if (src.includes(replacement)) return;

  const index = src.indexOf(search);
  if (index === -1) {
    throw new Error(`[permessi-legenda-quarti-ora] Pattern not found: ${label}`);
  }

  src = `${src.slice(0, index)}${replacement}${src.slice(index + search.length)}`;
  changed = true;
}

replaceOnce(
  `  const oggi = new Date();`,
  `  function parseOrePermesso(value: string) {
    if (!value) return null;

    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isQuartoOraValido(value: string) {
    const oreDecimali = parseOrePermesso(value);
    if (oreDecimali === null || oreDecimali <= 0) return false;

    return Math.abs(oreDecimali * 4 - Math.round(oreDecimali * 4)) < 0.000001;
  }

  function formatDurataPermesso(value: string) {
    const oreDecimali = parseOrePermesso(value);
    if (oreDecimali === null || oreDecimali <= 0) return "";

    const minutiTotali = Math.round(oreDecimali * 60);
    const oreIntere = Math.floor(minutiTotali / 60);
    const minuti = minutiTotali % 60;

    if (oreIntere === 0) return \`\${minuti} minuti\`;
    if (minuti === 0) return oreIntere === 1 ? "1 ora" : \`\${oreIntere} ore\`;

    return \`\${oreIntere} \${oreIntere === 1 ? "ora" : "ore"} e \${minuti} minuti\`;
  }

  const oggi = new Date();`,
  "helpers durata permesso"
);

replaceOnce(
  `      if (\n        form.tipo_permesso === "AL" &&\n        ![1, 2].includes(Number(form.ore))\n      ) {`,
  `      if (\n        form.tipo_permesso !== "AL" &&\n        !isQuartoOraValido(form.ore)\n      ) {\n        toast({\n          title: "Errore",\n          description:\n            "Le ore di permesso devono essere indicate a quarti d'ora: 0,25 / 0,50 / 0,75 / 1,00 e così via.",\n          variant: "destructive",\n        });\n        return;\n      }\n\n      if (\n        form.tipo_permesso === "AL" &&\n        ![1, 2].includes(Number(form.ore))\n      ) {`,
  "validazione quarti d'ora"
);

replaceOnce(
  `                  disabled={isFerie}\n                />\n              </div>\n            </div>`,
  `                  disabled={isFerie}\n                />\n\n                {!isFerie && (\n                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">\n                    {isAllattamento ? (\n                      <p>\n                        <span className="font-medium text-slate-800">AL:</span>{" "}\n                        sono ammesse 1 oppure 2 ore.\n                      </p>\n                    ) : (\n                      <>\n                        <p>\n                          <span className="font-medium text-slate-800">Legenda:</span>{" "}\n                          0,25 = 15 min · 0,50 = 30 min · 0,75 = 45 min · 1,00 = 1 ora\n                        </p>\n                        <p>\n                          1,25 = 1h 15m · 1,50 = 1h 30m · 1,75 = 1h 45m · 2,00 = 2 ore\n                        </p>\n                        {form.ore && isQuartoOraValido(form.ore) && (\n                          <p className="mt-1 font-medium text-slate-900">\n                            Corrisponde a {formatDurataPermesso(form.ore)}.\n                          </p>\n                        )}\n                      </>\n                    )}\n                  </div>\n                )}\n              </div>\n            </div>`,
  "legenda sotto ore permesso"
);

if (changed) {
  fs.writeFileSync(filePath, src);
  console.log("[permessi-legenda-quarti-ora] Patch applied.");
} else {
  console.log("[permessi-legenda-quarti-ora] Already applied.");
}
