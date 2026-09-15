import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceRequired(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    throw new Error(`[menu revisione-controllo] Anchor non trovato: ${label}`);
  }
  source = source.replace(from, to);
}

// Estensione metadata per raggruppare le icone in stile ribbon Word.
replaceRequired(
  `  systemAdminOnly?: boolean;\n  children?: MenuItem[];`,
  `  systemAdminOnly?: boolean;\n  groupLabel?: string;\n  children?: MenuItem[];`,
  "groupLabel MenuItem"
);

// Stato della sezione attiva nel ribbon unificato.
replaceRequired(
  `  const [desktopMenuOpen, setDesktopMenuOpen] = useState<string | null>(null);`,
  `  const [desktopMenuOpen, setDesktopMenuOpen] = useState<string | null>(null);\n  const [desktopRibbonTab, setDesktopRibbonTab] = useState<string | null>(null);`,
  "stato tab ribbon"
);

// Unificazione dei due menu principali. La regex tollera la vecchia patch che
// inserisce Redditività Studio dentro Controllo di gestione prima di questa patch.
if (!source.includes(`label: "Revisione e controllo"`)) {
  const menuRegex = /\n    \{\n      label: "Revisione",[\s\S]*?\n    \},\n    \{\n      label: "Controllo di gestione",[\s\S]*?\n    \},\n    \{\n      label: "Contenzioso",/;

  if (!menuRegex.test(source)) {
    throw new Error("[menu revisione-controllo] Blocchi Revisione/Controllo di gestione non trovati");
  }

  const nuovoMenu = `
    {
      label: "Revisione e controllo",
      icon: <ClipboardCheck className="h-4 w-4" />,
      children: [
        {
          label: "Revisione legale",
          icon: <ClipboardCheck className="h-4 w-4" />,
          children: [
            { label: "Dashboard", href: "/revisione-controllo/dashboard", icon: <BarChart3 className="h-4 w-4" />, groupLabel: "Panoramica" },
            { label: "Incarichi / Fascicoli", href: "/revisione-controllo", icon: <FolderKanban className="h-4 w-4" />, groupLabel: "Pratiche" },
            { label: "Nuova presa in carico", href: "/revisione-controllo/presa-in-carico", icon: <FileText className="h-4 w-4" />, groupLabel: "Pratiche" },
            { label: "Controlli periodici", href: "/revisione-controllo/controlli", icon: <Calendar className="h-4 w-4" />, groupLabel: "Esecuzione" },
            { label: "Carte di lavoro", href: "/revisione-controllo/documenti", icon: <FolderKanban className="h-4 w-4" />, groupLabel: "Esecuzione" },
            { label: "Rilievi / Follow-up", href: "/revisione-controllo/followup", icon: <AlertTriangle className="h-4 w-4" />, groupLabel: "Esecuzione" },
            { label: "Relazioni annuali", href: "/revisione-controllo/relazioni", icon: <FileText className="h-4 w-4" />, groupLabel: "Output" },
            { label: "Modelli relazioni", href: "/revisione-controllo/modelli", icon: <FileText className="h-4 w-4" />, groupLabel: "Output" },
          ],
        },
        {
          label: "Controllo di gestione",
          icon: <BriefcaseBusiness className="h-4 w-4" />,
          children: [
            { label: "Elenco generale", href: "/controllo-gestione", icon: <FileText className="h-4 w-4" />, groupLabel: "Controlli" },
            { label: "Nuovo controllo", href: "/controllo-gestione/nuovo", icon: <FileText className="h-4 w-4" />, groupLabel: "Controlli" },
            { label: "Analisi", href: "/controllo-gestione/analisi", icon: <BarChart3 className="h-4 w-4" />, groupLabel: "Analisi" },
            { label: "Indici", href: "/controllo-gestione/indici", icon: <BarChart3 className="h-4 w-4" />, groupLabel: "Analisi" },
            { label: "Storico controlli", href: "/controllo-gestione/storico", icon: <Clock className="h-4 w-4" />, groupLabel: "Storico" },
          ],
        },
        {
          label: "Dati contabili",
          icon: <RefreshCcw className="h-4 w-4" />,
          children: [
            { label: "Importa contabilità", href: "/controllo-gestione/import-contabilita", icon: <RefreshCcw className="h-4 w-4" />, groupLabel: "Acquisizione" },
            { label: "Piano conti e raccordi", href: "/controllo-gestione/piani-conti", icon: <Settings className="h-4 w-4" />, groupLabel: "Raccordi" },
          ],
        },
      ],
    },
    {
      label: "Contenzioso",`;

  source = source.replace(menuRegex, nuovoMenu);
}

// Redditività Studio appartiene alle funzioni dello Studio, non al controllo
// economico delle società clienti. La vecchia occorrenza è già scomparsa con
// la sostituzione del blocco precedente; qui la inseriamo nel ribbon Studio.
const redditivitaItem = `{ label: "Redditività Studio", href: "/controllo-gestione/redditivita-studio", icon: <BarChart3 className="h-4 w-4" /> },`;
if (!source.includes(redditivitaItem)) {
  const studioAnchor = `{ label: "Cassetti Fiscali", href: "/cassetti-fiscali", icon: <FileText className="h-4 w-4" /> },`;
  if (!source.includes(studioAnchor)) {
    throw new Error("[menu revisione-controllo] Anchor Studio/Cassetti Fiscali non trovato");
  }
  source = source.replace(studioAnchor, `${studioAnchor}\n          ${redditivitaItem}`);
}

// Selezione automatica del tab in base alla pagina corrente.
const helperAnchor = `  const renderMenuItem = (item: MenuItem) => {`;
const helper = `  const resolveRevisioneControlloTab = () => {
    if (pathname?.startsWith("/revisione-controllo")) return "Revisione legale";
    if (
      pathname?.startsWith("/controllo-gestione/import-contabilita") ||
      pathname?.startsWith("/controllo-gestione/piani-conti")
    ) {
      return "Dati contabili";
    }
    if (pathname?.startsWith("/controllo-gestione")) return "Controllo di gestione";
    return "Revisione legale";
  };

  const renderMenuItem = (item: MenuItem) => {`;
replaceRequired(helperAnchor, helper, "resolver tab Revisione e controllo");

// Apertura menu: per il nuovo menu posizioniamo subito il tab coerente con la route.
replaceRequired(
  `          onClick={() => setDesktopMenuOpen(menuOpen ? null : item.label)}`,
  `          onClick={() => {
            if (menuOpen) {
              setDesktopMenuOpen(null);
              return;
            }
            setDesktopMenuOpen(item.label);
            setDesktopRibbonTab(
              item.label === "Revisione e controllo"
                ? resolveRevisioneControlloTab()
                : null
            );
          }}`,
  "apertura menu con tab"
);

// Nel menu unificato non appiattiamo tutte le sezioni: mostriamo solo il tab scelto.
replaceRequired(
  `  const desktopMenuAttivo = menuItems.find((item) => item.label === desktopMenuOpen) || null;\n  const desktopMenuVoci = desktopMenuAttivo?.children?.flatMap((child) => child.children?.length ? child.children : [child]) || [];`,
  `  const desktopMenuAttivo = menuItems.find((item) => item.label === desktopMenuOpen) || null;
  const ribbonUnificato = desktopMenuAttivo?.label === "Revisione e controllo";
  const desktopRibbonTabs = ribbonUnificato ? desktopMenuAttivo?.children || [] : [];
  const desktopRibbonTabEffettivo = ribbonUnificato
    ? desktopRibbonTab || resolveRevisioneControlloTab()
    : null;
  const desktopMenuVoci = ribbonUnificato
    ? desktopRibbonTabs.find((tab) => tab.label === desktopRibbonTabEffettivo)?.children || []
    : desktopMenuAttivo?.children?.flatMap((child) => child.children?.length ? child.children : [child]) || [];

  const desktopMenuGruppi = ribbonUnificato
    ? desktopMenuVoci.reduce<Record<string, MenuItem[]>>((acc, voce) => {
        const gruppo = voce.groupLabel || "Funzioni";
        if (!acc[gruppo]) acc[gruppo] = [];
        acc[gruppo].push(voce);
        return acc;
      }, {})
    : {};`,
  "calcolo voci ribbon"
);

// Sostituiamo il ribbon standard con una variante Word-like solo per il menu
// Revisione e controllo. Gli altri menu restano invariati per questa prima fase.
const ribbonStart = `        {desktopMenuAttivo && desktopMenuVoci.length > 0 && (`;
const ribbonEnd = `        )}\n      </div>\n    </nav>`;
const startIndex = source.indexOf(ribbonStart);
const endIndex = source.indexOf(ribbonEnd, startIndex);

if (startIndex < 0 || endIndex < 0) {
  throw new Error("[menu revisione-controllo] Blocco ribbon desktop non trovato");
}

const newRibbon = `        {desktopMenuAttivo && desktopMenuVoci.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 border-y border-gray-200 bg-white shadow-lg">
            {ribbonUnificato && (
              <div className="flex items-end gap-1 border-b border-gray-200 bg-gray-50 px-4 pt-1">
                {desktopRibbonTabs.map((tab) => {
                  const tabAttivo = tab.label === desktopRibbonTabEffettivo;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => setDesktopRibbonTab(tab.label)}
                      className={cn(
                        "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-semibold transition-colors xl:text-xs",
                        tabAttivo
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

            {ribbonUnificato ? (
              <div className="flex min-h-[86px] w-full flex-row flex-nowrap items-stretch overflow-x-auto px-2 py-1.5">
                {Object.entries(desktopMenuGruppi).map(([gruppo, voci]) => (
                  <div key={gruppo} className="relative flex shrink-0 items-start border-r border-gray-200 px-1.5 pb-4 last:border-r-0">
                    <div className="flex items-start">
                      {voci.map((voce) => {
                        const voceActive = isActive(voce);
                        return (
                          <Link
                            key={voce.label}
                            href={voce.href || "#"}
                            onClick={() => setDesktopMenuOpen(null)}
                            className={cn(
                              "flex min-h-[60px] min-w-[82px] max-w-[104px] flex-col items-center justify-center gap-1 rounded px-2 py-1 text-center text-[10px] font-medium leading-tight transition-colors xl:min-w-[92px] xl:text-[11px]",
                              voceActive
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                            )}
                          >
                            <span className="flex items-center justify-center text-blue-600 [&>svg]:h-5 [&>svg]:w-5">{voce.icon}</span>
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
              <div className={cn("w-full items-stretch justify-start gap-0 px-4 py-2", desktopMenuAttivo.label === "Strumenti" ? "grid grid-cols-8" : "flex flex-row flex-nowrap")}>
                {desktopMenuVoci.map((voce) => {
                  const voceActive = isActive(voce);
                  const voceRiservata =
                    (voce.adminOnly && currentUser?.tipo_utente !== "Admin") ||
                    (voce.systemAdminOnly && !currentUser?.amministratore_sistema_generale);
                  const vocePdf = !!voce.href?.toLowerCase().endsWith(".pdf");
                  const motivoRiserva = voce.systemAdminOnly
                    ? "Solo amministratore generale"
                    : "Solo amministratore";
                  return (
                    <Link
                      key={voce.label}
                      href={voceRiservata ? "#" : voce.href || "#"}
                      target={vocePdf ? "_blank" : undefined}
                      rel={vocePdf ? "noopener noreferrer" : undefined}
                      onClick={(event) => {
                        if (voceRiservata) {
                          event.preventDefault();
                          return;
                        }
                        setDesktopMenuOpen(null);
                      }}
                      className={cn(
                        "flex min-h-[72px] min-w-[96px] max-w-[120px] flex-col items-center justify-center gap-1.5 border-r border-gray-100 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors",
                        desktopMenuAttivo.label === "Strumenti" && "min-w-0 max-w-none",
                        voceRiservata ? "cursor-not-allowed bg-gray-50 text-gray-400 opacity-70 hover:bg-gray-50 hover:text-gray-400" : voceActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      )}
                    >
                      <span className={cn("flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5", voceRiservata ? "text-gray-400" : "text-blue-600")}>{voce.icon}</span>
                      <span>{voce.label}</span>
                      {voceRiservata && <span className="text-[9px] font-normal text-gray-400">{motivoRiserva}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}`;

source = source.slice(0, startIndex) + newRibbon + source.slice(endIndex + `        )}`.length);

// Verifiche forti: un solo menu principale, tab presenti, redditività sotto Studio.
if (!source.includes(`label: "Revisione e controllo"`)) {
  throw new Error("[menu revisione-controllo] Menu principale unificato non applicato");
}
if (!source.includes(`label: "Revisione legale"`) || !source.includes(`label: "Dati contabili"`)) {
  throw new Error("[menu revisione-controllo] Tab ribbon mancanti");
}
if (!source.includes(`/controllo-gestione/analisi`) || !source.includes(`/controllo-gestione/indici`)) {
  throw new Error("[menu revisione-controllo] Analisi/Indici non esposti");
}
if (!source.includes(redditivitaItem)) {
  throw new Error("[menu revisione-controllo] Redditività Studio non spostata");
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Menu: Revisione + Controllo unificati con ribbon Word-like; Dati contabili separati; Redditività Studio spostata in Studio");
