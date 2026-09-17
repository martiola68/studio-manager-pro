import fs from "node:fs";

const path = "src/components/TopNavBar.tsx";
let source = fs.readFileSync(path, "utf8");

source = source.replace(
  `{ label: "Utilità", icon: <Key className="h-4 w-4" />, children: [`,
  `{ label: "Accessi telematici", icon: <Key className="h-4 w-4" />, children: [`
);

source = source.replaceAll(`groupLabel: "Utilità"`, `groupLabel: "Accessi telematici"`);
source = source.replace(
  `if (pathname?.startsWith("/accesso-portali") || pathname?.startsWith("/cassetti-fiscali")) return "Utilità";`,
  `if (pathname?.startsWith("/accesso-portali") || pathname?.startsWith("/cassetti-fiscali")) return "Accessi telematici";`
);

if (!source.includes(`label: "Accessi telematici"`)) {
  throw new Error("[accessi telematici] voce menu non rinominata");
}
if (!source.includes(`return "Accessi telematici";`)) {
  throw new Error("[accessi telematici] resolver ribbon non aggiornato");
}
if (source.includes(`label: "Utilità"`)) {
  throw new Error("[accessi telematici] vecchia etichetta Utilità ancora presente");
}

fs.writeFileSync(path, source, "utf8");
console.log("✓ Operatività: Utilità rinominato in Accessi telematici");
