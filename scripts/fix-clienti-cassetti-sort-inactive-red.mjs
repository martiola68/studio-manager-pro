import fs from "node:fs";

const filePath = "src/pages/clienti/index.tsx";
let source = fs.readFileSync(filePath, "utf8");

if (!source.includes("const cassettiFiscaliOrdinati = useMemo")) {
  const anchor = '  const clientiConCassetto = useMemo(';
  const block = `  const cassettiFiscaliOrdinati = useMemo(
    () =>
      [...cassettiFiscali].sort((a, b) =>
        safeString(a.nominativo)
          .trim()
          .localeCompare(safeString(b.nominativo).trim(), "it", {
            sensitivity: "base",
            numeric: true,
          })
      ),
    [cassettiFiscali]
  );

`;

  if (!source.includes(anchor)) {
    throw new Error("[clienti-fiscal-drawer-sort] anchor clientiConCassetto non trovato");
  }

  source = source.replace(anchor, block + anchor);
}

source = source.replaceAll(
  '{cassettiFiscali.map((cassetto) => (',
  '{cassettiFiscaliOrdinati.map((cassetto) => ('
);

const classBlock = `        className={
          cliente.attivo === true
            ? ""
            : "data-[state=unchecked]:bg-red-600"
        }`;

const styleBlock = `        style={
          cliente.attivo === true
            ? undefined
            : { backgroundColor: "#dc2626" }
        }`;

if (source.includes(classBlock)) {
  source = source.replace(classBlock, styleBlock);
}

if (
  !source.includes('data-client-status-toggle') &&
  !source.includes('backgroundColor: "#dc2626"')
) {
  const bareSwitch = `      <Switch
        checked={cliente.attivo === true}
        onCheckedChange={(checked) =>`;

  const styledSwitch = `      <Switch
        checked={cliente.attivo === true}
        style={
          cliente.attivo === true
            ? undefined
            : { backgroundColor: "#dc2626" }
        }
        onCheckedChange={(checked) =>`;

  if (!source.includes(bareSwitch)) {
    throw new Error("[clienti-inactive-red] controllo stato clienti non trovato");
  }

  source = source.replace(bareSwitch, styledSwitch);
}

if (!source.includes("cassettiFiscaliOrdinati.map")) {
  throw new Error("[clienti-fiscal-drawer-sort] lista ordinata non applicata");
}

fs.writeFileSync(filePath, source, "utf8");
console.log("✓ Clienti: referente cassetto fiscale ordinato + switch inattivo rosso");
