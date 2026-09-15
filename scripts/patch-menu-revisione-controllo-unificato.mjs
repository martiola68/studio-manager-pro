import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

function req(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`[menu-ribbon] ${label}`);
  source = source.replace(from, to);
}

req(
  `  systemAdminOnly?: boolean;\n  children?: MenuItem[];`,
  `  systemAdminOnly?: boolean;\n  groupLabel?: string;\n  children?: MenuItem[];`,
  "metadata groupLabel non trovati"
);

req(
  `  const [desktopMenuOpen, setDesktopMenuOpen] = useState<string | null>(null);`,
  `  const [desktopMenuOpen, setDesktopMenuOpen] = useState<string | null>(null);\n  const [desktopRibbonTab, setDesktopRibbonTab] = useState<string | null>(null);`,
  "stato ribbon non trovato"
);

if (!source.includes(`label: "Revisione e controllo"`)) {
  const re = /\n    \{\n      label: "Revisione",[\s\S]*?\n    \},\n    \{\n      label: "Controllo di gestione",[\s\S]*?\n    \},\n    \{\n      label: "Contenzioso",/;
  if (!re.test(source)) throw new Error("[menu-ribbon] Revisione/Controllo non trovati");
  source = source.replace(re, `
    {
      label: "Revisione e controllo",
      icon: <ClipboardCheck className="h-4 w-4" />,
      children: [
        { label: "Revisione legale", icon: <ClipboardCheck className="h-4 w-4" />, children: [
          { label: "Dashboard", href: "/revisione-controllo/dashboard", icon: <BarChart3 className="h-4 w-4" />, groupLabel: "Panoramica" },
          { label: "Incarichi / Fascicoli", href: "/revisione-controllo", icon: <FolderKanban className="h-4 w-4" />, groupLabel: "Pratiche" },
          { label: "Nuova presa in carico", href: "/revisione-controllo/presa-in-carico", icon: <FileText className="h-4 w-4" />, groupLabel: "Pratiche" },
          { label: "Controlli periodici", href: "/revisione-controllo/controlli", icon: <Calendar className="h-4 w-4" />, groupLabel: "Esecuzione" },
          { label: "Carte di lavoro", href: "/revisione-controllo/documenti", icon: <FolderKanban className="h-4 w-4" />, groupLabel: "Esecuzione" },
          { label: "Rilievi / Follow-up", href: "/revisione-controllo/followup", icon: <AlertTriangle className="h-4 w-4" />, groupLabel: "Esecuzione" },
          { label: "Relazioni annuali", href: "/revisione-controllo/relazioni", icon: <FileText className="h-4 w-4" />, groupLabel: "Output" },
          { label: "Modelli relazioni", href: "/revisione-controllo/modelli", icon: <FileText className="h-4 w-4" />, groupLabel: "Output" },
        ]},
        { label: "Controllo di gestione", icon: <BriefcaseBusiness className="h-4 w-4" />, children: [
          { label: "Elenco generale", href: "/controllo-gestione", icon: <FileText className="h-4 w-4" />, groupLabel: "Controlli" },
          { label: "Nuovo controllo", href: "/controllo-gestione/nuovo", icon: <FileText className="h-4 w-4" />, groupLabel: "Controlli" },
          { label: "Analisi", href: "/controllo-gestione/analisi", icon: <BarChart3 className="h-4 w-4" />, groupLabel: "Analisi" },
          { label: "Indici", href: "/controllo-gestione/indici", icon: <BarChart3 className="h-4 w-4" />, groupLabel: "Analisi" },
          { label: "Storico controlli", href: "/controllo-gestione/storico", icon: <Clock className="h-4 w-4" />, groupLabel: "Storico" },
        ]},
        { label: "Dati contabili", icon: <RefreshCcw className="h-4 w-4" />, children: [
          { label: "Importa contabilità", href: "/controllo-gestione/import-contabilita", icon: <RefreshCcw className="h-4 w-4" />, groupLabel: "Acquisizione" },
          { label: "Piano conti e raccordi", href: "/controllo-gestione/piani-conti", icon: <Settings className="h-4 w-4" />, groupLabel: "Raccordi" },
        ]},
      ],
    },
    {
      label: "Contenzioso",`);
}

const helperAnchor = `  const renderMenuItem = (item: MenuItem) => {`;
const helper = `  const resolveRibbonTab = (menuLabel: string) => {
    if (menuLabel === "Studio") {
      if (pathname === "/agenda" || pathname?.startsWith("/contatti")) return "Attività e contatti";
      if (pathname?.startsWith("/promemoria") || pathname?.startsWith("/post-del-giorno")) return "Memo";
      if (pathname?.startsWith("/comunicazioni/interne") || pathname?.startsWith("/comunicazioni-clienti") || pathname?.startsWith("/newsletter")) return "Comunicazione";
      if (pathname?.startsWith("/scadenze")) return "Scadenzario";
      if (pathname?.startsWith("/accesso-portali") || pathname?.startsWith("/cassetti-fiscali")) return "Utilità";
      return "Attività e contatti";
    }
    if (menuLabel === "Archivi di base") {
      if (pathname?.startsWith("/clienti") || pathname?.startsWith("/anagrafiche") || pathname?.startsWith("/antiriciclaggio/rappresentanti") || pathname?.startsWith("/impostazioni/studio")) return "Anagrafiche";
      if (pathname?.startsWith("/microsoft365")) return "Connessioni";
      if (pathname?.startsWith("/impostazioni/utenti") || pathname?.startsWith("/impostazioni/ruoli") || pathname?.startsWith("/impostazioni/prestazioni") || pathname?.startsWith("/impostazioni/payroll-") || pathname?.startsWith("/impostazioni/scadenzari") || pathname?.startsWith("/impostazioni/tipi-scadenze") || pathname?.startsWith("/impostazioni/tipo-promemoria") || pathname?.startsWith("/impostazioni/template-email")) return "Tabelle";
      if (pathname?.startsWith("/profilo/password") || pathname?.startsWith("/impostazioni/amministrazione-sistema")) return "Amministrazione";
      if (pathname?.startsWith("/guide/")) return "Manuali di istruzione";
      return "Anagrafiche";
    }
    if (menuLabel === "Revisione e controllo") {
      if (pathname?.startsWith("/revisione-controllo")) return "Revisione legale";
      if (pathname?.startsWith("/controllo-gestione/import-contabilita") || pathname?.startsWith("/controllo-gestione/piani-conti")) return "Dati contabili";
      if (pathname?.startsWith("/controllo-gestione")) return "Controllo di gestione";
      return "Revisione legale";
    }
    return null;
  };

  const renderMenuItem = (item: MenuItem) => {`;
req(helperAnchor, helper, "renderMenuItem non trovato");

req(
  `          onClick={() => setDesktopMenuOpen(menuOpen ? null : item.label)}`,
  `          onClick={() => {\n            if (menuOpen) { setDesktopMenuOpen(null); return; }\n            setDesktopMenuOpen(item.label);\n            setDesktopRibbonTab(resolveRibbonTab(item.label));\n          }}`,
  "click menu non trovato"
);

const calcStart = source.indexOf(`  const desktopMenuAttivo = menuItems.find((item) => item.label === desktopMenuOpen) || null;`);
const calcEnd = source.indexOf(`\n\n  if (loading) {`, calcStart);
if (calcStart < 0 || calcEnd < 0) throw new Error("[menu-ribbon] calcolo menu non trovato");
const calc = `  const desktopMenuAttivo = menuItems.find((item) => item.label === desktopMenuOpen) || null;
  const ribbonConTabs = Boolean(desktopMenuAttivo && ["Studio", "Archivi di base", "Revisione e controllo"].includes(desktopMenuAttivo.label));
  const desktopRibbonTabs = ribbonConTabs ? desktopMenuAttivo?.children || [] : [];
  const desktopRibbonTabEffettivo = ribbonConTabs ? desktopRibbonTab || resolveRibbonTab(desktopMenuAttivo?.label || "") || desktopRibbonTabs[0]?.label || null : null;
  const desktopRibbonVoceAttiva = ribbonConTabs ? desktopRibbonTabs.find((tab) => tab.label === desktopRibbonTabEffettivo) || null : null;
  const desktopMenuVoci = ribbonConTabs
    ? (desktopRibbonVoceAttiva?.children || []).flatMap((child) => child.children?.length
        ? child.children.map((voce) => ({ ...voce, groupLabel: voce.groupLabel || child.label }))
        : [child])
    : desktopMenuAttivo?.children?.flatMap((child) => child.children?.length ? child.children : [child]) || [];
  const desktopMenuGruppi = ribbonConTabs ? desktopMenuVoci.reduce<Record<string, MenuItem[]>>((acc, voce) => {
    const gruppo = voce.groupLabel || desktopRibbonTabEffettivo || "Funzioni";
    if (!acc[gruppo]) acc[gruppo] = [];
    acc[gruppo].push(voce);
    return acc;
  }, {}) : {};`;
source = source.slice(0, calcStart) + calc + source.slice(calcEnd);

const ribbonStart = `        {desktopMenuAttivo && desktopMenuVoci.length > 0 && (`;
const ribbonEnd = `        )}\n      </div>\n    </nav>`;
const startIndex = source.indexOf(ribbonStart);
const endIndex = source.indexOf(ribbonEnd, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error("[menu-ribbon] blocco ribbon non trovato");

const ribbon = `        {desktopMenuAttivo && desktopMenuVoci.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 border-y border-gray-200 bg-white shadow-lg">
            {ribbonConTabs && (
              <div className="flex items-end gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 px-4 pt-1">
                {desktopRibbonTabs.map((tab) => {
                  const active = tab.label === desktopRibbonTabEffettivo;
                  return <button key={tab.label} type="button" onClick={() => setDesktopRibbonTab(tab.label)} className={cn("flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-semibold xl:text-xs", active ? "border-blue-600 bg-white text-blue-700" : "border-transparent text-gray-600 hover:bg-white hover:text-blue-700")}><span className="[&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span><span>{tab.label}</span></button>;
                })}
              </div>
            )}
            {ribbonConTabs ? (
              <div className="flex min-h-[82px] w-full flex-row flex-nowrap items-stretch overflow-x-auto px-2 py-1.5">
                {Object.entries(desktopMenuGruppi).map(([gruppo, voci]) => (
                  <div key={gruppo} className="relative flex shrink-0 items-start border-r border-gray-200 px-1.5 pb-4 last:border-r-0">
                    <div className="flex items-start">
                      {voci.map((voce) => {
                        const active = isActive(voce);
                        const riservata = (voce.adminOnly && currentUser?.tipo_utente !== "Admin") || (voce.systemAdminOnly && !currentUser?.amministratore_sistema_generale);
                        const pdf = !!voce.href?.toLowerCase().endsWith(".pdf");
                        return <Link key={voce.label} href={riservata ? "#" : voce.href || "#"} target={pdf ? "_blank" : undefined} rel={pdf ? "noopener noreferrer" : undefined} onClick={(e) => { if (riservata) { e.preventDefault(); return; } if (voce.label === "Promemoria") handlePromemoriaClick(); setDesktopMenuOpen(null); }} className={cn("relative flex min-h-[58px] min-w-[82px] max-w-[110px] flex-col items-center justify-center gap-1 rounded px-2 py-1 text-center text-[10px] font-medium leading-tight xl:min-w-[92px] xl:text-[11px]", riservata ? "cursor-not-allowed bg-gray-50 text-gray-400 opacity-70" : active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-blue-50 hover:text-blue-700")}><span className={cn("flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5", riservata ? "text-gray-400" : "text-blue-600")}>{voce.icon}</span><span>{voce.label}</span></Link>;
                      })}
                    </div>
                    <span className="absolute bottom-0 left-1.5 right-1.5 truncate border-t border-gray-100 pt-0.5 text-center text-[9px] font-medium text-gray-400">{gruppo}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex w-full flex-row flex-nowrap items-stretch justify-start gap-0 px-4 py-2">
                {desktopMenuVoci.map((voce) => {
                  const active = isActive(voce);
                  const riservata = (voce.adminOnly && currentUser?.tipo_utente !== "Admin") || (voce.systemAdminOnly && !currentUser?.amministratore_sistema_generale);
                  const pdf = !!voce.href?.toLowerCase().endsWith(".pdf");
                  return <Link key={voce.label} href={riservata ? "#" : voce.href || "#"} target={pdf ? "_blank" : undefined} rel={pdf ? "noopener noreferrer" : undefined} onClick={(e) => { if (riservata) { e.preventDefault(); return; } setDesktopMenuOpen(null); }} className={cn("flex min-h-[72px] min-w-[96px] max-w-[120px] flex-col items-center justify-center gap-1.5 border-r border-gray-100 px-3 py-2 text-center text-[11px] font-medium leading-tight", riservata ? "cursor-not-allowed bg-gray-50 text-gray-400 opacity-70" : active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-blue-50 hover:text-blue-700")}><span className={cn("flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5", riservata ? "text-gray-400" : "text-blue-600")}>{voce.icon}</span><span>{voce.label}</span></Link>;
                })}
              </div>
            )}
          </div>
        )}`;
source = source.slice(0, startIndex) + ribbon + source.slice(endIndex + `        )}`.length);

if (!source.includes(`label: "Revisione e controllo"`) || !source.includes(`const ribbonConTabs = Boolean(`)) throw new Error("[menu-ribbon] verifica finale fallita");
fs.writeFileSync(path, source, "utf8");
console.log("✓ Ribbon unificato per Studio, Archivi di base e Revisione/Controllo");
