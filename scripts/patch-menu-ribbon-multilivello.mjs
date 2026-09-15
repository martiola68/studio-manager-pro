import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceRequired(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`[menu multilivello] Anchor non trovato: ${label}`);
  source = source.replace(from, to);
}

replaceRequired(
  `  const [desktopRibbonTab, setDesktopRibbonTab] = useState<string | null>(null);`,
  `  const [desktopRibbonTab, setDesktopRibbonTab] = useState<string | null>(null);\n  const [desktopRibbonSubTab, setDesktopRibbonSubTab] = useState<string | null>(null);`,
  "stato sottotab"
);

replaceRequired(
  `  const resolveRevisioneControlloTab = () => {\n    if (pathname?.startsWith("/revisione-controllo")) return "Revisione legale";\n    if (\n      pathname?.startsWith("/controllo-gestione/import-contabilita") ||\n      pathname?.startsWith("/controllo-gestione/piani-conti")\n    ) {\n      return "Dati contabili";\n    }\n    if (pathname?.startsWith("/controllo-gestione")) return "Controllo di gestione";\n    return "Revisione legale";\n  };`,
  `  const resolveRibbonTab = (menuLabel: string) => {\n    if (menuLabel === "Studio") {\n      if (pathname === "/agenda" || pathname?.startsWith("/contatti")) return "Attività e contatti";\n      if (pathname?.startsWith("/promemoria") || pathname?.startsWith("/post-del-giorno")) return "Memo";\n      if (pathname?.startsWith("/comunicazioni/interne") || pathname?.startsWith("/comunicazioni-clienti") || pathname?.startsWith("/newsletter")) return "Comunicazione";\n      if (pathname?.startsWith("/scadenze")) return "Scadenzario";\n      if (pathname?.startsWith("/accesso-portali") || pathname?.startsWith("/cassetti-fiscali")) return "Utilità";\n      return "Attività e contatti";\n    }\n\n    if (menuLabel === "Archivi di base") {\n      if (pathname?.startsWith("/clienti") || pathname?.startsWith("/anagrafiche") || pathname?.startsWith("/antiriciclaggio/rappresentanti") || pathname?.startsWith("/impostazioni/studio")) return "Anagrafiche";\n      if (pathname?.startsWith("/microsoft365")) return "Connessioni";\n      if (pathname?.startsWith("/impostazioni/utenti") || pathname?.startsWith("/impostazioni/ruoli") || pathname?.startsWith("/impostazioni/prestazioni") || pathname?.startsWith("/impostazioni/payroll-") || pathname?.startsWith("/impostazioni/scadenzari") || pathname?.startsWith("/impostazioni/tipi-scadenze") || pathname?.startsWith("/impostazioni/tipo-promemoria") || pathname?.startsWith("/impostazioni/template-email")) return "Tabelle";\n      if (pathname?.startsWith("/profilo/password") || pathname?.startsWith("/impostazioni/amministrazione-sistema")) return "Amministrazione";\n      if (pathname?.startsWith("/guide/")) return "Manuali di istruzione";\n      return "Anagrafiche";\n    }\n\n    if (menuLabel === "Revisione e controllo") {\n      if (pathname?.startsWith("/revisione-controllo")) return "Revisione legale";\n      if (pathname?.startsWith("/controllo-gestione/import-contabilita") || pathname?.startsWith("/controllo-gestione/piani-conti")) return "Dati contabili";\n      if (pathname?.startsWith("/controllo-gestione")) return "Controllo di gestione";\n      return "Revisione legale";\n    }\n\n    return null;\n  };\n\n  const resolveRibbonSubTab = (menuLabel: string, tabLabel: string | null) => {\n    if (menuLabel !== "Studio" || tabLabel !== "Scadenzario") return null;\n    const specifici = [\n      "/scadenze/iva", "/scadenze/ccgg", "/scadenze/cu", "/scadenze/imu",\n      "/scadenze/fiscali", "/scadenze/bilanci", "/scadenze/modello-770",\n      "/scadenze/lipe", "/scadenze/esterometro", "/scadenze/affitti", "/scadenze/proforma"\n    ];\n    return specifici.some((route) => pathname === route || pathname?.startsWith(route + "/"))\n      ? "Scadenzari"\n      : "Gestione scadenze";\n  };`,
  "resolver tab generico"
);

replaceRequired(
  `            setDesktopRibbonTab(\n              item.label === "Revisione e controllo"\n                ? resolveRevisioneControlloTab()\n                : null\n            );`,
  `            const tab = resolveRibbonTab(item.label);\n            setDesktopRibbonTab(tab);\n            setDesktopRibbonSubTab(resolveRibbonSubTab(item.label, tab));`,
  "apertura ribbon"
);

