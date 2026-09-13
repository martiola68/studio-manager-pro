import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const patches = [
  "scripts/patch-revisione-organi-api.mjs",
  "scripts/patch-revisione-print-layout.mjs",
  "scripts/patch-revisione-print-style-v2.mjs",
  "scripts/patch-menu-redditivita-studio.mjs",
  "scripts/patch-redditivita-clienti-tab.mjs",
  "scripts/patch-redditivita-compensi-tab.mjs",
  "scripts/patch-redditivita-incassi-tab.mjs",
  "scripts/patch-redditivita-incassi-scadenzario-centrale.mjs",
  "scripts/patch-redditivita-operativita.mjs",
  "scripts/oneoff-fix-redditivita-ux.mjs",
  "scripts/patch-redditivita-solo-clienti-attivi.mjs",
  "scripts/patch-redditivita-v2.mjs",
  "scripts/fix-redditivita-v2-build.mjs",
  "scripts/patch-redditivita-manuale-v2.mjs",
  "scripts/patch-redditivita-stabilita.mjs",
  "scripts/fix-redditivita-clienti-timeout.mjs",
  "scripts/patch-redditivita-defaults-mensile.mjs",
  "scripts/fix-redditivita-defaults-race.mjs",
  "scripts/fix-redditivita-nuovo-servizio-reset.mjs",
  "scripts/patch-redditivita-filtro-operatore.mjs",
  "scripts/fix-redditivita-clienti-loading-operatori.mjs",
  "scripts/fix-redditivita-clienti-pagination.mjs",
  "scripts/fix-redditivita-costo-orario-studio.mjs",
  "scripts/fix-redditivita-no-zero-cost.mjs",
  "scripts/fix-redditivita-capacita-payroll.mjs",
];

for (const script of patches) {
  console.log(`\n▶ ${script}`);
  execFileSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    stdio: "inherit",
  });
}

console.log("\n▶ next build");
const nextBin = path.join(root, "node_modules", ".bin", "next");
execFileSync(nextBin, ["build"], {
  cwd: root,
  stdio: "inherit",
});
