import fs from "node:fs";

const guardPath = "src/components/security/SensitiveDataMasterGuard.tsx";
let guardSource = fs.readFileSync(guardPath, "utf8");

const studioPrefix = `  "/impostazioni/studio",`;
if (!guardSource.includes(studioPrefix)) {
  const guardAnchor = `  "/impostazioni/utenti",`;
  if (!guardSource.includes(guardAnchor)) {
    throw new Error("[master password dati studio] anchor guard non trovato");
  }
  guardSource = guardSource.replace(
    guardAnchor,
    `${studioPrefix}\n${guardAnchor}`
  );
  fs.writeFileSync(guardPath, guardSource, "utf8");
}

const menuPath = "src/components/TopNavBar.tsx";
let menuSource = fs.readFileSync(menuPath, "utf8");

const gestionePasswordItem = `          { label: "Gestione Password", href: "/gestione-password", icon: <KeyRound className="h-4 w-4" />, groupLabel: "Amministrazione" },`;
if (!menuSource.includes(`href: "/gestione-password"`)) {
  const menuAnchor = `          { label: "Modifica Password", href: "/profilo/password", icon: <KeyRound className="h-4 w-4" />, groupLabel: "Amministrazione" },`;
  if (!menuSource.includes(menuAnchor)) {
    throw new Error("[master password dati studio] anchor menu Amministrazione non trovato");
  }
  menuSource = menuSource.replace(
    menuAnchor,
    `${menuAnchor}\n${gestionePasswordItem}`
  );
}

const resolverOld = `      if (pathname?.startsWith("/profilo/password") || pathname?.startsWith("/impostazioni/amministrazione-sistema")) return "Amministrazione";`;
const resolverNew = `      if (pathname?.startsWith("/profilo/password") || pathname?.startsWith("/gestione-password") || pathname?.startsWith("/impostazioni/amministrazione-sistema")) return "Amministrazione";`;

if (!menuSource.includes(resolverNew)) {
  if (!menuSource.includes(resolverOld)) {
    throw new Error("[master password dati studio] resolver Amministrazione non trovato");
  }
  menuSource = menuSource.replace(resolverOld, resolverNew);
}

if (!menuSource.includes(`href: "/gestione-password"`)) {
  throw new Error("[master password dati studio] Gestione Password non inserita nel menu");
}
if (!menuSource.includes(`pathname?.startsWith("/gestione-password")`)) {
  throw new Error("[master password dati studio] resolver Gestione Password non aggiornato");
}

fs.writeFileSync(menuPath, menuSource, "utf8");
console.log("✓ Master Password: Dati Studio protetto e Gestione Password aggiunta in Archivi di base > Amministrazione");