replaceRequired(
  `  const ribbonUnificato = desktopMenuAttivo?.label === "Revisione e controllo";\n  const desktopRibbonTabs = ribbonUnificato ? desktopMenuAttivo?.children || [] : [];\n  const desktopRibbonTabEffettivo = ribbonUnificato\n    ? desktopRibbonTab || resolveRevisioneControlloTab()\n    : null;\n  const desktopMenuVoci = ribbonUnificato\n    ? desktopRibbonTabs.find((tab) => tab.label === desktopRibbonTabEffettivo)?.children || []\n    : desktopMenuAttivo?.children?.flatMap((child) => child.children?.length ? child.children : [child]) || [];\n\n  const desktopMenuGruppi = ribbonUnificato\n    ? desktopMenuVoci.reduce<Record<string, MenuItem[]>>((acc, voce) => {\n        const gruppo = voce.groupLabel || "Funzioni";\n        if (!acc[gruppo]) acc[gruppo] = [];\n        acc[gruppo].push(voce);\n        return acc;\n      }, {})\n    : {};`,
  `  const ribbonConTabs = Boolean(desktopMenuAttivo && ["Studio", "Archivi di base", "Revisione e controllo"].includes(desktopMenuAttivo.label));\n  const desktopRibbonTabs = ribbonConTabs ? desktopMenuAttivo?.children || [] : [];\n  const desktopRibbonTabEffettivo = ribbonConTabs\n    ? desktopRibbonTab || resolveRibbonTab(desktopMenuAttivo?.label || "") || desktopRibbonTabs[0]?.label || null\n    : null;\n  const desktopRibbonVoceAttiva = ribbonConTabs\n    ? desktopRibbonTabs.find((tab) => tab.label === desktopRibbonTabEffettivo) || null\n    : null;\n  const desktopRibbonSubTabs = desktopRibbonVoceAttiva?.children?.filter((child) => Boolean(child.children?.length)) || [];\n  const desktopRibbonSubTabEffettivo = desktopRibbonSubTabs.length\n    ? desktopRibbonSubTab || resolveRibbonSubTab(desktopMenuAttivo?.label || "", desktopRibbonTabEffettivo) || desktopRibbonSubTabs[0]?.label || null\n    : null;\n  const desktopMenuVoci = ribbonConTabs\n    ? desktopRibbonSubTabs.length\n      ? desktopRibbonSubTabs.find((tab) => tab.label === desktopRibbonSubTabEffettivo)?.children || []\n      : desktopRibbonVoceAttiva?.children || []\n    : desktopMenuAttivo?.children?.flatMap((child) => child.children?.length ? child.children : [child]) || [];\n\n  const desktopMenuGruppi = ribbonConTabs\n    ? desktopMenuVoci.reduce<Record<string, MenuItem[]>>((acc, voce) => {\n        const gruppo = voce.groupLabel || desktopRibbonSubTabEffettivo || desktopRibbonTabEffettivo || "Funzioni";\n        if (!acc[gruppo]) acc[gruppo] = [];\n        acc[gruppo].push(voce);\n        return acc;\n      }, {})\n    : {};`,
  "calcolo ribbon multilivello"
);

replaceRequired(`            {ribbonUnificato && (`, `            {ribbonConTabs && (`, "flag tabs");
replaceRequired(`            {ribbonUnificato ? (`, `            {ribbonConTabs ? (`, "flag contenuto");

replaceRequired(
  `                      onClick={() => setDesktopRibbonTab(tab.label)}`,
  `                      onClick={() => {\n                        setDesktopRibbonTab(tab.label);\n                        setDesktopRibbonSubTab(resolveRibbonSubTab(desktopMenuAttivo.label, tab.label));\n                      }}`,
  "click tab"
);

const tabsClose = `              </div>\n            )}\n\n            {ribbonConTabs ? (`;
const tabsWithSub = `              </div>\n            )}\n\n            {ribbonConTabs && desktopRibbonSubTabs.length > 0 && (\n              <div className="flex items-center gap-1 border-b border-gray-100 bg-white px-4 py-1">\n                {desktopRibbonSubTabs.map((tab) => {\n                  const tabAttivo = tab.label === desktopRibbonSubTabEffettivo;\n                  return (\n                    <button\n                      key={tab.label}\n                      type="button"\n                      onClick={() => setDesktopRibbonSubTab(tab.label)}\n                      className={cn(\n                        "rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors xl:text-[11px]",\n                        tabAttivo ? "bg-blue-100 text-blue-800" : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"\n                      )}\n                    >\n                      {tab.label}\n                    </button>\n                  );\n                })}\n              </div>\n            )}\n\n            {ribbonConTabs ? (`;
replaceRequired(tabsClose, tabsWithSub, "riga sottotab");

// Permessi e apertura PDF anche nel ribbon a tab.
replaceRequired(
  `                      {voci.map((voce) => {\n                        const voceActive = isActive(voce);\n                        return (\n                          <Link\n                            key={voce.label}\n                            href={voce.href || "#"}\n                            onClick={() => setDesktopMenuOpen(null)}`,
  `                      {voci.map((voce) => {\n                        const voceActive = isActive(voce);\n                        const voceRiservata =\n                          (voce.adminOnly && currentUser?.tipo_utente !== "Admin") ||\n                          (voce.systemAdminOnly && !currentUser?.amministratore_sistema_generale);\n                        const vocePdf = !!voce.href?.toLowerCase().endsWith(".pdf");\n                        return (\n                          <Link\n                            key={voce.label}\n                            href={voceRiservata ? "#" : voce.href || "#"}\n                            target={vocePdf ? "_blank" : undefined}\n                            rel={vocePdf ? "noopener noreferrer" : undefined}\n                            onClick={(event) => {\n                              if (voceRiservata) { event.preventDefault(); return; }\n                              if (voce.label === "Promemoria") handlePromemoriaClick();\n                              setDesktopMenuOpen(null);\n                            }}`,
  "permessi ribbon"
);

replaceRequired(
  `                              voceActive\n                                ? "bg-blue-50 text-blue-700"\n                                : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"`,
  `                              voceRiservata\n                                ? "cursor-not-allowed bg-gray-50 text-gray-400 opacity-70"\n                                : voceActive\n                                  ? "bg-blue-50 text-blue-700"\n                                  : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"`,
  "stile riservato ribbon"
);

for (const marker of ["ribbonConTabs", "desktopRibbonSubTabs", "resolveRibbonTab", "resolveRibbonSubTab"]) {
  if (!source.includes(marker)) throw new Error(`[menu multilivello] marker mancante: ${marker}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Ribbon multilivello attivo per Studio, Archivi di base e Revisione e controllo");
