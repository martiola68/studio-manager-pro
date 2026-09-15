import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceRequired(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`[menu multilivello] Anchor non trovato: ${label}`);
  source = source.replace(from, to);
}

// Stato del secondo livello: serve oggi per Scadenzario e resta riutilizzabile.
replaceRequired(
  `  const [desktopRibbonTab, setDesktopRibbonTab] = useState<string | null>(null);`,
  `  const [desktopRibbonTab, setDesktopRibbonTab] = useState<string | null>(null);\n  const [desktopRibbonSubTab, setDesktopRibbonSubTab] = useState<string | null>(null);`,
  "stato sottotab"
);

// resolveRibbonTab è già creato dalla patch precedente. Aggiungiamo soltanto
// il resolver del secondo livello prima di renderMenuItem.
if (!source.includes(`const resolveRibbonSubTab = (`)) {
  const renderAnchor = `  const renderMenuItem = (item: MenuItem) => {`;
  if (!source.includes(renderAnchor)) throw new Error("[menu multilivello] renderMenuItem non trovato");

  const subResolver = `  const resolveRibbonSubTab = (menuLabel: string, tabLabel: string | null) => {\n    if (menuLabel !== "Studio" || tabLabel !== "Scadenzario") return null;\n\n    const scadenzariSpecifici = [\n      "/scadenze/iva",\n      "/scadenze/ccgg",\n      "/scadenze/cu",\n      "/scadenze/imu",\n      "/scadenze/fiscali",\n      "/scadenze/bilanci",\n      "/scadenze/modello-770",\n      "/scadenze/lipe",\n      "/scadenze/esterometro",\n      "/scadenze/affitti",\n      "/scadenze/proforma",\n    ];\n\n    return scadenzariSpecifici.some(\n      (route) => pathname === route || pathname?.startsWith(route + "/")\n    )\n      ? "Scadenzari"\n      : "Gestione scadenze";\n  };\n\n`;

  source = source.replace(renderAnchor, subResolver + renderAnchor);
}

// Quando apro un menu strutturato seleziono sia il tab principale sia l'eventuale sottotab.
replaceRequired(
  `            setDesktopRibbonTab(resolveRibbonTab(item.label));`,
  `            const tab = resolveRibbonTab(item.label);\n            setDesktopRibbonTab(tab);\n            setDesktopRibbonSubTab(resolveRibbonSubTab(item.label, tab));`,
  "apertura menu multilivello"
);

// Ricostruiamo il calcolo del ribbon usando anchor strutturali, non stringhe
// dipendenti dalla vecchia versione del componente.
const calcStart = source.indexOf(
  `  const desktopMenuAttivo = menuItems.find((item) => item.label === desktopMenuOpen) || null;`
);
const calcEnd = source.indexOf(`\n\n  if (loading) {`, calcStart);
if (calcStart < 0 || calcEnd < 0) {
  throw new Error("[menu multilivello] blocco calcolo ribbon non trovato");
}

const calc = `  const desktopMenuAttivo = menuItems.find((item) => item.label === desktopMenuOpen) || null;
  const ribbonConTabs = Boolean(
    desktopMenuAttivo &&
    ["Studio", "Archivi di base", "Revisione e controllo"].includes(desktopMenuAttivo.label)
  );
  const desktopRibbonTabs = ribbonConTabs ? desktopMenuAttivo?.children || [] : [];
  const desktopRibbonTabEffettivo = ribbonConTabs
    ? desktopRibbonTab || resolveRibbonTab(desktopMenuAttivo?.label || "") || desktopRibbonTabs[0]?.label || null
    : null;
  const desktopRibbonVoceAttiva = ribbonConTabs
    ? desktopRibbonTabs.find((tab) => tab.label === desktopRibbonTabEffettivo) || null
    : null;
  const desktopRibbonSubTabs = desktopRibbonVoceAttiva?.children?.filter(
    (child) => Boolean(child.children?.length)
  ) || [];
  const desktopRibbonSubTabEffettivo = desktopRibbonSubTabs.length
    ? desktopRibbonSubTab ||
      resolveRibbonSubTab(desktopMenuAttivo?.label || "", desktopRibbonTabEffettivo) ||
      desktopRibbonSubTabs[0]?.label ||
      null
    : null;
  const desktopMenuVoci = ribbonConTabs
    ? desktopRibbonSubTabs.length
      ? desktopRibbonSubTabs.find((tab) => tab.label === desktopRibbonSubTabEffettivo)?.children || []
      : desktopRibbonVoceAttiva?.children || []
    : desktopMenuAttivo?.children?.flatMap((child) =>
        child.children?.length ? child.children : [child]
      ) || [];
  const desktopMenuGruppi = ribbonConTabs
    ? desktopMenuVoci.reduce<Record<string, MenuItem[]>>((acc, voce) => {
        const gruppo =
          voce.groupLabel ||
          desktopRibbonSubTabEffettivo ||
          desktopRibbonTabEffettivo ||
          "Funzioni";
        if (!acc[gruppo]) acc[gruppo] = [];
        acc[gruppo].push(voce);
        return acc;
      }, {})
    : {};`;

source = source.slice(0, calcStart) + calc + source.slice(calcEnd);

// Ricostruiamo il solo ribbon desktop. Gli altri componenti restano invariati.
const ribbonStart = `        {desktopMenuAttivo && desktopMenuVoci.length > 0 && (`;
const ribbonEnd = `        )}\n      </div>\n    </nav>`;
const startIndex = source.indexOf(ribbonStart);
const endIndex = source.indexOf(ribbonEnd, startIndex);
if (startIndex < 0 || endIndex < 0) {
  throw new Error("[menu multilivello] blocco ribbon desktop non trovato");
}

