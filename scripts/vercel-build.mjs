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
  "scripts/fix-redditivita-solo-operatori-fiscali.mjs",
  "scripts/patch-clienti-filtri-settore.mjs",
  "scripts/fix-redditivita-settori-build.mjs",
  "scripts/patch-redditivita-listino-professionale.mjs",
  "scripts/patch-redditivita-listino-db.mjs",
  "scripts/fix-redditivita-listino-save-fallback.mjs",
  "scripts/fix-redditivita-client-detail-integrity.mjs",
  "scripts/fix-redditivita-coefficienti-minimo.mjs",
  "scripts/patch-presenze-permessi-ex-festivi.mjs",
  "scripts/patch-presenze-report-cc.mjs",
  "scripts/patch-permessi-legenda-quarti-ora.mjs",
  "scripts/patch-clienti-riferimenti-ordine-nome.mjs",
  "scripts/patch-scadenzari-operatori-attivi.mjs",
  "scripts/patch-scadenze-forza-alert.mjs",
  "scripts/fix-scadenze-resolver-prima-studio.mjs",
  "scripts/patch-scadenze-rimuovi-link-email.mjs",
  "scripts/patch-utenti-alert-scadenze-calendario.mjs",
  "scripts/patch-controllo-gestione-software-dinamico.mjs",
  "scripts/patch-menu-revisione-controllo-unificato.mjs",
  "scripts/patch-menu-studio-archivi-base.mjs",
  "scripts/patch-menu-ribbon-multilivello.mjs",
  "scripts/patch-menu-ordine-principale.mjs",
  "scripts/patch-master-password-dati-studio-menu.mjs",
  "scripts/patch-master-password-disable-confirm-cleanup.mjs",
  "scripts/patch-menu-accessi-telematici.mjs",
  "scripts/patch-pratiche-nomina-organo-controllo.mjs",
  "scripts/patch-pratiche-nomina-organo-docx.mjs",
  "scripts/patch-modelli-organo-controllo.mjs",
  "scripts/fix-pratiche-iter-layout.mjs",
  "scripts/patch-av4-public.mjs",
  "scripts/patch-av4-print-professionale.mjs",
  "scripts/fix-av4-public-validation-display.mjs",
  "scripts/patch-av4-public-print-identica.mjs",
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