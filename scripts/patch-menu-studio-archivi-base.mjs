import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

const prefixRegex = /  const menuItems: MenuItem\[] = \[\n[\s\S]*?\n    \{\n      label: "Pratiche",/;
if (!prefixRegex.test(source)) throw new Error("[menu studio-archivi] prefisso menu non trovato");

const prefix = `  const menuItems: MenuItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, href: "/dashboard" },
    {
      label: "Studio",
      icon: <BriefcaseBusiness className="h-4 w-4" />,
      children: [
        { label: "Attività e contatti", icon: <Calendar className="h-4 w-4" />, children: [
          { label: "Agenda", href: "/agenda", icon: <Calendar className="h-4 w-4" />, groupLabel: "Attività e contatti" },
          { label: "Rubrica", href: "/contatti", icon: <UserCircle className="h-4 w-4" />, groupLabel: "Attività e contatti" },
        ]},
        { label: "Memo", icon: <StickyNote className="h-4 w-4" />, children: [
          { label: "Promemoria", href: "/promemoria", icon: <FileText className="h-4 w-4" />, groupLabel: "Memo" },
          { label: "Post del giorno", href: "/post-del-giorno", icon: <StickyNote className="h-4 w-4" />, groupLabel: "Memo" },
        ]},
        { label: "Comunicazione", icon: <Mail className="h-4 w-4" />, children: [
          { label: "E-mail interne", href: "/comunicazioni/interne", icon: <MessageSquare className="h-4 w-4" />, groupLabel: "Comunicazione" },
          { label: "E-mail clienti", href: "/comunicazioni-clienti", icon: <Mail className="h-4 w-4" />, groupLabel: "Comunicazione" },
          { label: "Newsletter", href: "/newsletter", icon: <Mail className="h-4 w-4" />, groupLabel: "Comunicazione" },
        ]},
        { label: "Scadenzario", icon: <Calendar className="h-4 w-4" />, children: [
          { label: "Gestione scadenze", icon: <Calendar className="h-4 w-4" />, children: [
            { label: "Scadenze unificate", href: "/scadenze", icon: <Calendar className="h-4 w-4" />, groupLabel: "Gestione scadenze" },
            { label: "Elenco generale", href: "/scadenze/elenco-generale", icon: <FileText className="h-4 w-4" />, groupLabel: "Gestione scadenze" },
            { label: "Calendario", href: "/scadenze/calendario", icon: <Calendar className="h-4 w-4" />, groupLabel: "Gestione scadenze" },
            { label: "Riepilogo", href: "/scadenze/riepilogo", icon: <FileText className="h-4 w-4" />, groupLabel: "Gestione scadenze" },
          ]},
          { label: "Scadenzari", icon: <FileText className="h-4 w-4" />, children: [
            { label: "IVA", href: "/scadenze/iva", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "CCGG", href: "/scadenze/ccgg", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "CU", href: "/scadenze/cu", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "IMU", href: "/scadenze/imu", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "Fiscali", href: "/scadenze/fiscali", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "Bilanci", href: "/scadenze/bilanci", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "770", href: "/scadenze/modello-770", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "Liquidazioni IVA - LIPE", href: "/scadenze/lipe", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "Esterometro", href: "/scadenze/esterometro", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
            { label: "Affitti", href: "/scadenze/affitti", icon: <FileText className="h-4 w-4" />, groupLabel: "Tutti gli scadenzari" },
          ]},
        ]},
        { label: "Utilità", icon: <Key className="h-4 w-4" />, children: [
          { label: "Accesso ai portali", href: "/accesso-portali", icon: <Key className="h-4 w-4" />, groupLabel: "Utilità" },
          { label: "Cassetti fiscali", href: "/cassetti-fiscali", icon: <FileText className="h-4 w-4" />, groupLabel: "Utilità" },
        ]},
      ],
    },
    {
      label: "Archivi di base",
      icon: <Users className="h-4 w-4" />,
      children: [
        { label: "Anagrafiche", icon: <Users className="h-4 w-4" />, children: [
          { label: "Nominativi", href: "/clienti", icon: <Users className="h-4 w-4" />, groupLabel: "Anagrafiche" },
          { label: "Soci e organi sociali", href: "/clienti/organi-sociali", icon: <UserCircle className="h-4 w-4" />, groupLabel: "Anagrafiche" },
          { label: "Gruppi societari", href: "/anagrafiche/gruppi-societari", icon: <Network className="h-4 w-4" />, groupLabel: "Anagrafiche" },
          { label: "Rappresentanti legali", href: "/antiriciclaggio/rappresentanti", icon: <UserCircle className="h-4 w-4" />, groupLabel: "Anagrafiche" },
          { label: "Dati Studio", href: "/impostazioni/studio", icon: <Building2 className="h-4 w-4" />, adminOnly: true, groupLabel: "Anagrafiche" },
        ]},
        { label: "Connessioni", icon: <Cloud className="h-4 w-4" />, children: [
          { label: "Microsoft connessioni", href: "/microsoft365?tab=connessioni", icon: <Link2 className="h-4 w-4" />, groupLabel: "Connessioni" },
          { label: "Microsoft Sync", href: "/microsoft365?tab=sync", icon: <RefreshCcw className="h-4 w-4" />, groupLabel: "Connessioni" },
        ]},
        { label: "Tabelle", icon: <Settings className="h-4 w-4" />, children: [
          { label: "Utenti", href: "/impostazioni/utenti", icon: <Users className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
          { label: "Ruoli", href: "/impostazioni/ruoli", icon: <Settings className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
          { label: "Prestazioni", href: "/impostazioni/prestazioni", icon: <Settings className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
          { label: "Payroll Festività", href: "/impostazioni/payroll-festivita", icon: <Calendar className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
          { label: "Payroll Codici Presenza", href: "/impostazioni/payroll-codici-presenza", icon: <Clock className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
          { label: "Elaborazioni scadenzari", href: "/impostazioni/scadenzari", icon: <Settings className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
          { label: "Tipi Scadenze", href: "/impostazioni/tipi-scadenze", icon: <Settings className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
          { label: "Tipo Promemoria", href: "/impostazioni/tipo-promemoria", icon: <Settings className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
          { label: "Template Email", href: "/impostazioni/template-email", icon: <Mail className="h-4 w-4" />, adminOnly: true, groupLabel: "Tabelle" },
        ]},
        { label: "Amministrazione", icon: <ShieldCheck className="h-4 w-4" />, children: [
          { label: "Modifica Password", href: "/profilo/password", icon: <KeyRound className="h-4 w-4" />, groupLabel: "Amministrazione" },
          { label: "Amministrazione di sistema", href: "/impostazioni/amministrazione-sistema", icon: <ShieldCheck className="h-4 w-4" />, systemAdminOnly: true, groupLabel: "Amministrazione" },
        ]},
        { label: "Manuali di istruzione", icon: <BookOpen className="h-4 w-4" />, children: [
          { label: "Agenda", href: "/guide/Manuale_Agenda_SMP.pdf", icon: <Calendar className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Promemoria", href: "/guide/Manuale_Promemoria_SMP.pdf", icon: <FileText className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Scadenzario", href: "/guide/Manuale_Scadenzario_SMP.pdf", icon: <Calendar className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Pratiche", href: "/guide/Manuale_Pratiche_SMP.pdf", icon: <FolderKanban className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Revisione e Controllo", href: "/guide/Manuale_Revisione_e_Controllo_SMP.pdf", icon: <ClipboardCheck className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Controllo di Gestione", href: "/guide/Manuale_Controllo_di_Gestione_SMP.pdf", icon: <BriefcaseBusiness className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Redditività Studio", href: "/guide/redditivita-studio", icon: <BarChart3 className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Contenzioso", href: "/guide/Manuale_Contenzioso_SMP.pdf", icon: <Scale className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Antiriciclaggio", href: "/guide/Manuale_Antiriciclaggio_SMP.pdf", icon: <ShieldCheck className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Payroll", href: "/guide/Manuale_Payroll_SMP.pdf", icon: <Clock className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Anagrafiche", href: "/guide/Manuale_Anagrafiche_SMP.pdf", icon: <Users className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Microsoft 365", href: "/guide/Manuale_Operativo_Microsoft_365_SMP.pdf", icon: <Cloud className="h-4 w-4" />, groupLabel: "Manuali" },
          { label: "Configurazione", href: "/guide/Manuale_Generale_Configurazione_SMP.pdf", icon: <Settings className="h-4 w-4" />, groupLabel: "Manuali" },
        ]},
      ],
    },
    {
      label: "Pratiche",`;

source = source.replace(prefixRegex, prefix);

const legacyTail = /\n    \{\n      label: "Anagrafiche",[\s\S]*?\n    \},\n    \{\n      label: "Strumenti",[\s\S]*?\n    \},\n    \{\n      label: "Manuali di istruzioni",[\s\S]*?\n    \},(?=\n  \];)/;
if (!legacyTail.test(source)) throw new Error("[menu studio-archivi] vecchi menu finali non trovati");
source = source.replace(legacyTail, "");

for (const marker of [
  `label: "Archivi di base"`,
  `label: "Attività e contatti"`,
  `label: "Memo"`,
  `label: "Comunicazione"`,
  `label: "Gestione scadenze"`,
  `label: "Scadenzari"`,
  `label: "Utilità"`,
  `label: "Tabelle"`,
  `label: "Amministrazione"`,
  `label: "Manuali di istruzione"`,
]) if (!source.includes(marker)) throw new Error(`[menu studio-archivi] marker mancante: ${marker}`);

fs.writeFileSync(path, source, "utf8");
console.log("✓ Struttura menu: Studio e Archivi di base compattati; Agenda/Promemoria/Scadenzario/Anagrafiche/Strumenti/Manuali rimossi dalla barra principale");