const ribbon = `        {desktopMenuAttivo && desktopMenuVoci.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 border-y border-gray-200 bg-white shadow-lg">
            {ribbonConTabs && (
              <div className="flex items-end gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 px-4 pt-1">
                {desktopRibbonTabs.map((tab) => {
                  const active = tab.label === desktopRibbonTabEffettivo;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => {
                        setDesktopRibbonTab(tab.label);
                        setDesktopRibbonSubTab(
                          resolveRibbonSubTab(desktopMenuAttivo.label, tab.label)
                        );
                      }}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-semibold xl:text-xs",
                        active
                          ? "border-blue-600 bg-white text-blue-700"
                          : "border-transparent text-gray-600 hover:bg-white hover:text-blue-700"
                      )}
                    >
                      <span className="[&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {ribbonConTabs && desktopRibbonSubTabs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4 py-1">
                {desktopRibbonSubTabs.map((tab) => {
                  const active = tab.label === desktopRibbonSubTabEffettivo;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => setDesktopRibbonSubTab(tab.label)}
                      className={cn(
                        "shrink-0 rounded-md px-3 py-1.5 text-[10px] font-semibold xl:text-[11px]",
                        active
                          ? "bg-blue-100 text-blue-800"
                          : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            {ribbonConTabs ? (
              <div className="flex min-h-[82px] w-full flex-row flex-nowrap items-stretch overflow-x-auto px-2 py-1.5">
                {Object.entries(desktopMenuGruppi).map(([gruppo, voci]) => (
                  <div
                    key={gruppo}
                    className="relative flex shrink-0 items-start border-r border-gray-200 px-1.5 pb-4 last:border-r-0"
                  >
                    <div className="flex items-start">
                      {voci.map((voce) => {
                        const active = isActive(voce);
                        const riservata =
                          (voce.adminOnly && currentUser?.tipo_utente !== "Admin") ||
                          (voce.systemAdminOnly && !currentUser?.amministratore_sistema_generale);
                        const pdf = !!voce.href?.toLowerCase().endsWith(".pdf");
                        return (
                          <Link
                            key={voce.label}
                            href={riservata ? "#" : voce.href || "#"}
                            target={pdf ? "_blank" : undefined}
                            rel={pdf ? "noopener noreferrer" : undefined}
                            onClick={(event) => {
                              if (riservata) {
                                event.preventDefault();
                                return;
                              }
                              if (voce.label === "Promemoria") handlePromemoriaClick();
                              setDesktopMenuOpen(null);
                            }}
                            className={cn(
                              "relative flex min-h-[58px] min-w-[82px] max-w-[110px] flex-col items-center justify-center gap-1 rounded px-2 py-1 text-center text-[10px] font-medium leading-tight xl:min-w-[92px] xl:text-[11px]",
                              riservata
                                ? "cursor-not-allowed bg-gray-50 text-gray-400 opacity-70"
                                : active
                                  ? "bg-blue-50 text-blue-700"
                                  : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                            )}
                          >
                            <span
                              className={cn(
                                "flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5",
                                riservata ? "text-gray-400" : "text-blue-600"
                              )}
                            >
                              {voce.icon}
                            </span>
                            <span>{voce.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                    <span className="absolute bottom-0 left-1.5 right-1.5 truncate border-t border-gray-100 pt-0.5 text-center text-[9px] font-medium text-gray-400">
                      {gruppo}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex w-full flex-row flex-nowrap items-stretch justify-start gap-0 px-4 py-2">
                {desktopMenuVoci.map((voce) => {
                  const active = isActive(voce);
                  const riservata =
                    (voce.adminOnly && currentUser?.tipo_utente !== "Admin") ||
                    (voce.systemAdminOnly && !currentUser?.amministratore_sistema_generale);
                  const pdf = !!voce.href?.toLowerCase().endsWith(".pdf");
                  return (
                    <Link
                      key={voce.label}
                      href={riservata ? "#" : voce.href || "#"}
                      target={pdf ? "_blank" : undefined}
                      rel={pdf ? "noopener noreferrer" : undefined}
                      onClick={(event) => {
                        if (riservata) {
                          event.preventDefault();
                          return;
                        }
                        setDesktopMenuOpen(null);
                      }}
                      className={cn(
                        "flex min-h-[72px] min-w-[96px] max-w-[120px] flex-col items-center justify-center gap-1.5 border-r border-gray-100 px-3 py-2 text-center text-[11px] font-medium leading-tight",
                        riservata
                          ? "cursor-not-allowed bg-gray-50 text-gray-400 opacity-70"
                          : active
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5",
                          riservata ? "text-gray-400" : "text-blue-600"
                        )}
                      >
                        {voce.icon}
                      </span>
                      <span>{voce.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}`;

source =
  source.slice(0, startIndex) +
  ribbon +
  source.slice(endIndex + `        )}`.length);

for (const marker of [
  "resolveRibbonSubTab",
  "desktopRibbonSubTabs",
  "desktopRibbonSubTabEffettivo",
  `label: "Gestione scadenze"`,
  `label: "Scadenzari"`,
]) {
  if (!source.includes(marker)) {
    throw new Error(`[menu multilivello] verifica finale fallita: ${marker}`);
  }
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Ribbon multilivello: Scadenzario separato in Gestione scadenze e Scadenzari");
