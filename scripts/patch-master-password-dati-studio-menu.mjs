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
}

// La pagina amministrativa della Master Password deve restare fuori dal gate:
// serve anche per il recupero OTP quando la Master Password è stata dimenticata.
guardSource = guardSource.replace(`  "/gestione-password",\n`, "");
guardSource = guardSource.replace(`  "/impostazioni/master-password",\n`, "");
fs.writeFileSync(guardPath, guardSource, "utf8");

const menuPath = "src/components/TopNavBar.tsx";
let menuSource = fs.readFileSync(menuPath, "utf8");

const legacyItem = `          { label: "Gestione Password", href: "/gestione-password", icon: <KeyRound className="h-4 w-4" />, groupLabel: "Amministrazione" },`;
const masterItem = `          { label: "Gestione Master Password", href: "/impostazioni/master-password", icon: <KeyRound className="h-4 w-4" />, adminOnly: true, groupLabel: "Amministrazione" },`;

if (menuSource.includes(legacyItem)) {
  menuSource = menuSource.replace(legacyItem, masterItem);
} else if (!menuSource.includes(masterItem)) {
  const menuAnchor = `          { label: "Modifica Password", href: "/profilo/password", icon: <KeyRound className="h-4 w-4" />, groupLabel: "Amministrazione" },`;
  if (!menuSource.includes(menuAnchor)) {
    throw new Error("[master password dati studio] anchor menu Amministrazione non trovato");
  }
  menuSource = menuSource.replace(menuAnchor, `${menuAnchor}\n${masterItem}`);
}

const resolverLegacy = `      if (pathname?.startsWith("/profilo/password") || pathname?.startsWith("/gestione-password") || pathname?.startsWith("/impostazioni/amministrazione-sistema")) return "Amministrazione";`;
const resolverOld = `      if (pathname?.startsWith("/profilo/password") || pathname?.startsWith("/impostazioni/amministrazione-sistema")) return "Amministrazione";`;
const resolverNew = `      if (pathname?.startsWith("/profilo/password") || pathname?.startsWith("/gestione-password") || pathname?.startsWith("/impostazioni/master-password") || pathname?.startsWith("/impostazioni/amministrazione-sistema")) return "Amministrazione";`;

if (menuSource.includes(resolverLegacy)) {
  menuSource = menuSource.replace(resolverLegacy, resolverNew);
} else if (menuSource.includes(resolverOld)) {
  menuSource = menuSource.replace(resolverOld, resolverNew);
} else if (!menuSource.includes(resolverNew)) {
  throw new Error("[master password dati studio] resolver Amministrazione non trovato");
}

if (!menuSource.includes(`href: "/impostazioni/master-password"`)) {
  throw new Error("[master password dati studio] Gestione Master Password non inserita nel menu");
}
if (!menuSource.includes(`pathname?.startsWith("/impostazioni/master-password")`)) {
  throw new Error("[master password dati studio] resolver Master Password non aggiornato");
}

fs.writeFileSync(menuPath, menuSource, "utf8");
console.log("✓ Dati Studio protetto; Gestione Master Password disponibile in Archivi di base > Amministrazione");
